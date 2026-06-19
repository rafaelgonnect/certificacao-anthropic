import { Router } from "express";
import { prisma } from "../db.js";
export const contentRoutes = Router();
contentRoutes.get("/certifications", async (_req, res) => {
  const certs = await prisma.certification.findMany({
    select: { id: true, slug: true, title: true, description: true, version: true, level: true },
    orderBy: { title: "asc" },
  });
  res.json(certs);
});
contentRoutes.get("/certifications/:slug", async (req, res) => {
  const cert = await prisma.certification.findUnique({
    where: { slug: req.params.slug },
    include: { modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" }, select: { id: true, order: true, title: true } } } } },
  });
  if (!cert) return res.status(404).json({ error: "not found" });
  res.json(cert);
});
contentRoutes.get("/lessons/:id", async (req, res) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: req.params.id },
    include: { module: { select: { certId: true, cert: { select: { slug: true } } } } },
  });
  if (!lesson) return res.status(404).json({ error: "not found" });

  // lista ordenada de TODAS as lições da trilha (módulos por ordem, lições por ordem)
  // para descobrir a posição e as lições anterior/próxima.
  const cert = await prisma.certification.findUnique({
    where: { id: lesson.module.certId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" }, select: { id: true, title: true } } },
      },
    },
  });
  const flat = cert ? cert.modules.flatMap((m) => m.lessons) : [];
  const idx = flat.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  res.json({
    id: lesson.id,
    title: lesson.title,
    readingMd: lesson.readingMd,
    certSlug: lesson.module.cert.slug,
    position: idx + 1,
    total: flat.length,
    prev: prev ? { id: prev.id, title: prev.title } : null,
    next: next ? { id: next.id, title: next.title } : null,
  });
});
