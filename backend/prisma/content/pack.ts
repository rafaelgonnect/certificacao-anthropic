// Typed content-pack format for a certification.
//
// A "pack" is a plain, serializable data object describing the full content tree
// of a certification (modules -> lessons -> flashcards/questions/labs). It is the
// single source of truth that the generic seeder consumes. Authoring a new
// certification means writing one of these objects — no Prisma code required.
//
// See ./CONTENT.md for the authoring guide.

export type FlashcardSeed = {
  front: string;
  back: string;
  tags: string[];
};

export type QuestionSeed = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty?: number;
  tags: string[];
};

export type LabSeed = {
  title: string;
  promptMd: string;
  rubric: string[];
  modelAnswer: string;
};

export type LessonSeed = {
  title: string;
  readingMd: string;
  flashcards?: FlashcardSeed[];
  questions?: QuestionSeed[];
  labs?: LabSeed[];
};

export type ModuleSeed = {
  title: string;
  lessons: LessonSeed[];
};

export type CertificationPack = {
  slug: string;
  title: string;
  description: string;
  version: number;
  modules: ModuleSeed[];
};

/**
 * Pure validator. Walks the whole pack collecting every structural problem it
 * finds, then either returns the pack (when valid) or throws an Error whose
 * message lists ALL problems (one per line), each pointing at the offending item.
 *
 * Checks:
 *  - non-empty slug, title and description;
 *  - >= 1 module; each module has a non-empty title and >= 1 lesson;
 *  - each lesson has a non-empty title and non-empty readingMd;
 *  - every QuestionSeed has >= 2 options, a correctIndex within range,
 *    and a non-empty explanation;
 *  - every flashcard/question/lab field is present and non-empty;
 *  - every flashcard/question `tags` is a non-empty array of non-empty strings.
 */
export function validatePack(pack: CertificationPack): CertificationPack {
  const problems: string[] = [];

  const isBlank = (s: unknown): boolean => typeof s !== "string" || s.trim().length === 0;
  const tagsBad = (tags: unknown): boolean =>
    !Array.isArray(tags) || tags.length === 0 || tags.some((t) => isBlank(t));

  if (isBlank(pack.slug)) problems.push("pack: slug must be a non-empty string");
  if (isBlank(pack.title)) problems.push(`pack "${pack.slug}": title must be a non-empty string`);
  if (isBlank(pack.description))
    problems.push(`pack "${pack.slug}": description must be a non-empty string`);
  if (typeof pack.version !== "number" || !Number.isFinite(pack.version))
    problems.push(`pack "${pack.slug}": version must be a number`);

  if (!Array.isArray(pack.modules) || pack.modules.length === 0) {
    problems.push(`pack "${pack.slug}": must have at least 1 module`);
  } else {
    pack.modules.forEach((mod, mi) => {
      const modLabel = `module[${mi}] "${mod?.title ?? ""}"`;
      if (isBlank(mod?.title)) problems.push(`${modLabel}: title must be a non-empty string`);

      if (!Array.isArray(mod?.lessons) || mod.lessons.length === 0) {
        problems.push(`${modLabel}: must have at least 1 lesson`);
        return;
      }

      mod.lessons.forEach((lesson, li) => {
        const lessonLabel = `${modLabel} > lesson[${li}] "${lesson?.title ?? ""}"`;
        if (isBlank(lesson?.title))
          problems.push(`${lessonLabel}: title must be a non-empty string`);
        if (isBlank(lesson?.readingMd))
          problems.push(`${lessonLabel}: readingMd must be a non-empty string`);

        (lesson?.flashcards ?? []).forEach((fc, fi) => {
          const fcLabel = `${lessonLabel} > flashcard[${fi}]`;
          if (isBlank(fc?.front)) problems.push(`${fcLabel}: front must be a non-empty string`);
          if (isBlank(fc?.back)) problems.push(`${fcLabel}: back must be a non-empty string`);
          if (tagsBad(fc?.tags))
            problems.push(`${fcLabel}: tags must be a non-empty array of non-empty strings`);
        });

        (lesson?.questions ?? []).forEach((q, qi) => {
          const qLabel = `${lessonLabel} > question[${qi}] "${q?.prompt ?? ""}"`;
          if (isBlank(q?.prompt)) problems.push(`${qLabel}: prompt must be a non-empty string`);
          if (!Array.isArray(q?.options) || q.options.length < 2) {
            problems.push(`${qLabel}: must have at least 2 options`);
          } else {
            if (q.options.some((o) => isBlank(o)))
              problems.push(`${qLabel}: all options must be non-empty strings`);
            if (
              typeof q.correctIndex !== "number" ||
              !Number.isInteger(q.correctIndex) ||
              q.correctIndex < 0 ||
              q.correctIndex >= q.options.length
            ) {
              problems.push(
                `${qLabel}: correctIndex ${q.correctIndex} is out of range (must be 0..${q.options.length - 1})`,
              );
            }
          }
          if (isBlank(q?.explanation))
            problems.push(`${qLabel}: explanation must be a non-empty string`);
          if (
            q?.difficulty !== undefined &&
            (typeof q.difficulty !== "number" || !Number.isFinite(q.difficulty))
          )
            problems.push(`${qLabel}: difficulty must be a number when present`);
          if (tagsBad(q?.tags))
            problems.push(`${qLabel}: tags must be a non-empty array of non-empty strings`);
        });

        (lesson?.labs ?? []).forEach((lab, labi) => {
          const labLabel = `${lessonLabel} > lab[${labi}] "${lab?.title ?? ""}"`;
          if (isBlank(lab?.title)) problems.push(`${labLabel}: title must be a non-empty string`);
          if (isBlank(lab?.promptMd))
            problems.push(`${labLabel}: promptMd must be a non-empty string`);
          if (isBlank(lab?.modelAnswer))
            problems.push(`${labLabel}: modelAnswer must be a non-empty string`);
          if (!Array.isArray(lab?.rubric) || lab.rubric.length === 0) {
            problems.push(`${labLabel}: rubric must be a non-empty array`);
          } else if (lab.rubric.some((r) => isBlank(r))) {
            problems.push(`${labLabel}: every rubric item must be a non-empty string`);
          }
        });
      });
    });
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid certification pack (${problems.length} problem(s)):\n- ${problems.join("\n- ")}`,
    );
  }

  return pack;
}
