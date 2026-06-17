import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword, comparePassword } from "./password.js";
import { signToken } from "./jwt.js";
import { requireAuth } from "./middleware.js";
import { loadEnv } from "../env.js";

export const authRoutes = Router();

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  onboardedAt: Date | null;
  targetCertSlug: string | null;
  experienceLevel: string | null;
  dailyGoalMin: number | null;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    onboarded: u.onboardedAt !== null,
    targetCertSlug: u.targetCertSlug,
    experienceLevel: u.experienceLevel,
    dailyGoalMin: u.dailyGoalMin,
  };
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

// Cadastro: cria a conta como PENDENTE (sem token). O usuário só entra após a
// liberação de um admin/gestor.
authRoutes.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const { email, password, name } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "email in use" });
  await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password), status: "pending" },
  });
  res.status(201).json({ pending: true });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRoutes.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  if (user.status === "pending") {
    return res
      .status(403)
      .json({ error: "Sua conta ainda está aguardando liberação do administrador." });
  }
  if (user.status === "blocked") {
    return res.status(403).json({ error: "Sua conta está bloqueada. Fale com o administrador." });
  }
  const token = signToken({ sub: user.id, role: user.role }, loadEnv().JWT_SECRET);
  res.json({ token, user: publicUser(user) });
});

authRoutes.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: "not found" });
  res.json(publicUser(user));
});

// Marca o onboarding como concluído.
authRoutes.post("/onboarded", requireAuth, async (req, res) => {
  await prisma.user.update({ where: { id: req.user!.sub }, data: { onboardedAt: new Date() } });
  res.json({ ok: true });
});

const onboardingSchema = z.object({
  targetCertSlug: z.string().min(1).optional(),
  experienceLevel: z.enum(["iniciante", "intermediario", "avancado"]).optional(),
  dailyGoalMin: z.number().int().min(1).max(120).optional(),
  startupName: z.string().min(1).max(40).optional(),
});

// Conclui o onboarding salvando o perfil; se houver startupName + cert, nomeia a empresa do jogo.
authRoutes.post("/onboarding", requireAuth, async (req, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const { targetCertSlug, experienceLevel, dailyGoalMin, startupName } = parsed.data;

  const user = await prisma.user.update({
    where: { id: req.user!.sub },
    data: { onboardedAt: new Date(), targetCertSlug, experienceLevel, dailyGoalMin },
  });

  if (startupName && targetCertSlug) {
    await prisma.company.upsert({
      where: { userId_certSlug: { userId: user.id, certSlug: targetCertSlug } },
      update: { name: startupName },
      create: { userId: user.id, certSlug: targetCertSlug, name: startupName },
    });
  }

  res.json(publicUser(user));
});

// Reseta o onboarding (volta o usuário para /bem-vindo) — útil para testar o fluxo.
authRoutes.post("/onboarding/reset", requireAuth, async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user!.sub },
    data: { onboardedAt: null },
  });
  res.json(publicUser(user));
});
