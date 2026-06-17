import { useEffect, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { api } from "../api/client.js";
import { Prose } from "../components/Prose.js";
import { CoachTip } from "../components/CoachTip.js";
import { IconBack, IconChevron } from "../components/icons.js";

type NeighborLesson = { id: string; title: string };
type Lesson = {
  id: string;
  title: string;
  readingMd: string;
  certSlug: string;
  position: number;
  total: number;
  prev: NeighborLesson | null;
  next: NeighborLesson | null;
};
type LabLink = { id: string; title: string };

export function LessonPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const guia = sp.get("guia") === "1";
  const [progress, setProgress] = useState(0);

  // ao trocar de lição (prev/próxima), volta ao topo da leitura
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

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
      <div className="lesson-top">
        <Link to={`/trilha/${data.certSlug}`} className="back-link">
          <IconBack className="" /> Voltar à trilha
        </Link>
        <span className="qcount">Lição {data.position} de {data.total}</span>
      </div>

      {guia && (
        <CoachTip text="Essa é sua primeira lição! 🦜 Lê com calma, sem decorar nada. Quando terminar, é só voltar pra trilha e seguir em frente — ou testar no quiz de “Praticar”. Tô aqui com você! 💚" />
      )}

      <article className="reading">
        <Prose>{data.readingMd}</Prose>
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

      <nav className="lesson-nav" aria-label="Navegação entre lições">
        {data.prev ? (
          <Link to={`/licao/${data.prev.id}`} className="lnav lnav-prev">
            <span className="lnav-dir">← Anterior</span>
            <span className="lnav-ttl">{data.prev.title}</span>
          </Link>
        ) : (
          <span className="lnav lnav-empty" aria-hidden="true" />
        )}
        {data.next ? (
          <Link to={`/licao/${data.next.id}`} className="lnav lnav-next">
            <span className="lnav-dir">Próxima lição →</span>
            <span className="lnav-ttl">{data.next.title}</span>
          </Link>
        ) : (
          <Link to={`/trilha/${data.certSlug}`} className="lnav lnav-next lnav-done">
            <span className="lnav-dir">Concluir ✓</span>
            <span className="lnav-ttl">Voltar à trilha</span>
          </Link>
        )}
      </nav>
    </main>
  );
}
