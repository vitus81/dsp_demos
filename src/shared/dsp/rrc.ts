export type RrcFilterParams = {
  rolloff: number;
  samplesPerSymbol: number;
  spanSymbols: number;
};

export function createRrcFilter(params: RrcFilterParams): Float64Array {
  const { rolloff, samplesPerSymbol, spanSymbols } = params;
  const tapCount = spanSymbols * samplesPerSymbol + 1;
  const center = Math.floor(tapCount / 2);
  const taps = new Float64Array(tapCount);

  for (let tapIndex = 0; tapIndex < tapCount; tapIndex += 1) {
    const timeInSymbols = (tapIndex - center) / samplesPerSymbol;
    taps[tapIndex] = rrcImpulseAt(timeInSymbols, rolloff);
  }

  normalizeEnergy(taps);
  return taps;
}

function rrcImpulseAt(timeInSymbols: number, rolloff: number): number {
  const beta = rolloff;
  const t = timeInSymbols;
  const pi = Math.PI;
  const epsilon = 1e-8;

  if (Math.abs(t) < epsilon) {
    return 1 + beta * (4 / pi - 1);
  }

  if (beta > 0 && Math.abs(Math.abs(t) - 1 / (4 * beta)) < epsilon) {
    const angle = pi / (4 * beta);
    return (
      (beta / Math.sqrt(2)) *
      ((1 + 2 / pi) * Math.sin(angle) + (1 - 2 / pi) * Math.cos(angle))
    );
  }

  if (beta === 0) {
    return Math.sin(pi * t) / (pi * t);
  }

  const numerator =
    Math.sin(pi * t * (1 - beta)) + 4 * beta * t * Math.cos(pi * t * (1 + beta));
  const denominator = pi * t * (1 - (4 * beta * t) ** 2);

  return numerator / denominator;
}

function normalizeEnergy(taps: Float64Array): void {
  const energy = taps.reduce((sum, tap) => sum + tap * tap, 0);
  const scale = Math.sqrt(energy);

  for (let index = 0; index < taps.length; index += 1) {
    taps[index] /= scale;
  }
}
