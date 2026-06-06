import { describe, expect, it } from "vitest";
import {
  createWindowedLowPassFir,
  findBandwidthAtDb,
  getFirGroupDelay,
  getIntegerBits,
  quantizeFirCoefficients,
} from "./fir";

describe("createWindowedLowPassFir", () => {
  it("creates a symmetric unity-gain odd-length low-pass FIR", () => {
    const taps = createWindowedLowPassFir({
      cutoff: 0.18,
      tapCount: 41,
      window: "Hamming",
    });

    const sum = Array.from(taps).reduce((total, tap) => total + tap, 0);

    expect(taps).toHaveLength(41);
    expect(sum).toBeCloseTo(1, 12);
    expect(taps[0]).toBeCloseTo(taps[taps.length - 1], 12);
    expect(taps[10]).toBeCloseTo(taps[taps.length - 11], 12);
  });

  it("creates a symmetric unity-gain even-length low-pass FIR", () => {
    const taps = createWindowedLowPassFir({
      cutoff: 0.18,
      tapCount: 64,
      window: "Hamming",
    });

    const sum = Array.from(taps).reduce((total, tap) => total + tap, 0);

    expect(taps).toHaveLength(64);
    expect(sum).toBeCloseTo(1, 12);
    expect(taps[0]).toBeCloseTo(taps[taps.length - 1], 12);
    expect(taps[10]).toBeCloseTo(taps[taps.length - 11], 12);
  });

  it("creates a symmetric unity-gain Kaiser-windowed low-pass FIR", () => {
    const taps = createWindowedLowPassFir({
      cutoff: 0.22,
      tapCount: 80,
      window: "Kaiser",
      kaiserBeta: 10,
    });

    const sum = Array.from(taps).reduce((total, tap) => total + tap, 0);

    expect(taps).toHaveLength(80);
    expect(sum).toBeCloseTo(1, 12);
    expect(taps[0]).toBeCloseTo(taps[taps.length - 1], 12);
    expect(taps[20]).toBeCloseTo(taps[taps.length - 21], 12);
  });

  it("reports integer and fractional group delay from tap count", () => {
    expect(getFirGroupDelay(63)).toBe(31);
    expect(getFirGroupDelay(64)).toBe(31.5);
  });

  it("rejects invalid tap counts", () => {
    expect(() =>
      createWindowedLowPassFir({
        cutoff: 0.2,
        tapCount: 1,
        window: "Hann",
      }),
    ).toThrow(/integer greater than 1/);
  });

  it("rejects cutoff values outside the normalized Nyquist range", () => {
    expect(() =>
      createWindowedLowPassFir({
        cutoff: 0,
        tapCount: 41,
        window: "Hann",
      }),
    ).toThrow(/between 0 and 0.5/);
    expect(() =>
      createWindowedLowPassFir({
        cutoff: 0.5,
        tapCount: 41,
        window: "Hann",
      }),
    ).toThrow(/between 0 and 0.5/);
  });
});

describe("quantizeFirCoefficients", () => {
  it("rounds coefficients into signed fixed-point integers", () => {
    const quantized = quantizeFirCoefficients(
      Float64Array.from([0.25, -0.5, 0.999]),
      { wordLength: 8, fractionalBits: 6 },
    );

    expect(Array.from(quantized.integers)).toEqual([16, -32, 64]);
    expect(Array.from(quantized.reconstructed)).toEqual([0.25, -0.5, 1]);
    expect(quantized.clippedCount).toBe(0);
  });

  it("reports clipped coefficients", () => {
    const quantized = quantizeFirCoefficients(Float64Array.from([2]), {
      wordLength: 8,
      fractionalBits: 7,
    });

    expect(Array.from(quantized.integers)).toEqual([127]);
    expect(quantized.clippedCount).toBe(1);
  });

  it("computes Q integer bits from word length and fractional bits", () => {
    expect(getIntegerBits(16, 14)).toBe(1);
    expect(getIntegerBits(8, 7)).toBe(0);
  });
});

describe("findBandwidthAtDb", () => {
  it("finds an exact threshold crossing", () => {
    const bandwidth = findBandwidthAtDb(
      [0, 0.1, 0.2],
      [0, -1, -8],
      -1,
    );

    expect(bandwidth).toEqual({ frequency: 0.1, crossed: true });
  });

  it("interpolates between FFT bins", () => {
    const bandwidth = findBandwidthAtDb(
      [0, 0.1, 0.2],
      [0, -0.5, -1.5],
      -1,
    );

    expect(bandwidth.crossed).toBe(true);
    expect(bandwidth.frequency).toBeCloseTo(0.15, 12);
  });

  it("reports when the threshold is not crossed", () => {
    const bandwidth = findBandwidthAtDb(
      [0, 0.1, 0.2],
      [0, -0.2, -0.5],
      -1,
    );

    expect(bandwidth).toEqual({ frequency: null, crossed: false });
  });
});
