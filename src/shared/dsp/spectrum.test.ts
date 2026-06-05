import { describe, expect, it } from "vitest";
import {
  computeComplexWelchPeriodogramDb,
  computeSpectrumDb,
  computeWelchPeriodogramDb,
} from "./spectrum";

describe("computeWelchPeriodogramDb", () => {
  it("detects a real sinusoid peak at the expected normalized frequency", () => {
    const samples = Float64Array.from({ length: 256 }, (_, index) =>
      Math.sin(2 * Math.PI * 0.125 * index),
    );
    const spectrum = computeSpectrumDb(samples, 256);
    const peakFrequency = findPeakFrequency(spectrum);

    expect(Math.abs(peakFrequency)).toBeCloseTo(0.125, 12);
    expect(Math.max(...Array.from(spectrum.magnitudeDb))).toBeCloseTo(0, 12);
  });

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

  it("detects a complex sinusoid peak at positive normalized frequency", () => {
    const frequency = 0.125;
    const samples = {
      i: Float64Array.from({ length: 256 }, (_, index) =>
        Math.cos(2 * Math.PI * frequency * index),
      ),
      q: Float64Array.from({ length: 256 }, (_, index) =>
        Math.sin(2 * Math.PI * frequency * index),
      ),
    };
    const spectrum = computeComplexWelchPeriodogramDb(samples, {
      fftSize: 128,
      segmentSize: 128,
      overlapRatio: 0.5,
    });

    expect(findPeakFrequency(spectrum)).toBeCloseTo(frequency, 12);
    expect(Math.max(...Array.from(spectrum.magnitudeDb))).toBeCloseTo(0, 12);
  });
});

function findPeakFrequency(spectrum: {
  frequency: Float64Array;
  magnitudeDb: Float64Array;
}): number {
  let peakIndex = 0;

  for (let index = 1; index < spectrum.magnitudeDb.length; index += 1) {
    if (spectrum.magnitudeDb[index] > spectrum.magnitudeDb[peakIndex]) {
      peakIndex = index;
    }
  }

  return spectrum.frequency[peakIndex];
}
