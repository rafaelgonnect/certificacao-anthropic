# Game "Startup Tycoon de IA" — Design (Fase 1 / MVP)

**Conceito:** o aluno constrói uma startup de IA movida a Claude. Estudar os pontos
da certificação **lança features/sobe times**, que geram **usuários** e **receita
(MRR)**. O placar é o **valuation**. Não esquecer = manutenção: a qualidade decai com
o esquecimento (FSRS), gerando **churn** até o aluno revisar. Uma única alavanca
estratégica — **escolher o tier de modelo (Haiku/Sonnet/Opus)** por departamento —
porque casar modelo↔carga é objetivo real da prova.

## Princípio de integração
O jogo é uma **camada derivada** sobre dados que já existem; não duplica conteúdo.
- **Departamento = Módulo da certificação.**
- **Nível (0–5) do dept** = maestria do usuário nas questões daquele módulo (`Attempt`).
- **Qualidade (0–1) do dept** = quão reforçado/fresco está (cobertura + frescor dos
  `ReviewState` dos flashcards do módulo). Revisões vencidas derrubam a qualidade.
- **Tier ideal do dept** = derivado da `difficulty` média das questões do módulo.

## Economia (pura, testável — `game/economy.ts`)
Por departamento: `mrr = BASE × (nível/5) × qualidade × tierMult`.
- `tierMult`: distância entre tier escolhido e ideal → casou = 1.2; ±1 = 1.0; ±2 = 0.8.
- `users = round(Σ níveis × USERS_PER_LEVEL)`.
- `valuation = round(mrr × VAL_FROM_MRR + users × VAL_FROM_USERS)`.
- `stage`/título por faixas de valuation (Garagem → Pre-seed → Seed → Series A/B/C → Unicórnio).
- **Idle:** `creditsPerHour = round(mrr/3)`; ao coletar, soma `creditsPerHour × horas`
  (cap 8h) desde `lastCollectedAt`. Só acumula moeda (cosmético/futuro), não trava estudo.

## Estado persistido (1 novo modelo Prisma)
`Company { id, userId, certSlug, name, credits, tiers Json, valuation, mrr,
lastCollectedAt, createdAt; @@unique([userId, certSlug]) }`. `valuation`/`mrr` são
recalculados e persistidos a cada leitura/ação (para leaderboard barato). Demais
métricas (nível, qualidade, users) são derivadas on-read.

## Endpoints (`/api`, requireAuth)
- `GET  /game/:certSlug` → cria a company se faltar; retorna company + departamentos
  (nível, qualidade, tier, tierIdeal, mrr) + totais (users, mrr, valuation, stage,
  título, credits) + `idlePending` (créditos acumulados não coletados) + `weakest`.
- `POST /game/:certSlug/collect` → coleta o idle, atualiza `lastCollectedAt`.
- `POST /game/:certSlug/tier` `{ moduleId, tier }` → ajusta o tier do dept, recalcula.
- `GET  /game/leaderboard` → top startups por valuation (nome + título).

## Frontend
- Rota `/jogo/:slug?` (default `cca-foundations`); item no sidebar "Minha Startup".
- Tela: cabeçalho (nome, stage, **valuation** grande, MRR, usuários, créditos);
  botão **Coletar** quando `idlePending>0`; grid de **departamentos** (nível em
  estrelas, barra de qualidade, seletor de tier com dica do ideal, MRR do dept);
  CTA "Reforçar o time mais fraco" → leva ao quiz/revisões da cert; mini-leaderboard.
- Reusa as ações de estudo existentes (quiz/revisões) para evoluir o jogo.

## Fora do MVP (roadmap)
Ligas semanais, eventos aleatórios, cosméticos, prestígio, multi-certificação
simultânea com troca rica, PvP (Duelo de Founders). Anotados; não nesta fatia.

## Testes
- Unitário puro de `economy.ts` (nível/qualidade/tierMult/valuation/idle) — sem DB.
- Frontend: `GamePage` com fetch mockado.
- Integração real validada via deploy + Playwright (login → /jogo → screenshot).
