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
