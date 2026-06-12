import Anthropic from "@anthropic-ai/sdk";

// A Claude API é OPCIONAL: só está habilitada quando ANTHROPIC_API_KEY existe.
export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Modelo padrão para correção. Pode ser sobrescrito por ANTHROPIC_MODEL.
const GRADING_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

// Chama o Claude com o prompt de correção e devolve o texto concatenado dos blocos.
// Não é chamado no import — o cliente é criado sob demanda.
export async function gradeWithClaude(prompt: string): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: GRADING_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
