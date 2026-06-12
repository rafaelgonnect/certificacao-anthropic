import { describe, it, expect } from "vitest";
import { computeMastery, type AttemptLite } from "../src/learning/mastery.js";

const d = (iso: string) => new Date(iso);

describe("computeMastery", () => {
  it("entrada vazia → mapa vazio", () => {
    expect(computeMastery([])).toEqual({});
  });

  it("uma tag com resultados mistos → mastery = acertos/consideradas", () => {
    const attempts: AttemptLite[] = [
      { tags: ["api"], correct: true, createdAt: d("2026-01-01T00:00:00Z") },
      { tags: ["api"], correct: false, createdAt: d("2026-01-02T00:00:00Z") },
      { tags: ["api"], correct: true, createdAt: d("2026-01-03T00:00:00Z") },
      { tags: ["api"], correct: true, createdAt: d("2026-01-04T00:00:00Z") },
    ];
    const m = computeMastery(attempts);
    expect(m.api.attempts).toBe(4);
    expect(m.api.mastery).toBe(0.75);
  });

  it("uma tentativa com múltiplas tags contribui para cada tag", () => {
    const attempts: AttemptLite[] = [
      { tags: ["mcp", "claude-code"], correct: true, createdAt: d("2026-01-01T00:00:00Z") },
      { tags: ["mcp"], correct: false, createdAt: d("2026-01-02T00:00:00Z") },
    ];
    const m = computeMastery(attempts);
    expect(m.mcp).toEqual({ mastery: 0.5, attempts: 2 });
    expect(m["claude-code"]).toEqual({ mastery: 1, attempts: 1 });
  });

  it("trunca pela janela: só as N mais recentes contam (12 tentativas, janela 10)", () => {
    // 12 tentativas: as 2 mais antigas (dias 01 e 02) são acertos e devem ser ignoradas;
    // as 10 mais recentes (dias 03..12) são todas erradas → mastery 0.
    const attempts: AttemptLite[] = [];
    for (let day = 1; day <= 12; day++) {
      const dd = String(day).padStart(2, "0");
      attempts.push({
        tags: ["api"],
        correct: day <= 2, // dias 1 e 2 corretos, restante errado
        createdAt: d(`2026-01-${dd}T00:00:00Z`),
      });
    }
    const m = computeMastery(attempts, 10);
    expect(m.api.attempts).toBe(10);
    expect(m.api.mastery).toBe(0); // os 2 acertos antigos foram ignorados pela janela
  });

  it("janela padrão é 10", () => {
    const attempts: AttemptLite[] = [];
    for (let day = 1; day <= 12; day++) {
      const dd = String(day).padStart(2, "0");
      attempts.push({ tags: ["x"], correct: day <= 2, createdAt: d(`2026-02-${dd}T00:00:00Z`) });
    }
    const m = computeMastery(attempts);
    expect(m.x.attempts).toBe(10);
  });
});
