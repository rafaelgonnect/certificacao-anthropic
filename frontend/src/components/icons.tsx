/* Ícones de traço (stroke) minimalistas — herdam currentColor. */
type P = { className?: string };
const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconTrack = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
export const IconCards = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="7" width="13" height="14" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
  </svg>
);
export const IconQuiz = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
export const IconExam = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1z" />
    <rect x="4" y="4" width="16" height="18" rx="2" />
    <path d="M9 12h6M9 16h4" />
  </svg>
);
export const IconChart = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 3v18h18" />
    <rect x="7" y="11" width="3" height="6" />
    <rect x="12" y="7" width="3" height="10" />
    <rect x="17" y="13" width="3" height="4" />
  </svg>
);
export const IconLogout = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);
export const IconBack = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
export const IconClock = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
