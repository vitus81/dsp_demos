import { describe, expect, it } from "vitest";
import { buildEyeDiagram } from "./eye";

describe("buildEyeDiagram", () => {
  it("creates two-symbol traces with coherent dimensions", () => {
    const samples = Float64Array.from({ length: 40 }, (_, index) => index);
    const eye = buildEyeDiagram(samples, 4, 2, 3);

    expect(eye.samplesPerSymbol).toBe(4);
    expect(eye.traces).toHaveLength(3);
    eye.traces.forEach((trace) => expect(trace).toHaveLength(8));
  });
});
