import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { computeMastery, type AttemptLite, type MasteryMap } from "../learning/mastery.js";

export const adminRoutes = Router();

// Painel do gestor: autenticado e restrito a gestor/admin.
// Escopado a "/admin" (não no nível do router) porque este router é montado em
// "/api" e "/" junto com outros: um guard global responderia 403 e impediria que
// requisições de outras rotas (ex.: /api/game/*) caíssem nos routers seguintes.
adminRoutes.use("/admin", requireAuth, requireRole("gestor", "admin"));

// GET /admin/users → lista de usuários (pendentes primeiro) para aprovação
adminRoutes.get("/admin/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  res.json(users);
});

// PATCH /admin/users/:id/status → libera/bloqueia uma conta
const statusSchema = z.object({ status: z.enum(["pending", "active", "blocked"]) });
adminRoutes.patch("/admin/users/:id/status", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "not found" });
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  });
  res.json(updated);
});

// GET /admin/overview → visão da turma (alunos): tentativas, média dos simulados e domínio por tema
adminRoutes.get("/admin/overview", async (_req, res) => {
  const students = await prisma.user.findMany({
    where: { role: "aluno" },
    select: {
      id: true,
      name: true,
      email: true,
      attempts: { select: { correct: true, createdAt: true, question: { select: { tags: true } } } },
      examSessions: { select: { scorePct: true, finishedAt: true } },
    },
  });

  const out = students.map((s) => {
    const lite: AttemptLite[] = s.attempts.map((a) => ({
      tags: a.question.tags,
      correct: a.correct,
      createdAt: a.createdAt,
    }));
    const mastery = computeMastery(lite);
    const finished = s.examSessions.filter((e) => e.finishedAt !== null);
    const avgScore =
      finished.length === 0
        ? 0
        : finished.reduce((sum, e) => sum + e.scorePct, 0) / finished.length;
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      attempts: s.attempts.length,
      avgScore,
      mastery,
    };
  });

  // média de domínio por tema na turma (média das masteries dos alunos que têm o tema)
  const acc = new Map<string, { sum: number; count: number }>();
  for (const s of out) {
    for (const [tag, m] of Object.entries(s.mastery as MasteryMap)) {
      const a = acc.get(tag) ?? { sum: 0, count: 0 };
      a.sum += m.mastery;
      a.count += 1;
      acc.set(tag, a);
    }
  }
  const topicAverages: Record<string, number> = {};
  for (const [tag, a] of acc) topicAverages[tag] = a.sum / a.count;

  res.json({ students: out, topicAverages });
});
