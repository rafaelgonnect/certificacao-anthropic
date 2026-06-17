import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { GamePage } from "../pages/GamePage.js";

function renderGame() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><GamePage /></MemoryRouter></QueryClientProvider>
  );
}

describe("GamePage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("mostra valuation, departamento e leaderboard", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/game/board/leaderboard")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([{ rank: 1, name: "Ana AI", founder: "Ana", valuation: 90000, certSlug: "cca-foundations" }]),
            { status: 200 }
          )
        );
      }
      if (url.includes("/game/")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              company: { name: "Minha AI", credits: 120, certSlug: "cca-foundations" },
              totals: { mrr: 300, users: 700, valuation: 50000, stage: "Seed", title: "Funded Founder", creditsPerHour: 100 },
              departments: [
                { moduleId: "m1", title: "Claude API", level: 4, stars: 4, quality: 0.8, tier: "sonnet", idealTier: "sonnet", tierMult: 1.2, mrr: 200 },
              ],
              idlePending: 0,
              weakest: { moduleId: "m1", title: "Claude API" },
            }),
            { status: 200 }
          )
        );
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    renderGame();

    expect(await screen.findByText("Minha AI")).toBeInTheDocument();
    expect(screen.getByText("$50.0k")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Claude API" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sonnet" })).toBeInTheDocument();
    expect(await screen.findByText("Ana AI")).toBeInTheDocument();
  });
});
