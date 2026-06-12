import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

type Question = { id: string; prompt: string; options: string[] };
type AnswerResult = { correct: boolean; correctIndex: number; explanation: string };

export function QuizPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["quiz", "cca-foundations"],
    queryFn: () => api<Question[]>("/quiz?cert=cca-foundations&n=5"),
  });
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
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

  if (isLoading) return <p>Carregando…</p>;
  if (error) return <p role="alert">Erro ao carregar o quiz</p>;
  if (!data) return null;

  const question = data[index];

  function next() {
    setFeedback(null);
    setIndex((i) => i + 1);
  }

  return (
    <main>
      <Link to="/">← Voltar à trilha</Link>
      <h1>Praticar (quiz)</h1>
      {!question ? (
        <p>Você acertou {correctCount} de {data.length}</p>
      ) : (
        <section>
          <p>{question.prompt}</p>
          <div>
            {question.options.map((opt, i) => (
              <button
                key={i}
                disabled={feedback !== null || answer.isPending}
                onClick={() => answer.mutate({ questionId: question.id, chosenIndex: i })}
              >
                {opt}
              </button>
            ))}
          </div>
          {feedback && (
            <div>
              <p>{feedback.correct ? "Correto!" : "Errado."}</p>
              <p>Resposta correta: {question.options[feedback.correctIndex]}</p>
              <p>{feedback.explanation}</p>
              <button onClick={next}>Próxima</button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
