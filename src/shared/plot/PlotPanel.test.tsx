import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Plotly from "plotly.js-dist-min";
import { PlotPanel } from "./PlotPanel";

describe("PlotPanel", () => {
  it("renders a plain centered frame for regular plots", () => {
    const { container } = render(
      <PlotPanel
        title="Regular Plot"
        data={[
          {
            x: [0],
            y: [0],
            type: "scatter",
            mode: "markers",
          },
        ]}
      />,
    );

    const frame = container.querySelector(".plot-surface-frame");

    expect(frame).toBeInTheDocument();
    expect(frame).not.toHaveClass("square-axes");
  });

  it("calculates a square internal axis area when squareAxes is enabled", async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

    HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      right: 500,
      bottom: 300,
      left: 0,
      width: 500,
      height: 300,
      toJSON: () => ({}),
    }));

    const { container } = render(
      <PlotPanel
        title="Square IQ"
        xLabel="I"
        yLabel="Q"
        xRange={[-1, 1]}
        yRange={[-1, 1]}
        squareAxes
        data={[
          {
            x: [0],
            y: [0],
            type: "scatter",
            mode: "markers",
          },
        ]}
      />,
    );

    await waitFor(() => {
      const calls = vi.mocked(Plotly.react).mock.calls;
      const latestCall = calls[calls.length - 1];
      expect(latestCall?.[2]).toMatchObject({
        width: 500,
        height: 490,
        margin: { t: 18, r: 16, b: 42, l: 54 },
        yaxis: {
          scaleanchor: "x",
          scaleratio: 1,
        },
      });
    });
    expect(container.querySelector(".plot-surface-frame")).toHaveClass(
      "square-axes",
    );

    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });
});
