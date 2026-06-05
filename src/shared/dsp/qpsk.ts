import { createSeededRandom } from "./random";
import type { ComplexSample } from "./types";

export type DigitalModulation = "QPSK" | "16-QAM";

const QPSK_POINTS: ComplexSample[] = [
  { i: 1, q: 1 },
  { i: -1, q: 1 },
  { i: -1, q: -1 },
  { i: 1, q: -1 },
];

const QAM16_LEVELS = [-3, -1, 1, 3];

export function generateSymbols(
  count: number,
  seed: number,
  modulation: DigitalModulation,
): ComplexSample[] {
  if (modulation === "16-QAM") {
    return generate16QamSymbols(count, seed);
  }

  return generateQpskSymbols(count, seed);
}

export function generateQpskSymbols(count: number, seed: number): ComplexSample[] {
  const random = createSeededRandom(seed);
  const scale = 1 / Math.sqrt(2);

  return Array.from({ length: count }, () => {
    const point = QPSK_POINTS[Math.floor(random() * QPSK_POINTS.length)];
    return { i: point.i * scale, q: point.q * scale };
  });
}

export function generate16QamSymbols(count: number, seed: number): ComplexSample[] {
  const random = createSeededRandom(seed);
  const scale = 1 / Math.sqrt(10);

  return Array.from({ length: count }, () => {
    const i = QAM16_LEVELS[Math.floor(random() * QAM16_LEVELS.length)];
    const q = QAM16_LEVELS[Math.floor(random() * QAM16_LEVELS.length)];
    return { i: i * scale, q: q * scale };
  });
}

export function oversampleSymbols(
  symbols: ComplexSample[],
  samplesPerSymbol: number,
): { i: Float64Array; q: Float64Array } {
  const sampleCount = symbols.length * samplesPerSymbol;
  const i = new Float64Array(sampleCount);
  const q = new Float64Array(sampleCount);

  symbols.forEach((symbol, symbolIndex) => {
    const sampleIndex = symbolIndex * samplesPerSymbol;
    i[sampleIndex] = symbol.i;
    q[sampleIndex] = symbol.q;
  });

  return { i, q };
}

export function oversampleSymbolsWithQuadratureDelay(
  symbols: ComplexSample[],
  samplesPerSymbol: number,
  quadratureDelaySamples: number,
): { i: Float64Array; q: Float64Array } {
  const sampleCount = symbols.length * samplesPerSymbol + quadratureDelaySamples;
  const i = new Float64Array(sampleCount);
  const q = new Float64Array(sampleCount);

  symbols.forEach((symbol, symbolIndex) => {
    const sampleIndex = symbolIndex * samplesPerSymbol;
    i[sampleIndex] = symbol.i;
    q[sampleIndex + quadratureDelaySamples] = symbol.q;
  });

  return { i, q };
}
