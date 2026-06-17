import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { IconBack } from "../components/icons.js";

type Tier = "haiku" | "sonnet" | "opus";
type Dept = {
  moduleId: string;
  title: string;
  level: number;
  stars: number;
  quality: number;
  tier: Tier;
  idealTier: Tier;
  tierMult: number;
  mrr: number;
};
type Totals = {
  mrr: number;
  users: number;
  valuation: number;
  stage: string;
  title: string;
  creditsPerHour: number;
};
type GameState = {
  company: { name: string; credits: number; certSlug: string };
  totals: Totals;
  departments: Dept[];
  idlePending: number;
  weakest: { moduleId: string; title: string } | null;
};
type Leader = { rank: number; name: string; founder: string; valuation: number; certSlug: string };

const TIER_LABEL: Record<Tier, string> = { haiku: "Haiku", sonnet: "Sonnet", opus: "Opus" };
const TIERS: Tier[] = ["haiku", "sonnet", "opus"];

function money(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v}`;
}

export function GamePage() {
  const params = useParams();
  const slug = params.slug ?? "cca-foundations";
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["game", slug],
    queryFn: () => api<GameState>(`/game/${slug}`),
  });
  const board = useQuery({
    queryKey: ["game-board"],
    queryFn: () => api<Leader[]>("/game/board/leaderboard"),
  });

  const setTier = useMutation({
    mutationFn: (v: { moduleId: string; tier: Tier }) =>
      api(`/game/${slug}/tier`, { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["game", slug] }),
  });
  const collect = useMutation({
    mutationFn: () => api(`/game/${slug}/collect`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game", slug] });
    },
  });

  if (isLoading) return <main><p className="state">Carregando sua startup…</p></main>;
  if (error) return <main><p role="alert">Erro ao carregar o jogo</p></main>;
  if (!data) return null;

  const t = data.totals;

  return (
    <main>
      <Link to="/" className="back-link"><IconBack className="" /> Todas as trilhas</Link>

      <div className="game-hero card">
        <div className="game-hero-main">
          <div className="eyebrow">{t.stage} · {t.title}</div>
          <h1>{data.company.name}</h1>
          <div className="valuation">{money(t.valuation)}<small>valuation</small></div>
        </div>
        <div className="kpis">
          <div className="kpi"><b>{money(t.mrr)}</b><span>MRR / mês</span></div>
          <div className="kpi"><b>{t.users.toLocaleString("pt-BR")}</b><span>usuários</span></div>
          <div className="kpi"><b>{data.company.credits.toLocaleString("pt-BR")}</b><span>créditos</span></div>
        </div>
        {data.idlePending > 0 && (
          <button className="collect-btn" onClick={() => collect.mutate()} disabled={collect.isPending}>
            💰 Coletar +{data.idlePending} créditos
          </button>
        )}
      </div>

      {data.weakest && (
        <div className="nudge card">
          <span>Seu time mais fraco é <strong>{data.weakest.title}</strong>. Reforce para crescer.</span>
          <Link to={`/quiz?cert=${slug}`} className="btn btn-sm">Estudar agora</Link>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "1.6rem 0 0.8rem" }}>
        <h2 style={{ margin: 0 }}>Departamentos</h2>
        <span className="qcount">{data.departments.length} times</span>
      </div>

      <div className="dept-grid">
        {data.departments.map((d) => (
          <div className="dept-card card" key={d.moduleId}>
            <div className="dept-top">
              <h3>{d.title}</h3>
              <span className="stars" aria-label={`nível ${d.stars} de 5`}>
                {"★".repeat(d.stars)}{"☆".repeat(5 - d.stars)}
              </span>
            </div>

            <div className="qline">
              <span className="qlabel">Qualidade</span>
              <span className="track"><i style={{ width: `${Math.round(d.quality * 100)}%` }} /></span>
              <span className="qval">{Math.round(d.quality * 100)}%</span>
            </div>

            <div className="dept-foot">
              <div className="tier-seg" role="group" aria-label="tier de modelo">
                {TIERS.map((tier) => (
                  <button
                    key={tier}
                    className={"tier-opt" + (d.tier === tier ? " is-on" : "") + (d.idealTier === tier ? " is-ideal" : "")}
                    disabled={setTier.isPending}
                    onClick={() => setTier.mutate({ moduleId: d.moduleId, tier })}
                  >
                    {TIER_LABEL[tier]}
                  </button>
                ))}
              </div>
              <span className="dept-mrr">{money(d.mrr)}<small>/mês</small></span>
            </div>
            <div className="tier-hint">
              {d.tier === d.idealTier
                ? "✓ tier ideal para esta carga (margem máxima)"
                : `dica: o ideal aqui é ${TIER_LABEL[d.idealTier]}`}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: "2rem" }}>🏆 Startups mais valiosas</h2>
      <div className="card">
        {board.data && board.data.length > 0 ? (
          <ol className="board">
            {board.data.map((l) => (
              <li key={l.rank}>
                <span className="b-rank">#{l.rank}</span>
                <span className="b-name">{l.name}</span>
                <span className="b-founder">{l.founder}</span>
                <span className="b-val">{money(l.valuation)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="state" style={{ padding: "1.5rem" }}>Seja a primeira startup do ranking!</p>
        )}
      </div>
    </main>
  );
}
