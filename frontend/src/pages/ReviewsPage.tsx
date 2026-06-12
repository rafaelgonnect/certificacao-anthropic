import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

type Flashcard = { id: string; front: string; back: string };
type Grade = "again" | "hard" | "good" | "easy";
type GradeResult = { dueAt: string; intervalDays: number };

const GRADES: Array<{ grade: Grade; label: string }> = [
  { grade: "again", label: "Errei" },
  { grade: "hard", label: "Difícil" },
  { grade: "good", label: "Bom" },
  { grade: "easy", label: "Fácil" },
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

  if (isLoading) return <p>Carregando…</p>;
  if (error) return <p role="alert">Erro ao carregar as revisões</p>;
  if (!data) return null;

  const card = data[index];

  return (
    <main>
      <Link to="/">← Voltar à trilha</Link>
      <h1>Revisões de hoje</h1>
      {!card ? (
        <p>Nada para revisar agora 🎉</p>
      ) : (
        <section>
          <p>{card.front}</p>
          {!revealed ? (
            <button onClick={() => setRevealed(true)}>Mostrar resposta</button>
          ) : (
            <>
              <p>{card.back}</p>
              <div>
                {GRADES.map((g) => (
                  <button
                    key={g.grade}
                    disabled={grade.isPending}
                    onClick={() => grade.mutate({ id: card.id, grade: g.grade })}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
