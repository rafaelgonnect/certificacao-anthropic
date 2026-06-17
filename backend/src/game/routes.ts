import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import {
  computeDept,
  computeTotals,
  idleCredits,
  creditsPerHour,
  TIERS,
  type Tier,
  type DeptInput,
  type DeptResult,
} from "./economy.js";

export const gameRoutes = Router();
gameRoutes.use(requireAuth);

type Tiers = Record<string, Tier>;

// Monta os DeptInput (um por módulo) a partir do conteúdo + progresso do usuário.
async function buildDepartments(
  userId: string,
  certSlug: string,
  tiers: Tiers,
): Promise<{ certTitle: string; inputs: DeptInput[] } | null> {
  const cert = await prisma.certification.findUnique({
    where: { slug: certSlug },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            include: {
              questions: { select: { id: true, difficulty: true } },
              flashcards: { select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!cert) return null;

  const allQuestionIds: string[] = [];
  const allFlashcardIds: string[] = [];
  for (const m of cert.modules)
    for (const l of m.lessons) {
      for (const q of l.questions) allQuestionIds.push(q.id);
      for (const f of l.flashcards) allFlashcardIds.push(f.id);
    }

  const [attempts, reviews] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId, questionId: { in: allQuestionIds } },
      select: { questionId: true, correct: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reviewState.findMany({
      where: { userId, flashcardId: { in: allFlashcardIds } },
      select: { flashcardId: true, dueAt: true },
    }),
  ]);

  const attemptsByQ = new Map<string, { correct: boolean; createdAt: Date }[]>();
  for (const a of attempts) {
    const arr = attemptsByQ.get(a.questionId) ?? [];
    arr.push({ correct: a.correct, createdAt: a.createdAt });
    attemptsByQ.set(a.questionId, arr);
  }
  const dueByF = new Map<string, Date>();
  for (const r of reviews) dueByF.set(r.flashcardId, r.dueAt);

  const now = new Date();
  const inputs: DeptInput[] = cert.modules.map((m) => {
    const qids: string[] = [];
    const diffs: number[] = [];
    const fids: string[] = [];
    for (const l of m.lessons) {
      for (const q of l.questions) {
        qids.push(q.id);
        diffs.push(q.difficulty);
      }
      for (const f of l.flashcards) fids.push(f.id);
    }

    // maestria: 10 tentativas mais recentes nas questões do módulo
    const modAttempts = qids
      .flatMap((id) => attemptsByQ.get(id) ?? [])
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);
    const mastery = modAttempts.length
      ? modAttempts.filter((a) => a.correct).length / modAttempts.length
      : 0;

    const learned = fids.filter((id) => dueByF.has(id)).length;
    const fresh = fids.filter((id) => {
      const d = dueByF.get(id);
      return d !== undefined && d > now;
    }).length;
    const avgDifficulty = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 1;

    const tier = TIERS.includes(tiers[m.id]) ? tiers[m.id] : "sonnet";

    return {
      moduleId: m.id,
      title: m.title,
      mastery,
      attempts: modAttempts.length,
      flashcardsTotal: fids.length,
      flashcardsLearned: learned,
      flashcardsFresh: fresh,
      avgDifficulty,
      tier,
    };
  });

  return { certTitle: cert.title, inputs };
}

async function getOrCreateCompany(userId: string, certSlug: string, userName: string) {
  const existing = await prisma.company.findUnique({
    where: { userId_certSlug: { userId, certSlug } },
  });
  if (existing) return existing;
  return prisma.company.create({
    data: { userId, certSlug, name: `${userName} AI` },
  });
}

function buildState(inputs: DeptInput[]) {
  const departments: DeptResult[] = inputs.map(computeDept);
  const totals = computeTotals(departments);
  return { departments, totals };
}

// GET /game/:certSlug → painel da empresa
gameRoutes.get("/game/:certSlug", async (req, res) => {
  const userId = req.user!.sub;
  const { certSlug } = req.params;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const company = await getOrCreateCompany(userId, certSlug, user?.name ?? "Founder");

  const built = await buildDepartments(userId, certSlug, (company.tiers as Tiers) ?? {});
  if (!built) return res.status(404).json({ error: "certification not found" });

  const { departments, totals } = buildState(built.inputs);
  const now = new Date();
  const idlePending = idleCredits(totals.mrr, company.lastCollectedAt, now);

  // persiste mrr/valuation para o leaderboard
  await prisma.company.update({
    where: { id: company.id },
    data: { mrr: totals.mrr, valuation: totals.valuation },
  });

  const weakest = [...departments].sort(
    (a, b) => a.level * a.quality - b.level * b.quality,
  )[0];

  res.json({
    company: { name: company.name, credits: company.credits, certSlug },
    totals: { ...totals, creditsPerHour: creditsPerHour(totals.mrr) },
    departments,
    idlePending,
    weakest: weakest ? { moduleId: weakest.moduleId, title: weakest.title } : null,
  });
});

// POST /game/:certSlug/collect → coleta os créditos idle
gameRoutes.post("/game/:certSlug/collect", async (req, res) => {
  const userId = req.user!.sub;
  const { certSlug } = req.params;
  const company = await prisma.company.findUnique({
    where: { userId_certSlug: { userId, certSlug } },
  });
  if (!company) return res.status(404).json({ error: "company not found" });

  const built = await buildDepartments(userId, certSlug, (company.tiers as Tiers) ?? {});
  if (!built) return res.status(404).json({ error: "certification not found" });
  const { totals } = buildState(built.inputs);

  const now = new Date();
  const collected = idleCredits(totals.mrr, company.lastCollectedAt, now);
  const updated = await prisma.company.update({
    where: { id: company.id },
    data: { credits: company.credits + collected, lastCollectedAt: now },
  });

  res.json({ collected, credits: updated.credits });
});

// POST /game/:certSlug/tier → ajusta o tier de um departamento
const tierSchema = z.object({
  moduleId: z.string(),
  tier: z.enum(["haiku", "sonnet", "opus"]),
});
gameRoutes.post("/game/:certSlug/tier", async (req, res) => {
  const parsed = tierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const userId = req.user!.sub;
  const { certSlug } = req.params;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const company = await getOrCreateCompany(userId, certSlug, user?.name ?? "Founder");

  const tiers = { ...((company.tiers as Tiers) ?? {}), [parsed.data.moduleId]: parsed.data.tier };
  const built = await buildDepartments(userId, certSlug, tiers);
  if (!built) return res.status(404).json({ error: "certification not found" });

  const { departments, totals } = buildState(built.inputs);
  await prisma.company.update({
    where: { id: company.id },
    data: { tiers, mrr: totals.mrr, valuation: totals.valuation },
  });

  res.json({ departments, totals: { ...totals, creditsPerHour: creditsPerHour(totals.mrr) } });
});

// GET /game/board/leaderboard → top startups por valuation
gameRoutes.get("/game/board/leaderboard", async (_req, res) => {
  const companies = await prisma.company.findMany({
    orderBy: { valuation: "desc" },
    take: 20,
    select: { name: true, valuation: true, certSlug: true, user: { select: { name: true } } },
  });
  res.json(
    companies.map((c, i) => ({
      rank: i + 1,
      name: c.name,
      founder: c.user.name,
      valuation: c.valuation,
      certSlug: c.certSlug,
    })),
  );
});
