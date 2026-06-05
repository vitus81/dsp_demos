import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Plotly from "plotly.js-dist-min";
import { SingleCarrierOfdmDemo } from "./SingleCarrierOfdmDemo";

vi.mock("plotly.js-dist-min", () => ({
  default: {
    react: vi.fn().mockResolvedValue(undefined),
    newPlot: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn(),
  },
}));

describe("SingleCarrierOfdmDemo", () => {
  it("renders controls, metrics, and histogram comparison", () => {
    render(<SingleCarrierOfdmDemo />);

    expect(
      screen.getByRole("heading", { name: "Single-Carrier vs OFDM" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/view/i)).toHaveValue("all");
    expect(screen.getByLabelText(/modulation/i)).toHaveValue("QPSK");
    expect(screen.getByLabelText(/RRC roll-off/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Active subcarriers/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Blocks/i)).toBeInTheDocument();
    expect(screen.getByText("IQ magnitude histogram")).toBeInTheDocument();
    expect(screen.getAllByText(/cyclic prefix/i)).toHaveLength(2);
    expect(screen.getByText(/centered around DC/i)).toBeInTheDocument();
    expect(screen.queryByText(/DC bin left unused/i)).not.toBeInTheDocument();
    expect(screen.getByText(/does not smooth the discontinuities/i)).toBeInTheDocument();
    expect(screen.getByText("Single-carrier RRC PAPR")).toBeInTheDocument();
    expect(screen.getByText("OFDM PAPR")).toBeInTheDocument();
    expect(screen.getByText("DFT-s-OFDM PAPR")).toBeInTheDocument();
  });

  it("switches the global modulation", () => {
    render(<SingleCarrierOfdmDemo />);

    fireEvent.change(screen.getByLabelText(/modulation/i), {
      target: { value: "16-QAM" },
    });

    expect(screen.getByLabelText(/modulation/i)).toHaveValue("16-QAM");
  });

  it("randomizes the symbol seed", () => {
    render(<SingleCarrierOfdmDemo />);

    expect(screen.getByText("17")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /randomize symbols/i }));

    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("filters traces and metrics when selecting one waveform", () => {
    render(<SingleCarrierOfdmDemo />);

    fireEvent.change(screen.getByLabelText(/view/i), {
      target: { value: "ofdm" },
    });

    expect(screen.getByLabelText(/view/i)).toHaveValue("ofdm");
    expect(screen.getByText("OFDM PAPR")).toBeInTheDocument();
    expect(screen.queryByText("QPSK RRC PAPR")).not.toBeInTheDocument();
    expect(screen.queryByText("DFT-s-OFDM PAPR")).not.toBeInTheDocument();
    expect(screen.getByText("OFDM constellation preview")).toBeInTheDocument();

    const constellationLayout = vi.mocked(Plotly.react).mock.calls.find((call) => {
      const heading = call[0].closest(".plot-panel")?.querySelector("h2");
      return heading?.textContent === "OFDM constellation preview";
    })?.[2] as { yaxis?: { scaleanchor?: string; scaleratio?: number } } | undefined;

    expect(constellationLayout?.yaxis).toMatchObject({
      scaleanchor: "x",
      scaleratio: 1,
    });
  });

  it("uses overlaid histograms and a logarithmic CCDF axis", () => {
    render(<SingleCarrierOfdmDemo />);

    const plotCalls = vi.mocked(Plotly.react).mock.calls;
    const layouts = plotCalls.map((call) => call[2] as {
      barmode?: string;
      yaxis?: { range?: number[]; type?: string };
    });
    const logCcdfLayout = layouts.find((layout) => layout.yaxis?.type === "log");
    const histogramLayout = layouts.find((layout) => layout.barmode === "overlay");

    expect(logCcdfLayout).toBeDefined();
    expect(logCcdfLayout?.yaxis?.range).toEqual([-4, 0]);
    expect(histogramLayout).toBeDefined();
  });
});
