// Semeia o marketplace de skills a partir dos pacotes empacotados em
// prisma/seed-skills/<slug>/. Idempotente e NÃO destrutivo: só cria pacotes que
// ainda não existem no banco (preserva edições feitas pelos admins via UI).
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(here, "seed-skills");

type SkillFile = { path: string; content: string };

/** Lê recursivamente os arquivos de uma skill (exceto SKILL.md) como [{path, content}]. */
function readSkillFiles(skillDir: string): { skillMd: string; files: SkillFile[] } {
  const skillMd = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
  const files: SkillFile[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else {
        const rel = path.relative(skillDir, abs).split(path.sep).join("/");
        if (rel === "SKILL.md") continue;
        files.push({ path: rel, content: fs.readFileSync(abs, "utf8") });
      }
    }
  };
  walk(skillDir);
  return { skillMd, files };
}

export async function seedMarketplace(client: PrismaClient): Promise<void> {
  if (!fs.existsSync(SEED_DIR)) return;
  const pluginDirs = fs
    .readdirSync(SEED_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dir of pluginDirs) {
    const base = path.join(SEED_DIR, dir.name);
    const manifestPath = path.join(base, "plugin.json");
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    const existing = await client.plugin.findUnique({ where: { slug: manifest.slug } });
    if (existing) {
      console.log(`= marketplace: ${manifest.slug} já existe — pulado.`);
      continue;
    }

    const skillsDir = path.join(base, "skills");
    const skillSlugs = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
      : [];

    await client.plugin.create({
      data: {
        slug: manifest.slug,
        displayName: manifest.displayName,
        description: manifest.description,
        version: manifest.version ?? "0.1.0",
        category: manifest.category ?? null,
        keywords: manifest.keywords ?? [],
        author: manifest.author ?? null,
        published: true,
        skills: {
          create: skillSlugs.map((slug) => {
            const { skillMd, files } = readSkillFiles(path.join(skillsDir, slug));
            return { slug, skillMd, files };
          }),
        },
      },
    });
    console.log(`+ marketplace: ${manifest.slug} semeado (${skillSlugs.length} skills).`);
  }
}
