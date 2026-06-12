# Plataforma Certificações Claude — Fases 0+1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a primeira fatia vertical: um aluno faz login (3 papéis), navega a trilha da certificação *Foundations* e lê uma lição renderizada de Markdown — com backend Node.js + Postgres e frontend React.

**Architecture:** Monorepo com `backend/` (Express + Prisma + PostgreSQL) e `frontend/` (React + Vite). Backend é a fonte única de verdade, expõe REST/JSON com autenticação JWT. Conteúdo vive no banco, populado por seed versionado. Frontend é uma SPA que consome a API.

**Tech Stack:** Node.js 20+, TypeScript, Express, Prisma ORM, PostgreSQL, Zod (validação), bcrypt + jsonwebtoken (auth), Vitest + Supertest (testes backend), React 18 + Vite + React Router + TanStack Query, react-markdown, Vitest + Testing Library (testes frontend).

---

## Convenções

- **TDD sempre:** teste falhando → rodar e ver falhar → implementação mínima → rodar e ver passar → commit.
- **Banco de teste:** Postgres separado via variável `DATABASE_URL` de teste; cada suíte de integração usa um schema limpo.
- **Commits frequentes** com Conventional Commits (`feat:`, `test:`, `chore:`).
- Todos os comandos rodam a partir da raiz do repo salvo indicação contrária.

---

## Estrutura de arquivos

```
backend/
  package.json
  tsconfig.json
  vitest.config.ts
  .env.example
  prisma/
    schema.prisma          # modelos: User, Certification, Module, Lesson
    seed.ts                # seed da Foundations (1 módulo + 1 lição mínimos)
  src/
    server.ts              # cria e exporta o app Express (sem listen)
    index.ts               # importa app e faz listen (entrypoint)
    db.ts                  # instancia PrismaClient compartilhado
    env.ts                 # validação de variáveis de ambiente (Zod)
    auth/
      password.ts          # hash/compare com bcrypt
      jwt.ts               # sign/verify de JWT
      middleware.ts        # requireAuth, requireRole
      routes.ts            # POST /auth/register, /auth/login, GET /auth/me
    content/
      routes.ts            # GET /certifications, /certifications/:slug, /lessons/:id
  tests/
    auth.test.ts
    content.test.ts
frontend/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx               # bootstrap React + Router + QueryClient
    api/client.ts          # fetch wrapper com token
    auth/AuthContext.tsx   # estado de auth (token, user)
    pages/
      LoginPage.tsx
      TrilhaPage.tsx       # lista módulos/lições da certificação
      LessonPage.tsx       # renderiza reading_md
    components/
      ProtectedRoute.tsx
    tests/
      LoginPage.test.tsx
      TrilhaPage.test.tsx
docs/superpowers/...
.gitignore
README.md
```

---

## Task 1: Scaffolding do backend

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/.env.example`
- Create: `backend/src/env.ts`
- Test: `backend/tests/env.test.ts`

- [ ] **Step 1: Criar `backend/package.json`**

```json
{
  "name": "certificacao-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "express": "^4.21.1",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.16.0",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.22.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Criar `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Criar `backend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "forks",
    fileParallelism: false,
  },
});
```

- [ ] **Step 4: Criar `backend/.env.example`**

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/certificacao?schema=public"
JWT_SECRET="dev-secret-change-me"
PORT=3001
```

- [ ] **Step 5: Escrever o teste falhando para `env.ts`**

`backend/tests/env.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadEnv } from "../src/env.js";

describe("loadEnv", () => {
  it("lê variáveis válidas", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://x",
      JWT_SECRET: "s",
      PORT: "3001",
    });
    expect(env.PORT).toBe(3001);
    expect(env.JWT_SECRET).toBe("s");
  });

  it("lança erro se JWT_SECRET faltar", () => {
    expect(() =>
      loadEnv({ DATABASE_URL: "postgresql://x", PORT: "3001" })
    ).toThrow();
  });
});
```

- [ ] **Step 6: Rodar o teste e ver falhar**

Run: `cd backend && npm install && npm test -- env`
Expected: FAIL — `loadEnv` não existe / módulo não encontrado.

- [ ] **Step 7: Implementar `backend/src/env.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().default(3001),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return schema.parse(source);
}

export const env = loadEnv();
```

Nota: como `env` é avaliado na importação, os testes importam `loadEnv` e passam um objeto — não dependem de `process.env` real.

- [ ] **Step 8: Rodar o teste e ver passar**

Run: `cd backend && npm test -- env`
Expected: PASS (2 testes).

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/vitest.config.ts backend/.env.example backend/src/env.ts backend/tests/env.test.ts
git commit -m "chore: scaffold backend with env validation"
```

---

## Task 2: Schema Prisma + cliente de DB

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/db.ts`

- [ ] **Step 1: Criar `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  aluno
  gestor
  admin
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(aluno)
  createdAt    DateTime @default(now())
}

model Certification {
  id          String   @id @default(uuid())
  slug        String   @unique
  title       String
  description String
  version     Int      @default(1)
  modules     Module[]
  createdAt   DateTime @default(now())
}

model Module {
  id        String        @id @default(uuid())
  cert      Certification @relation(fields: [certId], references: [id], onDelete: Cascade)
  certId    String
  order     Int
  title     String
  lessons   Lesson[]
}

model Lesson {
  id         String   @id @default(uuid())
  module     Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  moduleId   String
  order      Int
  title      String
  readingMd  String
}
```

- [ ] **Step 2: Gerar o cliente e criar a migração**

Run: `cd backend && npx prisma migrate dev --name init`
Expected: cria `prisma/migrations/.../migration.sql` e gera o client sem erro.
(Requer Postgres acessível via `DATABASE_URL`.)

- [ ] **Step 3: Criar `backend/src/db.ts`**

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 4: Commit**

```bash
git add backend/prisma backend/src/db.ts
git commit -m "feat: add prisma schema for users and content"
```

---

## Task 3: Hash de senha e JWT

**Files:**
- Create: `backend/src/auth/password.ts`
- Create: `backend/src/auth/jwt.ts`
- Test: `backend/tests/authunit.test.ts`

- [ ] **Step 1: Escrever testes falhando**

`backend/tests/authunit.test.ts`:

```ts
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
    const payload = verifyToken(token, "s");
    expect(payload.sub).toBe("u1");
    expect(payload.role).toBe("aluno");
  });

  it("rejeita token com segredo errado", () => {
    const token = signToken({ sub: "u1", role: "aluno" }, "s");
    expect(() => verifyToken(token, "outro")).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npm test -- authunit`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implementar `backend/src/auth/password.ts`**

```ts
import bcrypt from "bcryptjs";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Implementar `backend/src/auth/jwt.ts`**

```ts
import jwt from "jsonwebtoken";

export type TokenPayload = { sub: string; role: "aluno" | "gestor" | "admin" };

export function signToken(payload: TokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken(token: string, secret: string): TokenPayload {
  const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
  return { sub: String(decoded.sub), role: decoded.role };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npm test -- authunit`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/password.ts backend/src/auth/jwt.ts backend/tests/authunit.test.ts
git commit -m "feat: add password hashing and jwt helpers"
```

---

## Task 4: App Express + middleware de auth

**Files:**
- Create: `backend/src/auth/middleware.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/index.ts`

- [ ] **Step 1: Implementar `backend/src/auth/middleware.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "./jwt.js";
import { env } from "../env.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing token" });
  }
  try {
    req.user = verifyToken(header.slice(7), env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

export function requireRole(...roles: TokenPayload["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}
```

- [ ] **Step 2: Implementar `backend/src/server.ts`**

```ts
import express from "express";
import cors from "cors";
import { authRoutes } from "./auth/routes.js";
import { contentRoutes } from "./content/routes.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRoutes);
  app.use("/", contentRoutes);
  return app;
}
```

- [ ] **Step 3: Implementar `backend/src/index.ts`**

```ts
import { createApp } from "./server.js";
import { env } from "./env.js";

createApp().listen(env.PORT, () => {
  console.log(`API on http://localhost:${env.PORT}`);
});
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/auth/middleware.ts backend/src/server.ts backend/src/index.ts
git commit -m "feat: add express app and auth middleware"
```

Nota: `server.ts` importa `routes.ts` que serão criadas nas Tasks 5 e 6. Não rode os testes ainda — o build dependerá dessas rotas.

---

## Task 5: Rotas de autenticação (integração)

**Files:**
- Create: `backend/src/auth/routes.ts`
- Test: `backend/tests/auth.test.ts`

- [ ] **Step 1: Escrever o teste de integração falhando**

`backend/tests/auth.test.ts`:

```ts
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
  it("registra, faz login e retorna o usuário em /me", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "a@a.com", password: "segredo123", name: "Ana" });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe("a@a.com");
    expect(reg.body.user.role).toBe("aluno");
    expect(reg.body.token).toBeTruthy();

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "a@a.com", password: "segredo123" });
    expect(login.status).toBe(200);
    const token = login.body.token;

    const me = await request(app)
      .get("/auth/me")
      .set("authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("a@a.com");
  });

  it("rejeita login com senha errada", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "b@b.com", password: "segredo123", name: "Bia" });
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npm test -- auth.test`
Expected: FAIL — `auth/routes.js` não existe.

- [ ] **Step 3: Implementar `backend/src/auth/routes.ts`**

```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword, comparePassword } from "./password.js";
import { signToken } from "./jwt.js";
import { requireAuth } from "./middleware.js";
import { env } from "../env.js";

export const authRoutes = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

authRoutes.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const { email, password, name } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "email in use" });
  const user = await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password) },
  });
  const token = signToken({ sub: user.id, role: user.role }, env.JWT_SECRET);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRoutes.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  const token = signToken({ sub: user.id, role: user.role }, env.JWT_SECRET);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

authRoutes.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: "not found" });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test -- auth.test`
Expected: PASS (3 testes). Requer Postgres de teste acessível.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/routes.ts backend/tests/auth.test.ts
git commit -m "feat: add register/login/me auth routes"
```

---

## Task 6: Rotas de conteúdo (integração)

**Files:**
- Create: `backend/src/content/routes.ts`
- Test: `backend/tests/content.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

`backend/tests/content.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { prisma } from "../src/db.js";

const app = createApp();

let lessonId = "";

beforeAll(async () => {
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.certification.deleteMany();
  const cert = await prisma.certification.create({
    data: {
      slug: "cca-foundations",
      title: "Claude Certified Architect – Foundations",
      description: "Teste",
      modules: {
        create: {
          order: 1,
          title: "Claude API",
          lessons: { create: { order: 1, title: "Intro", readingMd: "# Olá" } },
        },
      },
    },
    include: { modules: { include: { lessons: true } } },
  });
  lessonId = cert.modules[0].lessons[0].id;
});

afterAll(async () => {
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.certification.deleteMany();
  await prisma.$disconnect();
});

describe("content routes", () => {
  it("lista certificações", async () => {
    const res = await request(app).get("/certifications");
    expect(res.status).toBe(200);
    expect(res.body.some((c: any) => c.slug === "cca-foundations")).toBe(true);
  });

  it("retorna a trilha (módulos+lições) por slug", async () => {
    const res = await request(app).get("/certifications/cca-foundations");
    expect(res.status).toBe(200);
    expect(res.body.modules[0].title).toBe("Claude API");
    expect(res.body.modules[0].lessons[0].title).toBe("Intro");
    // a lista NÃO deve trazer o markdown inteiro
    expect(res.body.modules[0].lessons[0].readingMd).toBeUndefined();
  });

  it("retorna uma lição com o markdown", async () => {
    const res = await request(app).get(`/lessons/${lessonId}`);
    expect(res.status).toBe(200);
    expect(res.body.readingMd).toBe("# Olá");
  });

  it("404 para lição inexistente", async () => {
    const res = await request(app).get("/lessons/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npm test -- content.test`
Expected: FAIL — `content/routes.js` não existe.

- [ ] **Step 3: Implementar `backend/src/content/routes.ts`**

```ts
import { Router } from "express";
import { prisma } from "../db.js";

export const contentRoutes = Router();

contentRoutes.get("/certifications", async (_req, res) => {
  const certs = await prisma.certification.findMany({
    select: { id: true, slug: true, title: true, description: true, version: true },
    orderBy: { title: "asc" },
  });
  res.json(certs);
});

contentRoutes.get("/certifications/:slug", async (req, res) => {
  const cert = await prisma.certification.findUnique({
    where: { slug: req.params.slug },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: { id: true, order: true, title: true }, // sem readingMd
          },
        },
      },
    },
  });
  if (!cert) return res.status(404).json({ error: "not found" });
  res.json(cert);
});

contentRoutes.get("/lessons/:id", async (req, res) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: "not found" });
  res.json(lesson);
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test -- content.test`
Expected: PASS (4 testes).

- [ ] **Step 5: Rodar a suíte inteira**

Run: `cd backend && npm test`
Expected: PASS — todas as suítes (env, authunit, auth, content).

- [ ] **Step 6: Commit**

```bash
git add backend/src/content/routes.ts backend/tests/content.test.ts
git commit -m "feat: add content routes for certifications and lessons"
```

---

## Task 7: Seed da certificação Foundations

**Files:**
- Create: `backend/prisma/seed.ts`

- [ ] **Step 1: Implementar `backend/prisma/seed.ts`**

Conteúdo mínimo real (será expandido pelo autor depois). Cria um admin e a
certificação com 4 módulos (API, MCP, Agent Skills, Claude Code), cada um com 1
lição introdutória autorada.

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@colaborativa.dev" },
    update: {},
    create: {
      email: "admin@colaborativa.dev",
      name: "Admin",
      role: "admin",
      passwordHash: await bcrypt.hash("admin12345", 10),
    },
  });

  await prisma.certification.deleteMany({ where: { slug: "cca-foundations" } });

  await prisma.certification.create({
    data: {
      slug: "cca-foundations",
      title: "Claude Certified Architect – Foundations",
      description:
        "Fundamentos para construir aplicações de produção com Claude: API, MCP, Agent Skills e Claude Code.",
      version: 1,
      modules: {
        create: [
          {
            order: 1,
            title: "Claude API",
            lessons: {
              create: {
                order: 1,
                title: "Visão geral da Claude API",
                readingMd:
                  "# Claude API\n\nA Claude API permite enviar mensagens e receber respostas do modelo.\n\n**Tópicos:** mensagens, system prompt, parâmetros (max_tokens, temperature), streaming e uso de ferramentas.\n\n> Leitura oficial: https://docs.anthropic.com/",
              },
            },
          },
          {
            order: 2,
            title: "Model Context Protocol (MCP)",
            lessons: {
              create: {
                order: 1,
                title: "O que é MCP",
                readingMd:
                  "# MCP\n\nMCP é um protocolo aberto para conectar modelos a ferramentas e dados externos.\n\n**Tópicos:** servidores, tools, resources, transports.\n\n> Leitura oficial: https://modelcontextprotocol.io/",
              },
            },
          },
          {
            order: 3,
            title: "Agent Skills",
            lessons: {
              create: {
                order: 1,
                title: "Introdução a Agent Skills",
                readingMd:
                  "# Agent Skills\n\nSkills empacotam instruções e capacidades reutilizáveis para o Claude.\n\n**Tópicos:** estrutura de uma skill, quando o Claude a invoca.",
              },
            },
          },
          {
            order: 4,
            title: "Claude Code",
            lessons: {
              create: {
                order: 1,
                title: "Claude Code na prática",
                readingMd:
                  "# Claude Code\n\nClaude Code é o agente de linha de comando para tarefas de engenharia.\n\n**Tópicos:** ferramentas, permissões, MCP, skills.",
              },
            },
          },
        ],
      },
    },
  });

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Rodar o seed**

Run: `cd backend && npm run prisma:seed`
Expected: imprime "Seed concluído." sem erro.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: seed Foundations certification content"
```

---

## Task 8: Scaffolding do frontend

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Criar `frontend/package.json`**

```json
{
  "name": "certificacao-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.59.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.1",
    "react-router-dom": "^6.27.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Criar `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Criar `frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:3001" } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
});
```

- [ ] **Step 4: Criar `frontend/src/setupTests.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Criar `frontend/index.html`**

```html
<!doctype html>
<html lang="pt-br">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Certificações Claude — Colaborativa</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Criar `frontend/src/api/client.ts`**

```ts
const BASE = "/api";

let authToken: string | null = localStorage.getItem("token");

export function setToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

export function getToken() {
  return authToken;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? res.statusText);
  return res.json();
}
```

Nota: o proxy do Vite (`/api` → `:3001`) significa que o frontend chama `/api/auth/login` e o backend recebe `/auth/login`. Ajuste: o proxy NÃO reescreve o path por padrão, então configure o backend para também aceitar o prefixo OU adicione `rewrite`. Use `rewrite`:

Atualize `frontend/vite.config.ts` o proxy para:

```ts
proxy: { "/api": { target: "http://localhost:3001", rewrite: (p) => p.replace(/^\/api/, "") } }
```

- [ ] **Step 7: Criar `frontend/src/main.tsx`** (placeholder que será completado na Task 9)

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 8: Instalar dependências**

Run: `cd frontend && npm install`
Expected: instala sem erro. (`App` ainda não existe — criada na Task 9; não rode build ainda.)

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html frontend/src/setupTests.ts frontend/src/api/client.ts frontend/src/main.tsx
git commit -m "chore: scaffold frontend with vite and react"
```

---

## Task 9: Contexto de auth + roteamento + tela de login

**Files:**
- Create: `frontend/src/auth/AuthContext.tsx`
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/App.tsx`
- Test: `frontend/src/tests/LoginPage.test.tsx`

- [ ] **Step 1: Implementar `frontend/src/auth/AuthContext.tsx`**

```tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import { api, setToken, getToken } from "../api/client.js";

type User = { id: string; email: string; name: string; role: string };
type AuthState = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  async function login(email: string, password: string) {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fora de AuthProvider");
  return ctx;
}

export { getToken };
```

- [ ] **Step 2: Implementar `frontend/src/components/ProtectedRoute.tsx`**

```tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}
```

- [ ] **Step 3: Implementar `frontend/src/pages/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError("Credenciais inválidas");
    }
  }

  return (
    <form onSubmit={onSubmit} aria-label="login">
      <h1>Entrar</h1>
      <label>
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
      </label>
      <label>
        Senha
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
      </label>
      <button type="submit">Entrar</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 4: Implementar `frontend/src/App.tsx`** (rotas; TrilhaPage/LessonPage chegam na Task 10 — usar placeholders agora)

```tsx
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./pages/LoginPage.js";
import { TrilhaPage } from "./pages/TrilhaPage.js";
import { LessonPage } from "./pages/LessonPage.js";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <TrilhaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/licao/:id"
          element={
            <ProtectedRoute>
              <LessonPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Escrever o teste de `LoginPage`**

`frontend/src/tests/LoginPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext.js";
import { LoginPage } from "../pages/LoginPage.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  it("renderiza os campos", () => {
    renderLogin();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("mostra erro quando o login falha", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid credentials" }), { status: 401 })
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "a@a.com");
    await userEvent.type(screen.getByLabelText("Senha"), "errada123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas");
  });
});
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd frontend && npm test -- LoginPage`
Expected: PASS (2 testes).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/auth frontend/src/components frontend/src/pages/LoginPage.tsx frontend/src/App.tsx frontend/src/tests/LoginPage.test.tsx
git commit -m "feat: add auth context, routing and login page"
```

---

## Task 10: Trilha + página da lição

**Files:**
- Create: `frontend/src/pages/TrilhaPage.tsx`
- Create: `frontend/src/pages/LessonPage.tsx`
- Test: `frontend/src/tests/TrilhaPage.test.tsx`

- [ ] **Step 1: Implementar `frontend/src/pages/TrilhaPage.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

type Lesson = { id: string; order: number; title: string };
type Module = { id: string; order: number; title: string; lessons: Lesson[] };
type Trilha = { title: string; modules: Module[] };

export function TrilhaPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["trilha", "cca-foundations"],
    queryFn: () => api<Trilha>("/certifications/cca-foundations"),
  });

  if (isLoading) return <p>Carregando…</p>;
  if (error) return <p role="alert">Erro ao carregar a trilha</p>;
  if (!data) return null;

  return (
    <main>
      <h1>{data.title}</h1>
      {data.modules.map((m) => (
        <section key={m.id}>
          <h2>{m.title}</h2>
          <ul>
            {m.lessons.map((l) => (
              <li key={l.id}>
                <Link to={`/licao/${l.id}`}>{l.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Implementar `frontend/src/pages/LessonPage.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import Markdown from "react-markdown";
import { api } from "../api/client.js";

type Lesson = { id: string; title: string; readingMd: string };

export function LessonPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["lesson", id],
    queryFn: () => api<Lesson>(`/lessons/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <p>Carregando…</p>;
  if (error) return <p role="alert">Erro ao carregar a lição</p>;
  if (!data) return null;

  return (
    <main>
      <Link to="/">← Voltar à trilha</Link>
      <article>
        <Markdown>{data.readingMd}</Markdown>
      </article>
    </main>
  );
}
```

- [ ] **Step 3: Escrever o teste de `TrilhaPage`**

`frontend/src/tests/TrilhaPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TrilhaPage } from "../pages/TrilhaPage.js";

function renderTrilha() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TrilhaPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TrilhaPage", () => {
  it("renderiza módulos e lições vindos da API", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          title: "Foundations",
          modules: [
            { id: "m1", order: 1, title: "Claude API", lessons: [{ id: "l1", order: 1, title: "Intro" }] },
          ],
        }),
        { status: 200 }
      )
    );
    renderTrilha();
    expect(await screen.findByText("Claude API")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Intro" })).toHaveAttribute("href", "/licao/l1");
  });
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test`
Expected: PASS — LoginPage + TrilhaPage.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TrilhaPage.tsx frontend/src/pages/LessonPage.tsx frontend/src/tests/TrilhaPage.test.tsx
git commit -m "feat: add trilha and lesson pages"
```

---

## Task 11: Verificação ponta a ponta manual + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Subir Postgres e migrar/seed**

Run (na raiz, com `backend/.env` configurado a partir do `.env.example`):
```bash
cd backend && npx prisma migrate deploy && npm run prisma:seed
```
Expected: migração aplicada e "Seed concluído.".

- [ ] **Step 2: Subir backend e frontend**

Run em dois terminais:
```bash
cd backend && npm run dev
cd frontend && npm run dev
```
Expected: API em `:3001`, frontend em `:5173`.

- [ ] **Step 3: Fluxo manual**

1. Registrar um aluno via `POST /api/auth/register` (ou criar tela depois).
2. Abrir `http://localhost:5173/login`, logar com o aluno.
3. Ver a trilha da Foundations (4 módulos), clicar numa lição, ver o Markdown renderizado.

Expected: o fluxo completo funciona.

- [ ] **Step 4: Escrever `README.md`** com setup (Node, Postgres, `.env`, comandos `migrate`/`seed`/`dev`) e estrutura do monorepo.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions"
```

---

## Self-Review (cobertura do spec)

- **Auth 3 papéis:** enum `Role` + `requireRole` (Tasks 2, 4); cadastro cria `aluno` por padrão; admin via seed. ✓
- **Modelo de conteúdo (Cert→Módulo→Lição):** Task 2; rotas Task 6; seed Task 7. ✓ (flashcards/questions/labs são Fase 2 — fora deste plano por design.)
- **Trilha + leitura (Markdown):** Tasks 6, 10. ✓
- **API pensada para 2 clientes (React + futuro MCP):** REST stateless com JWT Bearer — o MCP da Fase 4 reusa as mesmas rotas. ✓
- **Seed versionado:** campo `version` + seed idempotente. ✓
- **Fora de escopo respeitado:** sem FSRS/quiz/labs/MCP nesta fatia. ✓

Lacuna conhecida e aceita: não há tela de cadastro de aluno no frontend nesta fase (registro via API/seed); entra na Fase 2 junto com a jornada do aluno. Marcado como follow-up, não bloqueia a fatia vertical.
