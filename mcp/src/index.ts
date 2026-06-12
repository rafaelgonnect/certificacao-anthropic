#!/usr/bin/env node
/**
 * Stdio entrypoint for the Certificacao LMS MCP server.
 *
 * IMPORTANT: stdout is the MCP protocol channel for stdio transport, so all
 * logging here goes to stderr only.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, clientFromEnv, maybeAutoLogin } from "./server.js";

async function main(): Promise<void> {
  const client = clientFromEnv();

  // Best-effort auto-login when credentials (but no token) are configured.
  try {
    await maybeAutoLogin(client);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[certificacao-mcp] auto-login failed: ${message}`);
    console.error("[certificacao-mcp] continuing; use the 'login' tool to authenticate.");
  }

  const server = createServer({ client });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `[certificacao-mcp] running on stdio (PLATFORM_URL=${
      process.env.PLATFORM_URL ?? "http://localhost:3001"
    })`,
  );
}

main().catch((err) => {
  console.error("[certificacao-mcp] fatal error:", err);
  process.exit(1);
});
