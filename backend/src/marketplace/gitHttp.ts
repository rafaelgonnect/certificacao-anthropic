import { spawn } from "node:child_process";
import zlib from "node:zlib";
import path from "node:path";
import { Router, type Request, type Response } from "express";
import { repoRoot, REPO_NAME } from "./materialize.js";
import { validateToken } from "./tokens.js";

// Implementação direta do protocolo git smart-HTTP (read-only) usando `git
// upload-pack` — que faz parte do pacote git core. NÃO usamos `git-http-backend`
// porque o pacote git do Alpine não o inclui.

/** Empacota uma string no formato pkt-line do protocolo git (4 hex de tamanho + dados). */
function pktLine(s: string): Buffer {
  const len = (Buffer.byteLength(s) + 4).toString(16).padStart(4, "0");
  return Buffer.from(len + s);
}
const FLUSH = Buffer.from("0000");

function readBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Resolve o diretório do repo a partir do nome (só o repo conhecido é aceito). */
function repoDir(repo: string): string | null {
  if (repo !== REPO_NAME) return null;
  return path.join(repoRoot(), repo);
}

function gitProtoEnv(req: Request): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const gp = req.header("git-protocol");
  if (gp) env.GIT_PROTOCOL = gp;
  return env;
}

// GET .../info/refs?service=git-upload-pack — anúncio das refs (clone/fetch).
async function handleInfoRefs(req: Request, res: Response) {
  if (!(await validateToken(req.params.token))) return res.status(404).type("text/plain").send("not found");
  const dir = repoDir(req.params.repo);
  if (!dir) return res.status(404).type("text/plain").send("not found");
  // Só upload-pack (read-only). receive-pack (push) e dumb-http são recusados.
  if (req.query.service !== "git-upload-pack") {
    return res.status(403).type("text/plain").send("read-only marketplace");
  }

  const child = spawn("git", ["upload-pack", "--stateless-rpc", "--advertise-refs", dir], { env: gitProtoEnv(req) });
  const err: Buffer[] = [];
  child.stderr.on("data", (c: Buffer) => err.push(c));
  child.on("error", (e) => {
    console.error("git upload-pack (info/refs) spawn error:", e);
    if (!res.headersSent) res.status(500).type("text/plain").send("git error");
  });
  res.status(200);
  res.setHeader("Content-Type", "application/x-git-upload-pack-advertisement");
  res.setHeader("Cache-Control", "no-cache");
  res.write(pktLine("# service=git-upload-pack\n"));
  res.write(FLUSH);
  child.stdout.pipe(res);
  child.on("close", (code) => {
    if (code !== 0) console.error("git upload-pack (info/refs) exit", code, Buffer.concat(err).toString());
  });
  child.stdin.end();
}

// POST .../git-upload-pack — negociação e envio do packfile.
async function handleUploadPack(req: Request, res: Response) {
  if (!(await validateToken(req.params.token))) return res.status(404).type("text/plain").send("not found");
  const dir = repoDir(req.params.repo);
  if (!dir) return res.status(404).type("text/plain").send("not found");

  let body = await readBody(req);
  if ((req.header("content-encoding") || "").includes("gzip")) {
    try { body = zlib.gunzipSync(body); } catch (e) {
      console.error("falha ao descomprimir corpo gzip:", e);
      return res.status(400).type("text/plain").send("bad gzip");
    }
  }

  const child = spawn("git", ["upload-pack", "--stateless-rpc", dir], { env: gitProtoEnv(req) });
  const err: Buffer[] = [];
  child.stderr.on("data", (c: Buffer) => err.push(c));
  child.on("error", (e) => {
    console.error("git upload-pack spawn error:", e);
    if (!res.headersSent) res.status(500).type("text/plain").send("git error");
  });
  res.status(200);
  res.setHeader("Content-Type", "application/x-git-upload-pack-result");
  res.setHeader("Cache-Control", "no-cache");
  child.stdout.pipe(res);
  child.on("close", (code) => {
    if (code !== 0) console.error("git upload-pack exit", code, Buffer.concat(err).toString());
  });
  child.stdin.write(body);
  child.stdin.end();
}

function wrap(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((e) => {
      console.error("git http handler error:", e);
      if (!res.headersSent) res.status(500).type("text/plain").send("internal error");
    });
  };
}

/**
 * Router git smart-HTTP read-only do marketplace, protegido por token no path.
 * DEVE ser montado ANTES de express.json() (corpo binário) e do fallback do SPA.
 */
export function gitHttpRouter() {
  const router = Router();
  router.get("/git/m/:token/:repo/info/refs", wrap(handleInfoRefs));
  router.post("/git/m/:token/:repo/git-upload-pack", wrap(handleUploadPack));
  return router;
}
