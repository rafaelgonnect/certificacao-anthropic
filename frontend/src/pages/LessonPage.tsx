import { useEffect, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams, Link } from "react-router-dom";
import Markdown from "react-markdown";
import { api } from "../api/client.js";
import { CoachTip } from "../components/CoachTip.js";
import { IconBack, IconChevron } from "../components/icons.js";

type Lesson = { id: string; title: string; readingMd: string };
type LabLink = { id: string; title: string };

export function LessonPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const guia = sp.get("guia") === "1";
  const [progress, setProgress] = useState(0);

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

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [data]);

  if (isLoading)
    return (
      <main>
        <div className="reading">
          <div className="skeleton sk-line" style={{ width: "50%", height: 28 }} />
          <div className="skeleton sk-line" style={{ width: "90%" }} />
          <div className="skeleton sk-line" style={{ width: "80%" }} />
          <div className="skeleton sk-line" style={{ width: "85%" }} />
        </div>
      </main>
    );
  if (error) return <main><p role="alert">Erro ao carregar a lição</p></main>;
  if (!data) return null;

  return (
    <main>
      <div className="read-progress">
        <i style={{ "--p": `${progress}%` } as CSSProperties} />
      </div>
      <Link to="/" className="back-link">
        <IconBack className="" /> Voltar à trilha
      </Link>

      {guia && (
        <CoachTip text="Essa é sua primeira lição! 🦜 Lê com calma, sem decorar nada. Quando terminar, é só voltar pra trilha e seguir em frente — ou testar no quiz de “Praticar”. Tô aqui com você! 💚" />
      )}

      <article className="reading">
        <Markdown>{data.readingMd}</Markdown>
      </article>

      {labs && labs.length > 0 && (
        <div className="module" style={{ marginTop: "1.4rem" }}>
          <div className="module-head">
            <span className="module-num" aria-hidden="true">🧪</span>
            <h2>Labs práticos</h2>
            <span className="count">{labs.length}</span>
          </div>
          <ul className="lesson-list">
            {labs.map((lab) => (
              <li key={lab.id}>
                <Link to={`/lab/${lab.id}`} className="lesson-row">
                  <span className="ttl">Lab: {lab.title}</span>
                  <IconChevron className="chev" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
