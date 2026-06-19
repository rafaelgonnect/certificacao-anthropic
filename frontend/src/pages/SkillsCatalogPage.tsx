import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

type CatalogPlugin = {
  slug: string;
  displayName: string;
  description: string;
  version: string;
  category: string | null;
  keywords: string[];
  author: string | null;
  skills: string[];
};
type InstallInfo = { marketplaceName: string; repoPath: string };

function Copyable({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-row">
      <code>{text}</code>
      <button
        type="button"
        className="btn-sm btn-ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard indisponível */
          }
        }}
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}

export function SkillsCatalogPage() {
  const qc = useQueryClient();
  const plugins = useQuery({ queryKey: ["mkt-plugins"], queryFn: () => api<CatalogPlugin[]>("/marketplace/plugins") });
  const info = useQuery({ queryKey: ["mkt-install-info"], queryFn: () => api<InstallInfo>("/marketplace/install-info") });

  const regenerate = useMutation({
    mutationFn: () => api<{ repoPath: string }>("/marketplace/token/regenerate", { method: "POST" }),
    onSuccess: (data) => qc.setQueryData(["mkt-install-info"], (old: InstallInfo | undefined) => ({ marketplaceName: old?.marketplaceName ?? "colaborativa", repoPath: data.repoPath })),
  });

  if (plugins.isLoading || info.isLoading) return <main><p className="state">Carregando…</p></main>;
  if (plugins.error || info.error) return <main><p role="alert">Erro ao carregar o catálogo</p></main>;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const repoUrl = info.data ? origin + info.data.repoPath : "";
  const mkt = info.data?.marketplaceName ?? "colaborativa";

  return (
    <main>
      <div className="page-head">
        <div className="eyebrow">Claude Code</div>
        <h1>Skills & Plugins</h1>
        <p>Skills compartilhadas pela Colaborativa. Adicione o marketplace uma vez e instale o que precisar.</p>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>1. Adicione o marketplace (uma vez)</h2>
        <Copyable text={`/plugin marketplace add ${repoUrl}`} />
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          O link contém seu token pessoal de acesso. Não compartilhe — ele identifica você.
          {" "}
          <button
            type="button"
            className="btn-sm btn-ghost"
            disabled={regenerate.isPending}
            onClick={() => regenerate.mutate()}
          >
            {regenerate.isPending ? "Regenerando…" : "Regenerar token"}
          </button>
        </p>
        <h2>Para atualizar depois</h2>
        <Copyable text={`/plugin marketplace update ${mkt}`} />
      </section>

      <h2>Pacotes disponíveis</h2>
      {plugins.data && plugins.data.length === 0 && (
        <p className="state">Nenhum pacote publicado ainda.</p>
      )}
      <div className="card-grid">
        {plugins.data?.map((p) => (
          <article key={p.slug} className="card">
            <div className="card-head">
              <h3 style={{ margin: 0 }}>{p.displayName}</h3>
              <span className="status-pill active">v{p.version}</span>
            </div>
            <p style={{ color: "var(--muted)" }}>{p.description}</p>
            {p.keywords.length > 0 && (
              <div className="tag-row">
                {p.keywords.map((k) => <span key={k} className="tag">{k}</span>)}
              </div>
            )}
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              {p.skills.length} skill(s): {p.skills.join(", ")}
            </p>
            <Copyable text={`/plugin install ${p.slug}@${mkt}`} />
          </article>
        ))}
      </div>
    </main>
  );
}
