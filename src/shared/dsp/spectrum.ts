export type Spectrum = {
  frequency: Float64Array;
  magnitudeDb: Float64Array;
};

type ComplexSamples = {
  i: Float64Array;
  q: Float64Array;
};

type WelchPeriodogramOptions = {
  fftSize?: number;
  segmentSize?: number;
  overlapRatio?: number;
};

const hannWindowCache = new Map<number, Float64Array>();
const twiddleTableCache = new Map<string, { cos: Float64Array; sin: Float64Array }>();

export function computeSpectrumDb(samples: Float64Array, fftSize = 512): Spectrum {
  const frequency = new Float64Array(fftSize);
  const magnitudeDb = new Float64Array(fftSize);
  let peakMagnitudeDb = -Infinity;

  for (let bin = 0; bin < fftSize; bin += 1) {
    let real = 0;
    let imaginary = 0;

    for (let index = 0; index < samples.length; index += 1) {
      const angle = (-2 * Math.PI * bin * index) / fftSize;
      real += samples[index] * Math.cos(angle);
      imaginary += samples[index] * Math.sin(angle);
    }

    const magnitude = Math.sqrt(real * real + imaginary * imaginary);
    frequency[bin] = bin < fftSize / 2 ? bin / fftSize : (bin - fftSize) / fftSize;
    magnitudeDb[bin] = 20 * Math.log10(Math.max(magnitude, 1e-10));
    peakMagnitudeDb = Math.max(peakMagnitudeDb, magnitudeDb[bin]);
  }

  for (let bin = 0; bin < fftSize; bin += 1) {
    magnitudeDb[bin] -= peakMagnitudeDb;
  }

  return {
    frequency: fftShift(frequency),
    magnitudeDb: fftShift(magnitudeDb),
  };
}

export function computeWelchPeriodogramDb(
  samples: Float64Array,
  {
    fftSize = 512,
    segmentSize = fftSize,
    overlapRatio = 0.5,
  }: WelchPeriodogramOptions = {},
): Spectrum {
  const safeSegmentSize = Math.min(segmentSize, samples.length, fftSize);
  const step = Math.max(1, Math.round(safeSegmentSize * (1 - overlapRatio)));
  const frequency = new Float64Array(fftSize);
  const power = new Float64Array(fftSize);
  const window = getHannWindow(safeSegmentSize);
  const twiddle = getDftTwiddleTable(fftSize, safeSegmentSize);
  const windowPower = Array.from(window).reduce(
    (sum, value) => sum + value * value,
    0,
  );
  let segmentCount = 0;

  for (
    let start = 0;
    start + safeSegmentSize <= samples.length;
    start += step
  ) {
    segmentCount += 1;

    for (let bin = 0; bin < fftSize; bin += 1) {
      let real = 0;
      let imaginary = 0;

      for (let index = 0; index < safeSegmentSize; index += 1) {
        const sample = samples[start + index] * window[index];
        const twiddleIndex = bin * safeSegmentSize + index;
        real += sample * twiddle.cos[twiddleIndex];
        imaginary += sample * twiddle.sin[twiddleIndex];
      }

      power[bin] += (real * real + imaginary * imaginary) / windowPower;
    }
  }

  const divisor = Math.max(segmentCount, 1);
  let peakPowerDb = -Infinity;
  const powerDb = new Float64Array(fftSize);

  for (let bin = 0; bin < fftSize; bin += 1) {
    frequency[bin] = bin < fftSize / 2 ? bin / fftSize : (bin - fftSize) / fftSize;
    powerDb[bin] = 10 * Math.log10(Math.max(power[bin] / divisor, 1e-20));
    peakPowerDb = Math.max(peakPowerDb, powerDb[bin]);
  }

  for (let bin = 0; bin < fftSize; bin += 1) {
    powerDb[bin] -= peakPowerDb;
  }

  return {
    frequency: fftShift(frequency),
    magnitudeDb: fftShift(powerDb),
  };
}

export function computeComplexWelchPeriodogramDb(
  samples: ComplexSamples,
  {
    fftSize = 512,
    segmentSize = fftSize,
    overlapRatio = 0.5,
  }: WelchPeriodogramOptions = {},
): Spectrum {
  const sampleLength = Math.min(samples.i.length, samples.q.length);
  const safeSegmentSize = Math.min(segmentSize, sampleLength, fftSize);
  const step = Math.max(1, Math.round(safeSegmentSize * (1 - overlapRatio)));
  const frequency = new Float64Array(fftSize);
  const power = new Float64Array(fftSize);
  const window = getHannWindow(safeSegmentSize);
  const twiddle = getDftTwiddleTable(fftSize, safeSegmentSize);
  const windowPower = Array.from(window).reduce(
    (sum, value) => sum + value * value,
    0,
  );
  let segmentCount = 0;

  for (
    let start = 0;
    start + safeSegmentSize <= sampleLength;
    start += step
  ) {
    segmentCount += 1;

    for (let bin = 0; bin < fftSize; bin += 1) {
      let real = 0;
      let imaginary = 0;

      for (let index = 0; index < safeSegmentSize; index += 1) {
        const sampleI = samples.i[start + index] * window[index];
        const sampleQ = samples.q[start + index] * window[index];
        const twiddleIndex = bin * safeSegmentSize + index;
        const cos = twiddle.cos[twiddleIndex];
        const sin = twiddle.sin[twiddleIndex];
        real += sampleI * cos - sampleQ * sin;
        imaginary += sampleI * sin + sampleQ * cos;
      }

      power[bin] += (real * real + imaginary * imaginary) / windowPower;
    }
  }

  const divisor = Math.max(segmentCount, 1);
  let peakPowerDb = -Infinity;
  const powerDb = new Float64Array(fftSize);

  for (let bin = 0; bin < fftSize; bin += 1) {
    frequency[bin] = bin < fftSize / 2 ? bin / fftSize : (bin - fftSize) / fftSize;
    powerDb[bin] = 10 * Math.log10(Math.max(power[bin] / divisor, 1e-20));
    peakPowerDb = Math.max(peakPowerDb, powerDb[bin]);
  }

  for (let bin = 0; bin < fftSize; bin += 1) {
    powerDb[bin] -= peakPowerDb;
  }

  return {
    frequency: fftShift(frequency),
    magnitudeDb: fftShift(powerDb),
  };
}

function fftShift(values: Float64Array): Float64Array {
  const shifted = new Float64Array(values.length);
  const half = Math.floor(values.length / 2);

  for (let index = 0; index < values.length; index += 1) {
    shifted[index] = values[(index + half) % values.length];
  }

  return shifted;
}

function getHannWindow(length: number): Float64Array {
  const cached = hannWindowCache.get(length);

  if (cached) {
    return cached;
  }

  const window = new Float64Array(length);

  if (length === 1) {
    window[0] = 1;
    hannWindowCache.set(length, window);
    return window;
  }

  for (let index = 0; index < length; index += 1) {
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (length - 1));
  }

  hannWindowCache.set(length, window);
  return window;
}

function getDftTwiddleTable(
  fftSize: number,
  segmentSize: number,
): { cos: Float64Array; sin: Float64Array } {
  const cacheKey = `${fftSize}:${segmentSize}`;
  const cached = twiddleTableCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const cos = new Float64Array(fftSize * segmentSize);
  const sin = new Float64Array(fftSize * segmentSize);

  for (let bin = 0; bin < fftSize; bin += 1) {
    for (let index = 0; index < segmentSize; index += 1) {
      const tableIndex = bin * segmentSize + index;
      const angle = (-2 * Math.PI * bin * index) / fftSize;
      cos[tableIndex] = Math.cos(angle);
      sin[tableIndex] = Math.sin(angle);
    }
  }

  const twiddle = { cos, sin };
  twiddleTableCache.set(cacheKey, twiddle);
  return twiddle;
}
