import { describe, it, expect } from "vitest";
import { buildExamReport, type GradedAnswer } from "../src/learning/examReport.js";

describe("buildExamReport", () => {
  it("entrada vazia → tudo zerado, sem temas fracos", () => {
    const r = buildExamReport([]);
    expect(r.total).toBe(0);
    expect(r.correct).toBe(0);
    expect(r.scorePct).toBe(0);
    expect(r.readinessPct).toBe(0);
    expect(r.perTopic).toEqual({});
    expect(r.weakTopics).toEqual([]);
  });

  it("agrega total/correct e calcula scorePct e readinessPct arredondados", () => {
    const answers: GradedAnswer[] = [
      { tags: ["api"], correct: true },
      { tags: ["api"], correct: false },
      { tags: ["mcp"], correct: true },
    ];
    const r = buildExamReport(answers);
    expect(r.total).toBe(3);
    expect(r.correct).toBe(2);
    expect(r.scorePct).toBe(67); // round(100*2/3)
    expect(r.readinessPct).toBe(67);
  });

  it("perTopic por tag com pct arredondado", () => {
    const answers: GradedAnswer[] = [
      { tags: ["api"], correct: true },
      { tags: ["api"], correct: false },
      { tags: ["api"], correct: false },
      { tags: ["mcp"], correct: true },
    ];
    const r = buildExamReport(answers);
    expect(r.perTopic.api).toEqual({ total: 3, correct: 1, pct: 33 });
    expect(r.perTopic.mcp).toEqual({ total: 1, correct: 1, pct: 100 });
  });

  it("weakTopics: pct < 70 ordenados ascendente; exatamente 70 NÃO é fraco", () => {
    // api: 1/3 = 33 (fraco), skills: 0/2 = 0 (fraco), mcp: 7/10 = 70 (NÃO fraco), cc: 1/1=100
    const answers: GradedAnswer[] = [
      { tags: ["api"], correct: true },
      { tags: ["api"], correct: false },
      { tags: ["api"], correct: false },
      { tags: ["skills"], correct: false },
      { tags: ["skills"], correct: false },
      ...Array.from({ length: 7 }, () => ({ tags: ["mcp"], correct: true })),
      ...Array.from({ length: 3 }, () => ({ tags: ["mcp"], correct: false })),
      { tags: ["cc"], correct: true },
    ];
    const r = buildExamReport(answers);
    expect(r.perTopic.mcp.pct).toBe(70);
    // mcp (70) e cc (100) não são fracos; ordenados ascendente: skills(0) antes de api(33)
    expect(r.weakTopics).toEqual(["skills", "api"]);
  });
});
