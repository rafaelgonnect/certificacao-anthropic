import { useEffect, useState, type CSSProperties } from "react";
import { Cockatiel } from "./Cockatiel.js";

/**
 * Tour estilo tutor.js: escurece a tela e abre um "furo" de luz sobre o elemento
 * alvo (#targetId), com um balão da Pia apontando onde clicar. O alvo continua
 * clicável (o overlay não captura cliques). Some ao clicar em "Entendi" ou quando
 * o usuário navega para o alvo.
 */
export function Spotlight({ targetId, text }: { targetId: string; text: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => {
      const e = document.getElementById(targetId);
      if (e) setRect(e.getBoundingClientRect());
    };
    measure();
    const t = setTimeout(measure, 380); // recalcula após o scroll suave
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [targetId, open]);

  if (!open || !rect) return null;

  const pad = 6;
  const holeStyle: CSSProperties = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  // balão abaixo do alvo, ou acima se não houver espaço
  const below = rect.bottom + 170 < window.innerHeight;
  const tipStyle: CSSProperties = below
    ? { top: rect.bottom + pad + 14 }
    : { top: rect.top - pad - 14 };

  return (
    <>
      <div className="spot-hole" style={holeStyle} aria-hidden="true" />
      <div className={"spot-tip" + (below ? "" : " above")} style={tipStyle} role="status">
        <Cockatiel mood="talk" size={56} />
        <div className="spot-tip-body">
          <p>{text}</p>
          <button type="button" className="btn-sm" onClick={() => setOpen(false)}>
            Entendi 👍
          </button>
        </div>
      </div>
    </>
  );
}
