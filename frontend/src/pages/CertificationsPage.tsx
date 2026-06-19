import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { IconChevron } from "../components/icons.js";

type Cert = {
  id: string;
  slug: string;
  title: string;
  description: string;
  version: number;
  level: string;
};

function tagFor(slug: string): { cls: string; label: string } {
  if (slug.endsWith("-prep")) return { cls: "prep", label: "Preparatório · não oficial" };
  if (slug === "cca-foundations") return { cls: "official", label: "Certificação oficial" };
  return { cls: "academy", label: "Anthropic Academy" };
}

// Ordem e rótulos dos níveis. Trilhas com level desconhecido caem em "iniciante".
const LEVELS: { key: string; label: string; desc: string }[] = [
  { key: "iniciante", label: "Iniciante", desc: "Comece por aqui — conceitos e fundamentos, sem pré-requisitos." },
  { key: "intermediario", label: "Intermediário", desc: "Mão na massa: construindo de verdade com a Claude API." },
  { key: "avancado", label: "Avançado", desc: "Preparatório técnico aprofundado para a certificação." },
  { key: "comercial", label: "Trilha comercial", desc: "Para times de vendas e pré-vendas — sem exigir base técnica." },
];

export function CertificationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["certifications"],
    queryFn: () => api<Cert[]>("/certifications"),
  });

  if (isLoading)
    return (
      <main>
        <div className="cert-grid">
          {[0, 1, 2, 3].map((i) => (
            <div className="cert-card" key={i}>
              <div className="skeleton sk-line" style={{ width: "40%", height: 18 }} />
              <div className="skeleton sk-line" style={{ width: "80%" }} />
              <div className="skeleton sk-line" style={{ width: "60%" }} />
            </div>
          ))}
        </div>
      </main>
    );
  if (error) return <main><p role="alert">Erro ao carregar as certificações</p></main>;
  if (!data) return null;

  const known = new Set(LEVELS.map((l) => l.key));
  const groupOf = (c: Cert) => (known.has(c.level) ? c.level : "iniciante");

  function renderCard(c: Cert) {
    const tag = tagFor(c.slug);
    return (
      <Link to={`/trilha/${c.slug}`} className="cert-card" key={c.id}>
        <span className={"cert-tag " + tag.cls}>{tag.label}</span>
        <h2>{c.title}</h2>
        <p>{c.description}</p>
        <span className="cert-cta">
          Começar <IconChevron className="" />
        </span>
      </Link>
    );
  }

  return (
    <main>
      <div className="page-head">
        <div className="eyebrow">Catálogo</div>
        <h1>Certificações e trilhas</h1>
        <p>
          Trilhas organizadas por nível — do primeiro contato com IA ao preparatório técnico.
          Escolha onde você está e comece.
        </p>
      </div>

      {LEVELS.map((lvl) => {
        const certs = data.filter((c) => groupOf(c) === lvl.key);
        if (certs.length === 0) return null;
        return (
          <section className="level-section" key={lvl.key}>
            <div className="level-head">
              <span className={"level-badge " + lvl.key}>{lvl.label}</span>
              <p>{lvl.desc}</p>
            </div>
            <div className="cert-grid">{certs.map(renderCard)}</div>
          </section>
        );
      })}
    </main>
  );
}
