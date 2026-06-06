import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirLowPassDesignerDemo } from "./FirLowPassDesignerDemo";

vi.mock("plotly.js-dist-min", () => ({
  default: {
    react: vi.fn().mockResolvedValue(undefined),
    newPlot: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn(),
  },
}));

describe("FirLowPassDesignerDemo", () => {
  it("renders FIR design controls and coefficient export", () => {
    render(<FirLowPassDesignerDemo />);

    expect(
      screen.getByRole("heading", {
        name: "Windowed FIR Low-Pass Designer",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/window method/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cutoff/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cutoff/i)).toHaveAttribute("min", "0.01");
    expect(screen.getByLabelText(/cutoff/i)).toHaveAttribute("max", "0.49");
    expect(screen.getByLabelText(/^filter length/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^filter length/i)).toHaveAttribute("max", "512");
    expect(screen.getByLabelText(/^filter length/i)).toHaveAttribute("step", "8");
    expect(screen.getByLabelText(/exact filter length/i)).toHaveAttribute(
      "min",
      "11",
    );
    expect(screen.getByLabelText(/exact filter length/i)).toHaveAttribute(
      "max",
      "512",
    );
    expect(screen.getByLabelText(/exact filter length/i)).toHaveAttribute(
      "step",
      "1",
    );
    expect(screen.getByLabelText(/window/i)).toHaveValue("Hamming");
    expect(screen.getByLabelText(/word length/i)).toHaveValue("16");
    expect(screen.getByLabelText(/fractional bits/i)).toBeInTheDocument();
    expect(screen.getByText("31 samples")).toBeInTheDocument();
    expect(screen.getByText("Q(1.14)")).toBeInTheDocument();
    const coefficients = screen.getByLabelText(
      /comma-separated coefficients/i,
    ) as HTMLTextAreaElement;

    expect(coefficients.value).toContain(",");
  });

  it("switches exported coefficients to fixed-point integers", () => {
    render(<FirLowPassDesignerDemo />);

    fireEvent.change(screen.getByLabelText(/format/i), {
      target: { value: "Fixed-point integers" },
    });

    const coefficients = screen.getByLabelText(
      /comma-separated coefficients/i,
    ) as HTMLTextAreaElement;

    expect(screen.getByLabelText(/format/i)).toHaveValue("Fixed-point integers");
    expect(coefficients.value.trim()).toMatch(/^-?\d+(, -?\d+)+$/);
  });

  it("uses the numeric tap input for exact even lengths and clamps bounds", () => {
    render(<FirLowPassDesignerDemo />);

    const slider = screen.getByLabelText(/^filter length/i);
    const exactInput = screen.getByLabelText(/exact filter length/i);

    fireEvent.change(exactInput, { target: { value: "64" } });

    expect(exactInput).toHaveValue(64);
    expect(slider).toHaveValue("64");
    expect(screen.getByText("31.5 samples")).toBeInTheDocument();

    fireEvent.change(exactInput, { target: { value: "999" } });

    expect(exactInput).toHaveValue(512);
    expect(slider).toHaveValue("512");

    fireEvent.change(exactInput, { target: { value: "10" } });

    expect(exactInput).toHaveValue(11);
    expect(slider).toHaveValue("11");

    fireEvent.change(exactInput, { target: { value: "63.6" } });

    expect(exactInput).toHaveValue(64);
    expect(slider).toHaveValue("64");
  });
});
