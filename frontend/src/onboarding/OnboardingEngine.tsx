import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";
import { Cockatiel } from "../components/Cockatiel.js";
import { STEPS } from "./steps.js";
import type { Answers, Mood } from "./types.js";
import { InfoStep } from "./steps/InfoStep.js";
import { ChoiceStep } from "./steps/ChoiceStep.js";
import { InputStep } from "./steps/InputStep.js";
import { SampleStep } from "./steps/SampleStep.js";

export function OnboardingEngine() {
  const navigate = useNavigate();
  const { user, setUserData } = useAuth();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [reaction, setReaction] = useState<Mood | null>(null);
  const [finishing, setFinishing] = useState(false);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const mood: Mood = reaction ?? step.mood;

  function set<K extends keyof Answers>(field: K, value: Answers[K]) {
    setAnswers((a) => ({ ...a, [field]: value }));
  }

  // valida se dá pra avançar (escolhas obrigatórias)
  const canAdvance =
    step.kind !== "choice" || answers[step.field] !== undefined;

  async function finish() {
    setFinishing(true);
    try {
      const profile = await api<Record<string, unknown>>("/auth/onboarding", {
        method: "POST",
        body: JSON.stringify({
          targetCertSlug: answers.targetCertSlug,
          experienceLevel: answers.experienceLevel,
          dailyGoalMin: answers.dailyGoalMin,
          startupName: answers.startupName,
        }),
      });
      setUserData({ ...(profile as object), onboarded: true });
    } catch {
      setUserData({ onboarded: true });
    }
    navigate(answers.targetCertSlug ? `/trilha/${answers.targetCertSlug}` : "/");
  }

  function next() {
    setReaction(null);
    if (last) return finish();
    setI((n) => n + 1);
  }
  function back() {
    setReaction(null);
    setI((n) => Math.max(0, n - 1));
  }

  return (
    <div
      className="onb"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Enter" && canAdvance && !finishing) next();
      }}
    >
      <div className="onb-dots">
        {STEPS.map((_, idx) => (
          <span key={idx} className={"onb-dot" + (idx === i ? " on" : "")} />
        ))}
      </div>

      <div className="onb-stage">
        <Cockatiel mood={mood} size={190} />
        <div key={i} aria-live="polite">
          {step.kind === "info" && <InfoStep step={step} />}
          {step.kind === "choice" && (
            <ChoiceStep
              step={step}
              value={answers[step.field] as string | undefined}
              onPick={(v) => set(step.field, (step.field === "dailyGoalMin" ? Number(v) : v) as never)}
            />
          )}
          {step.kind === "input" && (
            <InputStep
              step={step}
              value={
                (answers.startupName ??
                  (step.prefillFromName && user ? `${user.name.split(" ")[0]} AI` : "")) as string
              }
              onChange={(v) => set("startupName", v)}
            />
          )}
          {step.kind === "sample" && (
            <SampleStep
              step={step}
              certSlug={answers.targetCertSlug}
              onResult={(correct) => setReaction(correct ? "cheer" : "talk")}
            />
          )}
          {step.kind === "celebrate" && <InfoStep step={{ ...step, kind: "info" }} />}
        </div>
      </div>

      <div className="onb-actions">
        {i > 0 && (
          <button className="btn-ghost" onClick={back} disabled={finishing}>Voltar</button>
        )}
        <button className="btn-lg" onClick={next} disabled={finishing || !canAdvance}>
          {last ? (finishing ? "Vamos lá…" : "Começar 🎉") : "Continuar"}
        </button>
      </div>

      {!last && (
        <button className="btn-ghost btn-sm" onClick={finish} disabled={finishing} style={{ marginTop: "-0.4rem" } as CSSProperties}>
          Pular introdução
        </button>
      )}
    </div>
  );
}
