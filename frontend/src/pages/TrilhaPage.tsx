import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { IconChevron, IconCards, IconQuiz, IconExam, IconBack } from "../components/icons.js";

type Lesson = { id: string; order: number; title: string };
type Module = { id: string; order: number; title: string; lessons: Lesson[] };
type Trilha = { title: string; description?: string; modules: Module[] };

export function TrilhaPage() {
  const params = useParams();
  const slug = params.slug ?? "cca-foundations";

  const { data, isLoading, error } = useQuery({
    queryKey: ["trilha", slug],
    queryFn: () => api<Trilha>(`/certifications/${slug}`),
  });

  if (isLoading)
    return (
      <main>
        <div className="card card-pad">
          <div className="skeleton sk-line" style={{ width: "40%" }} />
          <div className="skeleton sk-line" style={{ width: "70%" }} />
          <div className="skeleton sk-line" style={{ width: "55%" }} />
        </div>
      </main>
    );
  if (error) return <main><p role="alert">Erro ao carregar a trilha</p></main>;
  if (!data) return null;

  const totalLessons = data.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <main>
      <Link to="/" className="back-link"><IconBack className="" /> Todas as trilhas</Link>
      <div className="page-head">
        <div className="eyebrow">Trilha de certificação</div>
        <h1>{data.title}</h1>
        {data.description && <p>{data.description}</p>}
      </div>

      <div className="quick-grid">
        <Link to="/revisoes" className="quick">
          <span className="q-ico q-green" aria-hidden="true"><IconCards className="" /></span>
          <span>Revisões<small>Repetição espaçada</small></span>
        </Link>
        <Link to={`/quiz?cert=${slug}`} className="quick">
          <span className="q-ico q-blue" aria-hidden="true"><IconQuiz className="" /></span>
          <span>Praticar<small>Quiz com feedback</small></span>
        </Link>
        <Link to={`/simulado?cert=${slug}`} className="quick">
          <span className="q-ico q-gold" aria-hidden="true"><IconExam className="" /></span>
          <span>Simulado<small>Teste de prontidão</small></span>
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.8rem" }}>
        <h2 style={{ margin: 0 }}>Conteúdo</h2>
        <span className="qcount">{data.modules.length} módulos · {totalLessons} lições</span>
      </div>

      {data.modules.map((m) => (
        <div className="module" key={m.id}>
          <div className="module-head">
            <span className="module-num" aria-hidden="true">{m.order}</span>
            <h2>{m.title}</h2>
            <span className="count">{m.lessons.length} {m.lessons.length === 1 ? "lição" : "lições"}</span>
          </div>
          <ul className="lesson-list">
            {m.lessons.map((l) => (
              <li key={l.id}>
                <Link to={`/licao/${l.id}`} className="lesson-row">
                  <span className="dot" aria-hidden="true">{l.order}</span>
                  <span className="ttl">{l.title}</span>
                  <IconChevron className="chev" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </main>
  );
}
