export type Lab = { title: string; promptMd: string; rubric: string[]; modelAnswer: string };
export type LabFeedback = {
  mode: "ai" | "self";
  score?: number;
  passed?: boolean;
  feedback: string;
  rubric: string[];
};

// Monta o prompt enviado ao Claude — puro e testável.
export function buildGradingPrompt(lab: Lab, submission: string): string {
  const rubricList = lab.rubric.map((item, i) => `${i + 1}. ${item}`).join("\n");
  return [
    "Você é um avaliador de exercícios práticos sobre o ecossistema Claude da Anthropic.",
    "Avalie a RESPOSTA DO ALUNO comparando-a com a rubrica e a resposta-modelo.",
    "",
    `# Lab: ${lab.title}`,
    "",
    "## Enunciado",
    lab.promptMd,
    "",
    "## Rubrica (critérios a verificar)",
    rubricList,
    "",
    "## Resposta-modelo (referência)",
    lab.modelAnswer,
    "",
    "## Resposta do aluno",
    submission,
    "",
    'Responda ESTRITAMENTE com um objeto JSON no formato {"score": <0-100>, "passed": <boolean>, "feedback": "<texto curto em português>"}.',
    "score é a nota de 0 a 100 segundo o cumprimento da rubrica; passed deve ser true quando score >= 70.",
    "Não inclua nenhum texto fora do objeto JSON.",
  ].join("\n");
}

// Faz o parse da resposta do Claude em feedback estruturado — puro, tolerante.
export function parseGradingResponse(text: string): { score: number; passed: boolean; feedback: string } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no JSON object found in grading response");
  const parsed = JSON.parse(match[0]) as { score?: unknown; passed?: unknown; feedback?: unknown };

  const rawScore = typeof parsed.score === "number" ? parsed.score : Number(parsed.score);
  if (!Number.isFinite(rawScore)) throw new Error("invalid score in grading response");
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const passed = typeof parsed.passed === "boolean" ? parsed.passed : score >= 70;
  const feedback = typeof parsed.feedback === "string" ? parsed.feedback : "";

  return { score, passed, feedback };
}

// Feedback de auto-avaliação (sem IA) — puro.
export function selfAssessmentFeedback(lab: Lab): LabFeedback {
  return {
    mode: "self",
    feedback: "Compare sua resposta com a resposta-modelo e o checklist da rubrica.",
    rubric: lab.rubric,
  };
}
