/**
 * Pia — a calopsita mascote, em SVG com animações CSS (ver styles.css).
 * mood: "idle" (balança e pisca), "talk" (bico se mexe), "cheer" (pula e bate asas),
 * "wave" (acena), "think" (inclina a cabeça).
 *
 * A SOMBRA fica FORA do grupo animado (.pia-body), então o "chão" permanece fixo
 * enquanto a Pia balança/pula. Paleta: corpo amarelo, bochechas vermelhas.
 */
export function Cockatiel({
  mood = "idle",
  size = 200,
}: {
  mood?: "idle" | "talk" | "cheer" | "wave" | "think";
  size?: number;
}) {
  return (
    <svg
      className={`pia ${mood}`}
      width={size}
      height={size}
      viewBox="0 0 220 260"
      role="img"
      aria-label="Pia, a calopsita mascote"
    >
      <defs>
        <radialGradient id="pia-body" cx="42%" cy="32%" r="78%">
          <stop offset="0%" stopColor="#ffe79a" />
          <stop offset="100%" stopColor="#fcc63f" />
        </radialGradient>
        <radialGradient id="pia-head" cx="42%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#fff0b8" />
          <stop offset="100%" stopColor="#ffd95e" />
        </radialGradient>
        <linearGradient id="pia-crest" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#f2962b" />
          <stop offset="100%" stopColor="#ffce5a" />
        </linearGradient>
      </defs>

      {/* sombra do chão — FORA do grupo animado, fica parada */}
      <ellipse className="pia-shadow" cx="110" cy="248" rx="54" ry="8.5" fill="#000" opacity="0.08" />

      <g className="pia-body">
        {/* cauda */}
        <path d="M104 210 L96 256 L112 244 L124 256 L120 210 Z" fill="#e9b32f" />

        {/* asas */}
        <g className="wing wing-l">
          <path d="M58 150 q-26 18 -10 58 q18 8 30 -8 q-8 -34 -20 -50z" fill="#f3c343" />
        </g>
        <g className="wing wing-r">
          <path d="M162 150 q26 18 10 58 q-18 8 -30 -8 q8 -34 20 -50z" fill="#f3c343" />
        </g>

        {/* corpo */}
        <ellipse cx="110" cy="168" rx="62" ry="72" fill="url(#pia-body)" />
        <ellipse cx="110" cy="186" rx="40" ry="50" fill="#fff4d2" />

        {/* pés */}
        <path d="M96 236 l0 12 M90 250 h12 M124 236 l0 12 M118 250 h12" stroke="#f0a04a" strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* cabeça */}
        <circle cx="110" cy="92" r="54" fill="url(#pia-head)" />
        <path d="M64 70 a54 54 0 0 1 92 0 q-46 -20 -92 0z" fill="#f6c947" opacity="0.85" />

        {/* topete */}
        <g className="crest">
          <path d="M104 46 q-10 -34 6 -42 q6 18 2 40z" fill="url(#pia-crest)" />
          <path d="M112 44 q4 -36 22 -40 q-4 20 -14 42z" fill="url(#pia-crest)" />
          <path d="M98 50 q-16 -26 -2 -38 q10 14 10 36z" fill="#f2962b" />
        </g>

        {/* bochechas vermelhas */}
        <circle cx="80" cy="104" r="12.5" fill="#ef4d44" opacity="0.92" />
        <circle cx="140" cy="104" r="12.5" fill="#ef4d44" opacity="0.92" />

        {/* olhos */}
        <g className="eye eye-l">
          <ellipse cx="90" cy="86" rx="8" ry="10" fill="#2a2e33" />
          <circle cx="87" cy="82" r="2.6" fill="#fff" />
        </g>
        <g className="eye eye-r">
          <ellipse cx="130" cy="86" rx="8" ry="10" fill="#2a2e33" />
          <circle cx="127" cy="82" r="2.6" fill="#fff" />
        </g>

        {/* bico */}
        <path d="M104 112 h12 l-6 9z" fill="#f0a04a" />
        <g className="beak-lower">
          <path d="M105 120 h10 q-5 7 -10 0z" fill="#d98636" />
        </g>
      </g>
    </svg>
  );
}
