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
