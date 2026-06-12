import { describe, it, expect } from "vitest";
import {
  buildGradingPrompt,
  parseGradingResponse,
  selfAssessmentFeedback,
  type Lab,
} from "../src/ai/labGrader.js";

const lab: Lab = {
  title: "Primeira chamada à Claude API",
  promptMd: "Escreva uma requisição mínima especificando model, max_tokens e uma mensagem do usuário.",
  rubric: ["Especifica o model", "Define max_tokens", "Inclui uma mensagem do usuário", "Trata a resposta"],
  modelAnswer: "const res = await client.messages.create({ model, max_tokens: 1024, messages });",
};

describe("buildGradingPrompt", () => {
  it("inclui os itens da rubrica e a submissão", () => {
    const submission = "minha resposta de teste 123";
    const prompt = buildGradingPrompt(lab, submission);
    for (const item of lab.rubric) {
      expect(prompt).toContain(item);
    }
    expect(prompt).toContain(submission);
    expect(prompt).toContain(lab.title);
    expect(prompt).toContain(lab.modelAnswer);
    expect(prompt.toLowerCase()).toContain("json");
  });
});

describe("parseGradingResponse", () => {
  it("faz parse de JSON limpo", () => {
    const text = '{"score": 85, "passed": true, "feedback": "Bom trabalho"}';
    expect(parseGradingResponse(text)).toEqual({ score: 85, passed: true, feedback: "Bom trabalho" });
  });

  it("faz parse de JSON embutido em prosa", () => {
    const text = 'Aqui está minha avaliação:\n{"score": 60, "passed": false, "feedback": "Faltou tratar a resposta"} Fim.';
    expect(parseGradingResponse(text)).toEqual({
      score: 60,
      passed: false,
      feedback: "Faltou tratar a resposta",
    });
  });

  it("faz clamp de scores fora do intervalo 0-100", () => {
    expect(parseGradingResponse('{"score": 150, "feedback": "x"}').score).toBe(100);
    expect(parseGradingResponse('{"score": -20, "feedback": "x"}').score).toBe(0);
  });

  it("deriva passed de score quando não fornecido", () => {
    expect(parseGradingResponse('{"score": 90, "feedback": "x"}').passed).toBe(true);
    expect(parseGradingResponse('{"score": 40, "feedback": "x"}').passed).toBe(false);
  });

  it("lança quando não há JSON parseável", () => {
    expect(() => parseGradingResponse("sem json aqui")).toThrow();
  });
});

describe("selfAssessmentFeedback", () => {
  it("retorna mode self com a rubrica", () => {
    const fb = selfAssessmentFeedback(lab);
    expect(fb.mode).toBe("self");
    expect(fb.rubric).toEqual(lab.rubric);
    expect(fb.feedback).toContain("rubrica");
  });
});
