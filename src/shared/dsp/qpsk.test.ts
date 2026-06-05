import { describe, expect, it } from "vitest";
import {
  generate16QamSymbols,
  generateQpskSymbols,
  generateSymbols,
  oversampleSymbolsWithQuadratureDelay,
} from "./qpsk";

describe("generateQpskSymbols", () => {
  it("is reproducible for the same seed", () => {
    const first = generateQpskSymbols(12, 123);
    const second = generateQpskSymbols(12, 123);

    expect(first).toEqual(second);
  });

  it("generates normalized QPSK symbols", () => {
    const symbols = generateQpskSymbols(32, 7);
    const expectedMagnitude = 1;

    symbols.forEach((symbol) => {
      expect(Math.abs(symbol.i)).toBeCloseTo(1 / Math.sqrt(2), 12);
      expect(Math.abs(symbol.q)).toBeCloseTo(1 / Math.sqrt(2), 12);
      expect(Math.hypot(symbol.i, symbol.q)).toBeCloseTo(expectedMagnitude, 12);
    });
  });

  it("generates deterministic 16-QAM symbols", () => {
    const first = generateSymbols(24, 42, "16-QAM");
    const second = generateSymbols(24, 42, "16-QAM");

    expect(first).toEqual(second);
  });

  it("generates normalized 16-QAM levels", () => {
    const symbols = generate16QamSymbols(4096, 5);
    const scale = 1 / Math.sqrt(10);
    const expectedLevels = new Set([-3, -1, 1, 3].map((level) => level * scale));
    const observedLevels = new Set<number>();
    const averagePower =
      symbols.reduce((sum, symbol) => sum + symbol.i ** 2 + symbol.q ** 2, 0) /
      symbols.length;

    symbols.forEach((symbol) => {
      observedLevels.add(symbol.i);
      observedLevels.add(symbol.q);
    });

    expect(observedLevels).toEqual(expectedLevels);
    expect(averagePower).toBeCloseTo(1, 1);
  });

  it("oversamples symbols with an explicit quadrature delay for OQPSK", () => {
    const samples = oversampleSymbolsWithQuadratureDelay(
      [
        { i: 1, q: -1 },
        { i: -1, q: 1 },
      ],
      8,
      4,
    );

    expect(samples.i).toHaveLength(20);
    expect(samples.q).toHaveLength(20);
    expect(samples.i[0]).toBe(1);
    expect(samples.i[8]).toBe(-1);
    expect(samples.q[4]).toBe(-1);
    expect(samples.q[12]).toBe(1);
  });
});
