import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { authRoutes } from "./auth/routes.js";
import { contentRoutes } from "./content/routes.js";
import { learningRoutes } from "./learning/routes.js";
import { examRoutes } from "./learning/examRoutes.js";
import { labRoutes } from "./learning/labRoutes.js";
import { adminRoutes } from "./admin/routes.js";
import { gameRoutes } from "./game/routes.js";
import { marketplaceRoutes } from "./marketplace/routes.js";
import { gitHttpRouter } from "./marketplace/gitHttp.js";
// Lido uma vez no start. BUILD_TIME/GIT_SHA são gravados pelo Dockerfile no build;
// em dev (sem os arquivos) caímos no fallback. Serve pra saber qual versão está no ar.
const BUILD_INFO = (() => {
  const read = (f: string, fallback: string) => {
    try {
      return fs.readFileSync(path.resolve(process.cwd(), f), "utf8").trim() || fallback;
    } catch {
      return fallback;
    }
  };
  return { builtAt: read("BUILD_TIME", "dev"), commit: read("GIT_SHA", "dev") };
})();

export function createApp() {
  const app = express();
  app.use(cors());
  // Git smart-HTTP do marketplace: ANTES do express.json() (corpo binário) e do
  // fallback do SPA. Tem token no path e é read-only.
  app.use(gitHttpRouter());
  app.use(express.json());
  const health = (_req: express.Request, res: express.Response) =>
    res.json({ ok: true, builtAt: BUILD_INFO.builtAt, commit: BUILD_INFO.commit });
  app.get("/health", health);
  app.get("/api/health", health);

  // Em produção, serve o SPA buildado ANTES das rotas. Sem isso, "/" e demais
  // paths não-API entrariam nos routers protegidos (requireAuth) e retornariam
  // 401 {"error":"missing token"} em vez do index.html.
  if (process.env.NODE_ENV === "production") {
    const publicDir = path.resolve(process.cwd(), "public");
    app.use(express.static(publicDir));
    // SPA fallback: serve index.html para GETs não-API; deixa /api/* seguir para os routers.
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

  app.use("/auth", authRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api", learningRoutes);
  app.use("/", learningRoutes);
  app.use("/api", contentRoutes);
  app.use("/", contentRoutes);
  app.use("/api", examRoutes);
  app.use("/", examRoutes);
  app.use("/api", labRoutes);
  app.use("/", labRoutes);
  app.use("/api", adminRoutes);
  app.use("/", adminRoutes);
  app.use("/api", gameRoutes);
  app.use("/", gameRoutes);
  app.use("/api", marketplaceRoutes);
  app.use("/", marketplaceRoutes);

  // 404 para rotas de API não encontradas
  app.use("/api", (_req, res) => res.status(404).json({ error: "not found" }));

  // Handler de erro global: erros não tratados viram 500 limpo (não derrubam o request)
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error(err);
      res.status(500).json({ error: "internal error" });
    }
  );

  return app;
}
