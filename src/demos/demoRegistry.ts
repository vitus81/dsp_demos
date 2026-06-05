import { RrcRollOffDemo } from "./rrc/RrcRollOffDemo";
import { InterpolationDemo } from "./interpolation/InterpolationDemo";
import { AgcDemo } from "./agc/AgcDemo";
import type { DemoDefinition } from "./demoTypes";

export const demoRegistry: DemoDefinition[] = [
  {
    id: "rrc-rolloff",
    title: "RRC Roll-Off Explorer",
    category: "Digital Communications",
    description:
      "Explore how root raised cosine roll-off changes bandwidth, pulse shape, IQ samples, and the eye diagram.",
    component: RrcRollOffDemo,
  },
  {
    id: "interpolation-x2",
    title: "Interpolation x2: repeat vs zero-stuff",
    category: "General DSP",
    description:
      "Compare repeat and zero-stuff sample preparation before a shared windowed-sinc FIR interpolation filter.",
    component: InterpolationDemo,
  },
  {
    id: "agc-gain-step",
    title: "AGC Gain Step Explorer",
    category: "Digital Communications",
    description:
      "Inspect an automatic gain control loop as it measures output level, applies attack/decay coefficients, and settles after input gain steps.",
    component: AgcDemo,
  },
];

export function getDemoById(id: string): DemoDefinition | undefined {
  return demoRegistry.find((demo) => demo.id === id);
}
