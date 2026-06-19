import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { prisma } from "../db.js";

// Nome do marketplace (namespace dos plugins: /plugin install <slug>@colaborativa)
export const MARKETPLACE_NAME = "colaborativa";
// Nome do repositório git servido (clients clonam .../skills.git)
export const REPO_NAME = "skills.git";

// Raiz efêmera dos artefatos git. O banco é a fonte da verdade; este repo é
// regenerado no boot e a cada publicação. Configurável para os testes.
export function repoRoot(): string {
  return process.env.MARKETPLACE_DIR || path.join(os.tmpdir(), "colaborativa-marketplace");
}

function bareDir() {
  return path.join(repoRoot(), REPO_NAME);
}
function buildDir() {
  return path.join(repoRoot(), "build");
}

function git(args: string[], opts: { cwd?: string } = {}) {
  const res = spawnSync("git", args, { cwd: opts.cwd, encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(" ")} falhou: ${res.stderr || res.stdout}`);
  }
  return res.stdout;
}

type PluginForBuild = {
  slug: string;
  displayName: string;
  description: string;
  version: string;
  category: string | null;
  keywords: string[];
  author: string | null;
  skills: { slug: string; skillMd: string }[];
};

/** Monta o objeto marketplace.json a partir dos plugins publicados. */
export function buildMarketplaceJson(plugins: PluginForBuild[]) {
  return {
    name: MARKETPLACE_NAME,
    owner: { name: "Colaborativa" },
    description: "Skills e plugins do Claude Code compartilhados pela Colaborativa.",
    plugins: plugins.map((p) => ({
      name: p.slug,
      source: `./plugins/${p.slug}`,
      description: p.description,
      version: p.version,
      ...(p.displayName ? { displayName: p.displayName } : {}),
      ...(p.category ? { category: p.category } : {}),
      ...(p.keywords.length ? { keywords: p.keywords } : {}),
      ...(p.author ? { author: { name: p.author } } : {}),
    })),
  };
}

function rmrf(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Escreve a árvore de arquivos do marketplace em `dest` a partir dos plugins. */
export function writeTree(dest: string, plugins: PluginForBuild[]) {
  rmrf(dest);
  fs.mkdirSync(path.join(dest, ".claude-plugin"), { recursive: true });
  fs.writeFileSync(
    path.join(dest, ".claude-plugin", "marketplace.json"),
    JSON.stringify(buildMarketplaceJson(plugins), null, 2) + "\n",
  );
  for (const p of plugins) {
    const pdir = path.join(dest, "plugins", p.slug);
    fs.mkdirSync(path.join(pdir, ".claude-plugin"), { recursive: true });
    fs.writeFileSync(
      path.join(pdir, ".claude-plugin", "plugin.json"),
      JSON.stringify(
        { name: p.slug, description: p.description, version: p.version },
        null,
        2,
      ) + "\n",
    );
    for (const s of p.skills) {
      const sdir = path.join(pdir, "skills", s.slug);
      fs.mkdirSync(sdir, { recursive: true });
      fs.writeFileSync(path.join(sdir, "SKILL.md"), s.skillMd);
    }
  }
}

async function loadPublishedPlugins(): Promise<PluginForBuild[]> {
  const plugins = await prisma.plugin.findMany({
    where: { published: true },
    orderBy: { slug: "asc" },
    include: { skills: { orderBy: { slug: "asc" } } },
  });
  return plugins.map((p) => ({
    slug: p.slug,
    displayName: p.displayName,
    description: p.description,
    version: p.version,
    category: p.category,
    keywords: p.keywords,
    author: p.author,
    skills: p.skills.map((s) => ({ slug: s.slug, skillMd: s.skillMd })),
  }));
}

let materializing: Promise<void> | null = null;

/**
 * Regenera o repositório git do marketplace a partir do banco (plugins publicados)
 * e cria um novo commit. Serializa chamadas concorrentes para evitar corromper o
 * índice git. Tolerante a falhas: loga e não derruba o processo no boot.
 */
export async function materialize(): Promise<void> {
  if (materializing) return materializing;
  materializing = (async () => {
    const plugins = await loadPublishedPlugins();
    const bare = bareDir();
    const build = buildDir();

    if (!fs.existsSync(path.join(bare, "HEAD"))) {
      fs.mkdirSync(bare, { recursive: true });
      git(["init", "--bare", "-b", "main", bare]);
      // Permite clone anônimo via git-http-backend (GIT_HTTP_EXPORT_ALL cobre isso,
      // mas deixamos explícito para o caso de export por marcador).
      git(["--git-dir", bare, "config", "http.receivepack", "false"]);
    }

    writeTree(build, plugins);

    const env = [
      "-c", "user.email=marketplace@colaborativa.dev",
      "-c", "user.name=Colaborativa Marketplace",
    ];
    git(["--git-dir", bare, "--work-tree", build, ...env, "add", "-A"]);
    git([
      "--git-dir", bare, "--work-tree", build, ...env,
      "commit", "--allow-empty", "-m", `publish ${new Date().toISOString()}`,
    ]);
    git(["--git-dir", bare, "update-server-info"]);
  })();
  try {
    await materializing;
  } finally {
    materializing = null;
  }
}

/** Caminho do repo bare servido pelo git-http-backend (GIT_PROJECT_ROOT = repoRoot). */
export function bareRepoPath() {
  return bareDir();
}
