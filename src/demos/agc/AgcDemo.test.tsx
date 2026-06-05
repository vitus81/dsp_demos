import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgcDemo } from "./AgcDemo";

vi.mock("plotly.js-dist-min", () => ({
  default: {
    react: vi.fn().mockResolvedValue(undefined),
    newPlot: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn(),
  },
}));

describe("AgcDemo", () => {
  it("renders the model explanation and internal coefficients", () => {
    render(<AgcDemo />);

    expect(
      screen.getByRole("heading", { name: "AGC Gain Step Explorer" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/AGC update equation/i)).toBeInTheDocument();
    expect(screen.getByText("attackCoefficient")).toBeInTheDocument();
    expect(screen.getByText("decayCoefficient")).toBeInTheDocument();
  });

  it("updates attack setting from the slider", () => {
    render(<AgcDemo />);

    const attackSlider = screen.getByLabelText(/attack setting/i);
    fireEvent.change(attackSlider, { target: { value: "80" } });

    expect(screen.getByText("80")).toBeInTheDocument();
  });
});
