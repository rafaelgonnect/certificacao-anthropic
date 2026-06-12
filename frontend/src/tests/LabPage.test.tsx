import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LabPage } from "../pages/LabPage.js";

function renderLab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/lab/x"]}>
        <Routes>
          <Route path="/lab/:id" element={<LabPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("LabPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("mostra o enunciado, envia a resposta e exibe o feedback + resposta-modelo", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const method = init?.method ?? "GET";
      if (url.endsWith("/labs/x") && method === "GET") {
        return Promise.resolve(
          new Response(
            JSON.stringify({ id: "x", title: "Lab 1", promptMd: "Faça X", rubric: ["item A"] }),
            { status: 200 }
          )
        );
      }
      if (url.endsWith("/labs/x/submit") && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              mode: "self",
              feedback: "Compare sua resposta com a resposta-modelo e o checklist da rubrica.",
              rubric: ["item A"],
              modelAnswer: "# Modelo",
            }),
            { status: 200 }
          )
        );
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });

    renderLab();

    expect(await screen.findByText("Lab 1")).toBeInTheDocument();
    expect(screen.getByText("Faça X")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Sua resposta"), "minha resposta");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(
      await screen.findByText("Compare sua resposta com a resposta-modelo e o checklist da rubrica.")
    ).toBeInTheDocument();
    expect(screen.getByText("Resposta-modelo")).toBeInTheDocument();
    expect(screen.getByText("Modelo")).toBeInTheDocument();
  });
});
