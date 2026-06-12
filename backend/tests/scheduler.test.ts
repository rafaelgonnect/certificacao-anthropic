import { describe, it, expect } from "vitest";
import { scheduleNext, initialState } from "../src/learning/scheduler.js";

const NOW = new Date("2026-06-12T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("scheduler (SM-2)", () => {
  it("estado inicial", () => {
    expect(initialState()).toEqual({ ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 });
  });

  it("carta nova com 'good' → reps 1, intervalo 1 dia, vence ~1 dia depois", () => {
    const r = scheduleNext(initialState(), "good", NOW);
    expect(r.reps).toBe(1);
    expect(r.intervalDays).toBe(1);
    expect(r.lapses).toBe(0);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + 1 * DAY);
  });

  it("dois 'good' consecutivos → reps 2, intervalo 6 dias", () => {
    const r1 = scheduleNext(initialState(), "good", NOW);
    const r2 = scheduleNext(r1, "good", NOW);
    expect(r2.reps).toBe(2);
    expect(r2.intervalDays).toBe(6);
    expect(r2.dueAt.getTime()).toBe(NOW.getTime() + 6 * DAY);
  });

  it("terceiro 'good' de {ease 2.5, intervalo 6, reps 2} → intervalo = round(6*2.5)=15", () => {
    const r = scheduleNext({ ease: 2.5, intervalDays: 6, reps: 2, lapses: 0 }, "good", NOW);
    expect(r.reps).toBe(3);
    expect(r.intervalDays).toBe(15);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + 15 * DAY);
  });

  it("'again' em carta madura → reps 0, lapses +1, intervalo 1, ease cai mas >= 1.3", () => {
    const mature = { ease: 2.5, intervalDays: 15, reps: 3, lapses: 0 };
    const r = scheduleNext(mature, "again", NOW);
    expect(r.reps).toBe(0);
    expect(r.lapses).toBe(1);
    expect(r.intervalDays).toBe(1);
    expect(r.ease).toBeLessThan(2.5);
    expect(r.ease).toBeGreaterThanOrEqual(1.3);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + 1 * DAY);
  });

  it("'easy' aumenta o ease", () => {
    const r = scheduleNext(initialState(), "easy", NOW);
    expect(r.ease).toBeGreaterThan(2.5);
  });

  it("'again' repetido nunca derruba o ease abaixo de 1.3", () => {
    let state = initialState();
    for (let i = 0; i < 20; i++) {
      const r = scheduleNext(state, "again", NOW);
      expect(r.ease).toBeGreaterThanOrEqual(1.3);
      state = r;
    }
    expect(state.ease).toBe(1.3);
  });

  it("'hard' (q=3) ainda conta como acerto: avança reps", () => {
    const r = scheduleNext(initialState(), "hard", NOW);
    expect(r.reps).toBe(1);
    expect(r.intervalDays).toBe(1);
    expect(r.lapses).toBe(0);
  });
});
