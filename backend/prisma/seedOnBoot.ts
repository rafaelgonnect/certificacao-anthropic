// Seed por versão, executado no boot do container.
// Para cada pack do registro:
//   - se a certificação não existe no banco -> semeia (novo conteúdo);
//   - se existe com versão MENOR que a do código -> re-semeia (atualização);
//   - se existe com versão >= a do código -> pula (preserva o progresso).
// Assim, novos packs e atualizações entram sozinhos no deploy, sem zerar o
// progresso de packs inalterados. Para forçar tudo, use `npx prisma db seed`.
import { PrismaClient } from "@prisma/client";
import { packs } from "./content/registry.js";
import { seedPack, upsertAdmin } from "./seedPack.js";
import { seedMarketplace } from "./seedMarketplace.js";

const prisma = new PrismaClient();

try {
  await upsertAdmin(prisma);
  await seedMarketplace(prisma);

  for (const pack of packs) {
    const existing = await prisma.certification.findUnique({
      where: { slug: pack.slug },
      select: { version: true },
    });

    if (!existing) {
      const c = await seedPack(prisma, pack);
      console.log(`+ ${pack.slug} v${pack.version} semeado (${c.lessons} lições).`);
    } else if (existing.version < pack.version) {
      const c = await seedPack(prisma, pack);
      console.log(`~ ${pack.slug} atualizado v${existing.version} -> v${pack.version} (${c.lessons} lições).`);
    } else {
      console.log(`= ${pack.slug} v${existing.version} já atual — pulado.`);
    }

    // Sincroniza metadados leves (nível) mesmo quando o pack não é re-semeado —
    // assim mudanças de nível propagam no boot sem resetar o progresso do aluno.
    await prisma.certification.update({
      where: { slug: pack.slug },
      data: { level: pack.level ?? "iniciante" },
    });
  }
} catch (err) {
  console.error("Falha no seed de boot:", err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
