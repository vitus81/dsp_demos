import { useEffect, useRef } from "react";
import Plotly, { type PlotlyData } from "plotly.js-dist-min";

type PlotPanelProps = {
  title: string;
  data: PlotlyData[];
  xLabel?: string;
  yLabel?: string;
  xRange?: [number, number];
  yRange?: [number, number];
  showLegend?: boolean;
  height?: number;
};

export function PlotPanel({
  title,
  data,
  xLabel,
  yLabel,
  xRange,
  yRange,
  showLegend,
  height = 300,
}: PlotPanelProps) {
  const plotElement = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!plotElement.current) {
      return;
    }

    Plotly.react(
      plotElement.current,
      data,
      {
        autosize: true,
        height,
        margin: { t: 18, r: 16, b: 42, l: 54 },
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
          range: yRange,
          zerolinecolor: "#d1d5db",
          gridcolor: "#edf0f3",
        },
        showlegend: showLegend ?? data.length > 1,
      },
      {
        displayModeBar: false,
        responsive: true,
      },
    );
  }, [data, height, showLegend, xLabel, xRange, yLabel, yRange]);

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
      <div ref={plotElement} className="plot-surface" />
    </section>
  );
}
