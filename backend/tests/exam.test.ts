import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { prisma } from "../src/db.js";
import { signToken } from "../src/auth/jwt.js";
import { loadEnv } from "../src/env.js";

const app = createApp();
let alunoToken = "";
let gestorToken = "";
let certSlug = "exam-test-cert";

async function reset() {
  await prisma.examSession.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.reviewState.deleteMany();
  await prisma.flashcard.deleteMany();
  await prisma.question.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.certification.deleteMany({ where: { slug: certSlug } });
  await prisma.user.deleteMany({ where: { email: { in: ["examaluno@test.dev", "examgestor@test.dev"] } } });
}

beforeAll(async () => {
  await reset();
  const aluno = await prisma.user.create({
    data: { email: "examaluno@test.dev", name: "Aluno", role: "aluno", passwordHash: "x" },
  });
  alunoToken = signToken({ sub: aluno.id, role: aluno.role }, loadEnv().JWT_SECRET);
  const gestor = await prisma.user.create({
    data: { email: "examgestor@test.dev", name: "Gestor", role: "gestor", passwordHash: "x" },
  });
  gestorToken = signToken({ sub: gestor.id, role: gestor.role }, loadEnv().JWT_SECRET);

  // certificação com 2 módulos, cada um com 1 lição e 2 questões (tags distintas)
  await prisma.certification.create({
    data: {
      slug: certSlug,
      title: "Exam Test",
      description: "Teste de simulado",
      modules: {
        create: [
          {
            order: 1,
            title: "API",
            lessons: {
              create: {
                order: 1,
                title: "API",
                readingMd: "# API",
                questions: {
                  create: [
                    { prompt: "Q api 1", options: ["a", "b"], correctIndex: 0, explanation: "e", tags: ["api"] },
                    { prompt: "Q api 2", options: ["a", "b"], correctIndex: 1, explanation: "e", tags: ["api"] },
                  ],
                },
              },
            },
          },
          {
            order: 2,
            title: "MCP",
            lessons: {
              create: {
                order: 1,
                title: "MCP",
                readingMd: "# MCP",
                questions: {
                  create: [
                    { prompt: "Q mcp 1", options: ["a", "b"], correctIndex: 0, explanation: "e", tags: ["mcp"] },
                    { prompt: "Q mcp 2", options: ["a", "b"], correctIndex: 1, explanation: "e", tags: ["mcp"] },
                  ],
                },
              },
            },
          },
        ],
      },
    },
  });
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

const auth = (r: request.Test, token: string) => r.set("authorization", `Bearer ${token}`);

describe("exam routes", () => {
  it("exige autenticação", async () => {
    const res = await request(app).post("/exams/start").send({ cert: certSlug });
    expect(res.status).toBe(401);
  });

  it("inicia simulado e retorna N questões sem respostas", async () => {
    const res = await auth(request(app).post("/exams/start"), alunoToken).send({ cert: certSlug, n: 4 });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.questions).toHaveLength(4);
    for (const q of res.body.questions) {
      expect(q.id).toBeDefined();
      expect(q.prompt).toBeDefined();
      expect(q.options).toBeDefined();
      expect(q.correctIndex).toBeUndefined();
      expect((q as any).explanation).toBeUndefined();
      expect((q as any).tags).toBeUndefined();
    }
  });

  it("submete, corrige e devolve relatório com perTopic e weakTopics", async () => {
    const start = await auth(request(app).post("/exams/start"), alunoToken).send({ cert: certSlug, n: 4 });
    const sessionId = start.body.sessionId as string;
    const questions = start.body.questions as { id: string }[];

    // carrega correctIndex direto do banco para montar respostas determinísticas
    const dbQuestions = await prisma.question.findMany({
      where: { id: { in: questions.map((q) => q.id) } },
      select: { id: true, correctIndex: true, tags: true },
    });
    const byId = new Map(dbQuestions.map((q) => [q.id, q]));
    // responde corretamente as de "api" e erra as de "mcp"
    const answers = questions.map((q) => {
      const dq = byId.get(q.id)!;
      const isApi = dq.tags.includes("api");
      return { questionId: q.id, chosenIndex: isApi ? dq.correctIndex : (dq.correctIndex + 1) % 2 };
    });

    const res = await auth(request(app).post(`/exams/${sessionId}/submit`), alunoToken).send({ answers });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.perTopic.api.pct).toBe(100);
    expect(res.body.perTopic.mcp.pct).toBe(0);
    expect(res.body.weakTopics).toContain("mcp");
    expect(res.body.weakTopics).not.toContain("api");

    // sessão foi finalizada
    const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
    expect(session?.finishedAt).not.toBeNull();
  });

  it("não permite submeter sessão de outro usuário", async () => {
    const start = await auth(request(app).post("/exams/start"), alunoToken).send({ cert: certSlug, n: 2 });
    const sessionId = start.body.sessionId as string;
    const res = await auth(request(app).post(`/exams/${sessionId}/submit`), gestorToken).send({ answers: [] });
    expect(res.status).toBe(403);
  });

  it("mastery reflete as tentativas do simulado", async () => {
    const res = await auth(request(app).get(`/me/mastery?cert=${certSlug}`), alunoToken);
    expect(res.status).toBe(200);
    expect(res.body.api).toBeDefined();
    expect(res.body.api.mastery).toBeGreaterThan(0);
    expect(res.body.mcp).toBeDefined();
  });
});

describe("admin overview", () => {
  it("aluno recebe 403", async () => {
    const res = await auth(request(app).get("/admin/overview"), alunoToken);
    expect(res.status).toBe(403);
  });

  it("gestor recebe a visão da turma", async () => {
    const res = await auth(request(app).get("/admin/overview"), gestorToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.students)).toBe(true);
    expect(res.body.topicAverages).toBeDefined();
    const aluno = res.body.students.find((s: any) => s.email === "examaluno@test.dev");
    expect(aluno).toBeDefined();
    expect(typeof aluno.avgScore).toBe("number");
    expect(aluno.mastery).toBeDefined();
  });
});
