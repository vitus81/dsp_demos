import type { EyeDiagram } from "./types";

export function buildEyeDiagram(
  samples: Float64Array,
  samplesPerSymbol: number,
  symbolsPerTrace = 2,
  maxTraces = 80,
): EyeDiagram {
  const traceLength = samplesPerSymbol * symbolsPerTrace;
  const traces: Float64Array[] = [];

  for (
    let start = 0;
    start + traceLength <= samples.length && traces.length < maxTraces;
    start += samplesPerSymbol
  ) {
    traces.push(samples.slice(start, start + traceLength));
  }

  return { traces, samplesPerSymbol };
}
