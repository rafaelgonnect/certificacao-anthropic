import type { InfoStep as T } from "../types.js";

export function InfoStep({ step }: { step: T }) {
  return (
    <div className="onb-bubble">
      <h2>{step.title}</h2>
      {step.text && <p>{step.text}</p>}
    </div>
  );
}
