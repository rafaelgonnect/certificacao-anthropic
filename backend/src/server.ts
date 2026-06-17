import express from "express";
import cors from "cors";
import path from "node:path";
import { authRoutes } from "./auth/routes.js";
import { contentRoutes } from "./content/routes.js";
import { learningRoutes } from "./learning/routes.js";
import { examRoutes } from "./learning/examRoutes.js";
import { labRoutes } from "./learning/labRoutes.js";
import { adminRoutes } from "./admin/routes.js";
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));

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
