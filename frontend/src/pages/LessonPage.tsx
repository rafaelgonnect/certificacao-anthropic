import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import Markdown from "react-markdown";
import { api } from "../api/client.js";
type Lesson = { id: string; title: string; readingMd: string };
type LabLink = { id: string; title: string };
export function LessonPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["lesson", id],
    queryFn: () => api<Lesson>(`/lessons/${id}`),
    enabled: !!id,
  });
  const { data: labs } = useQuery({
    queryKey: ["lesson", id, "labs"],
    queryFn: () => api<LabLink[]>(`/lessons/${id}/labs`),
    enabled: !!id,
  });
  if (isLoading) return <p>Carregando…</p>;
  if (error) return <p role="alert">Erro ao carregar a lição</p>;
  if (!data) return null;
  return (
    <main>
      <Link to="/">← Voltar à trilha</Link>
      <article><Markdown>{data.readingMd}</Markdown></article>
      {labs && labs.length > 0 && (
        <section>
          <h2>Labs práticos</h2>
          <ul>
            {labs.map((lab) => (
              <li key={lab.id}><Link to={`/lab/${lab.id}`}>Lab: {lab.title}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
