import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext.js";
import { OnboardingEngine } from "../onboarding/OnboardingEngine.js";

function renderOnb() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuthProvider>
          <OnboardingEngine />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("OnboardingEngine", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("mostra o primeiro passo e avança", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
    renderOnb();
    expect(await screen.findByText("Oi! Eu sou a Pia 🦜")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Qual certificação é seu foco?")).toBeInTheDocument();
  });
});
