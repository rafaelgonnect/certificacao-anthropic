export type Grade = "again" | "hard" | "good" | "easy";
export type ReviewInput = { ease: number; intervalDays: number; reps: number; lapses: number };
export type ReviewResult = { ease: number; intervalDays: number; reps: number; lapses: number; dueAt: Date };

const Q: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export function scheduleNext(state: ReviewInput, grade: Grade, now: Date): ReviewResult {
  const q = Q[grade];
  let { ease, intervalDays, reps, lapses } = state;
  if (q < 3) {
    // falhou: reinicia repetições, lapso, intervalo curto
    reps = 0;
    lapses += 1;
    intervalDays = 1;
  } else {
    reps += 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);
  }
  // ajuste do ease factor (SM-2), piso 1.3
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return { ease: Number(ease.toFixed(4)), intervalDays, reps, lapses, dueAt };
}

export function initialState(): ReviewInput {
  return { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };
}
