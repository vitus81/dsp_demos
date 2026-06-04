import { describe, expect, it } from "vitest";
import { computeSpectrumDb } from "./spectrum";
import {
  applyInterpolationFir,
  computeRepeatBy2TheoryDb,
  createWindowedSincInterpolationFilter,
  generateBpskSamples,
  measureBandPeakDb,
  repeatBy2Normalized,
  repeatInterpolateBy2,
  zeroStuffBy2,
} from "./interpolation";

describe("interpolation helpers", () => {
  it("generates reproducible BPSK samples", () => {
    const first = generateBpskSamples(16, 42);
    const second = generateBpskSamples(16, 42);

    expect(Array.from(first)).toEqual(Array.from(second));
    Array.from(first).forEach((sample) => {
      expect([-1, 1]).toContain(sample);
    });
  });

  it("interpolates by repeating each sample", () => {
    const interpolated = repeatInterpolateBy2(new Float64Array([1, -1, 1]));

    expect(Array.from(interpolated)).toEqual([1, 1, -1, -1, 1, 1]);
  });

  it("normalizes repeated samples to match zero-stuff DC gain", () => {
    const repeated = repeatBy2Normalized(new Float64Array([1, -1, 1]));
    const stuffed = zeroStuffBy2(new Float64Array([1, -1, 1]));

    expect(Array.from(repeated)).toEqual([0.5, 0.5, -0.5, -0.5, 0.5, 0.5]);
    expect(sum(repeated)).toBeCloseTo(sum(stuffed), 12);
  });

  it("upsamples by inserting zeros", () => {
    const stuffed = zeroStuffBy2(new Float64Array([1, -1, 1]));

    expect(Array.from(stuffed)).toEqual([1, 0, -1, 0, 1, 0]);
  });

  it("creates an odd symmetric interpolation filter with gain near two", () => {
    const taps = createWindowedSincInterpolationFilter(64, "Blackman");
    const gain = Array.from(taps).reduce((sum, tap) => sum + tap, 0);

    expect(taps.length).toBe(65);
    expect(gain).toBeCloseTo(2, 2);

    for (let index = 0; index < taps.length; index += 1) {
      expect(taps[index]).toBeCloseTo(taps[taps.length - 1 - index], 12);
    }
  });

  it("applies the interpolation FIR with delay compensation", () => {
    const prepared = zeroStuffBy2(new Float64Array([1, -1, 1, -1]));
    const taps = createWindowedSincInterpolationFilter(33, "Hann");
    const filtered = applyInterpolationFir(prepared, taps);

    expect(filtered.length).toBe(prepared.length);
  });

  it("computes the repeat-by-two theoretical boxcar envelope", () => {
    const response = computeRepeatBy2TheoryDb(
      new Float64Array([0, 0.25, 0.5]),
    );

    expect(response[0]).toBeCloseTo(0, 12);
    expect(response[1]).toBeCloseTo(-3.0103, 3);
    expect(response[2]).toBeLessThan(-200);
  });

  it("applies Hann and Blackman endpoint tapering", () => {
    const rectangular = createWindowedSincInterpolationFilter(33, "Rectangular");
    const hann = createWindowedSincInterpolationFilter(33, "Hann");
    const blackman = createWindowedSincInterpolationFilter(33, "Blackman");

    expect(Math.abs(rectangular[0])).toBeGreaterThan(0);
    expect(Math.abs(hann[0])).toBeLessThan(1e-12);
    expect(Math.abs(blackman[0])).toBeLessThan(1e-12);
  });

  it("keeps repeat and zero-stuff DC gain comparable before the shared FIR", () => {
    const samples = generateBpskSamples(96, 9);
    const repeat = repeatBy2Normalized(samples);
    const stuffed = zeroStuffBy2(samples);
    const taps = createWindowedSincInterpolationFilter(81, "Blackman");
    const filteredRepeat = applyInterpolationFir(repeat, taps);
    const filteredStuffed = applyInterpolationFir(stuffed, taps);

    const repeatSpectrum = computeSpectrumDb(repeat, 512);
    const stuffedSpectrum = computeSpectrumDb(stuffed, 512);
    const filteredRepeatSpectrum = computeSpectrumDb(filteredRepeat, 512);
    const filteredStuffedSpectrum = computeSpectrumDb(filteredStuffed, 512);
    const imageBand = (frequency: number) => Math.abs(frequency) > 0.3;

    const repeatImagePeak = measureBandPeakDb(
      repeatSpectrum.frequency,
      repeatSpectrum.magnitudeDb,
      imageBand,
    );
    const stuffedImagePeak = measureBandPeakDb(
      stuffedSpectrum.frequency,
      stuffedSpectrum.magnitudeDb,
      imageBand,
    );

    expect(Math.abs(sum(repeat) - sum(stuffed))).toBeLessThan(1e-12);
    expect(repeatImagePeak).toBeLessThan(stuffedImagePeak - 8);
    expect(filteredRepeatSpectrum.magnitudeDb.length).toBe(
      filteredStuffedSpectrum.magnitudeDb.length,
    );
  });
});

function sum(values: Float64Array): number {
  return Array.from(values).reduce((total, value) => total + value, 0);
}
