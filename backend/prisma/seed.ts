import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ccaFoundations } from "./content/cca-foundations.js";
import { validatePack, type CertificationPack } from "./content/pack.js";

const prisma = new PrismaClient();

// Register every certification pack here. Adding a new certification is just:
//   import { myPack } from "./content/my-pack.js";
//   ...and push it into this array.
const packs: CertificationPack[] = [ccaFoundations];

type SeedCounts = {
  modules: number;
  lessons: number;
  flashcards: number;
  questions: number;
  labs: number;
};

// Seeds a single certification pack: validates it, removes any previous
// certification with the same slug, then recreates the full nested tree
// (modules -> lessons -> flashcards/questions/labs) via Prisma nested writes.
async function seedPack(client: PrismaClient, pack: CertificationPack): Promise<SeedCounts> {
  validatePack(pack);

  await client.certification.deleteMany({ where: { slug: pack.slug } });

  const counts: SeedCounts = { modules: 0, lessons: 0, flashcards: 0, questions: 0, labs: 0 };

  await client.certification.create({
    data: {
      slug: pack.slug,
      title: pack.title,
      description: pack.description,
      version: pack.version,
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

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@colaborativa.dev" },
    update: {},
    create: {
      email: "admin@colaborativa.dev",
      name: "Admin",
      role: "admin",
      passwordHash: await bcrypt.hash("admin12345", 10),
    },
  });

  const total: SeedCounts = { modules: 0, lessons: 0, flashcards: 0, questions: 0, labs: 0 };
  for (const pack of packs) {
    const c = await seedPack(prisma, pack);
    console.log(
      `Pack "${pack.slug}" (v${pack.version}): ${c.modules} módulos, ${c.lessons} lições, ` +
        `${c.flashcards} flashcards, ${c.questions} questões, ${c.labs} labs.`,
    );
    total.modules += c.modules;
    total.lessons += c.lessons;
    total.flashcards += c.flashcards;
    total.questions += c.questions;
    total.labs += c.labs;
  }

  console.log(
    `Seed concluído: ${packs.length} pack(s), ${total.modules} módulos, ${total.lessons} lições, ` +
      `${total.flashcards} flashcards, ${total.questions} questões, ${total.labs} labs.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
