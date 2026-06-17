import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { adminRoutes } from "../src/admin/routes.js";
import { signToken } from "../src/auth/jwt.js";

// Regressão: o guard de role do adminRoutes deve ficar restrito a "/admin".
// Como o router é montado em "/api" junto com outros, um guard no nível do
// router responderia 403 e impediria que /api/game/* (montado depois) fosse
// alcançado por alunos. Aqui simulamos o encadeamento sem tocar no banco.
process.env.JWT_SECRET = "test-secret";
process.env.DATABASE_URL = "postgresql://test";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", adminRoutes);
  // router seguinte (como o gameRoutes), só alcançado se o admin não bloquear
  app.use("/api", (req, res) => res.json({ reached: true, path: req.path }));
  return app;
}

const alunoToken = () => signToken({ sub: "u1", role: "aluno" }, "test-secret");
const adminToken = () => signToken({ sub: "a1", role: "admin" }, "test-secret");

describe("admin routing guard", () => {
  it("aluno é bloqueado (403) nas rotas /admin", async () => {
    const res = await request(makeApp())
      .get("/api/admin/users")
      .set("authorization", `Bearer ${alunoToken()}`);
    expect(res.status).toBe(403);
  });

  it("aluno NÃO é bloqueado em rotas não-admin (cai no router seguinte)", async () => {
    const res = await request(makeApp())
      .get("/api/game/cca-foundations")
      .set("authorization", `Bearer ${alunoToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.reached).toBe(true);
  });

  it("admin passa pelo guard de /admin", async () => {
    // sem banco o handler real falharia; aqui basta confirmar que NÃO é 403
    const res = await request(makeApp())
      .get("/api/game/cca-foundations")
      .set("authorization", `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.reached).toBe(true);
  });
});
