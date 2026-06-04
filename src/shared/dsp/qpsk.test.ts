import { describe, expect, it } from "vitest";
import { generateQpskSymbols } from "./qpsk";

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
});
