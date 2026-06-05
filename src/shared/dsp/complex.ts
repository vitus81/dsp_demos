import type { ComplexSample } from "./types";

export type ComplexArray = {
  i: Float64Array;
  q: Float64Array;
};

export type MagnitudeHistogram = {
  binCenters: Float64Array;
  counts: Float64Array;
};

export type PaprCcdf = {
  thresholdDb: Float64Array;
  probability: Float64Array;
};

export function createComplexArray(length: number): ComplexArray {
  return {
    i: new Float64Array(length),
    q: new Float64Array(length),
  };
}

export function symbolsToComplexArray(symbols: ComplexSample[]): ComplexArray {
  const samples = createComplexArray(symbols.length);

  symbols.forEach((symbol, index) => {
    samples.i[index] = symbol.i;
    samples.q[index] = symbol.q;
  });

  return samples;
}

export function complexDft(samples: ComplexArray): ComplexArray {
  if (isPowerOfTwo(samples.i.length)) {
    return complexFft(samples);
  }

  return complexDftSlow(samples);
}

export function complexIdft(samples: ComplexArray): ComplexArray {
  if (isPowerOfTwo(samples.i.length)) {
    return complexIfft(samples);
  }

  return complexIdftSlow(samples);
}

export function complexFft(samples: ComplexArray): ComplexArray {
  return transformRadix2(samples, false);
}

export function complexIfft(samples: ComplexArray): ComplexArray {
  const output = transformRadix2(samples, true);
  const scale = 1 / output.i.length;

  for (let index = 0; index < output.i.length; index += 1) {
    output.i[index] *= scale;
    output.q[index] *= scale;
  }

  return output;
}

function complexDftSlow(samples: ComplexArray): ComplexArray {
  const length = samples.i.length;
  const output = createComplexArray(length);

  for (let bin = 0; bin < length; bin += 1) {
    let real = 0;
    let imaginary = 0;

    for (let index = 0; index < length; index += 1) {
      const angle = (-2 * Math.PI * bin * index) / length;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      real += samples.i[index] * cos - samples.q[index] * sin;
      imaginary += samples.i[index] * sin + samples.q[index] * cos;
    }

    output.i[bin] = real;
    output.q[bin] = imaginary;
  }

  return output;
}

function complexIdftSlow(samples: ComplexArray): ComplexArray {
  const length = samples.i.length;
  const output = createComplexArray(length);

  for (let index = 0; index < length; index += 1) {
    let real = 0;
    let imaginary = 0;

    for (let bin = 0; bin < length; bin += 1) {
      const angle = (2 * Math.PI * bin * index) / length;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      real += samples.i[bin] * cos - samples.q[bin] * sin;
      imaginary += samples.i[bin] * sin + samples.q[bin] * cos;
    }

    output.i[index] = real / length;
    output.q[index] = imaginary / length;
  }

  return output;
}

function transformRadix2(samples: ComplexArray, inverse: boolean): ComplexArray {
  const length = samples.i.length;

  if (!isPowerOfTwo(length)) {
    throw new Error("FFT length must be a power of two.");
  }

  const output = {
    i: new Float64Array(samples.i),
    q: new Float64Array(samples.q),
  };
  const levels = Math.log2(length);

  for (let index = 0; index < length; index += 1) {
    const reversed = reverseBits(index, levels);

    if (reversed > index) {
      const real = output.i[index];
      const imaginary = output.q[index];
      output.i[index] = output.i[reversed];
      output.q[index] = output.q[reversed];
      output.i[reversed] = real;
      output.q[reversed] = imaginary;
    }
  }

  for (let size = 2; size <= length; size *= 2) {
    const halfSize = size / 2;
    const angleStep = (inverse ? 2 : -2) * Math.PI / size;

    for (let start = 0; start < length; start += size) {
      for (let offset = 0; offset < halfSize; offset += 1) {
        const angle = angleStep * offset;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const evenIndex = start + offset;
        const oddIndex = evenIndex + halfSize;
        const oddReal = output.i[oddIndex] * cos - output.q[oddIndex] * sin;
        const oddImaginary = output.i[oddIndex] * sin + output.q[oddIndex] * cos;
        const evenReal = output.i[evenIndex];
        const evenImaginary = output.q[evenIndex];

        output.i[evenIndex] = evenReal + oddReal;
        output.q[evenIndex] = evenImaginary + oddImaginary;
        output.i[oddIndex] = evenReal - oddReal;
        output.q[oddIndex] = evenImaginary - oddImaginary;
      }
    }
  }

  return output;
}

function reverseBits(value: number, width: number): number {
  let reversed = 0;

  for (let bit = 0; bit < width; bit += 1) {
    reversed = (reversed << 1) | ((value >>> bit) & 1);
  }

  return reversed;
}

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

export function normalizeAveragePower(samples: ComplexArray): ComplexArray {
  const averagePower = computeAveragePower(samples);

  if (averagePower === 0) {
    return {
      i: new Float64Array(samples.i),
      q: new Float64Array(samples.q),
    };
  }

  const scale = 1 / Math.sqrt(averagePower);
  const normalized = createComplexArray(samples.i.length);

  for (let index = 0; index < samples.i.length; index += 1) {
    normalized.i[index] = samples.i[index] * scale;
    normalized.q[index] = samples.q[index] * scale;
  }

  return normalized;
}

export function computeAveragePower(samples: ComplexArray): number {
  if (samples.i.length === 0) {
    return 0;
  }

  let power = 0;

  for (let index = 0; index < samples.i.length; index += 1) {
    power += samples.i[index] * samples.i[index] + samples.q[index] * samples.q[index];
  }

  return power / samples.i.length;
}

export function computePaprDb(samples: ComplexArray): number {
  const averagePower = computeAveragePower(samples);

  if (averagePower === 0) {
    return 0;
  }

  let peakPower = 0;

  for (let index = 0; index < samples.i.length; index += 1) {
    const power = samples.i[index] * samples.i[index] + samples.q[index] * samples.q[index];
    peakPower = Math.max(peakPower, power);
  }

  return 10 * Math.log10(peakPower / averagePower);
}

export function computeEnvelope(samples: ComplexArray, maxSamples: number): Float64Array {
  const count = Math.min(samples.i.length, maxSamples);
  const envelope = new Float64Array(count);

  for (let index = 0; index < count; index += 1) {
    envelope[index] = Math.hypot(samples.i[index], samples.q[index]);
  }

  return envelope;
}

export function computePaprCcdf(
  samples: ComplexArray,
  thresholdCount = 80,
  maxThresholdDb = 12,
  minimumProbability = 1e-4,
): PaprCcdf {
  const averagePower = computeAveragePower(samples);
  const thresholdDb = new Float64Array(thresholdCount);
  const probability = new Float64Array(thresholdCount);

  if (samples.i.length === 0 || averagePower === 0) {
    return { thresholdDb, probability };
  }

  const powersDb = new Float64Array(samples.i.length);

  for (let index = 0; index < samples.i.length; index += 1) {
    const power = samples.i[index] * samples.i[index] + samples.q[index] * samples.q[index];
    powersDb[index] = 10 * Math.log10(Math.max(power / averagePower, 1e-20));
  }

  for (let thresholdIndex = 0; thresholdIndex < thresholdCount; thresholdIndex += 1) {
    const threshold =
      thresholdCount === 1
        ? 0
        : (thresholdIndex * maxThresholdDb) / (thresholdCount - 1);
    let exceedances = 0;

    for (let sampleIndex = 0; sampleIndex < powersDb.length; sampleIndex += 1) {
      if (powersDb[sampleIndex] > threshold) {
        exceedances += 1;
      }
    }

    thresholdDb[thresholdIndex] = threshold;
    probability[thresholdIndex] = Math.max(
      exceedances / powersDb.length,
      minimumProbability,
    );
  }

  return { thresholdDb, probability };
}

export function computeMagnitudeHistogram(
  samples: ComplexArray,
  binCount = 48,
  maxMagnitude = 3,
): MagnitudeHistogram {
  const binCenters = new Float64Array(binCount);
  const counts = new Float64Array(binCount);
  const binWidth = maxMagnitude / binCount;

  for (let bin = 0; bin < binCount; bin += 1) {
    binCenters[bin] = (bin + 0.5) * binWidth;
  }

  for (let index = 0; index < samples.i.length; index += 1) {
    const magnitude = Math.hypot(samples.i[index], samples.q[index]);
    const bin = Math.min(binCount - 1, Math.floor(magnitude / binWidth));
    counts[bin] += 1;
  }

  return { binCenters, counts };
}
