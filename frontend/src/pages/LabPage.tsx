import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client.js";
import { Prose } from "../components/Prose.js";
import { IconBack } from "../components/icons.js";

type Lab = { id: string; title: string; promptMd: string; rubric: string[] };
type LabFeedback = {
  mode: "ai" | "self";
  score?: number;
  passed?: boolean;
  feedback: string;
  rubric: string[];
  modelAnswer: string;
};

export function LabPage() {
  const { id } = useParams();
  const [submission, setSubmission] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["lab", id],
    queryFn: () => api<Lab>(`/labs/${id}`),
    enabled: !!id,
  });

  const submit = useMutation({
    mutationFn: () =>
      api<LabFeedback>(`/labs/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ submission }),
      }),
  });

  if (isLoading) return <main><p className="state">Carregando lab…</p></main>;
  if (error) return <main><p role="alert">Erro ao carregar o lab</p></main>;
  if (!data) return null;

  const result = submit.data;

  return (
    <main>
      <Link to="/" className="back-link"><IconBack className="" /> Voltar à trilha</Link>
      <div className="page-head">
        <div className="eyebrow">Lab prático</div>
        <h1>{data.title}</h1>
      </div>

      <article className="reading"><Prose>{data.promptMd}</Prose></article>

      <div className="card card-pad" style={{ marginTop: "1.2rem" }}>
        <h2>Rubrica de avaliação</h2>
        <ul className="checklist">
          {data.rubric.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="card card-pad" style={{ marginTop: "1.2rem" }}>
        <label htmlFor="lab-answer">Sua resposta</label>
        <textarea
          id="lab-answer"
          aria-label="Sua resposta"
          rows={10}
          placeholder="Escreva sua solução aqui…"
          value={submission}
          onChange={(e) => setSubmission(e.target.value)}
        />
        <div style={{ marginTop: "0.9rem" }}>
          <button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? "Enviando…" : "Enviar"}
          </button>
        </div>
        {submit.error && <p role="alert">Erro ao enviar a resposta</p>}
      </div>

      {result && (
        <div className="card card-pad" style={{ marginTop: "1.2rem" }}>
          <h2>Feedback</h2>
          {result.mode === "ai" ? (
            <>
              <div className="stat-grid" style={{ marginBottom: "1rem" }}>
                <div className="card stat">
                  <div className="v">{result.score}<small style={{ fontSize: "1rem", color: "var(--muted)" }}>/100</small></div>
                  <div className="l">Nota</div>
                </div>
                <div className="card stat">
                  <div className="v" style={{ color: result.passed ? "var(--success)" : "var(--danger)" }}>
                    {result.passed ? "Aprovado" : "A rever"}
                  </div>
                  <div className="l">Resultado</div>
                </div>
              </div>
              <p>{result.feedback}</p>
            </>
          ) : (
            <>
              <p>{result.feedback}</p>
              <ul className="checklist">
                {result.rubric.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </>
          )}

          <h2 style={{ marginTop: "1.4rem" }}>Resposta-modelo</h2>
          <article className="reading"><Prose>{result.modelAnswer}</Prose></article>
        </div>
      )}
    </main>
  );
}
