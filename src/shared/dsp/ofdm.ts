import {
  complexDft,
  complexIdft,
  computeAveragePower,
  computeEnvelope,
  computeMagnitudeHistogram,
  computePaprCcdf,
  computePaprDb,
  createComplexArray,
  normalizeAveragePower,
  symbolsToComplexArray,
  type ComplexArray,
  type MagnitudeHistogram,
  type PaprCcdf,
} from "./complex";
import { generateSymbols, type DigitalModulation } from "./qpsk";
import { computeComplexWelchPeriodogramDb, type Spectrum } from "./spectrum";

export type WaveformKind = "single-carrier" | "ofdm" | "dft-s-ofdm";

export type WaveformComparisonParams = {
  seed: number;
  rolloff: number;
  activeSubcarriers: number;
  blockCount: number;
  modulation: DigitalModulation;
};

export type WaveformResult = {
  kind: WaveformKind;
  label: string;
  color: string;
  samples: ComplexArray;
  averagePower: number;
  paprDb: number;
  nominalBandwidth: number;
  envelope: Float64Array;
  ccdf: PaprCcdf;
  histogram: MagnitudeHistogram;
  spectrum: Spectrum;
  constellation: ComplexArray;
};

export const OFDM_FFT_SIZE = 64;
export const OFDM_CP_LENGTH = OFDM_FFT_SIZE / 4;
const RRC_SPAN_SYMBOLS = 16;
const SPECTRUM_FFT_SIZE = 256;
const SPECTRUM_SEGMENT_SIZE = 256;
const ENVELOPE_SAMPLES = 384;
const CONSTELLATION_SAMPLES = 192;

const WAVEFORM_STYLES: Record<WaveformKind, { label: string; color: string }> = {
  "single-carrier": {
    label: "Single-carrier RRC",
    color: "#2563eb",
  },
  ofdm: {
    label: "OFDM",
    color: "#dc2626",
  },
  "dft-s-ofdm": {
    label: "DFT-s-OFDM",
    color: "#0f766e",
  },
};

export function runWaveformComparison(
  params: WaveformComparisonParams,
): WaveformResult[] {
  const normalizedActiveSubcarriers = clampActiveSubcarriers(
    params.activeSubcarriers,
  );
  const symbolCount = normalizedActiveSubcarriers * params.blockCount;
  const nominalBandwidth = normalizedActiveSubcarriers / OFDM_FFT_SIZE;

  return [
    buildSingleCarrierWaveform(params, symbolCount, nominalBandwidth),
    buildOfdmWaveform(
      "ofdm",
      params.seed + 101,
      normalizedActiveSubcarriers,
      params.blockCount,
      nominalBandwidth,
      params.modulation,
    ),
    buildOfdmWaveform(
      "dft-s-ofdm",
      params.seed + 202,
      normalizedActiveSubcarriers,
      params.blockCount,
      nominalBandwidth,
      params.modulation,
    ),
  ].map(completeWaveform);
}

export function clampActiveSubcarriers(activeSubcarriers: number): number {
  return Math.max(4, Math.min(52, Math.round(activeSubcarriers / 4) * 4));
}

export function createContiguousActiveSubcarrierBins(
  activeSubcarriers: number,
): number[] {
  const normalizedActiveSubcarriers = clampActiveSubcarriers(activeSubcarriers);
  const firstBin = Math.floor(
    (OFDM_FFT_SIZE - normalizedActiveSubcarriers) / 2,
  );

  return Array.from(
    { length: normalizedActiveSubcarriers },
    (_, carrier) => firstBin + carrier,
  );
}

function buildSingleCarrierWaveform(
  params: WaveformComparisonParams,
  symbolCount: number,
  nominalBandwidth: number,
): Omit<WaveformResult, "averagePower" | "paprDb" | "envelope" | "ccdf" | "histogram" | "spectrum"> {
  const symbols = generateSymbols(symbolCount, params.seed, params.modulation);
  const samplesPerSymbol =
    (1 + params.rolloff) / Math.max(nominalBandwidth, 1 / OFDM_FFT_SIZE);
  const samples = synthesizeFractionalRrcQpsk(
    symbols,
    samplesPerSymbol,
    params.rolloff,
    RRC_SPAN_SYMBOLS,
  );

  return {
    kind: "single-carrier",
    ...WAVEFORM_STYLES["single-carrier"],
    samples: normalizeAveragePower(samples),
    nominalBandwidth,
    constellation: symbolsToComplexArray(symbols.slice(0, CONSTELLATION_SAMPLES)),
  };
}

function synthesizeFractionalRrcQpsk(
  symbols: ReturnType<typeof generateSymbols>,
  samplesPerSymbol: number,
  rolloff: number,
  spanSymbols: number,
): ComplexArray {
  const sampleCount = Math.max(1, Math.round(symbols.length * samplesPerSymbol));
  const output = createComplexArray(sampleCount);
  const halfSpan = spanSymbols / 2;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const symbolTime = sampleIndex / samplesPerSymbol;
    const firstSymbol = Math.max(0, Math.floor(symbolTime - halfSpan));
    const lastSymbol = Math.min(
      symbols.length - 1,
      Math.ceil(symbolTime + halfSpan),
    );

    for (let symbolIndex = firstSymbol; symbolIndex <= lastSymbol; symbolIndex += 1) {
      const pulse = evaluateRrcPulse(symbolTime - symbolIndex, rolloff);
      output.i[sampleIndex] += symbols[symbolIndex].i * pulse;
      output.q[sampleIndex] += symbols[symbolIndex].q * pulse;
    }
  }

  return output;
}

function evaluateRrcPulse(timeInSymbols: number, rolloff: number): number {
  const alpha = rolloff;
  const t = timeInSymbols;
  const epsilon = 1e-8;

  if (alpha < epsilon) {
    if (Math.abs(t) < epsilon) {
      return 1;
    }

    return Math.sin(Math.PI * t) / (Math.PI * t);
  }

  if (Math.abs(t) < epsilon) {
    return 1 + alpha * (4 / Math.PI - 1);
  }

  const singularTime = 1 / (4 * alpha);

  if (Math.abs(Math.abs(t) - singularTime) < epsilon) {
    const firstTerm = (1 + 2 / Math.PI) * Math.sin(Math.PI / (4 * alpha));
    const secondTerm = (1 - 2 / Math.PI) * Math.cos(Math.PI / (4 * alpha));

    return (alpha / Math.sqrt(2)) * (firstTerm + secondTerm);
  }

  const numerator =
    Math.sin(Math.PI * t * (1 - alpha)) +
    4 * alpha * t * Math.cos(Math.PI * t * (1 + alpha));
  const denominator = Math.PI * t * (1 - (4 * alpha * t) ** 2);

  return numerator / denominator;
}

function buildOfdmWaveform(
  kind: Exclude<WaveformKind, "single-carrier">,
  seed: number,
  activeSubcarriers: number,
  blockCount: number,
  nominalBandwidth: number,
  modulation: DigitalModulation,
): Omit<WaveformResult, "averagePower" | "paprDb" | "envelope" | "ccdf" | "histogram" | "spectrum"> {
  const blockLength = OFDM_FFT_SIZE + OFDM_CP_LENGTH;
  const output = createComplexArray(blockCount * blockLength);
  const constellation = createComplexArray(
    Math.min(blockCount * activeSubcarriers, CONSTELLATION_SAMPLES),
  );
  const allSymbols = generateSymbols(
    blockCount * activeSubcarriers,
    seed,
    modulation,
  );
  const activeBins = createContiguousActiveSubcarrierBins(activeSubcarriers);
  let constellationIndex = 0;

  for (let block = 0; block < blockCount; block += 1) {
    const blockSymbols = allSymbols.slice(
      block * activeSubcarriers,
      (block + 1) * activeSubcarriers,
    );
    const mappedSubcarriers =
      kind === "dft-s-ofdm"
        ? complexDft(symbolsToComplexArray(blockSymbols))
        : symbolsToComplexArray(blockSymbols);
    const frequencyBins = createComplexArray(OFDM_FFT_SIZE);

    for (let carrier = 0; carrier < activeSubcarriers; carrier += 1) {
      const bin = activeBins[carrier];
      frequencyBins.i[bin] = mappedSubcarriers.i[carrier];
      frequencyBins.q[bin] = mappedSubcarriers.q[carrier];
    }

    const timeBlock = complexIdft(ifftShiftBins(frequencyBins));
    const outputOffset = block * blockLength;

    for (let index = 0; index < OFDM_CP_LENGTH; index += 1) {
      const sourceIndex = OFDM_FFT_SIZE - OFDM_CP_LENGTH + index;
      output.i[outputOffset + index] = timeBlock.i[sourceIndex];
      output.q[outputOffset + index] = timeBlock.q[sourceIndex];
    }

    for (let index = 0; index < OFDM_FFT_SIZE; index += 1) {
      const targetIndex = outputOffset + OFDM_CP_LENGTH + index;
      output.i[targetIndex] = timeBlock.i[index];
      output.q[targetIndex] = timeBlock.q[index];
    }

    for (
      let symbolIndex = 0;
      symbolIndex < blockSymbols.length && constellationIndex < CONSTELLATION_SAMPLES;
      symbolIndex += 1
    ) {
      constellation.i[constellationIndex] = blockSymbols[symbolIndex].i;
      constellation.q[constellationIndex] = blockSymbols[symbolIndex].q;
      constellationIndex += 1;
    }
  }

  return {
    kind,
    ...WAVEFORM_STYLES[kind],
    samples: normalizeAveragePower(output),
    nominalBandwidth,
    constellation,
  };
}

function completeWaveform(
  waveform: Omit<WaveformResult, "averagePower" | "paprDb" | "envelope" | "ccdf" | "histogram" | "spectrum">,
): WaveformResult {
  const spectrum = computeComplexWelchPeriodogramDb(waveform.samples, {
    fftSize: SPECTRUM_FFT_SIZE,
    segmentSize: SPECTRUM_SEGMENT_SIZE,
    overlapRatio: 0.5,
  });

  return {
    ...waveform,
    averagePower: computeAveragePower(waveform.samples),
    paprDb: computePaprDb(waveform.samples),
    envelope: computeEnvelope(waveform.samples, ENVELOPE_SAMPLES),
    ccdf: computePaprCcdf(waveform.samples),
    histogram: computeMagnitudeHistogram(waveform.samples),
    spectrum: {
      frequency: normalizeSpectrumFrequency(
        spectrum.frequency,
        waveform.nominalBandwidth,
      ),
      magnitudeDb: spectrum.magnitudeDb,
    },
  };
}

function normalizeSpectrumFrequency(
  frequency: Float64Array,
  nominalBandwidth: number,
): Float64Array {
  const normalized = new Float64Array(frequency.length);
  const halfBandwidth = nominalBandwidth / 2;

  for (let index = 0; index < frequency.length; index += 1) {
    normalized[index] = frequency[index] / halfBandwidth;
  }

  return normalized;
}

function ifftShiftBins(frequencyBins: ComplexArray): ComplexArray {
  const shifted = createComplexArray(frequencyBins.i.length);
  const half = Math.floor(frequencyBins.i.length / 2);

  for (let index = 0; index < frequencyBins.i.length; index += 1) {
    const sourceIndex = (index + half) % frequencyBins.i.length;
    shifted.i[index] = frequencyBins.i[sourceIndex];
    shifted.q[index] = frequencyBins.q[sourceIndex];
  }

  return shifted;
}
