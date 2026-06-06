import { describe, expect, it } from "vitest";
import {
  appendRollingRealSamples,
  computeAudioLevelMetrics,
  findDominantFrequencyHz,
} from "./audioAnalysis";

describe("appendRollingRealSamples", () => {
  it("keeps the newest samples within the requested capacity", () => {
    const current = Float64Array.from([1, 2, 3]);
    const next = Float64Array.from([4, 5, 6]);

    expect(Array.from(appendRollingRealSamples(current, next, 4))).toEqual([
      3, 4, 5, 6,
    ]);
  });

  it("returns an empty buffer for non-positive capacities", () => {
    expect(appendRollingRealSamples(Float64Array.from([1]), Float64Array.from([2]), 0))
      .toHaveLength(0);
  });
});

describe("computeAudioLevelMetrics", () => {
  it("computes RMS and peak levels in dBFS", () => {
    const metrics = computeAudioLevelMetrics(Float64Array.from([0.5, -0.5]));

    expect(metrics.rmsDbfs).toBeCloseTo(-6.0206, 4);
    expect(metrics.peakDbfs).toBeCloseTo(-6.0206, 4);
    expect(metrics.peakAmplitude).toBe(0.5);
  });

  it("handles silence without inventing a noise floor", () => {
    const metrics = computeAudioLevelMetrics(Float64Array.from([0, 0]));

    expect(metrics.rmsDbfs).toBe(-Infinity);
    expect(metrics.peakDbfs).toBe(-Infinity);
    expect(metrics.peakAmplitude).toBe(0);
  });
});

describe("findDominantFrequencyHz", () => {
  it("maps the strongest normalized bin to absolute Hz", () => {
    const frequency = Float64Array.from([-0.5, -0.25, 0, 0.25]);
    const magnitudeDb = Float64Array.from([-20, -3, -12, -9]);

    expect(findDominantFrequencyHz({ frequency, magnitudeDb }, 48000)).toBe(
      12000,
    );
  });
});
