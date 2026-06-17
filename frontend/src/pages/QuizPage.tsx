import { useState, type CSSProperties } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { IconBack } from "../components/icons.js";

type Question = { id: string; prompt: string; options: string[] };
type AnswerResult = { correct: boolean; correctIndex: number; explanation: string };

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuizPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["quiz", "cca-foundations"],
    queryFn: () => api<Question[]>("/quiz?cert=cca-foundations&n=5"),
  });
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const answer = useMutation({
    mutationFn: ({ questionId, chosenIndex }: { questionId: string; chosenIndex: number }) =>
      api<AnswerResult>("/quiz/answer", {
        method: "POST",
        body: JSON.stringify({ questionId, chosenIndex }),
      }),
    onSuccess: (result) => {
      setFeedback(result);
      if (result.correct) setCorrectCount((c) => c + 1);
    },
  });

  if (isLoading) return <main><p className="state">Carregando quiz…</p></main>;
  if (error) return <main><p role="alert">Erro ao carregar o quiz</p></main>;
  if (!data) return null;

  const question = data[index];

  function pick(i: number) {
    if (feedback || answer.isPending) return;
    setChosen(i);
    answer.mutate({ questionId: question.id, chosenIndex: i });
  }
  function next() {
    setFeedback(null);
    setChosen(null);
    setIndex((i) => i + 1);
  }

  const done = !question;
  const pct = done ? 100 : Math.round((index / data.length) * 100);
  const scorePct = data.length ? Math.round((correctCount / data.length) * 100) : 0;

  return (
    <main>
      <Link to="/" className="back-link"><IconBack className="" /> Voltar à trilha</Link>
      <div className="page-head">
        <div className="eyebrow">Praticar</div>
        <h1>Quiz · Foundations</h1>
      </div>

      {done ? (
        <div className="card result-hero">
          <div className="ring" style={{ "--p": scorePct, "--c": "var(--green)" } as CSSProperties}>
            <div><b>{scorePct}%</b><small>acertos</small></div>
          </div>
          <div className="meta">
            <p style={{ margin: 0 }}>Você acertou</p>
            <b>{correctCount} de {data.length}</b>
            <p style={{ marginTop: ".6rem" }}>
              <Link to="/" className="btn btn-ghost btn-sm">Voltar à trilha</Link>
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="exam-top">
            <span className="qcount">Questão {index + 1} de {data.length}</span>
            <div className="progress"><i style={{ "--p": `${pct}%` } as CSSProperties} /></div>
          </div>

          <div className="q-card">
            <p className="q-prompt">{question.prompt}</p>
            <div className="choices">
              {question.options.map((opt, i) => {
                let cls = "choice";
                if (feedback) {
                  if (i === feedback.correctIndex) cls += " is-correct";
                  else if (i === chosen) cls += " is-wrong";
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    disabled={feedback !== null || answer.isPending}
                    onClick={() => pick(i)}
                  >
                    <span className="key" aria-hidden="true">{LETTERS[i]}</span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className={"feedback " + (feedback.correct ? "is-correct" : "is-wrong")}>
                <div className="verdict">
                  <span aria-hidden="true">{feedback.correct ? "✓" : "✗"}</span>
                  <span>{feedback.correct ? "Correto!" : "Errado."}</span>
                </div>
                <p>{feedback.explanation}</p>
                <button onClick={next} style={{ marginTop: ".6rem" }}>Próxima</button>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
