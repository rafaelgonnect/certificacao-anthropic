export type Mood = "idle" | "talk" | "cheer" | "wave" | "think";

export type Answers = {
  targetCertSlug?: string;
  experienceLevel?: "iniciante" | "intermediario" | "avancado";
  dailyGoalMin?: number;
  startupName?: string;
};

type Base = { id: string; mood: Mood; title: string; text?: string };

export type InfoStep = Base & { kind: "info" };
export type ChoiceOption = { value: string; label: string; desc?: string; tag?: string };
export type ChoiceStep = Base & {
  kind: "choice";
  field: keyof Answers;
  options?: ChoiceOption[]; // estático
  source?: "certs"; // dinâmico: carrega de /certifications
};
export type InputStep = Base & {
  kind: "input";
  field: keyof Answers;
  placeholder?: string;
  prefillFromName?: boolean; // ex.: "<nome> AI"
};
export type SampleStep = Base & { kind: "sample" };
export type CelebrateStep = Base & { kind: "celebrate" };

export type Step = InfoStep | ChoiceStep | InputStep | SampleStep | CelebrateStep;
