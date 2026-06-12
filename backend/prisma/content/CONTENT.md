# Pacotes de conteúdo (content packs)

O conteúdo de **cada certificação** é um único objeto de dados tipado — um *content
pack*. Um seeder genérico lê esses packs e cria toda a árvore no banco. Para
adicionar uma nova certificação você **não escreve código Prisma**: só preenche a
estrutura tipada e registra o pack.

## Arquivos

- `pack.ts` — os tipos do pack (`CertificationPack` e aninhados) e o validador
  puro `validatePack`.
- `cca-foundations.ts` — o pack da certificação Foundations (referência de estilo
  e profundidade).
- `../seed.ts` — o seeder genérico: cria o admin, valida cada pack e o materializa
  no banco via *nested writes* do Prisma.

## Formato do pack

```ts
type CertificationPack = {
  slug: string;          // único; identifica a certificação
  title: string;
  description: string;
  version: number;
  modules: ModuleSeed[]; // >= 1
};

type ModuleSeed = { title: string; lessons: LessonSeed[] }; // >= 1 lição

type LessonSeed = {
  title: string;
  readingMd: string;          // Markdown da leitura (obrigatório)
  flashcards?: FlashcardSeed[];
  questions?: QuestionSeed[];
  labs?: LabSeed[];
};

type FlashcardSeed = { front: string; back: string; tags: string[] };

type QuestionSeed = {
  prompt: string;
  options: string[];          // >= 2
  correctIndex: number;       // 0..options.length-1
  explanation: string;
  difficulty?: number;        // default 1
  tags: string[];
};

type LabSeed = { title: string; promptMd: string; rubric: string[]; modelAnswer: string };
```

A **ordem** dos módulos e das lições é derivada da ordem no array (índice + 1
vira o campo `order`), então basta listá-los na sequência desejada.

## Como criar um novo pacote de certificação

1. **Copie** `cca-foundations.ts` para um novo arquivo, ex.: `content/cca-developer.ts`.
2. Renomeie a constante exportada (ex.: `export const ccaDeveloper: CertificationPack = {...}`)
   e ajuste `slug`, `title`, `description`, `version`.
3. **Preencha a estrutura tipada**: módulos → lições (com `readingMd`) → flashcards,
   questões e labs. O TypeScript guia os campos obrigatórios.
4. **Registre o pack** em `../seed.ts`:
   ```ts
   import { ccaDeveloper } from "./content/cca-developer.js";
   const packs: CertificationPack[] = [ccaFoundations, ccaDeveloper];
   ```
5. **Aplique no banco**:
   ```bash
   npm run prisma:push && npm run prisma:seed
   ```
   O seeder valida cada pack, **apaga a certificação existente com o mesmo `slug`**
   (re-seed idempotente) e recria a árvore completa, imprimindo um resumo de
   contagens.

> Observação sobre imports: os arquivos usam extensão `.js` nos imports relativos
> (ESM + `moduleResolution: bundler`), mesmo apontando para arquivos `.ts`.

## Convenção de tags

Use tags consistentes para que o cálculo de domínio (mastery) e os simulados
agrupem corretamente. Tags atuais da Foundations:

| tag           | área                                |
| ------------- | ----------------------------------- |
| `api`         | Claude API (Messages, tools, etc.)  |
| `mcp`         | Model Context Protocol              |
| `skills`      | Agent Skills                        |
| `claude-code` | Claude Code                         |

Uma questão/flashcard pode ter **mais de uma tag** quando cruza áreas (ex.: MCP
dentro do Claude Code usa `["claude-code", "mcp"]`). Cada flashcard e questão deve
ter **pelo menos uma** tag não vazia.

## Garantias de validação

`validatePack(pack)` é **puro**: percorre o pack inteiro, **coleta todos os
problemas** e ou retorna o pack (válido) ou lança um `Error` cuja mensagem lista
**todos** os problemas encontrados, cada um apontando o item ofensor. Ele é
chamado pelo seeder antes de qualquer escrita, então um pack malformado falha
cedo e sem tocar o banco. Verificações:

- `slug`, `title` e `description` não vazios; `version` numérico;
- pelo menos **1 módulo**; cada módulo com título e **pelo menos 1 lição**;
- cada lição com título e `readingMd` não vazios;
- cada **questão** com **>= 2 opções**, todas não vazias, e `correctIndex` dentro
  do intervalo; `explanation` não vazia; `difficulty` numérico quando presente;
- cada **flashcard** com `front`/`back` não vazios;
- cada **lab** com `title`/`promptMd`/`modelAnswer` não vazios e `rubric` não vazia;
- `tags` (de flashcards e questões) sendo arrays não vazios de strings não vazias.

O comportamento está coberto por testes em `../../tests/pack.test.ts`
(`npm run test:unit`).
