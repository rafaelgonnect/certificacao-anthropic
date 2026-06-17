import { useState } from "react";
import { Cockatiel } from "./Cockatiel.js";

/**
 * Balão de orientação da Pia — usado no "modo guia" (?guia=1) para conduzir o
 * aluno na primeira trilha e na primeira lição. Aparece no topo do conteúdo e
 * pode ser dispensado com "Entendi".
 */
export function CoachTip({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="coach" role="status">
      <Cockatiel mood="talk" size={64} />
      <div className="coach-body">
        <p>{text}</p>
        <button type="button" className="btn-sm" onClick={() => setOpen(false)}>
          Entendi 👍
        </button>
      </div>
    </div>
  );
}
