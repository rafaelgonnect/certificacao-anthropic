import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import Markdown from "react-markdown";
import { api } from "../api/client.js";

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

  if (isLoading) return <p>Carregando…</p>;
  if (error) return <p role="alert">Erro ao carregar o lab</p>;
  if (!data) return null;

  const result = submit.data;

  return (
    <main>
      <Link to="/">← Voltar à trilha</Link>
      <h1>{data.title}</h1>
      <article><Markdown>{data.promptMd}</Markdown></article>

      <h2>Rubrica</h2>
      <ul>
        {data.rubric.map((item, i) => (
          <li key={i}>☐ {item}</li>
        ))}
      </ul>

      <h2>Sua resposta</h2>
      <textarea
        aria-label="Sua resposta"
        rows={10}
        value={submission}
        onChange={(e) => setSubmission(e.target.value)}
      />
      <div>
        <button onClick={() => submit.mutate()} disabled={submit.isPending}>
          Enviar
        </button>
      </div>

      {submit.error && <p role="alert">Erro ao enviar a resposta</p>}

      {result && (
        <section>
          <h2>Feedback</h2>
          {result.mode === "ai" ? (
            <div>
              <p>Nota: {result.score}/100</p>
              <p>{result.passed ? "Aprovado ✓" : "Não aprovado ✗"}</p>
              <p>{result.feedback}</p>
            </div>
          ) : (
            <div>
              <p>{result.feedback}</p>
              <ul>
                {result.rubric.map((item, i) => (
                  <li key={i}>☐ {item}</li>
                ))}
              </ul>
            </div>
          )}

          <h2>Resposta-modelo</h2>
          <article><Markdown>{result.modelAnswer}</Markdown></article>
        </section>
      )}
    </main>
  );
}
