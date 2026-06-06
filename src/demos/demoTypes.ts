import type { ComponentType } from "react";

export type DemoCategory =
  | "Filtering and sample rate conversion"
  | "Digital communications"
  | "Live spectral analysis";

export type DemoDefinition = {
  id: string;
  title: string;
  category: DemoCategory;
  description: string;
  component: ComponentType;
};
