import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Garante que o bundle de skills empacotado (prisma/seed-skills) está bem-formado:
// cada pacote tem plugin.json válido e cada skill tem SKILL.md.
const SEED_DIR = path.resolve(__dirname, "..", "prisma", "seed-skills");

describe("bundle de seed-skills", () => {
  it("existe e tem ao menos o pacote superset", () => {
    expect(fs.existsSync(SEED_DIR)).toBe(true);
    expect(fs.existsSync(path.join(SEED_DIR, "superset"))).toBe(true);
  });

  it("cada pacote tem plugin.json válido e skills com SKILL.md", () => {
    const pluginDirs = fs.readdirSync(SEED_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
    expect(pluginDirs.length).toBeGreaterThan(0);
    for (const dir of pluginDirs) {
      const base = path.join(SEED_DIR, dir.name);
      const manifest = JSON.parse(fs.readFileSync(path.join(base, "plugin.json"), "utf8"));
      expect(manifest.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(manifest.displayName).toBeTruthy();
      expect(manifest.description).toBeTruthy();

      const skillsDir = path.join(base, "skills");
      const skills = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      expect(skills.length).toBeGreaterThan(0);
      for (const s of skills) {
        expect(fs.existsSync(path.join(skillsDir, s.name, "SKILL.md")), `${dir.name}/${s.name}/SKILL.md`).toBe(true);
      }
    }
  });

  it("o pacote superset tem as 6 skills esperadas", () => {
    const skillsDir = path.join(SEED_DIR, "superset", "skills");
    const skills = fs.readdirSync(skillsDir).sort();
    expect(skills).toEqual([
      "django-superset-embed",
      "superset-agent",
      "superset-dev-rules",
      "superset-embedding",
      "superset-frontend-design",
      "superset-security-audit",
    ]);
  });
});
