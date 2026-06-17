// Seed "force": (re)semeia o admin e TODOS os packs do registro, recriando o
// conteúdo do zero. Use para popular um banco novo ou aplicar atualizações de
// conteúdo manualmente: `npx prisma db seed`.
//
// ATENÇÃO: recria cada certificação (deleteMany por slug), o que zera o progresso
// (revisões) ligado àquele conteúdo. No boot do container usa-se o seedOnBoot.ts,
// que só re-semeia packs novos ou com versão maior.
import { PrismaClient } from "@prisma/client";
import { packs } from "./content/registry.js";
import { seedPack, upsertAdmin, type SeedCounts } from "./seedPack.js";

const prisma = new PrismaClient();

async function main() {
  await upsertAdmin(prisma);

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
