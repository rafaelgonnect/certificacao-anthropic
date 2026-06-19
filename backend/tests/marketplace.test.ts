import { describe, it, expect, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildMarketplaceJson, writeTree } from "../src/marketplace/materialize.js";

const samplePlugins = [
  {
    slug: "git-helpers",
    displayName: "Git Helpers",
    description: "Atalhos de git",
    version: "1.2.0",
    category: "devtools",
    keywords: ["git", "vcs"],
    author: "Colaborativa",
    skills: [
      { slug: "rebase-seguro", skillMd: "---\nname: rebase-seguro\n---\nconteúdo", files: [{ path: "references/guia.md", content: "# guia" }] },
      { slug: "bisect", skillMd: "# bisect" },
    ],
  },
];

const tmpDirs: string[] = [];
function mkTmp(prefix: string) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
afterAll(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

describe("buildMarketplaceJson", () => {
  it("usa nome do marketplace e sources relativos por slug", () => {
    const json = buildMarketplaceJson(samplePlugins);
    expect(json.name).toBe("colaborativa");
    expect(json.plugins).toHaveLength(1);
    const p = json.plugins[0];
    expect(p.name).toBe("git-helpers");
    expect(p.source).toBe("./plugins/git-helpers");
    expect(p.version).toBe("1.2.0");
    expect(p.keywords).toEqual(["git", "vcs"]);
    expect(p.author).toEqual({ name: "Colaborativa" });
  });

  it("omite campos opcionais vazios", () => {
    const json = buildMarketplaceJson([
      { slug: "x", displayName: "X", description: "d", version: "0.1.0", category: null, keywords: [], author: null, skills: [] },
    ]);
    const p = json.plugins[0] as Record<string, unknown>;
    expect("category" in p).toBe(false);
    expect("keywords" in p).toBe(false);
    expect("author" in p).toBe(false);
  });
});

describe("writeTree", () => {
  it("materializa marketplace.json, plugin.json e SKILL.md", () => {
    const dest = mkTmp("mkt-tree-");
    writeTree(dest, samplePlugins);

    const mkt = JSON.parse(fs.readFileSync(path.join(dest, ".claude-plugin", "marketplace.json"), "utf8"));
    expect(mkt.name).toBe("colaborativa");

    const pluginJson = JSON.parse(
      fs.readFileSync(path.join(dest, "plugins", "git-helpers", ".claude-plugin", "plugin.json"), "utf8"),
    );
    expect(pluginJson.name).toBe("git-helpers");
    expect(pluginJson.version).toBe("1.2.0");

    const skill = fs.readFileSync(path.join(dest, "plugins", "git-helpers", "skills", "rebase-seguro", "SKILL.md"), "utf8");
    expect(skill).toContain("rebase-seguro");

    // arquivo extra (references/) materializado preservando o caminho relativo
    const ref = fs.readFileSync(path.join(dest, "plugins", "git-helpers", "skills", "rebase-seguro", "references", "guia.md"), "utf8");
    expect(ref).toBe("# guia");
  });

  it("limpa o destino antes de reescrever (remove skills excluídas)", () => {
    const dest = mkTmp("mkt-tree2-");
    writeTree(dest, samplePlugins);
    expect(fs.existsSync(path.join(dest, "plugins", "git-helpers", "skills", "bisect"))).toBe(true);
    // Reescreve sem a skill "bisect"
    writeTree(dest, [{ ...samplePlugins[0], skills: [samplePlugins[0].skills[0]] }]);
    expect(fs.existsSync(path.join(dest, "plugins", "git-helpers", "skills", "bisect"))).toBe(false);
  });
});

// Round-trip git: materializa a árvore, commita num bare e clona de volta.
// Valida que os source relativos e o conteúdo sobrevivem ao clone. Pulado se git ausente.
const hasGit = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
describe.runIf(hasGit)("git round-trip", () => {
  it("clona o bare e recupera marketplace.json + SKILL.md", () => {
    const root = mkTmp("mkt-git-");
    const build = path.join(root, "build");
    const bare = path.join(root, "skills.git");
    const clone = path.join(root, "clone");
    writeTree(build, samplePlugins);

    const env = ["-c", "user.email=t@t.dev", "-c", "user.name=t"];
    expect(spawnSync("git", ["init", "--bare", "-b", "main", bare]).status).toBe(0);
    expect(spawnSync("git", ["--git-dir", bare, "--work-tree", build, ...env, "add", "-A"]).status).toBe(0);
    expect(spawnSync("git", ["--git-dir", bare, "--work-tree", build, ...env, "commit", "-m", "x"]).status).toBe(0);
    expect(spawnSync("git", ["clone", bare, clone]).status).toBe(0);

    const mkt = JSON.parse(fs.readFileSync(path.join(clone, ".claude-plugin", "marketplace.json"), "utf8"));
    expect(mkt.plugins[0].source).toBe("./plugins/git-helpers");
    expect(fs.existsSync(path.join(clone, "plugins", "git-helpers", "skills", "rebase-seguro", "SKILL.md"))).toBe(true);
  });
});
