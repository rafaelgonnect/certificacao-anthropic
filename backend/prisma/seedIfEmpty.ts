// Seed idempotente para o boot do container: só popula se o banco estiver vazio.
// Evita que um redeploy re-rode o seed "force" (seed.ts faz deleteMany na
// certificação, com cascade em flashcards/questões/labs e no progresso do aluno).
// Para forçar um re-seed manual, use: npx prisma db seed
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const certs = await prisma.certification.count();
  if (certs > 0) {
    console.log(`Seed pulado: já existem ${certs} certificação(ões) no banco.`);
  } else {
    console.log("Banco vazio — rodando o seed inicial...");
    execSync("npx prisma db seed", { stdio: "inherit" });
  }
} catch (err) {
  console.error("Falha ao checar/rodar o seed inicial:", err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
