import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { IconBack } from "../components/icons.js";

type MasteryStat = { mastery: number; attempts: number };
type Student = {
  id: string;
  name: string;
  email: string;
  attempts: number;
  avgScore: number;
  mastery: Record<string, MasteryStat>;
};
type Overview = {
  students: Student[];
  topicAverages: Record<string, number>;
};

export function GestorDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => api<Overview>("/admin/overview"),
  });

  if (isLoading) return <main><p className="state">Carregando painel…</p></main>;
  if (error) return <main><p role="alert">Erro ao carregar o painel</p></main>;
  if (!data) return null;

  const totalAttempts = data.students.reduce((n, s) => n + s.attempts, 0);
  const topics = Object.entries(data.topicAverages);

  return (
    <main>
      <Link to="/" className="back-link"><IconBack className="" /> Voltar à trilha</Link>
      <div className="page-head">
        <div className="eyebrow">Gestão</div>
        <h1>Painel do gestor</h1>
        <p>Acompanhe o progresso da turma e identifique os tópicos que precisam de reforço.</p>
      </div>

      <div className="stat-grid">
        <div className="card stat">
          <div className="v">{data.students.length}</div>
          <div className="l">Alunos</div>
        </div>
        <div className="card stat">
          <div className="v">{totalAttempts}</div>
          <div className="l">Tentativas</div>
        </div>
        <div className="card stat">
          <div className="v">{topics.length}</div>
          <div className="l">Tópicos acompanhados</div>
        </div>
      </div>

      <h2>Alunos</h2>
      <div className="table-wrap" style={{ marginBottom: "1.8rem" }}>
        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Email</th>
              <th>Tentativas</th>
              <th>Média</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td style={{ color: "var(--muted)" }}>{s.email}</td>
                <td>{s.attempts}</td>
                <td>{s.avgScore}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Média da turma por tópico</h2>
      <div className="card card-pad">
        {topics.map(([tag, pct]) => (
          <div className="bar-row" key={tag}>
            <span className="lbl">{tag}: {pct}%</span>
            <span className="track"><i style={{ width: `${pct}%` }} /></span>
          </div>
        ))}
      </div>
    </main>
  );
}
