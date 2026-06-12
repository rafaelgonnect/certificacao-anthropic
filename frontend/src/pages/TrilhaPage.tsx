import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";
type Lesson = { id: string; order: number; title: string };
type Module = { id: string; order: number; title: string; lessons: Lesson[] };
type Trilha = { title: string; modules: Module[] };
export function TrilhaPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["trilha", "cca-foundations"],
    queryFn: () => api<Trilha>("/certifications/cca-foundations"),
  });
  if (isLoading) return <p>Carregando…</p>;
  if (error) return <p role="alert">Erro ao carregar a trilha</p>;
  if (!data) return null;
  return (
    <main>
      <nav>
        <Link to="/revisoes">Revisões de hoje</Link>{" · "}
        <Link to="/quiz">Praticar (quiz)</Link>{" · "}
        <Link to="/simulado">Simulado</Link>
        {(user?.role === "gestor" || user?.role === "admin") && (
          <>{" · "}<Link to="/gestor">Painel do gestor</Link></>
        )}
      </nav>
      <h1>{data.title}</h1>
      {data.modules.map((m) => (
        <section key={m.id}>
          <h2>{m.title}</h2>
          <ul>
            {m.lessons.map((l) => (
              <li key={l.id}><Link to={`/licao/${l.id}`}>{l.title}</Link></li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
