import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword, comparePassword } from "./password.js";
import { signToken } from "./jwt.js";
import { requireAuth } from "./middleware.js";
import { loadEnv } from "../env.js";
export const authRoutes = Router();
const registerSchema = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(1) });
authRoutes.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const { email, password, name } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "email in use" });
  const user = await prisma.user.create({ data: { email, name, passwordHash: await hashPassword(password) } });
  const token = signToken({ sub: user.id, role: user.role }, loadEnv().JWT_SECRET);
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});
const loginSchema = z.object({ email: z.string().email(), password: z.string() });
authRoutes.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: "invalid credentials" });
  const token = signToken({ sub: user.id, role: user.role }, loadEnv().JWT_SECRET);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});
authRoutes.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: "not found" });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});
