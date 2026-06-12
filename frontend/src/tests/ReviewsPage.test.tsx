import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ReviewsPage } from "../pages/ReviewsPage.js";

function renderReviews() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><ReviewsPage /></MemoryRouter></QueryClientProvider>
  );
}

describe("ReviewsPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("revela o verso, grada e avança até esvaziar a fila", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const method = init?.method ?? "GET";
      if (url.endsWith("/reviews/due") && method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify([{ id: "f1", front: "Frente?", back: "Verso!" }]), { status: 200 })
        );
      }
      if (url.includes("/reviews/") && url.endsWith("/grade") && method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ dueAt: "2026-06-13", intervalDays: 1 }), { status: 200 })
        );
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });

    renderReviews();

    expect(await screen.findByText("Frente?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mostrar resposta" }));
    expect(screen.getByText("Verso!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Errei" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Difícil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bom" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fácil" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Bom" }));
    expect(await screen.findByText("Nada para revisar agora 🎉")).toBeInTheDocument();
  });
});
