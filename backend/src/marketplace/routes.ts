import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { materialize, marketplaceDiag, MARKETPLACE_NAME, REPO_NAME } from "./materialize.js";
import { ensureToken, rotateToken } from "./tokens.js";

export const marketplaceRoutes = Router();

const admin = [requireAuth, requireRole("admin")] as const;
const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use kebab-case (ex: minha-skill)");

// ───────────────────────── Catálogo (qualquer usuário logado) ─────────────────

// GET /marketplace/plugins → pacotes publicados (visão de catálogo)
marketplaceRoutes.get("/marketplace/plugins", requireAuth, async (_req, res) => {
  const plugins = await prisma.plugin.findMany({
    where: { published: true },
    orderBy: { displayName: "asc" },
    include: { skills: { select: { slug: true }, orderBy: { slug: "asc" } } },
  });
  res.json(
    plugins.map((p) => ({
      slug: p.slug,
      displayName: p.displayName,
      description: p.description,
      version: p.version,
      category: p.category,
      keywords: p.keywords,
      author: p.author,
      skills: p.skills.map((s) => s.slug),
    })),
  );
});

// GET /marketplace/install-info → dados para o frontend montar os comandos
marketplaceRoutes.get("/marketplace/install-info", requireAuth, async (req, res) => {
  const token = await ensureToken(req.user!.sub);
  res.json({
    marketplaceName: MARKETPLACE_NAME,
    // URL relativa; o frontend prefixa com window.location.origin.
    repoPath: `/git/m/${token.token}/${REPO_NAME}`,
  });
});

// POST /marketplace/token/regenerate → rotaciona o token do usuário
marketplaceRoutes.post("/marketplace/token/regenerate", requireAuth, async (req, res) => {
  const token = await rotateToken(req.user!.sub);
  res.json({ repoPath: `/git/m/${token.token}/${REPO_NAME}` });
});

// ───────────────────────────── Admin (CRUD) ───────────────────────────────────

// GET /admin/plugins → lista completa (com contagem de skills)
marketplaceRoutes.get("/admin/plugins", ...admin, async (_req, res) => {
  const plugins = await prisma.plugin.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { skills: true } } },
  });
  res.json(
    plugins.map((p) => ({
      id: p.id,
      slug: p.slug,
      displayName: p.displayName,
      description: p.description,
      version: p.version,
      category: p.category,
      keywords: p.keywords,
      author: p.author,
      published: p.published,
      skillCount: p._count.skills,
      updatedAt: p.updatedAt,
    })),
  );
});

const pluginSchema = z.object({
  slug,
  displayName: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1).default("0.1.0"),
  category: z.string().nullish(),
  keywords: z.array(z.string()).default([]),
  author: z.string().nullish(),
  published: z.boolean().default(false),
});

// POST /admin/plugins → cria pacote
marketplaceRoutes.post("/admin/plugins", ...admin, async (req, res) => {
  const parsed = pluginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid body" });
  const exists = await prisma.plugin.findUnique({ where: { slug: parsed.data.slug } });
  if (exists) return res.status(409).json({ error: "slug já existe" });
  const p = await prisma.plugin.create({ data: { ...parsed.data, category: parsed.data.category ?? null, author: parsed.data.author ?? null } });
  res.status(201).json({ id: p.id });
});

// GET /admin/plugins/:id → detalhe com skills
marketplaceRoutes.get("/admin/plugins/:id", ...admin, async (req, res) => {
  const p = await prisma.plugin.findUnique({
    where: { id: req.params.id },
    include: { skills: { orderBy: { slug: "asc" } } },
  });
  if (!p) return res.status(404).json({ error: "not found" });
  res.json(p);
});

// PUT /admin/plugins/:id → atualiza metadados
marketplaceRoutes.put("/admin/plugins/:id", ...admin, async (req, res) => {
  const parsed = pluginSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid body" });
  const p = await prisma.plugin.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: "not found" });
  if (parsed.data.slug && parsed.data.slug !== p.slug) {
    const clash = await prisma.plugin.findUnique({ where: { slug: parsed.data.slug } });
    if (clash) return res.status(409).json({ error: "slug já existe" });
  }
  await prisma.plugin.update({ where: { id: p.id }, data: parsed.data });
  res.json({ ok: true });
});

// DELETE /admin/plugins/:id
marketplaceRoutes.delete("/admin/plugins/:id", ...admin, async (req, res) => {
  const p = await prisma.plugin.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: "not found" });
  await prisma.plugin.delete({ where: { id: p.id } });
  res.json({ ok: true });
});

const skillSchema = z.object({ slug, skillMd: z.string().min(1) });

// POST /admin/plugins/:id/skills → adiciona skill
marketplaceRoutes.post("/admin/plugins/:id/skills", ...admin, async (req, res) => {
  const parsed = skillSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid body" });
  const p = await prisma.plugin.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: "not found" });
  const clash = await prisma.pluginSkill.findUnique({ where: { pluginId_slug: { pluginId: p.id, slug: parsed.data.slug } } });
  if (clash) return res.status(409).json({ error: "skill com esse slug já existe no pacote" });
  const s = await prisma.pluginSkill.create({ data: { pluginId: p.id, ...parsed.data } });
  res.status(201).json({ id: s.id });
});

// PUT /admin/plugins/:id/skills/:skillId → atualiza skill
marketplaceRoutes.put("/admin/plugins/:id/skills/:skillId", ...admin, async (req, res) => {
  const parsed = skillSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid body" });
  const s = await prisma.pluginSkill.findUnique({ where: { id: req.params.skillId } });
  if (!s || s.pluginId !== req.params.id) return res.status(404).json({ error: "not found" });
  await prisma.pluginSkill.update({ where: { id: s.id }, data: parsed.data });
  res.json({ ok: true });
});

// DELETE /admin/plugins/:id/skills/:skillId
marketplaceRoutes.delete("/admin/plugins/:id/skills/:skillId", ...admin, async (req, res) => {
  const s = await prisma.pluginSkill.findUnique({ where: { id: req.params.skillId } });
  if (!s || s.pluginId !== req.params.id) return res.status(404).json({ error: "not found" });
  await prisma.pluginSkill.delete({ where: { id: s.id } });
  res.json({ ok: true });
});

// GET /admin/marketplace/diag → diagnóstico do serving git
marketplaceRoutes.get("/admin/marketplace/diag", ...admin, async (_req, res) => {
  res.json(marketplaceDiag());
});

// POST /admin/marketplace/publish → regenera o repo git a partir do banco
marketplaceRoutes.post("/admin/marketplace/publish", ...admin, async (_req, res) => {
  try {
    await materialize();
    res.json({ ok: true });
  } catch (e) {
    console.error("publish/materialize falhou:", e);
    res.status(500).json({ error: "falha ao publicar (git)" });
  }
});
