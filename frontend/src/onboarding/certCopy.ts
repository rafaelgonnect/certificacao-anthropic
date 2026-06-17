// Explicações em linguagem simples para cada trilha, para a Pia apresentar as
// certificações de forma acolhedora no onboarding. A lista de slugs vem da API
// (/certifications); aqui só enriquecemos com nome curto + explicação amigável.
// Se um slug não estiver mapeado, o ChoiceStep cai no título/descrição da API.
export type CertCopy = { name: string; blurb: string; tag?: string };

export const CERT_COPY: Record<string, CertCopy> = {
  "ai-fluency": {
    name: "AI Fluency",
    blurb: "Os fundamentos pra conversar com IA com confiança — sem precisar programar.",
    tag: "Ótima pra começar",
  },
  "cca-foundations": {
    name: "Arquiteto — Foundations",
    blurb: "Entenda como o Claude pensa e como desenhar boas soluções com ele.",
  },
  "build-with-claude": {
    name: "Build with Claude",
    blurb: "Mão na massa com a API do Claude: construa aplicações de verdade com IA.",
  },
  "cca-developer-prep": {
    name: "Desenvolvedor (preparatório)",
    blurb: "Pra quem já programa e quer se certificar como desenvolvedor Claude.",
  },
  "cca-seller-prep": {
    name: "Vendas (preparatório)",
    blurb: "Pra quem vende ou faz consultoria: posicionar o Claude com segurança.",
  },
};
