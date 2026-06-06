export type FirWindow = "Rectangular" | "Hann" | "Hamming" | "Blackman";

export type LowPassFirOptions = {
  cutoff: number;
  tapCount: number;
  window: FirWindow;
};

export type QuantizedFirOptions = {
  wordLength: number;
  fractionalBits: number;
};

export type QuantizedFirResult = {
  integers: Int32Array;
  reconstructed: Float64Array;
  minInteger: number;
  maxInteger: number;
  clippedCount: number;
};

export const FIR_WINDOWS: FirWindow[] = [
  "Rectangular",
  "Hann",
  "Hamming",
  "Blackman",
];

export function createWindowedLowPassFir({
  cutoff,
  tapCount,
  window,
}: LowPassFirOptions): Float64Array {
  if (cutoff <= 0 || cutoff >= 0.5) {
    throw new RangeError("cutoff must be between 0 and 0.5 cycles/sample");
  }

  if (!Number.isInteger(tapCount) || tapCount < 2) {
    throw new RangeError("tapCount must be an integer greater than 1");
  }

  const taps = new Float64Array(tapCount);
  const center = (tapCount - 1) / 2;
  let sum = 0;

  for (let index = 0; index < tapCount; index += 1) {
    const offset = index - center;
    const ideal = offset === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * offset) / (Math.PI * offset);
    const value = ideal * windowValue(window, index, tapCount);

    taps[index] = value;
    sum += value;
  }

  for (let index = 0; index < taps.length; index += 1) {
    taps[index] /= sum;
  }

  return taps;
}

export function quantizeFirCoefficients(
  coefficients: Float64Array,
  { wordLength, fractionalBits }: QuantizedFirOptions,
): QuantizedFirResult {
  if (wordLength < 2 || wordLength > 32) {
    throw new RangeError("wordLength must be between 2 and 32 bits");
  }

  if (fractionalBits < 0 || fractionalBits >= wordLength) {
    throw new RangeError("fractionalBits must leave room for a sign bit");
  }

  const scale = 2 ** fractionalBits;
  const minInteger = -(2 ** (wordLength - 1));
  const maxInteger = 2 ** (wordLength - 1) - 1;
  const integers = new Int32Array(coefficients.length);
  const reconstructed = new Float64Array(coefficients.length);
  let clippedCount = 0;

  for (let index = 0; index < coefficients.length; index += 1) {
    const rounded = Math.round(coefficients[index] * scale);
    const clipped = Math.min(maxInteger, Math.max(minInteger, rounded));

    if (clipped !== rounded) {
      clippedCount += 1;
    }

    integers[index] = clipped;
    reconstructed[index] = clipped / scale;
  }

  return {
    integers,
    reconstructed,
    minInteger,
    maxInteger,
    clippedCount,
  };
}

export function getIntegerBits(wordLength: number, fractionalBits: number): number {
  return Math.max(0, wordLength - fractionalBits - 1);
}

export function getFirGroupDelay(tapCount: number): number {
  if (!Number.isInteger(tapCount) || tapCount < 2) {
    throw new RangeError("tapCount must be an integer greater than 1");
  }

  return (tapCount - 1) / 2;
}

function windowValue(window: FirWindow, index: number, length: number): number {
  if (length === 1) {
    return 1;
  }

  const phase = (2 * Math.PI * index) / (length - 1);

  switch (window) {
    case "Rectangular":
      return 1;
    case "Hann":
      return 0.5 - 0.5 * Math.cos(phase);
    case "Hamming":
      return 0.54 - 0.46 * Math.cos(phase);
    case "Blackman":
      return 0.42 - 0.5 * Math.cos(phase) + 0.08 * Math.cos(2 * phase);
  }
}
