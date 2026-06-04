import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  it("renders controls and updates roll-off", () => {
    render(<RrcRollOffDemo />);

    expect(screen.getByRole("heading", { name: "RRC Roll-Off Explorer" })).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        /RRC bandwidth formula: bandwidth equals symbol rate times one plus alpha/i,
      ),
    ).toBeInTheDocument();

    const rolloff = screen.getByLabelText(/roll-off alpha/i);
    fireEvent.change(rolloff, { target: { value: "0.7" } });

    expect(screen.getByText("0.7")).toBeInTheDocument();
    expect(screen.queryByText("Normalized bandwidth")).not.toBeInTheDocument();
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
});
