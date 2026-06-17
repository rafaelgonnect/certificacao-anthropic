import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { IconBack, IconClock, IconExam } from "../components/icons.js";

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

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function ExamPage() {
  const [sp] = useSearchParams();
  const cert = sp.get("cert") ?? "cca-foundations";
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
        body: JSON.stringify({ cert }),
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

  // ── Relatório ──────────────────────────────────────────────────────────
  if (report) {
    const ringColor =
      report.readinessPct >= 70 ? "var(--green)" : report.readinessPct >= 40 ? "var(--gold)" : "var(--danger)";
    return (
      <main>
        <Link to={`/trilha/${cert}`} className="back-link"><IconBack className="" /> Voltar à trilha</Link>
        <div className="page-head">
          <div className="eyebrow">Simulado concluído</div>
          <h1>Resultado do simulado</h1>
        </div>

        <div className="card result-hero">
          <div className="ring" style={{ "--p": report.readinessPct, "--c": ringColor } as CSSProperties}>
            <div><b>{report.readinessPct}%</b><small>prontidão</small></div>
          </div>
          <div className="meta">
            <p style={{ margin: 0, color: "var(--muted)" }}>Prontidão: {report.readinessPct}%</p>
            <b>Acertos: {report.correct}/{report.total}</b>
            <div className="chips" style={{ marginTop: ".7rem" }}>
              <span className="chip">Pontuação {report.scorePct}%</span>
            </div>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: "1.2rem" }}>
          <h2>Pontos fracos</h2>
          {report.weakTopics.length === 0 ? (
            <p>Sem pontos fracos 🎉</p>
          ) : (
            <div className="chips">
              {report.weakTopics.map((t) => (
                <span className="chip weak" key={t}>{t}</span>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h2>Desempenho por tópico</h2>
          {Object.entries(report.perTopic).map(([tag, stat]) => (
            <div className={"bar-row" + (report.weakTopics.includes(tag) ? " is-weak" : "")} key={tag}>
              <span className="lbl">{tag}</span>
              <span className="track"><i style={{ "--p": `${stat.pct}%` } as CSSProperties} /></span>
              <span className="val">{stat.pct}%</span>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ── Tela inicial ─────────────────────────────────────────────────────────
  if (!session) {
    return (
      <main>
        <Link to={`/trilha/${cert}`} className="back-link"><IconBack className="" /> Voltar à trilha</Link>
        <div className="page-head">
          <div className="eyebrow">Avaliação</div>
          <h1>Simulado</h1>
          <p>Um teste de prontidão no formato da prova, com diagnóstico por tópico ao final.</p>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <span className="q-ico q-gold" aria-hidden="true" style={{ margin: "0 auto .8rem", width: 52, height: 52 }}>
            <IconExam className="" />
          </span>
          <h2>Pronto para começar?</h2>
          <p style={{ color: "var(--muted)", maxWidth: "42ch", margin: "0 auto 1.2rem" }}>
            Responda todas as questões e finalize para ver sua prontidão e onde focar os estudos.
          </p>
          {start.error && <p role="alert">Erro ao iniciar o simulado</p>}
          <button className="btn-lg" onClick={() => start.mutate()} disabled={start.isPending}>
            Iniciar simulado
          </button>
        </div>
      </main>
    );
  }

  // ── Em andamento ─────────────────────────────────────────────────────────
  const question = session.questions[index];
  const isLast = index === session.questions.length - 1;
  const pct = Math.round(((index + 1) / session.questions.length) * 100);

  return (
    <main>
      <Link to={`/trilha/${cert}`} className="back-link"><IconBack className="" /> Voltar à trilha</Link>
      <div className="page-head"><h1 style={{ marginBottom: 0 }}>Simulado</h1></div>

      <div className="exam-top">
        <span className="timer"><IconClock className="" /> {formatTime(elapsed)}</span>
        <span className="qcount">Questão {index + 1} de {session.questions.length}</span>
        <div className="progress"><i style={{ "--p": `${pct}%` } as CSSProperties} /></div>
      </div>

      <div className="q-card">
        <p className="q-prompt">{question.prompt}</p>
        <div className="choices">
          {question.options.map((opt, i) => (
            <button
              key={i}
              className="choice"
              aria-pressed={answers[question.id] === i}
              onClick={() => setAnswers((a) => ({ ...a, [question.id]: i }))}
            >
              <span className="key" aria-hidden="true">{LETTERS[i]}</span>
              <span>{opt}</span>
            </button>
          ))}
        </div>
      </div>

      {submit.error && <p role="alert">Erro ao finalizar o simulado</p>}

      <div className="exam-nav">
        <button className="btn-ghost" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
          Anterior
        </button>
        <span className="spacer" />
        {isLast ? (
          <button onClick={() => submit.mutate(session.sessionId)} disabled={submit.isPending}>
            Finalizar
          </button>
        ) : (
          <button className="btn-secondary" onClick={() => setIndex((i) => i + 1)}>Próxima</button>
        )}
      </div>
    </main>
  );
}
