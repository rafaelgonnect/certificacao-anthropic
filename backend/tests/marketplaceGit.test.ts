import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";

// Mocka a validação de token para não depender do banco: só "good" é válido.
vi.mock("../src/marketplace/tokens.js", () => ({
  validateToken: async (t: string) => (t === "good" ? { id: "tok", userId: "u" } : null),
}));

const hasGit = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;

let server: http.Server;
let baseUrl = "";
let root = "";

beforeAll(async () => {
  if (!hasGit) return;
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mkt-http-"));
  process.env.MARKETPLACE_DIR = root;

  // Importa o módulo DEPOIS de setar MARKETPLACE_DIR (repoRoot lê o env).
  const { writeTree } = await import("../src/marketplace/materialize.js");
  const { gitHttpRouter } = await import("../src/marketplace/gitHttp.js");

  const build = path.join(root, "build");
  const bare = path.join(root, "skills.git");
  writeTree(build, [
    { slug: "demo", displayName: "Demo", description: "d", version: "0.1.0", category: null, keywords: [], author: null, skills: [{ slug: "ola", skillMd: "# ola" }] },
  ]);
  const env = ["-c", "user.email=t@t.dev", "-c", "user.name=t"];
  spawnSync("git", ["init", "--bare", "-b", "main", bare]);
  spawnSync("git", ["--git-dir", bare, "--work-tree", build, ...env, "add", "-A"]);
  spawnSync("git", ["--git-dir", bare, "--work-tree", build, ...env, "commit", "-m", "x"]);
  spawnSync("git", ["--git-dir", bare, "update-server-info"]);

  const app = express();
  app.use(gitHttpRouter());
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

// Clone assíncrono: NÃO use spawnSync — ele bloquearia o event loop e o servidor
// express (mesmo processo) não conseguiria atender a requisição (deadlock).
function cloneAsync(url: string, dest: string): Promise<{ status: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("git", ["clone", url, dest], { encoding: "utf8" } as never);
    const err: Buffer[] = [];
    child.stderr.on("data", (c: Buffer) => err.push(c));
    child.on("close", (status) => resolve({ status, stderr: Buffer.concat(err).toString() }));
  });
}

describe.runIf(hasGit)("git smart-HTTP serving", () => {
  it("clona via HTTP com token válido e recupera o conteúdo", async () => {
    const dest = path.join(root, "clone-good");
    const res = await cloneAsync(`${baseUrl}/git/m/good/skills.git`, dest);
    expect(res.status, res.stderr).toBe(0);
    expect(fs.existsSync(path.join(dest, ".claude-plugin", "marketplace.json"))).toBe(true);
    expect(fs.existsSync(path.join(dest, "plugins", "demo", "skills", "ola", "SKILL.md"))).toBe(true);
  });

  it("rejeita token inválido (clone falha)", async () => {
    const dest = path.join(root, "clone-bad");
    const res = await cloneAsync(`${baseUrl}/git/m/bad/skills.git`, dest);
    expect(res.status).not.toBe(0);
  });
});
