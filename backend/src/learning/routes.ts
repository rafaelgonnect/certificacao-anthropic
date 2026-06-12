import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { scheduleNext, initialState, type Grade } from "./scheduler.js";

export const learningRoutes = Router();

// Todas as rotas exigem autenticação
learningRoutes.use(requireAuth);

// GET /reviews/due → flashcards devidos para o usuário (sem ReviewState OU dueAt <= agora)
learningRoutes.get("/reviews/due", async (req, res) => {
  const userId = req.user!.sub;
  const cert = typeof req.query.cert === "string" ? req.query.cert : undefined;
  const now = new Date();

  const flashcards = await prisma.flashcard.findMany({
    where: cert ? { lesson: { module: { cert: { slug: cert } } } } : undefined,
    select: {
      id: true,
      front: true,
      back: true,
      reviews: { where: { userId }, select: { dueAt: true } },
    },
  });

  const due = flashcards
    .filter((f) => f.reviews.length === 0 || f.reviews[0].dueAt <= now)
    .slice(0, 20)
    .map((f) => ({ id: f.id, front: f.front, back: f.back }));

  res.json(due);
});

// POST /reviews/:flashcardId/grade → aplica SM-2 e persiste ReviewState
const gradeSchema = z.object({ grade: z.enum(["again", "hard", "good", "easy"]) });
learningRoutes.post("/reviews/:flashcardId/grade", async (req, res) => {
  const parsed = gradeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const userId = req.user!.sub;
  const { flashcardId } = req.params;
  const grade = parsed.data.grade as Grade;

  const flashcard = await prisma.flashcard.findUnique({ where: { id: flashcardId } });
  if (!flashcard) return res.status(404).json({ error: "not found" });

  const current = await prisma.reviewState.findUnique({
    where: { userId_flashcardId: { userId, flashcardId } },
  });
  const input = current
    ? { ease: current.ease, intervalDays: current.intervalDays, reps: current.reps, lapses: current.lapses }
    : initialState();

  const next = scheduleNext(input, grade, new Date());

  await prisma.reviewState.upsert({
    where: { userId_flashcardId: { userId, flashcardId } },
    update: { ease: next.ease, intervalDays: next.intervalDays, reps: next.reps, lapses: next.lapses, dueAt: next.dueAt },
    create: { userId, flashcardId, ease: next.ease, intervalDays: next.intervalDays, reps: next.reps, lapses: next.lapses, dueAt: next.dueAt },
  });

  res.json({ dueAt: next.dueAt, intervalDays: next.intervalDays });
});

// GET /quiz?cert=slug&n=5 → N questões com interleaving (round-robin por módulo)
learningRoutes.get("/quiz", async (req, res) => {
  const cert = typeof req.query.cert === "string" ? req.query.cert : undefined;
  const n = Math.max(1, Math.min(50, Number(req.query.n) || 5));

  const questions = await prisma.question.findMany({
    where: cert ? { lesson: { module: { cert: { slug: cert } } } } : undefined,
    select: {
      id: true,
      prompt: true,
      options: true,
      lesson: { select: { moduleId: true } },
    },
  });

  // agrupa por módulo
  const byModule = new Map<string, typeof questions>();
  for (const q of questions) {
    const key = q.lesson.moduleId;
    const arr = byModule.get(key) ?? [];
    arr.push(q);
    byModule.set(key, arr);
  }

  // round-robin entre módulos para intercalar os temas
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

  const selected = interleaved.slice(0, n).map((q) => ({ id: q.id, prompt: q.prompt, options: q.options }));
  res.json(selected);
});

// POST /quiz/answer → feedback imediato e registra Attempt
const answerSchema = z.object({ questionId: z.string(), chosenIndex: z.number().int() });
learningRoutes.post("/quiz/answer", async (req, res) => {
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const userId = req.user!.sub;
  const { questionId, chosenIndex } = parsed.data;

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) return res.status(404).json({ error: "not found" });

  const correct = chosenIndex === question.correctIndex;
  await prisma.attempt.create({ data: { userId, questionId, chosenIndex, correct } });

  res.json({ correct, correctIndex: question.correctIndex, explanation: question.explanation });
});
