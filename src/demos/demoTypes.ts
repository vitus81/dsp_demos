import type { ComponentType } from "react";

export type DemoCategory = "Digital Communications" | "General DSP";

export type DemoDefinition = {
  id: string;
  title: string;
  category: DemoCategory;
  description: string;
  component: ComponentType;
};
