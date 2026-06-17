import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import type { SampleStep as T } from "../types.js";

type Q = { id: string; prompt: string; options: string[] };
type R = { correct: boolean; correctIndex: number; explanation: string };
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function SampleStep({
  step,
  certSlug,
  onResult,
}: {
  step: T;
  certSlug: string | undefined;
  onResult: (correct: boolean) => void;
}) {
  const cert = certSlug ?? "cca-foundations";
  const { data } = useQuery({
    queryKey: ["onb-sample", cert],
    queryFn: () => api<Q[]>(`/quiz?cert=${cert}&n=1`),
  });
  const [fb, setFb] = useState<R | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);

  const answer = useMutation({
    mutationFn: (i: number) =>
      api<R>("/quiz/answer", {
        method: "POST",
        body: JSON.stringify({ questionId: data![0].id, chosenIndex: i }),
      }),
    onSuccess: (r) => {
      setFb(r);
      onResult(r.correct);
    },
  });

  const q = data?.[0];

  return (
    <div className="onb-bubble onb-bubble-wide">
      <h2>{step.title}</h2>
      {!q ? (
        <p className="state">Preparando…</p>
      ) : (
        <>
          <p className="q-prompt" style={{ fontSize: "1.05rem" }}>{q.prompt}</p>
          <div className="onb-choices">
            {q.options.map((opt, i) => {
              let cls = "onb-choice";
              if (fb) {
                if (i === fb.correctIndex) cls += " is-correct";
                else if (i === chosen) cls += " is-wrong";
              }
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  disabled={fb !== null || answer.isPending}
                  onClick={() => {
                    setChosen(i);
                    answer.mutate(i);
                  }}
                >
                  <span className="onb-choice-label">
                    <span className="key" aria-hidden="true">{LETTERS[i]}</span> {opt}
                  </span>
                </button>
              );
            })}
          </div>
          {fb && <p style={{ marginTop: "0.8rem", color: "var(--ink-2)" }}>{fb.explanation}</p>}
        </>
      )}
    </div>
  );
}
