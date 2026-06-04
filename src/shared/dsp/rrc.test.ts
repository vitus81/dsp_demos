import { describe, expect, it } from "vitest";
import { createRrcFilter } from "./rrc";

describe("createRrcFilter", () => {
  it("creates the expected number of taps", () => {
    const taps = createRrcFilter({
      rolloff: 0.35,
      samplesPerSymbol: 8,
      spanSymbols: 6,
    });

    expect(taps).toHaveLength(49);
  });

  it("creates finite symmetric taps", () => {
    const taps = createRrcFilter({
      rolloff: 0.5,
      samplesPerSymbol: 8,
      spanSymbols: 8,
    });

    for (let index = 0; index < taps.length; index += 1) {
      expect(Number.isFinite(taps[index])).toBe(true);
      expect(taps[index]).toBeCloseTo(taps[taps.length - 1 - index], 10);
    }
  });

  it("normalizes tap energy", () => {
    const taps = createRrcFilter({
      rolloff: 0.25,
      samplesPerSymbol: 8,
      spanSymbols: 8,
    });
    const energy = taps.reduce((sum, tap) => sum + tap * tap, 0);

    expect(energy).toBeCloseTo(1, 8);
  });
});
