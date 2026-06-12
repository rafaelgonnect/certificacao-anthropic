import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { buildExamReport, type GradedAnswer } from "./examReport.js";
import { computeMastery, type AttemptLite } from "./mastery.js";

export const examRoutes = Router();

// Todas as rotas de simulado exigem autenticação
examRoutes.use(requireAuth);

// POST /exams/start → amostra N questões pela certificação (intercaladas por módulo) e cria a sessão
const startSchema = z.object({ cert: z.string(), n: z.number().int().positive().max(50).optional() });
examRoutes.post("/exams/start", async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const userId = req.user!.sub;
  const { cert } = parsed.data;
  const n = parsed.data.n ?? 15;

  const certification = await prisma.certification.findUnique({ where: { slug: cert } });
  if (!certification) return res.status(404).json({ error: "not found" });

  const questions = await prisma.question.findMany({
    where: { lesson: { module: { cert: { slug: cert } } } },
    select: {
      id: true,
      prompt: true,
      options: true,
      lesson: { select: { moduleId: true } },
    },
  });

  // agrupa por módulo e faz round-robin para intercalar os temas (igual ao quiz)
  const byModule = new Map<string, typeof questions>();
  for (const q of questions) {
    const key = q.lesson.moduleId;
    const arr = byModule.get(key) ?? [];
    arr.push(q);
    byModule.set(key, arr);
  }
  const buckets = [...byModule.values()];
  const interleaved: typeof questions = [];
  let i = 0;
  while (interleaved.length < questions.length) {
    const bucket = buckets[i % buckets.length];
    const item = bucket.shift();
    if (item) interleaved.push(item);
    i++;
    if (buckets.every((b) => b.length === 0)) break;
  }

  const selected = interleaved.slice(0, n);
  const session = await prisma.examSession.create({
    data: {
      userId,
      certId: certification.id,
      questionIds: selected.map((q) => q.id),
      total: selected.length,
    },
  });

  res.json({
    sessionId: session.id,
    questions: selected.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
  });
});

// POST /exams/:id/submit → corrige, registra Attempts, atualiza a sessão e devolve o relatório
const submitSchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), chosenIndex: z.number().int() })),
});
examRoutes.post("/exams/:id/submit", async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const userId = req.user!.sub;
  const { id } = req.params;

  const session = await prisma.examSession.findUnique({ where: { id } });
  if (!session) return res.status(404).json({ error: "not found" });
  if (session.userId !== userId) return res.status(403).json({ error: "forbidden" });

  const questions = await prisma.question.findMany({
    where: { id: { in: session.questionIds } },
    select: { id: true, correctIndex: true, tags: true },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const chosenById = new Map(parsed.data.answers.map((a) => [a.questionId, a.chosenIndex]));

  // corrige cada questão da sessão; respostas ausentes contam como erro
  const graded: GradedAnswer[] = [];
  const attemptsData: { userId: string; questionId: string; chosenIndex: number; correct: boolean }[] = [];
  for (const qid of session.questionIds) {
    const q = byId.get(qid);
    if (!q) continue;
    const chosenIndex = chosenById.get(qid);
    const correct = chosenIndex !== undefined && chosenIndex === q.correctIndex;
    graded.push({ tags: q.tags, correct });
    attemptsData.push({ userId, questionId: qid, chosenIndex: chosenIndex ?? -1, correct });
  }

  // registra Attempts para que o domínio (mastery) reflita também os simulados
  if (attemptsData.length > 0) await prisma.attempt.createMany({ data: attemptsData });

  const report = buildExamReport(graded);

  await prisma.examSession.update({
    where: { id },
    data: { finishedAt: new Date(), correct: report.correct, scorePct: report.scorePct },
  });

  res.json(report);
});

// GET /me/mastery?cert=slug → domínio por tema do usuário (a partir das suas Attempts)
examRoutes.get("/me/mastery", async (req, res) => {
  const userId = req.user!.sub;
  const cert = typeof req.query.cert === "string" ? req.query.cert : undefined;

  const attempts = await prisma.attempt.findMany({
    where: {
      userId,
      ...(cert ? { question: { lesson: { module: { cert: { slug: cert } } } } } : {}),
    },
    select: { correct: true, createdAt: true, question: { select: { tags: true } } },
  });

  const lite: AttemptLite[] = attempts.map((a) => ({
    tags: a.question.tags,
    correct: a.correct,
    createdAt: a.createdAt,
  }));

  res.json(computeMastery(lite));
});
