# Melhorias do Onboarding (Pia 2.0) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o onboarding atual (5 telas informativas estáticas com a mascote Pia) em uma experiência **personalizada e interativa** estilo Duolingo: perguntas de personalização, definição de meta diária, dar nome à startup do jogo, uma **primeira questão de degustação** com a Pia reagindo, e celebração — terminando na trilha que o aluno escolheu.

**Architecture:** O onboarding vira uma **máquina de passos tipados** (info / escolha / input / questão-exemplo / celebração) no frontend, que coleta um objeto `Answers` e, ao final, persiste o perfil via um novo endpoint `POST /auth/onboarding` (que também marca `onboardedAt` e nomeia a `Company` do jogo). O backend ganha campos de perfil no `User`. A Pia ganha novos "moods". Reusa endpoints existentes (`/certifications`, `/quiz`, `/quiz/answer`).

**Tech Stack:** Backend Node/Express + Prisma + PostgreSQL (TypeScript, ESM, Vitest+Supertest). Frontend React 18 + Vite + React Router + TanStack Query (TypeScript, Vitest + Testing Library). Deploy Easypanel via webhook (build-from-repo).

**Pré-requisitos de teste:** os testes de integração do backend (`tests/auth.test.ts`) precisam de um PostgreSQL acessível via `DATABASE_URL`. Os testes puros/unitários e os de frontend (jsdom) não precisam de banco. Rode `npm run test:unit` (backend) e `npm test` (frontend) a cada tarefa; rode `npm test` no backend só onde houver banco.

**Contexto do código atual (já existe):**
- `frontend/src/pages/OnboardingPage.tsx` — versão atual (5 passos estáticos, usa `Cockatiel` e `useAuth().markOnboarded`, `POST /auth/onboarded`, navega para `/`).
- `frontend/src/components/Cockatiel.tsx` — SVG da Pia com `mood: "idle" | "talk" | "cheer"`; animações em `frontend/src/styles.css` (bloco "Pia, a calopsita mascote").
- `frontend/src/auth/AuthContext.tsx` — `user` inclui `onboarded`; expõe `markOnboarded()`.
- `frontend/src/App.tsx` — rota `/bem-vindo` (ProtectedRoute, sem AppShell); `RequireOnboarded` redireciona quem não concluiu.
- `backend/src/auth/routes.ts` — `publicUser()`, `POST /auth/onboarded` (marca `onboardedAt`). `GET /auth/me` e `POST /auth/login` retornam `publicUser`.
- `backend/prisma/schema.prisma` — `User` tem `status` e `onboardedAt`; existe `model Company { userId, certSlug, name, ... @@unique([userId, certSlug]) }`.
- Endpoints reusáveis: `GET /api/certifications`, `GET /api/quiz?cert=<slug>&n=1`, `POST /api/quiz/answer`.

---

## Estrutura de arquivos

```
backend/
  prisma/schema.prisma                      # +campos de perfil no User
  src/auth/routes.ts                        # +POST /auth/onboarding; publicUser inclui perfil
  tests/auth.test.ts                        # +teste do novo endpoint
frontend/
  src/onboarding/types.ts                   # tipos dos passos + Answers (novo)
  src/onboarding/steps.ts                   # definição declarativa dos passos (novo)
  src/onboarding/OnboardingEngine.tsx       # motor: estado, navegação, finish (novo)
  src/onboarding/steps/InfoStep.tsx         # renderer (novo)
  src/onboarding/steps/ChoiceStep.tsx       # renderer (novo)
  src/onboarding/steps/InputStep.tsx        # renderer (novo)
  src/onboarding/steps/SampleStep.tsx       # renderer (novo)
  src/pages/OnboardingPage.tsx              # passa a só montar o OnboardingEngine
  src/components/Cockatiel.tsx              # +moods "wave" | "think"
  src/styles.css                            # +animações dos novos moods + .onb-*
  src/auth/AuthContext.tsx                  # User inclui perfil; setUserProfile()
  src/tests/OnboardingEngine.test.tsx       # testes do motor (novo)
```

---

## Task 1: Backend — campos de perfil no `User`

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Adicionar campos ao model `User`**

No bloco `model User`, logo após `onboardedAt  DateTime?`, adicione:

```prisma
  targetCertSlug  String?
  experienceLevel String?
  dailyGoalMin    Int?
```

- [ ] **Step 2: Regenerar o Prisma Client**

Run: `cd backend && npx prisma generate`
Expected: "Generated Prisma Client" sem erro (os tipos passam a incluir os novos campos).

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(onboarding): campos de perfil (targetCert/experiencia/meta) no User"
```

---

## Task 2: Backend — endpoint `POST /auth/onboarding`

**Files:**
- Modify: `backend/src/auth/routes.ts`
- Test: `backend/tests/auth.test.ts`

- [ ] **Step 1: Escrever o teste falhando** (adicione um novo `it` dentro do `describe("auth routes", ...)` em `backend/tests/auth.test.ts`)

```ts
  it("salva o perfil do onboarding e marca como concluído", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "c@c.com", password: "segredo123", name: "Caio" });
    await prisma.user.update({ where: { email: "c@c.com" }, data: { status: "active" } });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "c@c.com", password: "segredo123" });
    const token = login.body.token as string;

    const onb = await request(app)
      .post("/auth/onboarding")
      .set("authorization", `Bearer ${token}`)
      .send({
        targetCertSlug: "cca-foundations",
        experienceLevel: "iniciante",
        dailyGoalMin: 10,
        startupName: "Caio AI",
      });
    expect(onb.status).toBe(200);
    expect(onb.body.onboarded).toBe(true);
    expect(onb.body.targetCertSlug).toBe("cca-foundations");
    expect(onb.body.dailyGoalMin).toBe(10);

    const me = await request(app).get("/auth/me").set("authorization", `Bearer ${token}`);
    expect(me.body.onboarded).toBe(true);
    expect(me.body.experienceLevel).toBe("iniciante");
  });
```

- [ ] **Step 2: Rodar e ver falhar** (requer Postgres de teste)

Run: `cd backend && npm test -- auth`
Expected: FAIL — rota `/auth/onboarding` retorna 404.

- [ ] **Step 3: Atualizar `publicUser` para incluir o perfil**

Em `backend/src/auth/routes.ts`, substitua a função `publicUser` por:

```ts
function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  onboardedAt: Date | null;
  targetCertSlug: string | null;
  experienceLevel: string | null;
  dailyGoalMin: number | null;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    onboarded: u.onboardedAt !== null,
    targetCertSlug: u.targetCertSlug,
    experienceLevel: u.experienceLevel,
    dailyGoalMin: u.dailyGoalMin,
  };
}
```

(`login` e `/me` já chamam `publicUser` com o registro completo do `prisma.user`, então passam a expor os novos campos automaticamente.)

- [ ] **Step 4: Implementar o endpoint** (adicione ao final de `backend/src/auth/routes.ts`, antes do `export` final se houver, ou logo após o handler `/onboarded`)

```ts
const onboardingSchema = z.object({
  targetCertSlug: z.string().min(1).optional(),
  experienceLevel: z.enum(["iniciante", "intermediario", "avancado"]).optional(),
  dailyGoalMin: z.number().int().min(1).max(120).optional(),
  startupName: z.string().min(1).max(40).optional(),
});

// Conclui o onboarding salvando o perfil; se houver startupName + cert, nomeia a empresa do jogo.
authRoutes.post("/onboarding", requireAuth, async (req, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });
  const { targetCertSlug, experienceLevel, dailyGoalMin, startupName } = parsed.data;

  const user = await prisma.user.update({
    where: { id: req.user!.sub },
    data: { onboardedAt: new Date(), targetCertSlug, experienceLevel, dailyGoalMin },
  });

  if (startupName && targetCertSlug) {
    await prisma.company.upsert({
      where: { userId_certSlug: { userId: user.id, certSlug: targetCertSlug } },
      update: { name: startupName },
      create: { userId: user.id, certSlug: targetCertSlug, name: startupName },
    });
  }

  res.json(publicUser(user));
});
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npm test -- auth`
Expected: PASS (incluindo o novo teste).

- [ ] **Step 6: Build e commit**

Run: `cd backend && npm run build` (deve compilar limpo)

```bash
git add backend/src/auth/routes.ts backend/tests/auth.test.ts
git commit -m "feat(onboarding): POST /auth/onboarding salva perfil + nomeia startup"
```

---

## Task 3: Frontend — novos moods da Pia (`wave`, `think`)

**Files:**
- Modify: `frontend/src/components/Cockatiel.tsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/tests/Cockatiel.test.tsx` (criar)

- [ ] **Step 1: Escrever o teste falhando** (`frontend/src/tests/Cockatiel.test.tsx`)

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Cockatiel } from "../components/Cockatiel.js";

describe("Cockatiel", () => {
  it("aplica a classe do mood no svg", () => {
    const { container } = render(<Cockatiel mood="wave" />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains("wave")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- Cockatiel`
Expected: FAIL — tipo `"wave"` não é aceito pelo prop `mood` (erro de tipos no build/teste).

- [ ] **Step 3: Ampliar o tipo `mood`** em `frontend/src/components/Cockatiel.tsx`

Troque a assinatura do prop:

```tsx
  mood = "idle",
  size = 200,
}: {
  mood?: "idle" | "talk" | "cheer" | "wave" | "think";
  size?: number;
}) {
```

- [ ] **Step 4: Adicionar as animações dos novos moods** em `frontend/src/styles.css`, logo após o bloco `@keyframes pia-flap-r { ... }`:

```css
/* mood: wave — levanta e balança a asa direita */
.pia.wave .wing-r {
  transform-origin: 0% 12%;
  animation: pia-wave 0.7s ease-in-out infinite;
}
@keyframes pia-wave {
  0%, 100% { transform: rotate(8deg); }
  50% { transform: rotate(40deg); }
}
/* mood: think — inclina levemente a cabeça (corpo) e segura o topete */
.pia.think .pia-body {
  animation: pia-think 3s ease-in-out infinite;
}
@keyframes pia-think {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  50% { transform: rotate(-5deg) translateY(-2px); }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npm test -- Cockatiel`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Cockatiel.tsx frontend/src/styles.css frontend/src/tests/Cockatiel.test.tsx
git commit -m "feat(onboarding): moods wave e think para a Pia"
```

---

## Task 4: Frontend — tipos e definição declarativa dos passos

**Files:**
- Create: `frontend/src/onboarding/types.ts`
- Create: `frontend/src/onboarding/steps.ts`

- [ ] **Step 1: Criar `frontend/src/onboarding/types.ts`**

```ts
export type Mood = "idle" | "talk" | "cheer" | "wave" | "think";

export type Answers = {
  targetCertSlug?: string;
  experienceLevel?: "iniciante" | "intermediario" | "avancado";
  dailyGoalMin?: number;
  startupName?: string;
};

type Base = { id: string; mood: Mood; title: string; text?: string };

export type InfoStep = Base & { kind: "info" };
export type ChoiceOption = { value: string; label: string; desc?: string };
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
```

- [ ] **Step 2: Criar `frontend/src/onboarding/steps.ts`**

```ts
import type { Step } from "./types.js";

export const STEPS: Step[] = [
  {
    id: "intro",
    kind: "info",
    mood: "wave",
    title: "Oi! Eu sou a Pia 🦜",
    text: "Vou ser sua mentora aqui na Colaborativa. Vamos montar seu plano em 1 minuto?",
  },
  {
    id: "cert",
    kind: "choice",
    field: "targetCertSlug",
    source: "certs",
    mood: "talk",
    title: "Qual certificação é seu foco?",
    text: "Posso recomendar outras depois — comece pela que mais te interessa.",
  },
  {
    id: "experiencia",
    kind: "choice",
    field: "experienceLevel",
    mood: "think",
    title: "Como é sua experiência com o Claude?",
    options: [
      { value: "iniciante", label: "Iniciante", desc: "Estou começando agora" },
      { value: "intermediario", label: "Intermediário", desc: "Já uso o Claude/IA" },
      { value: "avancado", label: "Avançado", desc: "Construo com a API" },
    ],
  },
  {
    id: "meta",
    kind: "choice",
    field: "dailyGoalMin",
    mood: "talk",
    title: "Quanto tempo por dia?",
    text: "Definir uma meta diária ajuda a manter a ofensiva 🔥",
    options: [
      { value: "5", label: "5 min", desc: "Casual" },
      { value: "10", label: "10 min", desc: "Regular" },
      { value: "15", label: "15 min", desc: "Sério" },
      { value: "20", label: "20 min", desc: "Intenso" },
    ],
  },
  {
    id: "startup",
    kind: "input",
    field: "startupName",
    mood: "talk",
    title: "Dê um nome à sua startup de IA 🚀",
    text: "Enquanto estuda, você constrói uma empresa. Como ela vai se chamar?",
    placeholder: "Ex.: NeuraLabs",
    prefillFromName: true,
  },
  {
    id: "sample",
    kind: "sample",
    mood: "think",
    title: "Bora uma primeira questão?",
    text: "Sem pressão — é só pra você sentir como funciona.",
  },
  {
    id: "fim",
    kind: "celebrate",
    mood: "cheer",
    title: "Tudo pronto! 🎉",
    text: "Sua jornada começa agora. Eu vou estar por aqui torcendo por você!",
  },
];
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/onboarding/types.ts frontend/src/onboarding/steps.ts
git commit -m "feat(onboarding): tipos e definição declarativa dos passos"
```

---

## Task 5: Frontend — renderers dos passos (Info, Choice, Input)

**Files:**
- Create: `frontend/src/onboarding/steps/InfoStep.tsx`
- Create: `frontend/src/onboarding/steps/ChoiceStep.tsx`
- Create: `frontend/src/onboarding/steps/InputStep.tsx`

- [ ] **Step 1: Criar `InfoStep.tsx`**

```tsx
import type { InfoStep as T } from "../types.js";

export function InfoStep({ step }: { step: T }) {
  return (
    <div className="onb-bubble">
      <h2>{step.title}</h2>
      {step.text && <p>{step.text}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Criar `ChoiceStep.tsx`** (suporta opções estáticas e dinâmicas via `/certifications`)

```tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import type { ChoiceStep as T, ChoiceOption } from "../types.js";

type Cert = { slug: string; title: string; description: string };

export function ChoiceStep({
  step,
  value,
  onPick,
}: {
  step: T;
  value: string | undefined;
  onPick: (v: string) => void;
}) {
  const certs = useQuery({
    queryKey: ["certifications"],
    queryFn: () => api<Cert[]>("/certifications"),
    enabled: step.source === "certs",
  });

  const options: ChoiceOption[] =
    step.source === "certs"
      ? (certs.data ?? []).map((c) => ({ value: c.slug, label: c.title, desc: c.description }))
      : step.options ?? [];

  return (
    <div className="onb-bubble onb-bubble-wide">
      <h2>{step.title}</h2>
      {step.text && <p>{step.text}</p>}
      {step.source === "certs" && certs.isLoading ? (
        <p className="state">Carregando…</p>
      ) : (
        <div className="onb-choices">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={"onb-choice" + (value === o.value ? " is-on" : "")}
              onClick={() => onPick(o.value)}
            >
              <span className="onb-choice-label">{o.label}</span>
              {o.desc && <span className="onb-choice-desc">{o.desc}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Criar `InputStep.tsx`**

```tsx
import type { InputStep as T } from "../types.js";

export function InputStep({
  step,
  value,
  onChange,
}: {
  step: T;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="onb-bubble">
      <h2>{step.title}</h2>
      {step.text && <p>{step.text}</p>}
      <input
        className="onb-input"
        value={value ?? ""}
        placeholder={step.placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={step.title}
      />
    </div>
  );
}
```

- [ ] **Step 4: Adicionar estilos** em `frontend/src/styles.css` (após o bloco `.onb-bubble p { ... }`)

```css
.onb-bubble-wide { max-width: 540px; }
.onb-choices { display: grid; gap: 0.6rem; margin-top: 1rem; text-align: left; }
.onb-choice {
  background: var(--surface);
  border: 1.5px solid var(--border-2);
  border-radius: var(--r);
  padding: 0.8rem 1rem;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  transition: border-color 0.14s var(--ease), background 0.14s var(--ease);
  box-shadow: none;
}
.onb-choice:hover { border-color: var(--green); background: var(--green-50); }
.onb-choice.is-on { border-color: var(--green); background: var(--green-100); }
.onb-choice-label { font-weight: 700; }
.onb-choice-desc { font-size: 0.82rem; color: var(--muted); }
.onb-input { margin-top: 1rem; text-align: center; font-size: 1.05rem; }
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/onboarding/steps/ frontend/src/styles.css
git commit -m "feat(onboarding): renderers Info, Choice e Input"
```

---

## Task 6: Frontend — passo de degustação (`SampleStep`)

**Files:**
- Create: `frontend/src/onboarding/steps/SampleStep.tsx`

- [ ] **Step 1: Criar `SampleStep.tsx`** (busca 1 questão da cert escolhida; ao responder, revela explicação e avisa o pai se acertou via `onResult` para a Pia reagir)

```tsx
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import type { SampleStep as T } from "../types.js";

type Q = { id: string; prompt: string; options: string[] };
type R = { correct: boolean; correctIndex: number; explanation: string };
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function SampleStep({
  step,
  certSlug,
  onResult,
}: {
  step: T;
  certSlug: string | undefined;
  onResult: (correct: boolean) => void;
}) {
  const cert = certSlug ?? "cca-foundations";
  const { data } = useQuery({
    queryKey: ["onb-sample", cert],
    queryFn: () => api<Q[]>(`/quiz?cert=${cert}&n=1`),
  });
  const [fb, setFb] = useState<R | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);

  const answer = useMutation({
    mutationFn: (i: number) =>
      api<R>("/quiz/answer", {
        method: "POST",
        body: JSON.stringify({ questionId: data![0].id, chosenIndex: i }),
      }),
    onSuccess: (r) => {
      setFb(r);
      onResult(r.correct);
    },
  });

  const q = data?.[0];

  return (
    <div className="onb-bubble onb-bubble-wide">
      <h2>{step.title}</h2>
      {!q ? (
        <p className="state">Preparando…</p>
      ) : (
        <>
          <p className="q-prompt" style={{ fontSize: "1.05rem" }}>{q.prompt}</p>
          <div className="onb-choices">
            {q.options.map((opt, i) => {
              let cls = "onb-choice";
              if (fb) {
                if (i === fb.correctIndex) cls += " is-correct";
                else if (i === chosen) cls += " is-wrong";
              }
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  disabled={fb !== null || answer.isPending}
                  onClick={() => {
                    setChosen(i);
                    answer.mutate(i);
                  }}
                >
                  <span className="onb-choice-label">
                    <span className="key" aria-hidden="true">{LETTERS[i]}</span> {opt}
                  </span>
                </button>
              );
            })}
          </div>
          {fb && <p style={{ marginTop: "0.8rem", color: "var(--ink-2)" }}>{fb.explanation}</p>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Adicionar estados de acerto/erro** em `frontend/src/styles.css` (reuso visual): após `.onb-choice.is-on`:

```css
.onb-choice.is-correct { border-color: var(--success); background: var(--success-50); }
.onb-choice.is-wrong { border-color: var(--danger); background: var(--danger-50); }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/onboarding/steps/SampleStep.tsx frontend/src/styles.css
git commit -m "feat(onboarding): passo de degustação com questão real"
```

---

## Task 7: Frontend — motor do onboarding + integração

**Files:**
- Create: `frontend/src/onboarding/OnboardingEngine.tsx`
- Modify: `frontend/src/pages/OnboardingPage.tsx`
- Modify: `frontend/src/auth/AuthContext.tsx`
- Test: `frontend/src/tests/OnboardingEngine.test.tsx`

- [ ] **Step 1: Estender o `AuthContext`** para guardar o perfil retornado. Em `frontend/src/auth/AuthContext.tsx`:

Troque o tipo `User`:

```ts
type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  onboarded: boolean;
  targetCertSlug?: string | null;
  experienceLevel?: string | null;
  dailyGoalMin?: number | null;
};
```

E troque `markOnboarded` por um setter que mescla o usuário retornado:

```ts
  function setUserData(u: Partial<User>) {
    setUser((prev) => (prev ? { ...prev, ...u } : prev));
  }
```

No tipo `AuthState` e no `value` do Provider, substitua `markOnboarded: () => void;` por `setUserData: (u: Partial<User>) => void;` (e remova a função `markOnboarded`).

- [ ] **Step 2: Escrever o teste do motor** (`frontend/src/tests/OnboardingEngine.test.tsx`)

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext.js";
import { OnboardingEngine } from "../onboarding/OnboardingEngine.js";

function renderOnb() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuthProvider>
          <OnboardingEngine />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("OnboardingEngine", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("mostra o primeiro passo e avança", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
    renderOnb();
    expect(await screen.findByText("Oi! Eu sou a Pia 🦜")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Qual certificação é seu foco?")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd frontend && npm test -- OnboardingEngine`
Expected: FAIL — módulo `OnboardingEngine` não existe.

- [ ] **Step 4: Criar `frontend/src/onboarding/OnboardingEngine.tsx`**

```tsx
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
    <div className="onb">
      <div className="onb-dots">
        {STEPS.map((_, idx) => (
          <span key={idx} className={"onb-dot" + (idx === i ? " on" : "")} />
        ))}
      </div>

      <div className="onb-stage">
        <Cockatiel mood={mood} size={190} />
        <div key={i}>
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
```

- [ ] **Step 5: Simplificar `frontend/src/pages/OnboardingPage.tsx`** para apenas montar o motor

```tsx
import { OnboardingEngine } from "../onboarding/OnboardingEngine.js";

export function OnboardingPage() {
  return <OnboardingEngine />;
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd frontend && npm test -- OnboardingEngine`
Expected: PASS.

- [ ] **Step 7: Build e commit**

Run: `cd frontend && npm run build` (deve compilar limpo)

```bash
git add frontend/src/onboarding/OnboardingEngine.tsx frontend/src/pages/OnboardingPage.tsx frontend/src/auth/AuthContext.tsx frontend/src/tests/OnboardingEngine.test.tsx
git commit -m "feat(onboarding): motor de passos personalizado + integração com perfil"
```

---

## Task 8: Polish — teclado, aria-live e transição

**Files:**
- Modify: `frontend/src/onboarding/OnboardingEngine.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Enter avança** — em `OnboardingEngine`, adicione um handler no contêiner raiz `.onb`:

```tsx
    <div
      className="onb"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Enter" && canAdvance && !finishing) next();
      }}
    >
```

- [ ] **Step 2: aria-live na fala da Pia** — envolva o bloco do passo (`<div key={i}>`) com `aria-live="polite"`:

```tsx
        <div key={i} aria-live="polite">
```

- [ ] **Step 3: Transição de entrada** — em `frontend/src/styles.css`, garanta que `.onb-bubble` já tem `animation: onb-pop ...` (existe). Adicione foco visível removido do contêiner:

```css
.onb:focus { outline: none; }
```

- [ ] **Step 4: Build e commit**

Run: `cd frontend && npm run build`

```bash
git add frontend/src/onboarding/OnboardingEngine.tsx frontend/src/styles.css
git commit -m "feat(onboarding): teclado (Enter), aria-live e foco"
```

---

## Task 9: Verificação final + deploy

- [ ] **Step 1: Backend — build + unit**

Run: `cd backend && npm run build && npm run test:unit`
Expected: build limpo; todos os testes unitários passam.

- [ ] **Step 2: Frontend — build + testes**

Run: `cd frontend && npm run build && npm test`
Expected: build limpo; todos os testes passam.

- [ ] **Step 3: Push (dispara CI/registro) e deploy**

```bash
git push origin master
```
Em seguida dispare o redeploy no Easypanel (a `Company`/`User` ganham os campos via `prisma db push` no boot):

```bash
curl -X POST "<DEPLOY_WEBHOOK_URL>"
```
> A URL do webhook de deploy está guardada na memória local do projeto (`easypanel-deploy-hook.md`). Se não tiver acesso, peça ao operador para disparar o redeploy.

- [ ] **Step 4: Verificação manual (browser)**

1. Crie uma conta em `/cadastro`, aprove-a em `/admin/usuarios` (como admin).
2. Faça login com a nova conta → deve cair em `/bem-vindo`.
3. Percorra: escolher certificação → experiência → meta → nomear a startup → responder a questão de degustação (a Pia deve **comemorar** se acertar) → "Começar".
4. Confirme que termina na **trilha escolhida** (`/trilha/<slug>`) e que a startup no `/jogo/<slug>` está com o **nome escolhido**.

---

## Self-Review (cobertura)

- **Personalização (cert/experiência/meta):** Tasks 4–5, persistido na Task 2 (campos) + Task 7 (finish). ✓
- **Nomear a startup e refletir no jogo:** Task 2 (upsert Company) + Task 7. ✓
- **Degustação com reação da Pia:** Task 6 + Task 7 (`onResult` → `reaction`). ✓
- **Moods novos da Pia:** Task 3. ✓
- **Marcar onboarding + redirecionar para a trilha escolhida:** Task 7. ✓
- **Acessibilidade/teclado:** Task 8. ✓
- **Back-compat:** `POST /auth/onboarded` permanece; `RequireOnboarded`/rota `/bem-vindo` inalterados. ✓

**Decisões assumidas (ajuste se quiser):** a meta diária é só perfil (ainda não vira XP/streak — fica para a Fase 2 de gamificação); a degustação registra um `Attempt` real (conta como primeira tentativa do aluno) — se não quiser isso, troque por um endpoint somente-leitura que não persista.
