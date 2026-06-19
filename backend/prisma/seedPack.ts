// Núcleo reutilizável de seeding — SEM efeitos colaterais ao importar.
// Usado tanto pelo seed "force" (seed.ts) quanto pelo seed por versão no boot
// (seedOnBoot.ts). Extraído para cá justamente para poder ser importado sem
// disparar nenhuma execução.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { validatePack, type CertificationPack } from "./content/pack.js";

export type SeedCounts = {
  modules: number;
  lessons: number;
  flashcards: number;
  questions: number;
  labs: number;
};

/** Garante o usuário admin padrão (idempotente). */
export async function upsertAdmin(client: PrismaClient): Promise<void> {
  await client.user.upsert({
    where: { email: "admin@colaborativa.dev" },
    update: {},
    create: {
      email: "admin@colaborativa.dev",
      name: "Admin",
      role: "admin",
      passwordHash: await bcrypt.hash("admin12345", 10),
    },
  });
}

/**
 * Semeia um único pack: valida, remove qualquer certificação com o mesmo slug e
 * recria a árvore completa (módulos -> lições -> flashcards/questões/labs).
 */
export async function seedPack(
  client: PrismaClient,
  pack: CertificationPack,
): Promise<SeedCounts> {
  validatePack(pack);

  await client.certification.deleteMany({ where: { slug: pack.slug } });

  const counts: SeedCounts = { modules: 0, lessons: 0, flashcards: 0, questions: 0, labs: 0 };

  await client.certification.create({
    data: {
      slug: pack.slug,
      title: pack.title,
      description: pack.description,
      version: pack.version,
      level: pack.level ?? "iniciante",
      modules: {
        create: pack.modules.map((mod, mi) => {
          counts.modules++;
          return {
            order: mi + 1,
            title: mod.title,
            lessons: {
              create: mod.lessons.map((lesson, li) => {
                counts.lessons++;
                counts.flashcards += lesson.flashcards?.length ?? 0;
                counts.questions += lesson.questions?.length ?? 0;
                counts.labs += lesson.labs?.length ?? 0;
                return {
                  order: li + 1,
                  title: lesson.title,
                  readingMd: lesson.readingMd,
                  flashcards: {
                    create: (lesson.flashcards ?? []).map((fc) => ({
                      front: fc.front,
                      back: fc.back,
                      tags: fc.tags,
                    })),
                  },
                  questions: {
                    create: (lesson.questions ?? []).map((q) => ({
                      prompt: q.prompt,
                      options: q.options,
                      correctIndex: q.correctIndex,
                      explanation: q.explanation,
                      difficulty: q.difficulty ?? 1,
                      tags: q.tags,
                    })),
                  },
                  labs: {
                    create: (lesson.labs ?? []).map((lab) => ({
                      title: lab.title,
                      promptMd: lab.promptMd,
                      rubric: lab.rubric,
                      modelAnswer: lab.modelAnswer,
                    })),
                  },
                };
              }),
            },
          };
        }),
      },
    },
  });

  return counts;
}
