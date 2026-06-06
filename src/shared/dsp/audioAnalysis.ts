import type { Spectrum } from "./spectrum";

export type AudioLevelMetrics = {
  rmsDbfs: number;
  peakDbfs: number;
  peakAmplitude: number;
};

export function appendRollingRealSamples(
  current: Float64Array,
  next: Float64Array,
  maxSamples: number,
): Float64Array {
  if (maxSamples <= 0) {
    return new Float64Array(0);
  }

  const copyLength = Math.min(maxSamples, current.length + next.length);
  const output = new Float64Array(copyLength);
  const fromCurrent = Math.min(current.length, Math.max(0, copyLength - next.length));
  const fromNext = copyLength - fromCurrent;

  if (fromCurrent > 0) {
    output.set(current.subarray(current.length - fromCurrent), 0);
  }

  if (fromNext > 0) {
    output.set(next.subarray(next.length - fromNext), fromCurrent);
  }

  return output;
}

export function computeAudioLevelMetrics(samples: Float64Array): AudioLevelMetrics {
  if (samples.length === 0) {
    return {
      rmsDbfs: -Infinity,
      peakDbfs: -Infinity,
      peakAmplitude: 0,
    };
  }

  let squareSum = 0;
  let peakAmplitude = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    squareSum += sample * sample;
    peakAmplitude = Math.max(peakAmplitude, Math.abs(sample));
  }

  const rms = Math.sqrt(squareSum / samples.length);

  return {
    rmsDbfs: amplitudeToDbfs(rms),
    peakDbfs: amplitudeToDbfs(peakAmplitude),
    peakAmplitude,
  };
}

export function findDominantFrequencyHz(
  spectrum: Spectrum | undefined,
  sampleRate: number,
): number | undefined {
  if (!spectrum || spectrum.magnitudeDb.length === 0 || sampleRate <= 0) {
    return undefined;
  }

  let peakIndex = 0;

  for (let index = 1; index < spectrum.magnitudeDb.length; index += 1) {
    if (spectrum.magnitudeDb[index] > spectrum.magnitudeDb[peakIndex]) {
      peakIndex = index;
    }
  }

  return Math.abs(spectrum.frequency[peakIndex] * sampleRate);
}

function amplitudeToDbfs(amplitude: number): number {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity;
}
