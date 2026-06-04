import { describe, expect, it } from "vitest";
import { computeWelchPeriodogramDb } from "./spectrum";

describe("computeWelchPeriodogramDb", () => {
  it("returns a normalized spectrum with shifted normalized frequencies", () => {
    const samples = Float64Array.from({ length: 256 }, (_, index) =>
      Math.sin(2 * Math.PI * 0.125 * index),
    );
    const spectrum = computeWelchPeriodogramDb(samples, {
      fftSize: 128,
      segmentSize: 64,
      overlapRatio: 0.5,
    });

    expect(spectrum.frequency).toHaveLength(128);
    expect(spectrum.magnitudeDb).toHaveLength(128);
    expect(spectrum.frequency[0]).toBeCloseTo(-0.5, 12);
    expect(Math.max(...Array.from(spectrum.magnitudeDb))).toBeCloseTo(0, 12);
  });
});
