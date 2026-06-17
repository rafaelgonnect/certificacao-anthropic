// Economia pura do jogo "Startup Tycoon de IA". Sem dependências de DB — toda a
// lógica de níveis, qualidade, tier de modelo, MRR, usuários, valuation e idle
// vive aqui para ser testada de forma isolada.

export type Tier = "haiku" | "sonnet" | "opus";
export const TIERS: Tier[] = ["haiku", "sonnet", "opus"];

export type DeptInput = {
  moduleId: string;
  title: string;
  mastery: number; // 0..1 — acertos recentes nas questões do módulo
  attempts: number;
  flashcardsTotal: number;
  flashcardsLearned: number; // têm ReviewState
  flashcardsFresh: number; // ReviewState com dueAt no futuro (não vencido)
  avgDifficulty: number; // média da difficulty das questões (1..3) → tier ideal
  tier: Tier; // tier escolhido pelo jogador
};

export type DeptResult = {
  moduleId: string;
  title: string;
  level: number; // 0..5 contínuo
  stars: number; // round(level)
  quality: number; // 0..1
  tier: Tier;
  idealTier: Tier;
  tierMult: number;
  mrr: number;
};

export type CompanyTotals = {
  mrr: number;
  users: number;
  valuation: number;
  stage: string;
  title: string;
};

const BASE_MRR = 60;
const USERS_PER_LEVEL = 35;
const VAL_FROM_MRR = 12;
const VAL_FROM_USERS = 4;
export const IDLE_CAP_HOURS = 8;

const STAGES: Array<{ min: number; stage: string; title: string }> = [
  { min: 1_000_000, stage: "Unicórnio", title: "Unicorn Founder" },
  { min: 400_000, stage: "Series C", title: "Scale-up CEO" },
  { min: 150_000, stage: "Series B", title: "Scale-up CEO" },
  { min: 60_000, stage: "Series A", title: "Funded Founder" },
  { min: 20_000, stage: "Seed", title: "Funded Founder" },
  { min: 5_000, stage: "Pre-seed", title: "Founder" },
  { min: 0, stage: "Garagem", title: "Founder" },
];

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Tier ideal a partir da dificuldade média do módulo. */
export function idealTier(avgDifficulty: number): Tier {
  if (avgDifficulty >= 2.4) return "opus";
  if (avgDifficulty >= 1.6) return "sonnet";
  return "haiku";
}

/** Multiplicador de margem: casar o tier com o ideal dá bônus; errar penaliza. */
export function tierMultiplier(chosen: Tier, ideal: Tier): number {
  const d = Math.abs(TIERS.indexOf(chosen) - TIERS.indexOf(ideal));
  return d === 0 ? 1.2 : d === 1 ? 1.0 : 0.8;
}

/** Qualidade do dept: cobertura (quanto foi reforçado) + frescor (não vencido). */
export function deptQuality(total: number, learned: number, fresh: number): number {
  if (total === 0) return 1;
  const coverage = clamp(learned / total, 0, 1);
  const freshness = learned === 0 ? 0 : clamp(fresh / learned, 0, 1);
  return clamp(0.3 + 0.4 * coverage + 0.3 * freshness, 0, 1);
}

export function computeDept(input: DeptInput): DeptResult {
  const level = clamp(input.mastery, 0, 1) * 5;
  const quality = deptQuality(
    input.flashcardsTotal,
    input.flashcardsLearned,
    input.flashcardsFresh,
  );
  const ideal = idealTier(input.avgDifficulty);
  const tierMult = tierMultiplier(input.tier, ideal);
  const mrr = Math.round(BASE_MRR * (level / 5) * quality * tierMult);
  return {
    moduleId: input.moduleId,
    title: input.title,
    level,
    stars: Math.round(level),
    quality,
    tier: input.tier,
    idealTier: ideal,
    tierMult,
    mrr,
  };
}

export function stageFor(valuation: number): { stage: string; title: string } {
  return STAGES.find((s) => valuation >= s.min)!;
}

export function computeTotals(depts: DeptResult[]): CompanyTotals {
  const mrr = depts.reduce((n, d) => n + d.mrr, 0);
  const users = Math.round(depts.reduce((n, d) => n + d.level, 0) * USERS_PER_LEVEL);
  const valuation = Math.round(mrr * VAL_FROM_MRR + users * VAL_FROM_USERS);
  const st = stageFor(valuation);
  return { mrr, users, valuation, stage: st.stage, title: st.title };
}

export function creditsPerHour(mrr: number): number {
  return Math.round(mrr / 3);
}

/** Créditos acumulados em idle desde a última coleta (cap em IDLE_CAP_HOURS). */
export function idleCredits(mrr: number, lastCollectedAt: Date, now: Date): number {
  const elapsedH = (now.getTime() - lastCollectedAt.getTime()) / 3_600_000;
  const hours = clamp(elapsedH, 0, IDLE_CAP_HOURS);
  return Math.floor(creditsPerHour(mrr) * hours);
}
