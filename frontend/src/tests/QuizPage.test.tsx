import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { QuizPage } from "../pages/QuizPage.js";

function renderQuiz() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><QuizPage /></MemoryRouter></QueryClientProvider>
  );
}

describe("QuizPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("mostra feedback imediato ao responder", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const method = init?.method ?? "GET";
      if (url.includes("/quiz?") && method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify([{ id: "q1", prompt: "Qual protocolo?", options: ["REST", "MCP"] }]), { status: 200 })
        );
      }
      if (url.endsWith("/quiz/answer") && method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ correct: true, correctIndex: 1, explanation: "MCP é o protocolo." }), { status: 200 })
        );
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });

    renderQuiz();

    expect(await screen.findByText("Qual protocolo?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "MCP" }));
    expect(await screen.findByText("Correto!")).toBeInTheDocument();
    expect(screen.getByText("MCP é o protocolo.")).toBeInTheDocument();
  });
});
