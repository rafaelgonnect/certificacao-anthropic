import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "../src/auth/password.js";
import { signToken, verifyToken } from "../src/auth/jwt.js";
describe("password", () => {
  it("faz hash e confere a senha", async () => {
    const hash = await hashPassword("segredo123");
    expect(hash).not.toBe("segredo123");
    expect(await comparePassword("segredo123", hash)).toBe(true);
    expect(await comparePassword("errada", hash)).toBe(false);
  });
});
describe("jwt", () => {
  it("assina e verifica um token", () => {
    const token = signToken({ sub: "u1", role: "aluno" }, "s");
    const p = verifyToken(token, "s");
    expect(p.sub).toBe("u1");
    expect(p.role).toBe("aluno");
  });
  it("rejeita token com segredo errado", () => {
    const token = signToken({ sub: "u1", role: "aluno" }, "s");
    expect(() => verifyToken(token, "outro")).toThrow();
  });
});
