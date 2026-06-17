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
