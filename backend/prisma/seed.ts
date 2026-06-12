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
        { order: 1, title: "Claude API", lessons: { create: { order: 1, title: "Visão geral da Claude API", readingMd: "# Claude API\n\nA Claude API permite enviar mensagens e receber respostas do modelo.\n\n**Tópicos:** mensagens, system prompt, parâmetros (max_tokens, temperature), streaming e uso de ferramentas.\n\n> Leitura oficial: https://docs.anthropic.com/",
          flashcards: { create: [
            { front: "Qual parâmetro limita o tamanho da resposta na Claude API?", back: "max_tokens", tags: ["api"] },
            { front: "Qual parâmetro controla a aleatoriedade das respostas?", back: "temperature (0 = mais determinístico; valores maiores = mais variado)", tags: ["api"] },
          ] },
          questions: { create: [
            { prompt: "Qual parâmetro define o número máximo de tokens gerados na resposta?", options: ["max_length", "max_tokens", "limit", "top_k"], correctIndex: 1, explanation: "max_tokens limita quantos tokens o modelo pode gerar na resposta.", difficulty: 1, tags: ["api"] },
            { prompt: "Como se chama a instrução que define o comportamento/persona do modelo numa requisição?", options: ["system prompt", "user prompt", "assistant prefill", "stop sequence"], correctIndex: 0, explanation: "O system prompt define o papel e as regras de comportamento do modelo.", difficulty: 1, tags: ["api"] },
          ] },
        } } },
        { order: 2, title: "Model Context Protocol (MCP)", lessons: { create: { order: 1, title: "O que é MCP", readingMd: "# MCP\n\nMCP é um protocolo aberto para conectar modelos a ferramentas e dados externos.\n\n**Tópicos:** servidores, tools, resources, transports.\n\n> Leitura oficial: https://modelcontextprotocol.io/",
          flashcards: { create: [
            { front: "O que significa a sigla MCP?", back: "Model Context Protocol", tags: ["mcp"] },
            { front: "Quais são as primitivas que um servidor MCP pode expor?", back: "tools, resources e prompts", tags: ["mcp"] },
          ] },
          questions: { create: [
            { prompt: "Qual protocolo conecta o Claude a ferramentas externas?", options: ["REST", "MCP", "GraphQL", "gRPC"], correctIndex: 1, explanation: "MCP (Model Context Protocol) é o protocolo aberto para conectar modelos a ferramentas e dados.", difficulty: 1, tags: ["mcp"] },
            { prompt: "No MCP, o que um servidor expõe para que o modelo execute ações?", options: ["resources", "tools", "transports", "tokens"], correctIndex: 1, explanation: "As tools são funções que o servidor MCP expõe para o modelo invocar.", difficulty: 1, tags: ["mcp"] },
          ] },
        } } },
        { order: 3, title: "Agent Skills", lessons: { create: { order: 1, title: "Introdução a Agent Skills", readingMd: "# Agent Skills\n\nSkills empacotam instruções e capacidades reutilizáveis para o Claude.\n\n**Tópicos:** estrutura de uma skill, quando o Claude a invoca.",
          flashcards: { create: [
            { front: "O que uma Agent Skill empacota?", back: "Instruções e capacidades reutilizáveis que o Claude pode invocar quando relevante.", tags: ["skills"] },
            { front: "Qual arquivo descreve uma skill e quando ela deve ser usada?", back: "O SKILL.md (com nome e descrição/gatilhos no frontmatter).", tags: ["skills"] },
          ] },
          questions: { create: [
            { prompt: "Quando o Claude decide invocar uma Agent Skill?", options: ["Sempre, em toda resposta", "Quando a descrição da skill casa com a tarefa do usuário", "Apenas se o usuário digitar o nome exato do arquivo", "Nunca de forma automática"], correctIndex: 1, explanation: "O Claude usa a descrição da skill para decidir, com base na tarefa, se a invoca.", difficulty: 2, tags: ["skills"] },
            { prompt: "O que torna uma skill reutilizável entre tarefas?", options: ["Conter segredos da API", "Empacotar instruções e capacidades genéricas", "Ser escrita em binário", "Rodar apenas localmente"], correctIndex: 1, explanation: "Skills empacotam instruções/capacidades reutilizáveis, aplicáveis a várias tarefas.", difficulty: 1, tags: ["skills"] },
          ] },
        } } },
        { order: 4, title: "Claude Code", lessons: { create: { order: 1, title: "Claude Code na prática", readingMd: "# Claude Code\n\nClaude Code é o agente de linha de comando para tarefas de engenharia.\n\n**Tópicos:** ferramentas, permissões, MCP, skills.",
          flashcards: { create: [
            { front: "O que é o Claude Code?", back: "O agente de linha de comando da Anthropic para tarefas de engenharia de software.", tags: ["claude-code"] },
            { front: "Como o Claude Code se conecta a ferramentas e dados externos?", back: "Via servidores MCP (além de suas ferramentas nativas).", tags: ["claude-code", "mcp"] },
          ] },
          questions: { create: [
            { prompt: "O Claude Code é melhor descrito como:", options: ["Uma IDE gráfica", "Um agente de linha de comando para engenharia", "Um modelo de embeddings", "Um banco de dados"], correctIndex: 1, explanation: "Claude Code é o agente de CLI para tarefas de engenharia de software.", difficulty: 1, tags: ["claude-code"] },
            { prompt: "Qual mecanismo permite estender o Claude Code com integrações externas?", options: ["Plugins .exe", "Servidores MCP", "Macros do editor", "Cookies do navegador"], correctIndex: 1, explanation: "Servidores MCP estendem o Claude Code com tools e resources externos.", difficulty: 2, tags: ["claude-code", "mcp"] },
          ] },
        } } },
      ] },
    },
  });
  console.log("Seed concluído.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
