import { convolve } from "./convolution";
import { createSeededRandom } from "./random";

export type InterpolationWindow = "Rectangular" | "Hann" | "Blackman";

const INTERPOLATION_FACTOR = 2;
const INTERPOLATION_CUTOFF = 0.25;

export function generateBpskSamples(count: number, seed: number): Float64Array {
  const random = createSeededRandom(seed);
  const samples = new Float64Array(count);

  for (let index = 0; index < count; index += 1) {
    samples[index] = random() >= 0.5 ? 1 : -1;
  }

  return samples;
}

export function repeatInterpolateBy2(samples: Float64Array): Float64Array {
  const interpolated = new Float64Array(samples.length * INTERPOLATION_FACTOR);

  for (let index = 0; index < samples.length; index += 1) {
    const outputIndex = index * INTERPOLATION_FACTOR;
    interpolated[outputIndex] = samples[index];
    interpolated[outputIndex + 1] = samples[index];
  }

  return interpolated;
}

export function repeatBy2Normalized(samples: Float64Array): Float64Array {
  const repeated = repeatInterpolateBy2(samples);

  for (let index = 0; index < repeated.length; index += 1) {
    repeated[index] /= INTERPOLATION_FACTOR;
  }

  return repeated;
}

export function zeroStuffBy2(samples: Float64Array): Float64Array {
  const stuffed = new Float64Array(samples.length * INTERPOLATION_FACTOR);

  for (let index = 0; index < samples.length; index += 1) {
    stuffed[index * INTERPOLATION_FACTOR] = samples[index];
  }

  return stuffed;
}

export function createWindowedSincInterpolationFilter(
  length: number,
  window: InterpolationWindow,
): Float64Array {
  const oddLength = length % 2 === 1 ? length : length + 1;
  const center = Math.floor(oddLength / 2);
  const taps = new Float64Array(oddLength);

  for (let index = 0; index < oddLength; index += 1) {
    const offset = index - center;
    const idealLowPass = 2 * INTERPOLATION_CUTOFF * sinc(2 * INTERPOLATION_CUTOFF * offset);
    taps[index] = INTERPOLATION_FACTOR * idealLowPass * windowValue(window, index, oddLength);
  }

  return taps;
}

export function sincInterpolateBy2(
  samples: Float64Array,
  filterTaps: Float64Array,
): Float64Array {
  const stuffed = zeroStuffBy2(samples);
  return applyInterpolationFir(stuffed, filterTaps);
}

export function applyInterpolationFir(
  preparedSamples: Float64Array,
  filterTaps: Float64Array,
): Float64Array {
  const filtered = convolve(preparedSamples, filterTaps);
  const groupDelay = Math.floor(filterTaps.length / 2);

  return filtered.slice(groupDelay, groupDelay + preparedSamples.length);
}

export function computeRepeatBy2TheoryDb(frequency: Float64Array): Float64Array {
  const response = new Float64Array(frequency.length);

  for (let index = 0; index < frequency.length; index += 1) {
    const magnitude = Math.abs(Math.cos(Math.PI * frequency[index]));
    response[index] = 20 * Math.log10(Math.max(magnitude, 1e-12));
  }

  return response;
}

export function measureBandPeakDb(
  frequency: Float64Array,
  magnitudeDb: Float64Array,
  predicate: (frequency: number) => boolean,
): number {
  let peak = -Infinity;

  for (let index = 0; index < frequency.length; index += 1) {
    if (predicate(frequency[index])) {
      peak = Math.max(peak, magnitudeDb[index]);
    }
  }

  return peak;
}

function sinc(value: number): number {
  if (Math.abs(value) < 1e-12) {
    return 1;
  }

  const angle = Math.PI * value;
  return Math.sin(angle) / angle;
}

function windowValue(
  window: InterpolationWindow,
  index: number,
  length: number,
): number {
  if (window === "Rectangular" || length === 1) {
    return 1;
  }

  const phase = (2 * Math.PI * index) / (length - 1);

  if (window === "Hann") {
    return 0.5 - 0.5 * Math.cos(phase);
  }

  return 0.42 - 0.5 * Math.cos(phase) + 0.08 * Math.cos(2 * phase);
}
