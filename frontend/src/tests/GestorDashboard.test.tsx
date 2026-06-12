import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { GestorDashboard } from "../pages/GestorDashboard.js";

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><GestorDashboard /></MemoryRouter></QueryClientProvider>
  );
}

describe("GestorDashboard", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("mostra alunos e médias por tópico", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const method = init?.method ?? "GET";
      if (url.endsWith("/admin/overview") && method === "GET") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              students: [
                { id: "u1", name: "Ana", email: "a@a.com", attempts: 3, avgScore: 80, mastery: {} },
              ],
              topicAverages: { api: 75 },
            }),
            { status: 200 }
          )
        );
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });

    renderDashboard();

    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("api: 75%")).toBeInTheDocument();
  });
});
