/// <reference types="vite/client" />

declare module "plotly.js-dist-min" {
  export type PlotlyData = Record<string, unknown>;
  export type Layout = Record<string, unknown>;
  export type Config = Record<string, unknown>;

  const Plotly: {
    newPlot: (
      element: HTMLElement,
      data: PlotlyData[],
      layout?: Partial<Layout>,
      config?: Partial<Config>,
    ) => Promise<void>;
    react: (
      element: HTMLElement,
      data: PlotlyData[],
      layout?: Partial<Layout>,
      config?: Partial<Config>,
    ) => Promise<void>;
    purge: (element: HTMLElement) => void;
  };

  export default Plotly;
}
