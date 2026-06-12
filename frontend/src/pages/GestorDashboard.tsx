import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

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

  if (isLoading) return <p>Carregando…</p>;
  if (error) return <p role="alert">Erro ao carregar o painel</p>;
  if (!data) return null;

  return (
    <main>
      <Link to="/">← Voltar à trilha</Link>
      <h1>Painel do gestor</h1>
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
              <td>{s.name}</td>
              <td>{s.email}</td>
              <td>{s.attempts}</td>
              <td>{s.avgScore}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Média da turma por tópico</h2>
      <ul>
        {Object.entries(data.topicAverages).map(([tag, pct]) => (
          <li key={tag}>{tag}: {pct}%</li>
        ))}
      </ul>
    </main>
  );
}
