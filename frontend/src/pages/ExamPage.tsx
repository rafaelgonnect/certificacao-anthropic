import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

type Question = { id: string; prompt: string; options: string[] };
type StartResult = { sessionId: string; questions: Question[] };
type TopicStat = { total: number; correct: number; pct: number };
type SubmitResult = {
  total: number;
  correct: number;
  scorePct: number;
  perTopic: Record<string, TopicStat>;
  readinessPct: number;
  weakTopics: string[];
};

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function ExamPage() {
  const [session, setSession] = useState<StartResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [report, setReport] = useState<SubmitResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);

  const start = useMutation({
    mutationFn: () =>
      api<StartResult>("/exams/start", {
        method: "POST",
        body: JSON.stringify({ cert: "cca-foundations" }),
      }),
    onSuccess: (res) => {
      setSession(res);
      setAnswers({});
      setIndex(0);
      setReport(null);
      startedAt.current = Date.now();
      setElapsed(0);
    },
  });

  const submit = useMutation({
    mutationFn: (sessionId: string) =>
      api<SubmitResult>(`/exams/${sessionId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, chosenIndex]) => ({
            questionId,
            chosenIndex,
          })),
        }),
      }),
    onSuccess: (res) => setReport(res),
  });

  useEffect(() => {
    if (!session || report) return;
    const timer = setInterval(() => {
      if (startedAt.current != null) {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [session, report]);

  if (report) {
    return (
      <main>
        <Link to="/">← Voltar à trilha</Link>
        <h1>Resultado do simulado</h1>
        <p>Prontidão: {report.readinessPct}%</p>
        <p>Acertos: {report.correct}/{report.total}</p>
        <h2>Pontos fracos</h2>
        {report.weakTopics.length === 0 ? (
          <p>Sem pontos fracos 🎉</p>
        ) : (
          <ul>
            {report.weakTopics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <h2>Por tópico</h2>
        <ul>
          {Object.entries(report.perTopic).map(([tag, stat]) => (
            <li key={tag}>{tag}: {stat.pct}%</li>
          ))}
        </ul>
      </main>
    );
  }

  if (!session) {
    return (
      <main>
        <Link to="/">← Voltar à trilha</Link>
        <h1>Simulado</h1>
        {start.error && <p role="alert">Erro ao iniciar o simulado</p>}
        <button onClick={() => start.mutate()} disabled={start.isPending}>
          Iniciar simulado
        </button>
      </main>
    );
  }

  const question = session.questions[index];
  const isLast = index === session.questions.length - 1;

  return (
    <main>
      <Link to="/">← Voltar à trilha</Link>
      <h1>Simulado</h1>
      <p>Tempo: {formatTime(elapsed)}</p>
      <p>Questão {index + 1} de {session.questions.length}</p>
      <section>
        <p>{question.prompt}</p>
        <div>
          {question.options.map((opt, i) => (
            <button
              key={i}
              aria-pressed={answers[question.id] === i}
              onClick={() =>
                setAnswers((a) => ({ ...a, [question.id]: i }))
              }
            >
              {opt}
            </button>
          ))}
        </div>
      </section>
      {submit.error && <p role="alert">Erro ao finalizar o simulado</p>}
      <div>
        <button onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
          Anterior
        </button>
        {isLast ? (
          <button
            onClick={() => submit.mutate(session.sessionId)}
            disabled={submit.isPending}
          >
            Finalizar
          </button>
        ) : (
          <button onClick={() => setIndex((i) => i + 1)}>Próxima</button>
        )}
      </div>
    </main>
  );
}
