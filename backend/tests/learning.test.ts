import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { prisma } from "../src/db.js";
import { signToken } from "../src/auth/jwt.js";
import { loadEnv } from "../src/env.js";

const app = createApp();
let token = "";
let flashcardId = "";
let questionId = "";
let correctIndex = 0;

async function reset() {
  await prisma.attempt.deleteMany();
  await prisma.reviewState.deleteMany();
  await prisma.flashcard.deleteMany();
  await prisma.question.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.certification.deleteMany();
  await prisma.user.deleteMany({ where: { email: "learner@test.dev" } });
}

beforeAll(async () => {
  await reset();
  const user = await prisma.user.create({
    data: { email: "learner@test.dev", name: "Learner", passwordHash: "x" },
  });
  token = signToken({ sub: user.id, role: user.role }, loadEnv().JWT_SECRET);

  const cert = await prisma.certification.create({
    data: {
      slug: "cca-foundations",
      title: "Foundations",
      description: "Teste",
      modules: {
        create: {
          order: 1,
          title: "Claude API",
          lessons: { create: { order: 1, title: "Intro", readingMd: "# Olá" } },
        },
      },
    },
    include: { modules: { include: { lessons: true } } },
  });
  const lessonId = cert.modules[0].lessons[0].id;

  const flashcard = await prisma.flashcard.create({
    data: { lessonId, front: "Parâmetro que limita a resposta?", back: "max_tokens", tags: ["api"] },
  });
  flashcardId = flashcard.id;

  correctIndex = 1;
  const question = await prisma.question.create({
    data: {
      lessonId,
      prompt: "Qual protocolo conecta o Claude a ferramentas externas?",
      options: ["REST", "MCP", "GraphQL", "gRPC"],
      correctIndex,
      explanation: "MCP é o protocolo aberto.",
      difficulty: 1,
      tags: ["mcp"],
    },
  });
  questionId = question.id;
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

const auth = (r: request.Test) => r.set("authorization", `Bearer ${token}`);

describe("learning routes", () => {
  it("exige autenticação", async () => {
    const res = await request(app).get("/reviews/due");
    expect(res.status).toBe(401);
  });

  it("retorna a carta nova como devida", async () => {
    const res = await auth(request(app).get("/reviews/due"));
    expect(res.status).toBe(200);
    expect(res.body.some((c: any) => c.id === flashcardId)).toBe(true);
    const card = res.body.find((c: any) => c.id === flashcardId);
    expect(card.front).toBeDefined();
    expect(card.back).toBe("max_tokens");
  });

  it("avaliar a carta empurra o dueAt para o futuro", async () => {
    const res = await auth(request(app).post(`/reviews/${flashcardId}/grade`)).send({ grade: "good" });
    expect(res.status).toBe(200);
    expect(res.body.intervalDays).toBe(1);
    expect(new Date(res.body.dueAt).getTime()).toBeGreaterThan(Date.now());
    // agora não está mais devida
    const due = await auth(request(app).get("/reviews/due"));
    expect(due.body.some((c: any) => c.id === flashcardId)).toBe(false);
  });

  it("rejeita grade inválida", async () => {
    const res = await auth(request(app).post(`/reviews/${flashcardId}/grade`)).send({ grade: "wat" });
    expect(res.status).toBe(400);
  });

  it("quiz retorna questões sem as respostas", async () => {
    const res = await auth(request(app).get("/quiz?cert=cca-foundations&n=5"));
    expect(res.status).toBe(200);
    const q = res.body.find((x: any) => x.id === questionId);
    expect(q).toBeDefined();
    expect(q.prompt).toBeDefined();
    expect(q.options).toHaveLength(4);
    expect(q.correctIndex).toBeUndefined();
    expect(q.explanation).toBeUndefined();
  });

  it("responder retorna feedback e registra a tentativa", async () => {
    const res = await auth(request(app).post("/quiz/answer")).send({ questionId, chosenIndex: correctIndex });
    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(true);
    expect(res.body.correctIndex).toBe(correctIndex);
    expect(res.body.explanation).toBeDefined();

    const attempts = await prisma.attempt.findMany({ where: { questionId } });
    expect(attempts.length).toBe(1);
    expect(attempts[0].correct).toBe(true);
  });

  it("resposta errada retorna correct=false", async () => {
    const res = await auth(request(app).post("/quiz/answer")).send({ questionId, chosenIndex: 0 });
    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(false);
    expect(res.body.correctIndex).toBe(correctIndex);
  });
});
