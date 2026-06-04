import { createSeededRandom } from "./random";
import type { ComplexSample } from "./types";

const QPSK_POINTS: ComplexSample[] = [
  { i: 1, q: 1 },
  { i: -1, q: 1 },
  { i: -1, q: -1 },
  { i: 1, q: -1 },
];

export function generateQpskSymbols(count: number, seed: number): ComplexSample[] {
  const random = createSeededRandom(seed);
  const scale = 1 / Math.sqrt(2);

  return Array.from({ length: count }, () => {
    const point = QPSK_POINTS[Math.floor(random() * QPSK_POINTS.length)];
    return { i: point.i * scale, q: point.q * scale };
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
