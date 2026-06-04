import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InterpolationDemo } from "./InterpolationDemo";

vi.mock("plotly.js-dist-min", () => ({
  default: {
    react: vi.fn().mockResolvedValue(undefined),
    newPlot: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn(),
  },
}));

describe("InterpolationDemo", () => {
  it("renders controls and updates the window", () => {
    render(<InterpolationDemo />);

    expect(
      screen.getByRole("heading", {
        name: "Interpolation x2: repeat vs zero-stuff",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/same windowed-sinc FIR/i)).toBeInTheDocument();
    expect(screen.getByText(/Welch periodogram/i)).toBeInTheDocument();
    expect(screen.getByText(/\[1\/2, 1\/2\] boxcar envelope/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        /Repeat theoretical response: absolute H repeat of f equals absolute cosine pi f/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/window/i)).toHaveValue("Blackman");
    expect(screen.getByLabelText(/filter length/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/window/i), {
      target: { value: "Hann" },
    });

    expect(screen.getByLabelText(/window/i)).toHaveValue("Hann");
  });

  it("randomizes the BPSK seed", () => {
    render(<InterpolationDemo />);

    expect(screen.getByText("11")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /randomize bits/i }));

    expect(screen.getByText("12")).toBeInTheDocument();
  });
});
