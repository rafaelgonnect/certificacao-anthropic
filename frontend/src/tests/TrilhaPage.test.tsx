import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext.js";
import { TrilhaPage } from "../pages/TrilhaPage.js";
function renderTrilha() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><AuthProvider><TrilhaPage /></AuthProvider></MemoryRouter></QueryClientProvider>
  );
}
describe("TrilhaPage", () => {
  it("renderiza módulos e lições vindos da API", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        title: "Foundations",
        modules: [{ id: "m1", order: 1, title: "Claude API", lessons: [{ id: "l1", order: 1, title: "Intro" }] }],
      }), { status: 200 })
    );
    renderTrilha();
    expect(await screen.findByText("Claude API")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Intro" })).toHaveAttribute("href", "/licao/l1");
  });
});
