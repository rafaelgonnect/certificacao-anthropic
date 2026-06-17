# Plataforma de Certificações Claude — Colaborativa

LMS para alunos da Colaborativa estudarem e tirarem certificações da Anthropic
(começando pela *Claude Certified Architect – Foundations*). Conteúdo autorado a
partir do material oficial, com simulados, flashcards (repetição espaçada), labs e
trilha guiada. Inclui (em fases posteriores) um **MCP server** e uma **skill
"Professor"** para estudar conversando com o Claude.

> Visão completa em [`docs/superpowers/specs`](docs/superpowers/specs) e o plano de
> implementação em [`docs/superpowers/plans`](docs/superpowers/plans).

## Stack

- **backend/** — Node.js + Express + Prisma + PostgreSQL (TypeScript, ESM)
- **frontend/** — React + Vite + React Router + TanStack Query (TypeScript)
- Deploy: Easypanel (ver [`DEPLOY.md`](DEPLOY.md))

## Estrutura

```
backend/    API REST (auth, conteúdo) + Prisma schema + seed
frontend/   SPA React (login, trilha, leitura de lições)
Dockerfile  build de produção (backend serve o frontend buildado)
```

Deploy: serviço **App** no Easypanel buildado direto do repo via `Dockerfile`,
com banco externo informado por `DATABASE_URL`. Ver [`DEPLOY.md`](DEPLOY.md).

## Desenvolvimento local

Pré-requisitos: Node 20+ e um PostgreSQL acessível (local ou na nuvem).

### Backend

```bash
cd backend
cp .env.example .env          # ajuste DATABASE_URL e JWT_SECRET
npm install
npm run prisma:generate       # gera o Prisma Client
npm run prisma:push           # sincroniza o schema no banco (precisa de DB)
npm run prisma:seed           # popula admin + certificação Foundations
npm run dev                   # API em http://localhost:3001
```

Testes:
```bash
npm run test:unit             # unitários (não precisam de banco)
npm test                      # suíte completa (precisa de DATABASE_URL/Postgres)
```

Usuário admin do seed: `admin@colaborativa.dev` / `admin12345`.

### Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxia /api -> :3001)
npm test                      # testes de componente (jsdom)
npm run build
```

## Fluxo de uso (Fase 1)

1. Logar em `/login`.
2. Ver a trilha da Foundations (módulos: API, MCP, Agent Skills, Claude Code).
3. Abrir uma lição e ler o conteúdo (Markdown renderizado).

## Roadmap de fases

- **0–1 (feito):** fundação, auth (aluno/gestor/admin), trilha + leitura.
- **2:** flashcards (FSRS), quizzes com feedback e intercalação.
- **3:** simulados, mastery por tópico, painel do gestor.
- **4:** MCP server + skill "Professor".
- **5:** opcionais com Claude API runtime.
- **6:** novas certificações (pacotes de conteúdo).
