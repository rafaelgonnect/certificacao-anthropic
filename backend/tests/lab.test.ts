import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { prisma } from "../src/db.js";
import { signToken } from "../src/auth/jwt.js";
import { loadEnv } from "../src/env.js";

const app = createApp();
let alunoToken = "";
let labId = "";
let lessonId = "";
const certSlug = "lab-test-cert";

async function reset() {
  await prisma.lab.deleteMany();
  await prisma.question.deleteMany();
  await prisma.flashcard.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.certification.deleteMany({ where: { slug: certSlug } });
  await prisma.user.deleteMany({ where: { email: "lab.aluno@test.dev" } });
}

beforeAll(async () => {
  await reset();
  // garante que a IA está desabilitada para o teste de auto-avaliação
  delete process.env.ANTHROPIC_API_KEY;

  const aluno = await prisma.user.create({
    data: { email: "lab.aluno@test.dev", name: "Aluno", role: "aluno", passwordHash: "x" },
  });
  alunoToken = signToken({ sub: aluno.id, role: aluno.role }, loadEnv().JWT_SECRET);

  const cert = await prisma.certification.create({
    data: {
      slug: certSlug,
      title: "Lab Test",
      description: "Teste de labs",
      modules: {
        create: { order: 1, title: "API", lessons: { create: { order: 1, title: "API", readingMd: "# API" } } },
      },
    },
    include: { modules: { include: { lessons: true } } },
  });
  lessonId = cert.modules[0].lessons[0].id;

  const lab = await prisma.lab.create({
    data: {
      lessonId,
      title: "Primeira chamada à Claude API",
      promptMd: "Escreva uma requisição mínima.",
      rubric: ["Especifica o model", "Define max_tokens"],
      modelAnswer: "client.messages.create({ model, max_tokens: 1024, messages })",
    },
  });
  labId = lab.id;
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

const auth = (r: request.Test, token: string) => r.set("authorization", `Bearer ${token}`);

describe("lab routes", () => {
  it("exige autenticação", async () => {
    const res = await request(app).get(`/labs/${labId}`);
    expect(res.status).toBe(401);
  });

  it("GET /labs/:id esconde a resposta-modelo", async () => {
    const res = await auth(request(app).get(`/labs/${labId}`), alunoToken);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(labId);
    expect(res.body.title).toBeDefined();
    expect(res.body.promptMd).toBeDefined();
    expect(res.body.rubric).toEqual(["Especifica o model", "Define max_tokens"]);
    expect(res.body.modelAnswer).toBeUndefined();
  });

  it("POST /labs/:id/submit sem API key retorna modo self + resposta-modelo", async () => {
    const res = await auth(request(app).post(`/labs/${labId}/submit`), alunoToken).send({
      submission: "minha tentativa",
    });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("self");
    expect(res.body.feedback).toContain("rubrica");
    expect(res.body.rubric).toEqual(["Especifica o model", "Define max_tokens"]);
    expect(res.body.modelAnswer).toBeDefined();
  });

  it("GET /lessons/:id/labs lista os labs da lição", async () => {
    const res = await auth(request(app).get(`/lessons/${lessonId}/labs`), alunoToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(labId);
    expect(res.body[0].title).toBeDefined();
    expect((res.body[0] as any).modelAnswer).toBeUndefined();
  });
});
