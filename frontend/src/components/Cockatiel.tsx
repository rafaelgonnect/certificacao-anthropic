/**
 * Pia — a calopsita mascote, em SVG com animações CSS (ver styles.css).
 * mood: "idle" (balança e pisca), "talk" (bico se mexe), "cheer" (pula e bate asas).
 */
export function Cockatiel({
  mood = "idle",
  size = 200,
}: {
  mood?: "idle" | "talk" | "cheer";
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
        <radialGradient id="pia-body" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#f3f5f8" />
          <stop offset="100%" stopColor="#d4d9e0" />
        </radialGradient>
        <linearGradient id="pia-crest" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#f2b734" />
          <stop offset="100%" stopColor="#ffd76a" />
        </linearGradient>
      </defs>

      <g className="pia-body">
        {/* sombra */}
        <ellipse cx="110" cy="246" rx="56" ry="9" fill="#000" opacity="0.08" />

        {/* cauda */}
        <path d="M104 210 L96 256 L112 244 L124 256 L120 210 Z" fill="#c2c8d2" />

        {/* asas */}
        <g className="wing wing-l">
          <path d="M58 150 q-26 18 -10 58 q18 8 30 -8 q-8 -34 -20 -50z" fill="#c7cdd7" />
        </g>
        <g className="wing wing-r">
          <path d="M162 150 q26 18 10 58 q-18 8 -30 -8 q8 -34 20 -50z" fill="#c7cdd7" />
        </g>

        {/* corpo */}
        <ellipse cx="110" cy="168" rx="62" ry="72" fill="url(#pia-body)" />
        <ellipse cx="110" cy="184" rx="40" ry="52" fill="#fbfcfe" />

        {/* pés */}
        <path d="M96 236 l0 12 M90 250 h12 M124 236 l0 12 M118 250 h12" stroke="#f0a04a" strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* cabeça */}
        <circle cx="110" cy="92" r="54" fill="#ffe39a" />
        <path d="M64 70 a54 54 0 0 1 92 0 q-46 -22 -92 0z" fill="#d9dee6" />

        {/* topete */}
        <g className="crest">
          <path d="M104 46 q-10 -34 6 -42 q6 18 2 40z" fill="url(#pia-crest)" />
          <path d="M112 44 q4 -36 22 -40 q-4 20 -14 42z" fill="url(#pia-crest)" />
          <path d="M98 50 q-16 -26 -2 -38 q10 14 10 36z" fill="#f2b734" />
        </g>

        {/* bochechas */}
        <circle cx="78" cy="104" r="13" fill="#ff9a6b" opacity="0.9" />
        <circle cx="142" cy="104" r="13" fill="#ff9a6b" opacity="0.9" />

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
