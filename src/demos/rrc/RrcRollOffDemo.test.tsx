import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Plotly from "plotly.js-dist-min";
import { RrcRollOffDemo } from "./RrcRollOffDemo";

vi.mock("plotly.js-dist-min", () => ({
  default: {
    react: vi.fn().mockResolvedValue(undefined),
    newPlot: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn(),
  },
}));

describe("RrcRollOffDemo", () => {
  beforeEach(() => {
    vi.mocked(Plotly.react).mockClear();
  });

  it("renders controls and updates roll-off", () => {
    render(<RrcRollOffDemo />);

    expect(screen.getByRole("heading", { name: "RRC Roll-Off Explorer" })).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        /RRC bandwidth formula: bandwidth equals symbol rate times one plus alpha/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/modulation/i)).toHaveValue("QPSK");
    expect(screen.getByLabelText(/samples per symbol/i)).toHaveAttribute("step", "2");

    const rolloff = screen.getByLabelText(/roll-off alpha/i);
    expect(rolloff).toHaveAttribute("min", "0.05");

    fireEvent.change(rolloff, { target: { value: "0.7" } });

    expect(screen.getByText("0.7")).toBeInTheDocument();
    expect(screen.queryByText("Normalized bandwidth")).not.toBeInTheDocument();
  });

  it("updates IQ axis limits for 16-QAM", () => {
    render(<RrcRollOffDemo />);

    fireEvent.change(screen.getByLabelText(/modulation/i), {
      target: { value: "16-QAM" },
    });

    expect(screen.getByLabelText(/modulation/i)).toHaveValue("16-QAM");
    expect(findPlotLayout(vi.mocked(Plotly.react).mock.calls, "IQ trajectory")).toMatchObject({
      xaxis: { range: [-(3 / Math.sqrt(10)), 3 / Math.sqrt(10)] },
      yaxis: {
        range: [-(3 / Math.sqrt(10)), 3 / Math.sqrt(10)],
        scaleanchor: "x",
        scaleratio: 1,
      },
    });
  });

  it("uses all oversampled filtered samples in the IQ trajectory", () => {
    render(<RrcRollOffDemo />);

    const plotCalls = vi.mocked(Plotly.react).mock.calls;
    const iqTrajectoryCall = plotCalls.find((call) => {
      const data = call[1];
      return data.some((trace) => trace.name === "Filtered samples");
    });

    expect(iqTrajectoryCall).toBeDefined();

    const iqTrace = iqTrajectoryCall?.[1].find(
      (trace) => trace.name === "Filtered samples",
    );

    expect(iqTrace?.x).toHaveLength(96 * 8);
    expect(iqTrace?.y).toHaveLength(96 * 8);
  });

  it("locks axis ranges for roll-off comparison plots", () => {
    render(<RrcRollOffDemo />);

    const plotCalls = vi.mocked(Plotly.react).mock.calls;

    expect(findPlotLayout(plotCalls, "RRC impulse response")).toMatchObject({
      xaxis: { range: [-32, 32] },
      yaxis: { range: [-0.1, 0.5] },
    });
    expect(findPlotLayout(plotCalls, "I/Q waveform")).toMatchObject({
      xaxis: { range: [0, 24] },
      yaxis: { range: [-0.8, 0.8] },
    });
    expect(findPlotLayout(plotCalls, "IQ trajectory")).toMatchObject({
      xaxis: { range: [-Math.SQRT1_2, Math.SQRT1_2] },
      yaxis: {
        range: [-Math.SQRT1_2, Math.SQRT1_2],
        scaleanchor: "x",
        scaleratio: 1,
      },
    });
  });
});

function findPlotLayout(
  plotCalls: Parameters<typeof Plotly.react>[],
  title: string,
) {
  const call = [...plotCalls].reverse().find(([element]) => {
    const heading = element.closest(".plot-panel")?.querySelector("h2");
    return heading?.textContent === title;
  });

  expect(call).toBeDefined();
  return call?.[2];
}
