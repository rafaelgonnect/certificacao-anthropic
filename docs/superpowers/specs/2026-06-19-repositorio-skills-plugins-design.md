# Repositório de Skills/Plugins do Claude — Design

**Data:** 2026-06-19
**Status:** Aprovado (implementação autônoma)

## Objetivo

Permitir que os usuários da Colaborativa **sincronizem skills e plugins do Claude Code**
entre si, a partir de um repositório **auto-hospedado dentro do próprio LMS**. Um admin
gerencia os pacotes (skills) por uma UI web; cada usuário instala/atualiza usando o
mecanismo **nativo** do Claude Code (`/plugin marketplace add` + `/plugin install` +
`/plugin marketplace update`).

## Decisões

- **Fonte da verdade:** banco do LMS (Postgres) + UI web. O repositório git é um
  artefato **gerado** a partir do banco, não a fonte da verdade.
- **Auto-hospedado:** nada de GitHub/npm. O backend serve um repositório git via
  **git smart-HTTP** (`git http-backend`).
- **Acesso restrito:** só usuários logados. O controle de acesso usa um **token por
  usuário embutido no path da URL git** (revogável/rotacionável), evitando configuração
  de credenciais git no cliente.
- **Autoria:** só admins criam/editam skills. Usuários apenas consomem.

## Restrição técnica que moldou o design

O Claude Code só baixa arquivos de plugin via **git** (ou npm). Servir só o
`marketplace.json` por URL HTTPS funciona para o catálogo, mas `source` relativos (`./…`)
**falham** nesse modo. Solução: adicionar o marketplace **como repositório git**, onde os
`source: "./plugins/<slug>"` relativos funcionam — tudo num clone só.

## Modelo de dados (Prisma)

```prisma
model Plugin {
  id          String   @id @default(uuid())
  slug        String   @unique
  displayName String
  description String
  version     String   @default("0.1.0")
  category    String?
  keywords    String[]
  author      String?
  published   Boolean  @default(false)
  skills      PluginSkill[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model PluginSkill {
  id        String  @id @default(uuid())
  plugin    Plugin  @relation(fields: [pluginId], references: [id], onDelete: Cascade)
  pluginId  String
  slug      String
  skillMd   String
  @@unique([pluginId, slug])
}

model InstallToken {
  id         String    @id @default(uuid())
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     String    @unique
  token      String    @unique
  revokedAt  DateTime?
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())
}
```

**Escopo v1 (YAGNI):** cada skill = um `SKILL.md`. Skills multi-arquivo e plugins com
commands/agents/hooks ficam para depois (modelo já comporta).

## Backend — módulo `marketplace/`

- `materialize.ts` — lê o banco e escreve a árvore de arquivos num repo bare + commit:
  - `.claude-plugin/marketplace.json` (name `colaborativa`, `plugins[]` com
    `source: "./plugins/<slug>"`).
  - `plugins/<slug>/.claude-plugin/plugin.json` + `plugins/<slug>/skills/<skill>/SKILL.md`.
- `gitHttp.ts` — serve o repo bare via `git http-backend` (read-only: só `git-upload-pack`),
  montado em `/git/m/:token/:repo` antes do `express.json()` e do fallback do SPA.
- `tokens.ts` — geração/validação de `InstallToken`.
- `routes.ts` — admin (CRUD + publish), catálogo (lista + install-info), token (get/regenerate).
- No boot: `materialize()` roda após o seed.

## Serving git + acesso restrito

- URL: `https://app/git/m/<TOKEN>/skills.git`
- Middleware valida `:token` em `InstallToken` (não revogado) → atualiza `lastUsedAt`.
  Token inválido → **404** (não vaza existência). Read-only: rejeita `git-receive-pack`.

## Frontend

- **Admin** (`/admin/skills`): lista de pacotes, editor de `SKILL.md`, metadados, publicar.
- **Catálogo** (usuário): cards dos pacotes; banner com `/plugin marketplace add …` (token +
  copiar); por pacote `/plugin install <slug>@colaborativa`; instruções de atualização e
  botão de regenerar token.

## Docker / boot

- `apk add --no-cache git` no estágio runtime.
- Materializa o repo bare em caminho efêmero no boot (DB é a fonte da verdade; sem volume).

## Segurança

- Skills podem conter código (scripts/hooks) → execução arbitrária ao usar. Aceitável:
  autoria só admin, consumo só time interno.
- Token no path pode vazar em logs/histórico → mitigado por read-only, por-usuário e
  revogável.

## Testes

- Unit: geração do `marketplace.json`; estrutura materializada; validação/revogação de token.
- Smoke: `git clone` contra o endpoint (skip se git ausente).
