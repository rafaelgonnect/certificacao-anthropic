import express from "express";
import cors from "cors";
import path from "node:path";
import { authRoutes } from "./auth/routes.js";
import { contentRoutes } from "./content/routes.js";
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api", contentRoutes);
  app.use("/", contentRoutes);
  if (process.env.NODE_ENV === "production") {
    const publicDir = path.resolve(process.cwd(), "public");
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
  }
  return app;
}
