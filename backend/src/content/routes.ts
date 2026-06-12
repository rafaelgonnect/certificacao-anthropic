import { Router } from "express";
import { prisma } from "../db.js";
export const contentRoutes = Router();
contentRoutes.get("/certifications", async (_req, res) => {
  const certs = await prisma.certification.findMany({
    select: { id: true, slug: true, title: true, description: true, version: true },
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
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: "not found" });
  res.json(lesson);
});
