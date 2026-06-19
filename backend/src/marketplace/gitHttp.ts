import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { Router, type Request, type Response } from "express";
import { repoRoot } from "./materialize.js";
import { validateToken } from "./tokens.js";

// Localiza o binário git-http-backend dentro do exec-path do git (resolvido 1x).
const gitHttpBackend = (() => {
  try {
    const execPath = spawnSync("git", ["--exec-path"], { encoding: "utf8" }).stdout.trim();
    const candidates = [
      path.join(execPath, "git-http-backend"),
      path.join(execPath, "git-http-backend.exe"),
    ];
    return candidates.find((c) => fs.existsSync(c)) ?? candidates[0];
  } catch {
    return "git-http-backend";
  }
})();

/** Lê o corpo bruto da requisição (negociação do upload-pack, pequena). */
function readBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Separa o bloco de headers CGI do corpo na saída do git-http-backend. */
export function parseCgi(out: Buffer) {
  const sep = out.indexOf("\r\n\r\n");
  if (sep === -1) return { status: 200, headers: {} as Record<string, string>, body: out };
  const headerText = out.slice(0, sep).toString("utf8");
  const body = out.slice(sep + 4);
  const headers: Record<string, string> = {};
  let status = 200;
  for (const line of headerText.split("\r\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key.toLowerCase() === "status") {
      status = parseInt(value, 10) || 200;
    } else {
      headers[key] = value;
    }
  }
  return { status, headers, body };
}

async function handle(req: Request, res: Response) {
  const token = req.params.token;
  const record = await validateToken(token);
  // Token inválido/revogado: 404 para não vazar a existência do recurso.
  if (!record) return res.status(404).type("text/plain").send("not found");

  const subPath = req.params[0] ?? ""; // ex: skills.git/info/refs
  const pathInfo = "/" + subPath;

  // Read-only: nunca aceitamos push.
  const queryString = (req.originalUrl.split("?")[1] ?? "");
  if (pathInfo.includes("git-receive-pack") || queryString.includes("git-receive-pack")) {
    return res.status(403).type("text/plain").send("read-only marketplace");
  }

  const body = await readBody(req);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_PROJECT_ROOT: repoRoot(),
    GIT_HTTP_EXPORT_ALL: "1",
    PATH_INFO: pathInfo,
    REQUEST_METHOD: req.method,
    QUERY_STRING: queryString,
    CONTENT_TYPE: req.header("content-type") ?? "",
    REMOTE_ADDR: req.ip ?? "",
  };
  const contentLength = req.header("content-length");
  if (contentLength) env.CONTENT_LENGTH = contentLength;
  const gitProtocol = req.header("git-protocol");
  if (gitProtocol) env.GIT_PROTOCOL = gitProtocol;

  const child = spawn(gitHttpBackend, [], { env });
  const out: Buffer[] = [];
  const err: Buffer[] = [];
  child.stdout.on("data", (c: Buffer) => out.push(c));
  child.stderr.on("data", (c: Buffer) => err.push(c));
  child.on("error", (e) => {
    console.error("git-http-backend spawn error:", e);
    if (!res.headersSent) res.status(500).type("text/plain").send("git backend error");
  });
  child.on("close", (code) => {
    if (code !== 0) {
      console.error("git-http-backend exit", code, Buffer.concat(err).toString());
      if (!res.headersSent) return res.status(500).type("text/plain").send("git backend error");
      return res.end();
    }
    const { status, headers, body: respBody } = parseCgi(Buffer.concat(out));
    res.status(status);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end(respBody);
  });
  child.stdin.write(body);
  child.stdin.end();
}

/**
 * Router git smart-HTTP read-only do marketplace, montado em /git e protegido por
 * token no path. DEVE ser montado ANTES de express.json() (corpo binário) e do
 * fallback do SPA.
 */
export function gitHttpRouter() {
  const router = Router();
  router.all("/git/m/:token/*", (req, res) => {
    handle(req, res).catch((e) => {
      console.error("git http handler error:", e);
      if (!res.headersSent) res.status(500).type("text/plain").send("internal error");
    });
  });
  return router;
}
