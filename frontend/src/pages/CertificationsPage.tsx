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
};

function tagFor(slug: string): { cls: string; label: string } {
  if (slug.endsWith("-prep")) return { cls: "prep", label: "Preparatório · não oficial" };
  if (slug === "cca-foundations") return { cls: "official", label: "Certificação oficial" };
  return { cls: "academy", label: "Anthropic Academy" };
}

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

  return (
    <main>
      <div className="page-head">
        <div className="eyebrow">Catálogo</div>
        <h1>Certificações e trilhas</h1>
        <p>
          Estude para as certificações da Anthropic e nas trilhas da Anthropic Academy.
          Escolha uma trilha para começar.
        </p>
      </div>

      <div className="cert-grid">
        {data.map((c) => {
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
        })}
      </div>
    </main>
  );
}
