export type AttemptLite = { tags: string[]; correct: boolean; createdAt: Date };
export type MasteryMap = Record<string, { mastery: number; attempts: number }>;

// Calcula domínio por tema a partir das tentativas. Para cada tag, considera as
// `window` tentativas mais recentes; mastery = acertos / consideradas (∈ [0,1]).
export function computeMastery(attempts: AttemptLite[], window = 10): MasteryMap {
  // agrupa tentativas por tag (uma tentativa com várias tags conta para cada uma)
  const byTag = new Map<string, AttemptLite[]>();
  for (const a of attempts) {
    for (const tag of a.tags) {
      const arr = byTag.get(tag) ?? [];
      arr.push(a);
      byTag.set(tag, arr);
    }
  }

  const result: MasteryMap = {};
  for (const [tag, group] of byTag) {
    // mais recentes primeiro, depois recorta a janela
    const recent = [...group]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, window);
    const correctCount = recent.filter((a) => a.correct).length;
    result[tag] = { mastery: correctCount / recent.length, attempts: recent.length };
  }
  return result;
}
