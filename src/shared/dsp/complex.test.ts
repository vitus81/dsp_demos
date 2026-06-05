import { describe, expect, it } from "vitest";
import {
  complexDft,
  complexFft,
  complexIdft,
  computeAveragePower,
  computeMagnitudeHistogram,
  computePaprDb,
  normalizeAveragePower,
  type ComplexArray,
} from "./complex";

describe("complex DSP helpers", () => {
  it("computes a radix-2 FFT that matches known DFT bins", () => {
    const spectrum = complexFft({
      i: new Float64Array([1, 2, 3, 4]),
      q: new Float64Array([0, 0, 0, 0]),
    });

    expect(spectrum.i[0]).toBeCloseTo(10, 12);
    expect(spectrum.i[1]).toBeCloseTo(-2, 12);
    expect(spectrum.i[2]).toBeCloseTo(-2, 12);
    expect(spectrum.i[3]).toBeCloseTo(-2, 12);
    expect(spectrum.q[0]).toBeCloseTo(0, 12);
    expect(spectrum.q[1]).toBeCloseTo(2, 12);
    expect(spectrum.q[2]).toBeCloseTo(0, 12);
    expect(spectrum.q[3]).toBeCloseTo(-2, 12);
  });

  it("round-trips through DFT and IDFT", () => {
    const samples: ComplexArray = {
      i: new Float64Array([1, 0.5, -1, 0.25]),
      q: new Float64Array([0, -0.5, 0.75, 1]),
    };

    const reconstructed = complexIdft(complexDft(samples));

    Array.from(samples.i).forEach((value, index) => {
      expect(reconstructed.i[index]).toBeCloseTo(value, 10);
      expect(reconstructed.q[index]).toBeCloseTo(samples.q[index], 10);
    });
  });

  it("round-trips non-power-of-two inputs through the DFT fallback", () => {
    const samples: ComplexArray = {
      i: new Float64Array([1, 0.5, -1]),
      q: new Float64Array([0, -0.5, 0.75]),
    };

    const reconstructed = complexIdft(complexDft(samples));

    Array.from(samples.i).forEach((value, index) => {
      expect(reconstructed.i[index]).toBeCloseTo(value, 10);
      expect(reconstructed.q[index]).toBeCloseTo(samples.q[index], 10);
    });
  });

  it("computes PAPR from peak and average power", () => {
    const samples: ComplexArray = {
      i: new Float64Array([1, 2]),
      q: new Float64Array([0, 0]),
    };

    expect(computePaprDb(samples)).toBeCloseTo(10 * Math.log10(4 / 2.5), 12);
  });

  it("keeps constant-envelope PAPR at zero decibels", () => {
    const samples: ComplexArray = {
      i: new Float64Array([1, -1, 1, -1]),
      q: new Float64Array([0, 0, 0, 0]),
    };

    expect(computePaprDb(samples)).toBeCloseTo(0, 12);
  });

  it("normalizes average power", () => {
    const normalized = normalizeAveragePower({
      i: new Float64Array([2, 0]),
      q: new Float64Array([0, 0]),
    });

    expect(computeAveragePower(normalized)).toBeCloseTo(1, 12);
  });

  it("conserves sample count in the magnitude histogram", () => {
    const histogram = computeMagnitudeHistogram(
      {
        i: new Float64Array([0, 1, 2, 3]),
        q: new Float64Array([0, 0, 0, 0]),
      },
      3,
      3,
    );

    const total = Array.from(histogram.counts).reduce(
      (sum, count) => sum + count,
      0,
    );

    expect(total).toBe(4);
    expect(Array.from(histogram.binCenters)).toEqual([0.5, 1.5, 2.5]);
  });
});
