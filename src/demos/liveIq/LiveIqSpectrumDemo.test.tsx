import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveIqSpectrumDemo } from "./LiveIqSpectrumDemo";

vi.mock("plotly.js-dist-min", () => ({
  default: {
    react: vi.fn().mockResolvedValue(undefined),
    newPlot: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn(),
  },
}));

describe("LiveIqSpectrumDemo", () => {
  it("renders default connection and FFT controls", () => {
    render(<LiveIqSpectrumDemo />);

    expect(
      screen.getByRole("heading", { name: "Live IQ Spectrum" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/websocket url/i)).toHaveValue(
      "ws://127.0.0.1:8765",
    );
    expect(screen.getByLabelText(/fft size/i)).toHaveValue("1024");
    expect(screen.getByText(/int16 LE: I0, Q0, I1, Q1/i)).toBeInTheDocument();
    expect(screen.getByText("Packets/s")).toBeInTheDocument();
    expect(screen.getByText("0.0")).toBeInTheDocument();
    expect(screen.getByLabelText(/waterfall colormap/i)).toHaveValue("Viridis");
    expect(
      screen.getByRole("heading", { name: "Spectrum waterfall" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "IQ buffer" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
  });

  it("updates the selected FFT size", () => {
    render(<LiveIqSpectrumDemo />);

    fireEvent.change(screen.getByLabelText(/fft size/i), {
      target: { value: "2048" },
    });

    expect(screen.getByLabelText(/fft size/i)).toHaveValue("2048");
    expect(screen.getAllByText("2048").length).toBeGreaterThan(0);
  });
});
