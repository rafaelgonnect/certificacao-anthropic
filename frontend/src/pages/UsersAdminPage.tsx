import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

type Status = "pending" | "active" | "blocked";
type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: Status;
  createdAt: string;
};

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendente",
  active: "Ativo",
  blocked: "Bloqueado",
};

export function UsersAdminPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api<AdminUser[]>("/admin/users"),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: Status }) =>
      api(`/admin/users/${v.id}/status`, { method: "PATCH", body: JSON.stringify({ status: v.status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  if (isLoading) return <main><p className="state">Carregando usuários…</p></main>;
  if (error) return <main><p role="alert">Erro ao carregar os usuários</p></main>;
  if (!data) return null;

  const pending = data.filter((u) => u.status === "pending").length;

  return (
    <main>
      <div className="page-head">
        <div className="eyebrow">Gestão</div>
        <h1>Usuários</h1>
        <p>
          Libere o acesso de novos alunos. {pending > 0
            ? `${pending} conta(s) aguardando aprovação.`
            : "Nenhuma conta pendente no momento."}
        </p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Email</th>
              <th>Papel</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td style={{ color: "var(--muted)" }}>{u.email}</td>
                <td style={{ textTransform: "capitalize" }}>{u.role}</td>
                <td>
                  <span className={"status-pill " + u.status}>{STATUS_LABEL[u.status]}</span>
                </td>
                <td>
                  <div className="row-actions">
                    {u.status !== "active" && (
                      <button
                        className="btn-sm"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: u.id, status: "active" })}
                      >
                        Aprovar
                      </button>
                    )}
                    {u.status !== "blocked" && u.role !== "admin" && (
                      <button
                        className="btn-sm btn-ghost"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: u.id, status: "blocked" })}
                      >
                        Bloquear
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
