export type GradedAnswer = { tags: string[]; correct: boolean };
export type ExamReport = {
  total: number;
  correct: number;
  scorePct: number;
  perTopic: Record<string, { total: number; correct: number; pct: number }>;
  readinessPct: number; // == scorePct, arredondado
  weakTopics: string[]; // temas com pct < 70, ordenados de forma ascendente por pct
};

// Constrói um relatório de prontidão a partir de respostas já corrigidas.
export function buildExamReport(answers: GradedAnswer[]): ExamReport {
  const total = answers.length;
  const correct = answers.filter((a) => a.correct).length;
  const scorePct = total === 0 ? 0 : Math.round((100 * correct) / total);

  // agrega por tema (uma resposta com várias tags conta para cada uma)
  const perTopic: Record<string, { total: number; correct: number; pct: number }> = {};
  for (const a of answers) {
    for (const tag of a.tags) {
      const t = perTopic[tag] ?? { total: 0, correct: 0, pct: 0 };
      t.total += 1;
      if (a.correct) t.correct += 1;
      perTopic[tag] = t;
    }
  }
  for (const tag of Object.keys(perTopic)) {
    const t = perTopic[tag];
    t.pct = t.total === 0 ? 0 : Math.round((100 * t.correct) / t.total);
  }

  const weakTopics = Object.keys(perTopic)
    .filter((tag) => perTopic[tag].pct < 70)
    .sort((a, b) => perTopic[a].pct - perTopic[b].pct);

  return { total, correct, scorePct, perTopic, readinessPct: scorePct, weakTopics };
}
