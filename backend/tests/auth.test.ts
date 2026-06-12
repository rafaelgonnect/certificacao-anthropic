import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { prisma } from "../src/db.js";
const app = createApp();
beforeAll(async () => { await prisma.user.deleteMany(); });
afterAll(async () => { await prisma.user.deleteMany(); await prisma.$disconnect(); });
describe("auth routes", () => {
  it("registra, faz login e retorna o usuário em /me", async () => {
    const reg = await request(app).post("/auth/register").send({ email: "a@a.com", password: "segredo123", name: "Ana" });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe("a@a.com");
    expect(reg.body.user.role).toBe("aluno");
    expect(reg.body.token).toBeTruthy();
    const login = await request(app).post("/auth/login").send({ email: "a@a.com", password: "segredo123" });
    expect(login.status).toBe(200);
    const me = await request(app).get("/auth/me").set("authorization", `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("a@a.com");
  });
  it("rejeita login com senha errada", async () => {
    await request(app).post("/auth/register").send({ email: "b@b.com", password: "segredo123", name: "Bia" });
    const login = await request(app).post("/auth/login").send({ email: "b@b.com", password: "errada" });
    expect(login.status).toBe(401);
  });
  it("bloqueia /me sem token", async () => {
    const me = await request(app).get("/auth/me");
    expect(me.status).toBe(401);
  });
});
