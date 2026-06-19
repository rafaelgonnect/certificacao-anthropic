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

/** Bloco de comando com botão de copiar. */
function CodeBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-box">
      <code>{text}</code>
      <button
        type="button"
        className={"copy-btn" + (copied ? " ok" : "")}
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
        {copied ? "Copiado ✓" : "Copiar"}
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
    onSuccess: (data) =>
      qc.setQueryData(["mkt-install-info"], (old: InstallInfo | undefined) => ({
        marketplaceName: old?.marketplaceName ?? "colaborativa",
        repoPath: data.repoPath,
      })),
  });

  if (plugins.isLoading || info.isLoading) return <main><p className="state">Carregando catálogo…</p></main>;
  if (plugins.error || info.error) return <main><p role="alert">Erro ao carregar o catálogo</p></main>;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const repoUrl = info.data ? origin + info.data.repoPath : "";
  const mkt = info.data?.marketplaceName ?? "colaborativa";

  return (
    <main>
      <div className="page-head">
        <div className="eyebrow">Claude Code</div>
        <h1>Skills &amp; Plugins</h1>
        <p>
          Skills do time da Colaborativa, prontas pra instalar no Claude Code. Adicione o
          marketplace uma vez e instale (ou atualize) o que precisar — tudo pelos comandos
          nativos <code>/plugin</code>.
        </p>
      </div>

      {/* Passo-a-passo de instalação */}
      <div className="mkt-setup">
        <h2>Como instalar</h2>
        <ol className="mkt-steps">
          <li className="mkt-step">
            <span className="step-num">1</span>
            <div className="step-body">
              <strong>Adicione o marketplace (só uma vez)</strong>
              <CodeBox text={`/plugin marketplace add ${repoUrl}`} />
              <p className="hint">
                Cole no Claude Code. O link traz seu <em>token pessoal</em> — não compartilhe.{" "}
                <button
                  type="button"
                  className="btn-sm btn-ghost"
                  disabled={regenerate.isPending}
                  onClick={() => regenerate.mutate()}
                >
                  {regenerate.isPending ? "Regenerando…" : "Regenerar token"}
                </button>
              </p>
            </div>
          </li>
          <li className="mkt-step">
            <span className="step-num">2</span>
            <div className="step-body">
              <strong>Instale um pacote</strong>
              <CodeBox text={`/plugin install <pacote>@${mkt}`} />
              <p className="hint">Use o botão <em>Instalar</em> de cada pacote abaixo — ele já monta o comando certo.</p>
            </div>
          </li>
          <li className="mkt-step">
            <span className="step-num">3</span>
            <div className="step-body">
              <strong>Mantenha atualizado</strong>
              <CodeBox text={`/plugin marketplace update ${mkt}`} />
              <p className="hint">Roda quando o time publica novas versões. Depois, reinstale o pacote se o Claude Code pedir.</p>
            </div>
          </li>
        </ol>

        <div className="callout">
          <span className="ico">💡</span>
          <span>
            Depois de instalar, as skills entram em ação <strong>automaticamente</strong> quando o assunto
            aparece na conversa. Para chamar uma de propósito, use o nome com namespace do pacote — ex:{" "}
            <code>/{`superset`}:superset-agent</code>. Requisito: ter o <strong>git</strong> instalado na máquina.
          </span>
        </div>
      </div>

      <h2>Pacotes disponíveis</h2>
      {plugins.data && plugins.data.length === 0 && (
        <div className="empty">
          <span className="emoji">📦</span>
          <p>Nenhum pacote publicado ainda. Volte em breve.</p>
        </div>
      )}
      <div className="skill-grid">
        {plugins.data?.map((p) => (
          <article key={p.slug} className="skill-card">
            <div className="skill-card-head">
              <h3>{p.displayName}</h3>
              <span className="ver-pill">v{p.version}</span>
            </div>
            <p className="desc">{p.description}</p>
            {p.keywords.length > 0 && (
              <div className="chip-row">
                {p.keywords.map((k) => <span key={k} className="chip">{k}</span>)}
              </div>
            )}
            <div>
              {p.skills.map((s) => (
                <div key={s} className="skill-mini"><span>🧩</span><code>{s}</code></div>
              ))}
            </div>
            <CodeBox text={`/plugin install ${p.slug}@${mkt}`} />
          </article>
        ))}
      </div>
    </main>
  );
}
