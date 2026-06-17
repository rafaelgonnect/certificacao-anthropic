import { describe, it, expect } from "vitest";
import {
  idealTier,
  tierMultiplier,
  deptQuality,
  computeDept,
  computeTotals,
  stageFor,
  creditsPerHour,
  idleCredits,
  IDLE_CAP_HOURS,
  type DeptInput,
} from "../src/game/economy.js";

describe("idealTier", () => {
  it("mapeia dificuldade média para o tier ideal", () => {
    expect(idealTier(1.0)).toBe("haiku");
    expect(idealTier(2.0)).toBe("sonnet");
    expect(idealTier(2.6)).toBe("opus");
  });
});

describe("tierMultiplier", () => {
  it("dá bônus ao casar e penaliza ao errar", () => {
    expect(tierMultiplier("sonnet", "sonnet")).toBe(1.2);
    expect(tierMultiplier("haiku", "sonnet")).toBe(1.0);
    expect(tierMultiplier("haiku", "opus")).toBe(0.8);
  });
});

describe("deptQuality", () => {
  it("é 1 quando não há flashcards", () => {
    expect(deptQuality(0, 0, 0)).toBe(1);
  });
  it("sobe com cobertura e frescor; revisões vencidas derrubam", () => {
    const semReforco = deptQuality(10, 0, 0); // nada estudado
    const tudoFresco = deptQuality(10, 10, 10); // tudo reforçado e fresco
    const tudoVencido = deptQuality(10, 10, 0); // estudado mas vencido
    expect(semReforco).toBeCloseTo(0.3, 5);
    expect(tudoFresco).toBeCloseTo(1.0, 5);
    expect(tudoVencido).toBeGreaterThan(semReforco);
    expect(tudoVencido).toBeLessThan(tudoFresco);
  });
});

describe("computeDept", () => {
  const base: DeptInput = {
    moduleId: "m1",
    title: "Claude API",
    mastery: 1,
    attempts: 10,
    flashcardsTotal: 4,
    flashcardsLearned: 4,
    flashcardsFresh: 4,
    avgDifficulty: 2.0, // ideal = sonnet
    tier: "sonnet",
  };

  it("nível é mastery×5 e MRR é positivo quando domina e está fresco", () => {
    const d = computeDept(base);
    expect(d.level).toBe(5);
    expect(d.stars).toBe(5);
    expect(d.idealTier).toBe("sonnet");
    expect(d.tierMult).toBe(1.2);
    expect(d.mrr).toBeGreaterThan(0);
  });

  it("MRR cai quando o tier não casa com o ideal", () => {
    const certo = computeDept(base);
    const errado = computeDept({ ...base, tier: "opus" }); // 1 de distância
    expect(errado.mrr).toBeLessThan(certo.mrr);
  });

  it("MRR é 0 quando não há domínio", () => {
    const d = computeDept({ ...base, mastery: 0 });
    expect(d.mrr).toBe(0);
    expect(d.level).toBe(0);
  });
});

describe("computeTotals + stageFor", () => {
  it("agrega MRR/usuários/valuation e começa na Garagem quando vazio", () => {
    const t0 = computeTotals([]);
    expect(t0.mrr).toBe(0);
    expect(t0.valuation).toBe(0);
    expect(t0.stage).toBe("Garagem");
  });

  it("valuation cresce com os departamentos", () => {
    const d = computeDept({
      moduleId: "m1",
      title: "x",
      mastery: 1,
      attempts: 10,
      flashcardsTotal: 0,
      flashcardsLearned: 0,
      flashcardsFresh: 0,
      avgDifficulty: 2,
      tier: "sonnet",
    });
    const t = computeTotals([d, d, d]);
    expect(t.mrr).toBeGreaterThan(0);
    expect(t.users).toBeGreaterThan(0);
    expect(t.valuation).toBeGreaterThan(0);
  });

  it("stageFor sobe de faixa conforme o valuation", () => {
    expect(stageFor(0).stage).toBe("Garagem");
    expect(stageFor(25_000).stage).toBe("Seed");
    expect(stageFor(2_000_000).stage).toBe("Unicórnio");
  });
});

describe("idle", () => {
  it("acumula créditos proporcional ao tempo, com cap", () => {
    const now = new Date("2026-06-17T12:00:00Z");
    const umaHora = new Date(now.getTime() - 3_600_000);
    const muitoTempo = new Date(now.getTime() - 100 * 3_600_000);
    const perHour = creditsPerHour(300); // 100
    expect(idleCredits(300, umaHora, now)).toBe(perHour);
    // cap em IDLE_CAP_HOURS
    expect(idleCredits(300, muitoTempo, now)).toBe(perHour * IDLE_CAP_HOURS);
    // sem tempo decorrido → 0
    expect(idleCredits(300, now, now)).toBe(0);
  });
});
