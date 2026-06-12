import { describe, it, expect } from "vitest";
import { loadEnv } from "../src/env.js";
describe("loadEnv", () => {
  it("lê variáveis válidas", () => {
    const env = loadEnv({ DATABASE_URL: "postgresql://x", JWT_SECRET: "s", PORT: "3001" });
    expect(env.PORT).toBe(3001);
    expect(env.JWT_SECRET).toBe("s");
  });
  it("lança erro se JWT_SECRET faltar", () => {
    expect(() => loadEnv({ DATABASE_URL: "postgresql://x", PORT: "3001" } as any)).toThrow();
  });
});
