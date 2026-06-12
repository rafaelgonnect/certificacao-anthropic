# certificacao-mcp

An [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server that
wraps the **Certificacao LMS** REST API, exposing the platform's study workflow
(trilhas, licoes, flashcards/repeticao espacada, quizzes and progresso) as tools
an LLM agent — e.g. Claude Desktop or Claude Code — can call.

It is a thin, typed layer over the existing REST API; it does not talk to the
database directly.

## Tools

| Tool | Description |
| --- | --- |
| `login` | Authenticate (`email`, `password`); stores the bearer token for the session. |
| `listar_certificacoes` | List available certifications (slug + title). |
| `get_trilha` | Modules + lessons for a certification (`slug`, default `cca-foundations`). |
| `get_licao` | A lesson's reading material in Markdown (`lessonId`). |
| `revisoes_do_dia` | Flashcards due today (id, front, back). |
| `avaliar_flashcard` | Grade a flashcard (`flashcardId`, `grade`: again/hard/good/easy); returns next due date + interval. |
| `get_quiz` | Fetch quiz questions without answers (`cert`, `n`). |
| `responder_questao` | Submit an answer (`questionId`, `chosenIndex`); returns correctness + explanation. |
| `meu_progresso` | Mastery map per topic + count of due reviews (`cert`). |

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PLATFORM_URL` | no | `http://localhost:3001` | Base URL of the LMS API. |
| `PLATFORM_TOKEN` | no | — | Pre-issued bearer token. If set, the server starts authenticated. |
| `PLATFORM_EMAIL` | no | — | Email for auto-login at startup (used only when `PLATFORM_TOKEN` is unset). |
| `PLATFORM_PASSWORD` | no | — | Password for auto-login at startup. |

Authentication precedence: `PLATFORM_TOKEN` wins; otherwise, if both
`PLATFORM_EMAIL` and `PLATFORM_PASSWORD` are present the server logs in at
startup; otherwise the agent can call the `login` tool at any time.

## Build

```bash
cd mcp
npm install
npm run build      # tsc -> dist/
npm test           # vitest: platform client unit tests
```

The built entrypoint is `dist/index.js`.

## Run

```bash
PLATFORM_URL=http://localhost:3001 PLATFORM_TOKEN=<token> node dist/index.js
```

The server communicates over **stdio** (stdout is the protocol channel; all
logs go to stderr).

## Register in Claude Desktop / Claude Code

Add an entry to your `claude_desktop_config.json` (Claude Desktop) or the
equivalent MCP servers config in Claude Code. Use an **absolute** path to the
built file:

```json
{
  "mcpServers": {
    "certificacao": {
      "command": "node",
      "args": ["D:/certificacao_anthropic/mcp/dist/index.js"],
      "env": {
        "PLATFORM_URL": "http://localhost:3001",
        "PLATFORM_TOKEN": "<your-bearer-token>"
      }
    }
  }
}
```

To authenticate with credentials instead of a token, drop `PLATFORM_TOKEN` and
provide `PLATFORM_EMAIL` / `PLATFORM_PASSWORD`, or simply ask the agent to use
the `login` tool.

Restart Claude Desktop (or reload the MCP servers in Claude Code) after editing
the config. Run `npm run build` first so `dist/index.js` exists.
