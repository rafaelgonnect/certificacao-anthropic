import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ExamPage } from "../pages/ExamPage.js";

function renderExam() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><ExamPage /></MemoryRouter></QueryClientProvider>
  );
}

describe("ExamPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("inicia o simulado, responde e mostra o relatório de prontidão", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const method = init?.method ?? "GET";
      if (url.endsWith("/exams/start") && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              sessionId: "s1",
              questions: [{ id: "q1", prompt: "P1?", options: ["A", "B"] }],
            }),
            { status: 200 }
          )
        );
      }
      if (url.endsWith("/exams/s1/submit") && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              total: 1,
              correct: 1,
              scorePct: 100,
              perTopic: { api: { total: 1, correct: 1, pct: 100 } },
              readinessPct: 100,
              weakTopics: [],
            }),
            { status: 200 }
          )
        );
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });

    renderExam();

    await userEvent.click(screen.getByRole("button", { name: "Iniciar simulado" }));
    expect(await screen.findByText("P1?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "A" }));
    await userEvent.click(screen.getByRole("button", { name: "Finalizar" }));
    expect(await screen.findByText("Prontidão: 100%")).toBeInTheDocument();
    expect(screen.getByText("Sem pontos fracos 🎉")).toBeInTheDocument();
  });
});
