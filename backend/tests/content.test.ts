import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { prisma } from "../src/db.js";
const app = createApp();
let lessonId = "";
beforeAll(async () => {
  await prisma.lesson.deleteMany(); await prisma.module.deleteMany(); await prisma.certification.deleteMany();
  const cert = await prisma.certification.create({
    data: { slug: "cca-foundations", title: "Claude Certified Architect – Foundations", description: "Teste",
      modules: { create: { order: 1, title: "Claude API", lessons: { create: { order: 1, title: "Intro", readingMd: "# Olá" } } } } },
    include: { modules: { include: { lessons: true } } },
  });
  lessonId = cert.modules[0].lessons[0].id;
});
afterAll(async () => { await prisma.lesson.deleteMany(); await prisma.module.deleteMany(); await prisma.certification.deleteMany(); await prisma.$disconnect(); });
describe("content routes", () => {
  it("lista certificações", async () => {
    const res = await request(app).get("/certifications");
    expect(res.status).toBe(200);
    expect(res.body.some((c: any) => c.slug === "cca-foundations")).toBe(true);
  });
  it("retorna a trilha por slug", async () => {
    const res = await request(app).get("/certifications/cca-foundations");
    expect(res.status).toBe(200);
    expect(res.body.modules[0].title).toBe("Claude API");
    expect(res.body.modules[0].lessons[0].title).toBe("Intro");
    expect(res.body.modules[0].lessons[0].readingMd).toBeUndefined();
  });
  it("retorna uma lição com markdown", async () => {
    const res = await request(app).get(`/lessons/${lessonId}`);
    expect(res.status).toBe(200);
    expect(res.body.readingMd).toBe("# Olá");
  });
  it("404 para lição inexistente", async () => {
    const res = await request(app).get("/lessons/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});
