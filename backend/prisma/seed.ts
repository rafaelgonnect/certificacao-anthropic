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
            { prompt: "Qual recurso permite receber a resposta da Claude API em pedaços, à medida que é gerada?", options: ["streaming", "batching", "caching", "pagination"], correctIndex: 0, explanation: "Com streaming (stream=true) a resposta chega de forma incremental via Server-Sent Events.", difficulty: 2, tags: ["api"] },
            { prompt: "Como a Claude API estrutura uma conversa enviada ao modelo?", options: ["Como uma única string de texto", "Como uma lista de mensagens com papéis (user/assistant)", "Como um arquivo XML", "Como pares chave-valor em query string"], correctIndex: 1, explanation: "As requisições usam um array de mensagens, cada uma com um role (user/assistant) e seu conteúdo.", difficulty: 2, tags: ["api"] },
          ] },
          labs: { create: {
            title: "Primeira chamada à Claude API",
            promptMd: "# Lab: Primeira chamada à Claude API\n\nEscreva uma requisição mínima à Claude API que:\n\n1. Especifique o `model`.\n2. Defina `max_tokens`.\n3. Inclua uma mensagem do usuário (`role: \"user\"`).\n4. Trate a resposta retornada (extraia o texto).\n\nPode ser em pseudocódigo, Python ou TypeScript.",
            rubric: ["Especifica o model", "Define max_tokens", "Inclui uma mensagem do usuário", "Trata a resposta"],
            modelAnswer: "```ts\nimport Anthropic from \"@anthropic-ai/sdk\";\nconst client = new Anthropic();\nconst res = await client.messages.create({\n  model: \"claude-sonnet-4-6\",\n  max_tokens: 1024,\n  messages: [{ role: \"user\", content: \"Olá, Claude!\" }],\n});\nconst texto = res.content.filter(b => b.type === \"text\").map(b => b.text).join(\"\");\nconsole.log(texto);\n```",
          } },
        } } },
        { order: 2, title: "Model Context Protocol (MCP)", lessons: { create: { order: 1, title: "O que é MCP", readingMd: "# MCP\n\nMCP é um protocolo aberto para conectar modelos a ferramentas e dados externos.\n\n**Tópicos:** servidores, tools, resources, transports.\n\n> Leitura oficial: https://modelcontextprotocol.io/",
          flashcards: { create: [
            { front: "O que significa a sigla MCP?", back: "Model Context Protocol", tags: ["mcp"] },
            { front: "Quais são as primitivas que um servidor MCP pode expor?", back: "tools, resources e prompts", tags: ["mcp"] },
          ] },
          questions: { create: [
            { prompt: "Qual protocolo conecta o Claude a ferramentas externas?", options: ["REST", "MCP", "GraphQL", "gRPC"], correctIndex: 1, explanation: "MCP (Model Context Protocol) é o protocolo aberto para conectar modelos a ferramentas e dados.", difficulty: 1, tags: ["mcp"] },
            { prompt: "No MCP, o que um servidor expõe para que o modelo execute ações?", options: ["resources", "tools", "transports", "tokens"], correctIndex: 1, explanation: "As tools são funções que o servidor MCP expõe para o modelo invocar.", difficulty: 1, tags: ["mcp"] },
            { prompt: "No MCP, qual primitiva fornece dados/conteúdo de contexto (somente leitura) ao modelo?", options: ["tools", "resources", "transports", "prompts"], correctIndex: 1, explanation: "Resources expõem dados/conteúdo que o cliente pode ler e fornecer como contexto ao modelo.", difficulty: 2, tags: ["mcp"] },
            { prompt: "Como um cliente MCP normalmente se comunica com um servidor MCP local?", options: ["Via stdio (entrada/saída padrão)", "Via Bluetooth", "Via FTP", "Via porta serial RS-232"], correctIndex: 0, explanation: "Servidores MCP locais costumam usar o transport stdio; há também HTTP/SSE para servidores remotos.", difficulty: 2, tags: ["mcp"] },
          ] },
          labs: { create: {
            title: "Desenhe um servidor MCP",
            promptMd: "# Lab: Desenhe um servidor MCP\n\nDescreva um servidor MCP simples que exponha uma ferramenta de consulta ao clima. Sua resposta deve indicar:\n\n1. O nome e a descrição de uma `tool` exposta.\n2. O schema de entrada da tool (parâmetros).\n3. Pelo menos um `resource` (somente leitura) que o servidor poderia oferecer.\n4. Qual `transport` o cliente usaria para um servidor local.",
            rubric: ["Define uma tool com nome e descrição", "Especifica o schema de entrada da tool", "Inclui ao menos um resource", "Menciona o transport (stdio para local)"],
            modelAnswer: "Servidor `weather-mcp`:\n\n- **tool** `get_weather` — \"Retorna o clima atual de uma cidade\". Input schema: `{ city: string }`.\n- **resource** `weather://cities` — lista somente-leitura de cidades suportadas.\n- **transport**: `stdio` para um servidor local (HTTP/SSE para remoto).",
          } },
        } } },
        { order: 3, title: "Agent Skills", lessons: { create: { order: 1, title: "Introdução a Agent Skills", readingMd: "# Agent Skills\n\nSkills empacotam instruções e capacidades reutilizáveis para o Claude.\n\n**Tópicos:** estrutura de uma skill, quando o Claude a invoca.",
          flashcards: { create: [
            { front: "O que uma Agent Skill empacota?", back: "Instruções e capacidades reutilizáveis que o Claude pode invocar quando relevante.", tags: ["skills"] },
            { front: "Qual arquivo descreve uma skill e quando ela deve ser usada?", back: "O SKILL.md (com nome e descrição/gatilhos no frontmatter).", tags: ["skills"] },
          ] },
          questions: { create: [
            { prompt: "Quando o Claude decide invocar uma Agent Skill?", options: ["Sempre, em toda resposta", "Quando a descrição da skill casa com a tarefa do usuário", "Apenas se o usuário digitar o nome exato do arquivo", "Nunca de forma automática"], correctIndex: 1, explanation: "O Claude usa a descrição da skill para decidir, com base na tarefa, se a invoca.", difficulty: 2, tags: ["skills"] },
            { prompt: "O que torna uma skill reutilizável entre tarefas?", options: ["Conter segredos da API", "Empacotar instruções e capacidades genéricas", "Ser escrita em binário", "Rodar apenas localmente"], correctIndex: 1, explanation: "Skills empacotam instruções/capacidades reutilizáveis, aplicáveis a várias tarefas.", difficulty: 1, tags: ["skills"] },
            { prompt: "Onde ficam o nome e a descrição (gatilhos) que ajudam o Claude a escolher uma skill?", options: ["No frontmatter do SKILL.md", "Num arquivo .env", "No nome do diretório apenas", "Numa variável de ambiente"], correctIndex: 0, explanation: "O frontmatter do SKILL.md traz name e description, usados para decidir quando a skill se aplica.", difficulty: 2, tags: ["skills"] },
            { prompt: "Por que descrições de skill devem ser específicas e ricas em gatilhos?", options: ["Para ocupar mais tokens", "Para o Claude reconhecer melhor quando a skill é relevante", "Para criptografar a skill", "Porque é exigência de sintaxe do Markdown"], correctIndex: 1, explanation: "Descrições específicas com gatilhos melhoram a decisão automática de quando invocar a skill.", difficulty: 1, tags: ["skills"] },
          ] },
          labs: { create: {
            title: "Escreva o frontmatter de uma SKILL.md",
            promptMd: "# Lab: Escreva o frontmatter de uma SKILL.md\n\nCrie o frontmatter (YAML) de uma `SKILL.md` para uma skill que gera relatórios financeiros em Excel. Inclua:\n\n1. Um `name` claro.\n2. Uma `description` específica e rica em gatilhos (quando a skill deve ser usada).\n3. Uma breve menção de quando o Claude deveria invocá-la.",
            rubric: ["Inclui o campo name", "Inclui o campo description", "A description tem gatilhos específicos de quando usar", "Deixa claro o caso de uso"],
            modelAnswer: "```markdown\n---\nname: excel-financial-reports\ndescription: Gera relatórios financeiros em planilhas .xlsx (DRE, fluxo de caixa, KPIs). Use quando o usuário pedir para montar, formatar ou exportar relatórios financeiros em Excel a partir de dados tabulares.\n---\n```\nO Claude invoca a skill quando a tarefa casa com a descrição — por exemplo, \"gere uma DRE em Excel a partir deste CSV\".",
          } },
        } } },
        { order: 4, title: "Claude Code", lessons: { create: { order: 1, title: "Claude Code na prática", readingMd: "# Claude Code\n\nClaude Code é o agente de linha de comando para tarefas de engenharia.\n\n**Tópicos:** ferramentas, permissões, MCP, skills.",
          flashcards: { create: [
            { front: "O que é o Claude Code?", back: "O agente de linha de comando da Anthropic para tarefas de engenharia de software.", tags: ["claude-code"] },
            { front: "Como o Claude Code se conecta a ferramentas e dados externos?", back: "Via servidores MCP (além de suas ferramentas nativas).", tags: ["claude-code", "mcp"] },
          ] },
          questions: { create: [
            { prompt: "O Claude Code é melhor descrito como:", options: ["Uma IDE gráfica", "Um agente de linha de comando para engenharia", "Um modelo de embeddings", "Um banco de dados"], correctIndex: 1, explanation: "Claude Code é o agente de CLI para tarefas de engenharia de software.", difficulty: 1, tags: ["claude-code"] },
            { prompt: "Qual mecanismo permite estender o Claude Code com integrações externas?", options: ["Plugins .exe", "Servidores MCP", "Macros do editor", "Cookies do navegador"], correctIndex: 1, explanation: "Servidores MCP estendem o Claude Code com tools e resources externos.", difficulty: 2, tags: ["claude-code", "mcp"] },
            { prompt: "Como o Claude Code trata ações potencialmente sensíveis, como editar arquivos ou rodar comandos?", options: ["Executa tudo sem avisar", "Pede permissão conforme as regras configuradas", "Só funciona em modo somente leitura", "Exige reiniciar a máquina"], correctIndex: 1, explanation: "O Claude Code usa um sistema de permissões: ações sensíveis podem requerer aprovação conforme a configuração.", difficulty: 2, tags: ["claude-code"] },
            { prompt: "Onde se costuma registrar instruções de projeto que o Claude Code deve seguir no repositório?", options: ["Num arquivo CLAUDE.md", "No .gitignore", "No package-lock.json", "Num cookie do navegador"], correctIndex: 0, explanation: "O arquivo CLAUDE.md documenta convenções e instruções do projeto que o Claude Code respeita.", difficulty: 1, tags: ["claude-code"] },
          ] },
          labs: { create: {
            title: "Planeje uma tarefa no Claude Code",
            promptMd: "# Lab: Planeje uma tarefa no Claude Code\n\nVocê quer que o Claude Code adicione um endpoint à sua API. Descreva como você conduziria a tarefa, abordando:\n\n1. Que instruções de projeto registrar em `CLAUDE.md`.\n2. Como o Claude Code lida com ações sensíveis (ex.: editar arquivos, rodar comandos).\n3. Como você estenderia o Claude Code com uma integração externa.",
            rubric: ["Menciona registrar convenções em CLAUDE.md", "Explica o sistema de permissões para ações sensíveis", "Cita servidores MCP como forma de integração externa", "Descreve um fluxo de trabalho coerente"],
            modelAnswer: "1. Em `CLAUDE.md`, registro convenções: estilo de código, comandos de teste/lint, estrutura de pastas.\n2. O Claude Code pede permissão para ações sensíveis (editar arquivos, executar comandos) conforme as regras configuradas.\n3. Conecto um servidor MCP (ex.: banco de dados ou GitHub) para estender o Claude Code com tools e resources externos, e peço o endpoint com testes.",
          } },
        } } },
      ] },
    },
  });
  console.log("Seed concluído.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
