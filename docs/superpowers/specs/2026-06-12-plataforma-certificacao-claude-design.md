# Plataforma de Treino para Certificações Claude (Colaborativa) — Design

**Data:** 2026-06-12
**Status:** Aprovado para implementação (Fases 0+1 primeiro)

## Objetivo

Construir uma plataforma de ensino (LMS) que ajude alunos/funcionários da
Colaborativa a estudar e obter **qualquer** certificação da Anthropic
(começando pela *Claude Certified Architect – Foundations*), aplicando técnicas
de aprendizagem com evidência de eficácia. O conteúdo é autorado a partir do
material oficial da Anthropic (cursos da Academy, docs), com links para a fonte.

A própria plataforma dogfooda a matéria da prova: expõe um **MCP server** e uma
**Agent Skill "Professor"**, de modo que o aluno também pode estudar conversando
com o Claude.

## Decisões de fundação

- **Abordagem:** fatia vertical — uma certificação completa de ponta a ponta
  primeiro; certificações futuras viram "pacotes de conteúdo" (dados, sem código
  novo).
- **Stack:** Node.js (Express/Fastify) + React (SPA) + PostgreSQL. Mesma stack do
  SegueAProposta.
- **Usuários:** multiusuário com 3 papéis — `aluno`, `gestor`, `admin`.
- **Conteúdo:** autorado por mim cobrindo os tópicos oficiais, em Markdown, com
  links para a fonte oficial como leitura complementar (sem cópia integral).
- **Claude API runtime:** opcional, fase posterior (correção de dissertativas,
  geração extra). O núcleo funciona 100% com conteúdo pré-autorado.

## Seção 1 — Arquitetura

Duas portas de entrada para o mesmo backend:

1. **Frontend React (SPA)** — área do aluno (trilha, leitura, flashcards, quiz,
   labs) e painel do gestor (turmas, progresso, certificações).
2. **Claude (Desktop/Code/claude.ai)** — via **Skill "Professor"** que consome um
   **MCP Server** da plataforma.

```
Frontend React  ─┐                    Claude + Skill Professor ─┐
                 │ REST/JSON + JWT                             │ MCP tools
                 └──────────────► Backend Node.js ◄────────────┘
                                  Auth · Conteúdo · Aprendizado · Gestão
                                          │
                                  PostgreSQL  (+ Claude API runtime, opcional)
```

- Backend é a **fonte única de verdade**; React e MCP são apenas clientes.
- MCP server **embrulha a mesma API** (sem duplicar lógica), autenticado pelo
  token do aluno; cada interação via Claude conta no progresso real.
- API desenhada desde o início pensando nos dois clientes para evitar retrabalho.

## Seção 2 — Modelo de conteúdo

Hierarquia: `Certificação → Módulo → Lição → {Leitura, Flashcards, Questões, Lab}`.

Tabelas principais:

| Tabela | Guarda | Campos-chave |
|---|---|---|
| `certifications` | certificações | `slug`, `title`, `descrição`, `versão` |
| `modules` | módulos | `cert_id`, `ordem`, `title` |
| `lessons` | lições | `module_id`, `ordem`, `title`, `reading_md` |
| `flashcards` | cartões | `lesson_id`, `frente`, `verso`, `tags` |
| `questions` | questões | `lesson_id`, `enunciado`, `opções[]`, `correta`, `explicação`, `dificuldade` |
| `labs` | exercícios | `lesson_id`, `enunciado_md`, `tipo_correção`, `rubrica[]` |

- Conteúdo em **Markdown**; tudo etiquetado por lição e **tags de tópico**.
- Cada certificação é um **seed versionado** (campo `versão`); nova versão da prova
  não quebra progresso existente.
- Labs com `tipo_correção`: começam em `autoavaliação` + `rubrica` +
  `resposta_modelo`. Correção por Claude API é fase posterior (evita sandbox de
  código arbitrário agora).
- Banco de questões grande o bastante para simulados nunca idênticos (sorteio por
  tópico/dificuldade).

## Seção 3 — Ciclo de estudo e técnicas de aprendizagem

Técnicas aplicadas:

1. **Recuperação ativa** — flashcards e quizzes são a espinha dorsal (não a releitura).
2. **Repetição espaçada (FSRS)** — agendamento de revisão por flashcard/aluno.
3. **Intercalação** — simulados/revisões misturam tópicos (viável pelas tags).
4. **Teste com feedback imediato** — erro mostra o porquê na hora; tópico fraco
   reaparece mais cedo.
5. **Prática espelhando a prova** — simulado cronometrado + relatório de prontidão.

Ciclo diário do aluno: Revisões de hoje → Próxima lição (leitura + recall) →
Prática misturada → Lab da semana → Simulado (quando pronto). Mesmo ciclo via web
ou via Claude (skill + MCP).

**Mastery:** nível de domínio por aluno/tópico (acertos recentes + estado FSRS).
Alimenta o painel do gestor e a decisão da skill Professor sobre o que ensinar.

Dados adicionais: `review_schedule` (estado FSRS), `attempts` (cada resposta),
`mastery` (nível por aluno/tópico), `exam_sessions` (simulados).

## Seção 4 — Plano de fases

- **Fase 0 — Fundação:** monorepo, migrações, auth com 3 papéis, deploy básico.
- **Fase 1 — Núcleo de conteúdo + leitura:** modelo da Seção 2 + seed da
  Foundations + telas de trilha e leitura.
- **Fase 2 — Recuperação ativa:** flashcards (FSRS), "Revisões de hoje", quizzes
  com feedback + intercalação.
- **Fase 3 — Simulados + mastery + painel do gestor.**
- **Fase 4 — MCP Server + Skill "Professor".**
- **Fase 5 — Opcionais com Claude API runtime.**
- **Fase 6 — Escala para outras certificações** (novos seeds).

Cada fase tem seu próprio spec → plano → implementação. **Fases 0+1** formam a
primeira fatia vertical e serão o primeiro plano de implementação.

## Fora de escopo (por ora)

- Sandbox de execução de código do aluno.
- Pagamentos/cobrança.
- App mobile nativo.
- Integração com o sistema oficial de exames da Anthropic (não há API pública).
