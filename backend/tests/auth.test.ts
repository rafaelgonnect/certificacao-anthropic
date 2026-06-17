import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { prisma } from "../src/db.js";
const app = createApp();
beforeAll(async () => {
  await prisma.user.deleteMany();
});
afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});
describe("auth routes", () => {
  it("cadastra como pendente, bloqueia login até aprovação e libera depois", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "a@a.com", password: "segredo123", name: "Ana" });
    expect(reg.status).toBe(201);
    expect(reg.body.pending).toBe(true);
    expect(reg.body.token).toBeUndefined();

    // pendente não consegue logar
    const pendente = await request(app)
      .post("/auth/login")
      .send({ email: "a@a.com", password: "segredo123" });
    expect(pendente.status).toBe(403);

    // admin aprova (simulado direto no banco)
    await prisma.user.update({ where: { email: "a@a.com" }, data: { status: "active" } });

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "a@a.com", password: "segredo123" });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    expect(login.body.user.onboarded).toBe(false);

    const me = await request(app)
      .get("/auth/me")
      .set("authorization", `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("a@a.com");
    expect(me.body.onboarded).toBe(false);

    // conclui o onboarding
    const onb = await request(app)
      .post("/auth/onboarded")
      .set("authorization", `Bearer ${login.body.token}`);
    expect(onb.status).toBe(200);
    const me2 = await request(app)
      .get("/auth/me")
      .set("authorization", `Bearer ${login.body.token}`);
    expect(me2.body.onboarded).toBe(true);
  });

  it("rejeita login com senha errada", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "b@b.com", password: "segredo123", name: "Bia" });
    await prisma.user.update({ where: { email: "b@b.com" }, data: { status: "active" } });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "b@b.com", password: "errada" });
    expect(login.status).toBe(401);
  });

  it("bloqueia /me sem token", async () => {
    const me = await request(app).get("/auth/me");
    expect(me.status).toBe(401);
  });
});
