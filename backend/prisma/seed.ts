import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
  await prisma.user.upsert({
    where: { email: "admin@colaborativa.dev" }, update: {},
    create: { email: "admin@colaborativa.dev", name: "Admin", role: "admin", passwordHash: await bcrypt.hash("admin12345", 10) },
  });
  await prisma.certification.deleteMany({ where: { slug: "cca-foundations" } });
  await prisma.certification.create({
    data: {
      slug: "cca-foundations",
      title: "Claude Certified Architect – Foundations",
      description: "Fundamentos para construir aplicações de produção com Claude: API, MCP, Agent Skills e Claude Code.",
      version: 1,
      modules: { create: [
        { order: 1, title: "Claude API", lessons: { create: { order: 1, title: "Visão geral da Claude API", readingMd: "# Claude API\n\nA Claude API permite enviar mensagens e receber respostas do modelo.\n\n**Tópicos:** mensagens, system prompt, parâmetros (max_tokens, temperature), streaming e uso de ferramentas.\n\n> Leitura oficial: https://docs.anthropic.com/" } } },
        { order: 2, title: "Model Context Protocol (MCP)", lessons: { create: { order: 1, title: "O que é MCP", readingMd: "# MCP\n\nMCP é um protocolo aberto para conectar modelos a ferramentas e dados externos.\n\n**Tópicos:** servidores, tools, resources, transports.\n\n> Leitura oficial: https://modelcontextprotocol.io/" } } },
        { order: 3, title: "Agent Skills", lessons: { create: { order: 1, title: "Introdução a Agent Skills", readingMd: "# Agent Skills\n\nSkills empacotam instruções e capacidades reutilizáveis para o Claude.\n\n**Tópicos:** estrutura de uma skill, quando o Claude a invoca." } } },
        { order: 4, title: "Claude Code", lessons: { create: { order: 1, title: "Claude Code na prática", readingMd: "# Claude Code\n\nClaude Code é o agente de linha de comando para tarefas de engenharia.\n\n**Tópicos:** ferramentas, permissões, MCP, skills." } } },
      ] },
    },
  });
  console.log("Seed concluído.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
