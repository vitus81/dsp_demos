import { RrcRollOffDemo } from "./rrc/RrcRollOffDemo";
import { InterpolationDemo } from "./interpolation/InterpolationDemo";
import { SingleCarrierOfdmDemo } from "./singleCarrierOfdm/SingleCarrierOfdmDemo";
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
    id: "single-carrier-ofdm",
    title: "Single-Carrier vs OFDM",
    category: "Digital Communications",
    description:
      "Compare PAPR, IQ magnitude statistics, and spectrum shape for RRC QPSK, OFDM, and DFT-s-OFDM at matched bandwidth.",
    component: SingleCarrierOfdmDemo,
  },
];

export function getDemoById(id: string): DemoDefinition | undefined {
  return demoRegistry.find((demo) => demo.id === id);
}
