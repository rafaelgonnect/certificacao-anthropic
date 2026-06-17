import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { IconBack } from "../components/icons.js";

type Flashcard = { id: string; front: string; back: string };
type Grade = "again" | "hard" | "good" | "easy";
type GradeResult = { dueAt: string; intervalDays: number };

const GRADES: Array<{ grade: Grade; label: string; hint: string }> = [
  { grade: "again", label: "Errei", hint: "rever já" },
  { grade: "hard", label: "Difícil", hint: "em breve" },
  { grade: "good", label: "Bom", hint: "no prazo" },
  { grade: "easy", label: "Fácil", hint: "mais tarde" },
];

export function ReviewsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reviews", "due"],
    queryFn: () => api<Flashcard[]>("/reviews/due"),
  });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const grade = useMutation({
    mutationFn: ({ id, grade }: { id: string; grade: Grade }) =>
      api<GradeResult>(`/reviews/${id}/grade`, {
        method: "POST",
        body: JSON.stringify({ grade }),
      }),
    onSuccess: () => {
      setIndex((i) => i + 1);
      setRevealed(false);
    },
  });

  if (isLoading) return <main><p className="state">Carregando revisões…</p></main>;
  if (error) return <main><p role="alert">Erro ao carregar as revisões</p></main>;
  if (!data) return null;

  const card = data[index];

  return (
    <main>
      <Link to="/" className="back-link"><IconBack className="" /> Voltar à trilha</Link>
      <div className="page-head">
        <div className="eyebrow">Repetição espaçada</div>
        <h1>Revisões de hoje</h1>
      </div>

      {!card ? (
        <div className="empty">
          <span className="emoji">🎉</span>
          <h2>Tudo em dia!</h2>
          <p>Nada para revisar agora 🎉</p>
          <Link to="/" className="btn btn-ghost btn-sm">Voltar à trilha</Link>
        </div>
      ) : (
        <>
          <div className="deck-progress">Cartão {index + 1} de {data.length}</div>

          <div className={"flash" + (revealed ? " is-flipped" : "")}>
            <div className="flash-inner">
              <div className="flash-face">
                <span className="tag">Pergunta</span>
                <p className="txt">{card.front}</p>
              </div>
              <div className="flash-face flash-back">
                <span className="tag">Resposta</span>
                <p className="txt">{card.back}</p>
              </div>
            </div>
          </div>

          {!revealed ? (
            <button className="btn-lg btn-block" onClick={() => setRevealed(true)}>
              Mostrar resposta
            </button>
          ) : (
            <div className="grade-grid">
              {GRADES.map((g) => (
                <button
                  key={g.grade}
                  className={"grade " + g.grade}
                  disabled={grade.isPending}
                  onClick={() => grade.mutate({ id: card.id, grade: g.grade })}
                >
                  {g.label}
                  <small aria-hidden="true">{g.hint}</small>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
