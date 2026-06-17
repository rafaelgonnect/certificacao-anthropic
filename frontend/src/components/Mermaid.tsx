import { useEffect, useId, useRef, useState } from "react";

/**
 * Renderiza um diagrama Mermaid (texto → SVG). O pacote `mermaid` é pesado, então
 * é carregado sob demanda (import dinâmico) apenas quando há um diagrama na página.
 * Os diagramas são autorais (nosso conteúdo), renderizados no cliente.
 */
export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const rawId = useId();
  const id = "m" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
          fontFamily: "inherit",
        });
        const { svg } = await mermaid.render(id, chart);
        if (active && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [chart, id]);

  if (failed) return <code className="mermaid-fallback">{chart}</code>;
  return <span className="mermaid-fig" ref={ref} role="img" aria-label="diagrama" />;
}
