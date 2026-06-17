import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";
import { Cockatiel } from "../components/Cockatiel.js";

type Step = { title: string; text: string; mood: "idle" | "talk" | "cheer" };

const STEPS: Step[] = [
  {
    title: "Oi! Eu sou a Pia 🦜",
    text: "Vou ser sua mentora aqui na Colaborativa. Bora aprender a construir com o Claude?",
    mood: "talk",
  },
  {
    title: "Você estuda no seu ritmo",
    text: "Trilhas, lições, quizzes e simulados preparam você para as certificações da Anthropic — passo a passo, do básico ao avançado.",
    mood: "talk",
  },
  {
    title: "Eu cuido da sua memória",
    text: "Com a repetição espaçada, eu te lembro de revisar cada conceito na hora certa — assim nada é esquecido antes da prova.",
    mood: "idle",
  },
  {
    title: "E tem um segredo… 🚀",
    text: "Enquanto estuda, você constrói sua própria startup de IA! Cada coisa que aprende lança features e faz sua empresa valer mais.",
    mood: "talk",
  },
  {
    title: "Bora começar sua jornada?",
    text: "Escolha uma certificação no catálogo e vamos juntos. Eu vou estar por aqui torcendo por você!",
    mood: "cheer",
  },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { markOnboarded } = useAuth();
  const [i, setI] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  async function finish() {
    setFinishing(true);
    try {
      await api("/auth/onboarded", { method: "POST" });
    } catch {
      /* não bloqueia o fluxo se falhar */
    }
    markOnboarded();
    navigate("/");
  }

  return (
    <div className="onb">
      <div className="onb-dots">
        {STEPS.map((_, idx) => (
          <span key={idx} className={"onb-dot" + (idx === i ? " on" : "")} />
        ))}
      </div>

      <div className="onb-stage">
        <Cockatiel mood={step.mood} size={200} />
        <div className="onb-bubble" key={i}>
          <h2>{step.title}</h2>
          <p>{step.text}</p>
        </div>
      </div>

      <div className="onb-actions">
        {i > 0 && (
          <button className="btn-ghost" onClick={() => setI((n) => n - 1)} disabled={finishing}>
            Voltar
          </button>
        )}
        {last ? (
          <button className="btn-lg" onClick={finish} disabled={finishing}>
            {finishing ? "Vamos lá…" : "Começar 🎉"}
          </button>
        ) : (
          <button className="btn-lg" onClick={() => setI((n) => n + 1)}>
            Continuar
          </button>
        )}
      </div>

      {!last && (
        <button
          className="btn-ghost btn-sm"
          onClick={finish}
          disabled={finishing}
          style={{ marginTop: "-0.4rem" }}
        >
          Pular introdução
        </button>
      )}
    </div>
  );
}
