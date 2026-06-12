/**
 * Builds the configured MCP server for the Certificacao LMS.
 *
 * This module only *constructs* the server and registers tools. It does NOT
 * connect a transport, so it stays importable/testable (see index.ts for the
 * stdio entrypoint).
 *
 * Configuration is read from the environment:
 *   - PLATFORM_URL       base URL of the LMS API (default http://localhost:3001)
 *   - PLATFORM_TOKEN     optional pre-issued bearer token
 *   - PLATFORM_EMAIL     optional email for auto-login at startup
 *   - PLATFORM_PASSWORD  optional password for auto-login at startup
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  PlatformClient,
  type Grade,
} from "./platformClient.js";

const DEFAULT_CERT = "cca-foundations";

/** Convenience: turn any value into a tool text result. */
function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    ...(isError ? { isError: true } : {}),
  };
}

/** Build a human-friendly error result from a thrown value. */
function errorResult(prefix: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return textResult(`${prefix}: ${message}`, true);
}

export interface CreateServerOptions {
  /** Override the platform client (useful for tests). */
  client?: PlatformClient;
}

/** Build a PlatformClient from the environment (PLATFORM_URL/PLATFORM_TOKEN). */
export function clientFromEnv(): PlatformClient {
  const baseUrl = process.env.PLATFORM_URL ?? "http://localhost:3001";
  const token = process.env.PLATFORM_TOKEN;
  return new PlatformClient({ baseUrl, token });
}

/**
 * Build the configured MCP server. The platform client used can be retrieved
 * afterwards via the returned server's `getClient()` helper attached below, but
 * for entrypoint use prefer constructing the client yourself with
 * `clientFromEnv()` and passing it in.
 */
export function createServer(options: CreateServerOptions = {}): McpServer {
  const client = options.client ?? clientFromEnv();

  const server = new McpServer({
    name: "certificacao-mcp-server",
    version: "0.1.0",
  });

  // --- login ---------------------------------------------------------------
  server.registerTool(
    "login",
    {
      title: "Login na plataforma",
      description: `Autentica um usuario na plataforma de certificacao (POST /api/auth/login).

Armazena o token retornado internamente, de modo que as demais ferramentas passam a operar autenticadas. Use quando nenhum PLATFORM_TOKEN foi configurado ou quando precisar trocar de usuario.

Args:
  - email (string): e-mail do usuario
  - password (string): senha do usuario

Returns: confirmacao com nome e papel (role) do usuario autenticado.`,
      inputSchema: {
        email: z.string().email("e-mail invalido").describe("e-mail do usuario"),
        password: z.string().min(1, "senha obrigatoria").describe("senha do usuario"),
      },
      annotations: {
        title: "Login na plataforma",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ email, password }) => {
      try {
        const user = await client.login(email, password);
        const name = user.name ?? user.email ?? "usuario";
        const role = user.role ? ` (papel: ${user.role})` : "";
        return textResult(`Login realizado com sucesso: ${name}${role}.`);
      } catch (err) {
        return errorResult("Falha no login", err);
      }
    },
  );

  // --- listar_certificacoes ------------------------------------------------
  server.registerTool(
    "listar_certificacoes",
    {
      title: "Listar certificacoes",
      description: `Lista as certificacoes (trilhas) disponiveis na plataforma (GET /api/certifications).

Args: nenhum.

Returns: lista de certificacoes com slug e titulo. Use o slug em get_trilha, get_quiz e meu_progresso.`,
      inputSchema: {},
      annotations: {
        title: "Listar certificacoes",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const certs = await client.listCertifications();
        if (!certs.length) {
          return textResult("Nenhuma certificacao disponivel.");
        }
        const lines = certs.map((c) => `- ${c.title} (slug: ${c.slug})`);
        return textResult(
          `Certificacoes disponiveis (${certs.length}):\n${lines.join("\n")}`,
        );
      } catch (err) {
        return errorResult("Falha ao listar certificacoes", err);
      }
    },
  );

  // --- get_trilha ----------------------------------------------------------
  server.registerTool(
    "get_trilha",
    {
      title: "Obter trilha de uma certificacao",
      description: `Retorna a estrutura de uma trilha: modulos e licoes (GET /api/certifications/:slug).

Args:
  - slug (string, opcional): slug da certificacao (default "${DEFAULT_CERT}").

Returns: titulo da certificacao seguido de cada modulo e suas licoes (titulo + id da licao). Use os ids em get_licao.`,
      inputSchema: {
        slug: z
          .string()
          .min(1)
          .default(DEFAULT_CERT)
          .describe(`slug da certificacao (default "${DEFAULT_CERT}")`),
      },
      annotations: {
        title: "Obter trilha",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ slug }) => {
      try {
        const trilha = await client.getTrilha(slug);
        const lines: string[] = [`# ${trilha.title} (${slug})`, ""];
        const modules = trilha.modules ?? [];
        if (!modules.length) {
          lines.push("(sem modulos)");
        }
        modules.forEach((mod, i) => {
          lines.push(`## Modulo ${i + 1}: ${mod.title}`);
          const lessons = mod.lessons ?? [];
          if (!lessons.length) {
            lines.push("  (sem licoes)");
          }
          for (const lesson of lessons) {
            lines.push(`  - ${lesson.title} (lessonId: ${lesson.id})`);
          }
          lines.push("");
        });
        return textResult(lines.join("\n").trimEnd());
      } catch (err) {
        return errorResult(`Falha ao obter a trilha "${slug}"`, err);
      }
    },
  );

  // --- get_licao -----------------------------------------------------------
  server.registerTool(
    "get_licao",
    {
      title: "Obter conteudo de uma licao",
      description: `Retorna o conteudo (readingMd, em Markdown) de uma licao (GET /api/lessons/:id).

Args:
  - lessonId (string): id da licao (obtido em get_trilha).

Returns: titulo da licao e o material de leitura em Markdown.`,
      inputSchema: {
        lessonId: z
          .string()
          .min(1, "lessonId obrigatorio")
          .describe("id da licao, obtido em get_trilha"),
      },
      annotations: {
        title: "Obter licao",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ lessonId }) => {
      try {
        const lesson = await client.getLesson(lessonId);
        const body = lesson.readingMd ?? "(sem conteudo de leitura)";
        return textResult(`# ${lesson.title} (lessonId: ${lesson.id})\n\n${body}`);
      } catch (err) {
        return errorResult(`Falha ao obter a licao "${lessonId}"`, err);
      }
    },
  );

  // --- revisoes_do_dia -----------------------------------------------------
  server.registerTool(
    "revisoes_do_dia",
    {
      title: "Revisoes (flashcards) do dia",
      description: `Lista os flashcards com revisao agendada para hoje (GET /api/reviews/due).

Args: nenhum.

Returns: cada flashcard com id, frente (front) e verso (back). Para um estudo eficaz, mostre primeiro apenas a frente ao aluno e revele o verso somente depois que ele tentar responder; em seguida use avaliar_flashcard com a nota.`,
      inputSchema: {},
      annotations: {
        title: "Revisoes do dia",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const reviews = await client.dueReviews();
        if (!reviews.length) {
          return textResult("Nenhuma revisao pendente para hoje. Bom trabalho!");
        }
        const lines = [`Revisoes pendentes (${reviews.length}):`, ""];
        for (const r of reviews) {
          lines.push(`- id: ${r.id}`);
          lines.push(`  frente: ${r.front}`);
          lines.push(`  verso: ${r.back}`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult("Falha ao obter as revisoes do dia", err);
      }
    },
  );

  // --- avaliar_flashcard ---------------------------------------------------
  const grades = ["again", "hard", "good", "easy"] as const;
  server.registerTool(
    "avaliar_flashcard",
    {
      title: "Avaliar um flashcard",
      description: `Registra a nota de autoavaliacao de um flashcard, atualizando o agendamento de repeticao espacada (POST /api/reviews/:flashcardId/grade).

Args:
  - flashcardId (string): id do flashcard (de revisoes_do_dia).
  - grade ("again" | "hard" | "good" | "easy"): quao bem o aluno lembrou.
      again = errou/esqueceu; hard = lembrou com dificuldade; good = lembrou; easy = facil.

Returns: a proxima data de revisao (dueAt) e o intervalo em dias (intervalDays).`,
      inputSchema: {
        flashcardId: z
          .string()
          .min(1, "flashcardId obrigatorio")
          .describe("id do flashcard, obtido em revisoes_do_dia"),
        grade: z
          .enum(grades)
          .describe('nota: "again", "hard", "good" ou "easy"'),
      },
      annotations: {
        title: "Avaliar flashcard",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ flashcardId, grade }) => {
      try {
        const result = await client.gradeFlashcard(flashcardId, grade as Grade);
        return textResult(
          `Flashcard ${flashcardId} avaliado como "${grade}". ` +
            `Proxima revisao: ${result.dueAt} (intervalo: ${result.intervalDays} dia(s)).`,
        );
      } catch (err) {
        return errorResult(`Falha ao avaliar o flashcard "${flashcardId}"`, err);
      }
    },
  );

  // --- get_quiz ------------------------------------------------------------
  server.registerTool(
    "get_quiz",
    {
      title: "Obter questoes de quiz",
      description: `Busca questoes de quiz de uma certificacao, SEM as respostas (GET /api/quiz).

Args:
  - cert (string, opcional): slug da certificacao (default "${DEFAULT_CERT}").
  - n (number, opcional): quantidade de questoes, 1-50 (default 5).

Returns: cada questao com id, enunciado (prompt) e opcoes indexadas. Apresente as opcoes ao aluno e, ao receber a escolha, use responder_questao para conferir.`,
      inputSchema: {
        cert: z
          .string()
          .min(1)
          .default(DEFAULT_CERT)
          .describe(`slug da certificacao (default "${DEFAULT_CERT}")`),
        n: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(5)
          .describe("quantidade de questoes (1-50, default 5)"),
      },
      annotations: {
        title: "Obter quiz",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ cert, n }) => {
      try {
        const questions = await client.getQuiz(cert, n);
        if (!questions.length) {
          return textResult(`Nenhuma questao disponivel para "${cert}".`);
        }
        const lines = [`Quiz "${cert}" (${questions.length} questao(oes)):`, ""];
        questions.forEach((q, i) => {
          lines.push(`${i + 1}. ${q.prompt} (questionId: ${q.id})`);
          (q.options ?? []).forEach((opt, idx) => {
            lines.push(`   [${idx}] ${opt}`);
          });
          lines.push("");
        });
        return textResult(lines.join("\n").trimEnd());
      } catch (err) {
        return errorResult(`Falha ao obter o quiz de "${cert}"`, err);
      }
    },
  );

  // --- responder_questao ---------------------------------------------------
  server.registerTool(
    "responder_questao",
    {
      title: "Responder uma questao de quiz",
      description: `Submete a resposta de uma questao e retorna a correcao (POST /api/quiz/answer).

Args:
  - questionId (string): id da questao (de get_quiz).
  - chosenIndex (number): indice (base 0) da opcao escolhida.

Returns: se acertou (correct), o indice correto (correctIndex) e a explicacao.`,
      inputSchema: {
        questionId: z
          .string()
          .min(1, "questionId obrigatorio")
          .describe("id da questao, obtido em get_quiz"),
        chosenIndex: z
          .number()
          .int()
          .min(0)
          .describe("indice (base 0) da opcao escolhida"),
      },
      annotations: {
        title: "Responder questao",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ questionId, chosenIndex }) => {
      try {
        const result = await client.answerQuestion(questionId, chosenIndex);
        const verdict = result.correct ? "CORRETO" : "INCORRETO";
        return textResult(
          `${verdict}. Sua escolha: indice ${chosenIndex}. ` +
            `Resposta correta: indice ${result.correctIndex}.\n` +
            `Explicacao: ${result.explanation}`,
        );
      } catch (err) {
        return errorResult(`Falha ao responder a questao "${questionId}"`, err);
      }
    },
  );

  // --- meu_progresso -------------------------------------------------------
  server.registerTool(
    "meu_progresso",
    {
      title: "Meu progresso",
      description: `Resume o progresso do aluno: mapa de dominio (mastery) por topico e quantidade de revisoes pendentes (GET /api/me/mastery + GET /api/reviews/due).

Args:
  - cert (string, opcional): slug da certificacao (default "${DEFAULT_CERT}").

Returns: por topico, o nivel de dominio (mastery, 0-1) e numero de tentativas; alem do total de flashcards a revisar hoje.`,
      inputSchema: {
        cert: z
          .string()
          .min(1)
          .default(DEFAULT_CERT)
          .describe(`slug da certificacao (default "${DEFAULT_CERT}")`),
      },
      annotations: {
        title: "Meu progresso",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ cert }) => {
      try {
        const [mastery, due] = await Promise.all([
          client.myMastery(cert),
          client.dueReviews(),
        ]);
        const topics = Object.entries(mastery);
        const lines = [`# Progresso em "${cert}"`, ""];
        if (!topics.length) {
          lines.push("Ainda nao ha dados de dominio (mastery) para esta certificacao.");
        } else {
          lines.push(`Dominio por topico (${topics.length}):`);
          for (const [topic, info] of topics) {
            const pct = Math.round((info.mastery ?? 0) * 100);
            lines.push(`- ${topic}: ${pct}% (tentativas: ${info.attempts ?? 0})`);
          }
        }
        lines.push("");
        lines.push(`Revisoes pendentes para hoje: ${due.length}.`);
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult(`Falha ao obter o progresso de "${cert}"`, err);
      }
    },
  );

  return server;
}

/**
 * Optionally perform an auto-login using PLATFORM_EMAIL/PLATFORM_PASSWORD when
 * no PLATFORM_TOKEN was provided. Called by the entrypoint, not by createServer
 * (so importing the server never triggers network I/O).
 */
export async function maybeAutoLogin(client: PlatformClient): Promise<void> {
  if (process.env.PLATFORM_TOKEN) return;
  const email = process.env.PLATFORM_EMAIL;
  const password = process.env.PLATFORM_PASSWORD;
  if (email && password) {
    await client.login(email, password);
  }
}
