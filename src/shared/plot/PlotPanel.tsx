import { useEffect, useRef, useState } from "react";
import Plotly, { type PlotlyData } from "plotly.js-dist-min";

const PLOT_MARGIN = { t: 18, r: 16, b: 42, l: 54 };

type PlotPanelProps = {
  title: string;
  data: PlotlyData[];
  xLabel?: string;
  yLabel?: string;
  xRange?: [number, number];
  yRange?: [number, number];
  yScale?: "linear" | "log";
  barMode?: "group" | "overlay";
  showLegend?: boolean;
  squareAxes?: boolean;
  height?: number;
};

export function PlotPanel({
  title,
  data,
  xLabel,
  yLabel,
  xRange,
  yRange,
  yScale = "linear",
  barMode,
  showLegend,
  squareAxes = false,
  height = 300,
}: PlotPanelProps) {
  const frameElement = useRef<HTMLDivElement | null>(null);
  const plotElement = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | undefined>();
  const squarePlotAreaWidth =
    squareAxes && measuredWidth
      ? Math.max(120, measuredWidth - PLOT_MARGIN.l - PLOT_MARGIN.r)
      : undefined;
  const squarePlotOuterWidth = squarePlotAreaWidth
    ? squarePlotAreaWidth + PLOT_MARGIN.l + PLOT_MARGIN.r
    : undefined;
  const squarePlotOuterHeight = squarePlotAreaWidth
    ? squarePlotAreaWidth + PLOT_MARGIN.t + PLOT_MARGIN.b
    : undefined;
  const plotHeight = squarePlotOuterHeight ?? height;

  useEffect(() => {
    const element = frameElement.current;

    if (!element || !squareAxes) {
      return;
    }

    const updateWidth = () => {
      const width = element.getBoundingClientRect().width;
      setMeasuredWidth(width > 0 ? width : undefined);
    };
    const resizeObserver = new ResizeObserver(updateWidth);

    updateWidth();
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [squareAxes]);

  useEffect(() => {
    if (!plotElement.current) {
      return;
    }

    Plotly.react(
      plotElement.current,
      data,
      {
        autosize: true,
        width: squarePlotOuterWidth,
        height: plotHeight,
        margin: PLOT_MARGIN,
        paper_bgcolor: "transparent",
        plot_bgcolor: "#ffffff",
        font: { color: "#1f2937", family: "Inter, system-ui, sans-serif" },
        xaxis: {
          title: xLabel,
          range: xRange,
          zerolinecolor: "#d1d5db",
          gridcolor: "#edf0f3",
        },
        yaxis: {
          title: yLabel,
          type: yScale,
          range:
            yScale === "log" && yRange
              ? [Math.log10(yRange[0]), Math.log10(yRange[1])]
              : yRange,
          scaleanchor: squareAxes ? "x" : undefined,
          scaleratio: squareAxes ? 1 : undefined,
          zerolinecolor: "#d1d5db",
          gridcolor: "#edf0f3",
        },
        barmode: barMode,
        showlegend: showLegend ?? data.length > 1,
      },
      {
        displayModeBar: false,
        responsive: true,
      },
    );
  }, [
    barMode,
    data,
    height,
    plotHeight,
    showLegend,
    squareAxes,
    squarePlotOuterWidth,
    xLabel,
    xRange,
    yLabel,
    yRange,
    yScale,
  ]);

  useEffect(() => {
    return () => {
      if (plotElement.current) {
        Plotly.purge(plotElement.current);
      }
    };
  }, []);

  return (
    <section className="plot-panel">
      <h2>{title}</h2>
      <div
        ref={frameElement}
        className={`plot-surface-frame${squareAxes ? " square-axes" : ""}`}
      >
        <div ref={plotElement} className="plot-surface" />
      </div>
    </section>
  );
}
