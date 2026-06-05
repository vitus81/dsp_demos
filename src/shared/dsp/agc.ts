export type AgcSimulationOptions = {
  sampleCount: number;
  seed: number;
  targetLevel: number;
  attackSetting: number;
  decaySetting: number;
  stepSeverity: number;
  noiseLevel: number;
  minGain?: number;
  maxGain?: number;
};

export type AgcSimulationResult = {
  time: Float64Array;
  input: Float64Array;
  output: Float64Array;
  inputEnvelope: Float64Array;
  outputEnvelope: Float64Array;
  measuredLevel: Float64Array;
  gain: Float64Array;
  error: Float64Array;
  inputGain: Float64Array;
  attackCoefficient: number;
  decayCoefficient: number;
  attackTimeConstantSamples: number;
  decayTimeConstantSamples: number;
  finalOutputRms: number;
  peakOvershoot: number;
  settlingTimeSamples: number | null;
};

const DEFAULT_MIN_GAIN = 0.05;
const DEFAULT_MAX_GAIN = 20;
const ENVELOPE_COEFFICIENT = 0.04;
const SETTLING_TOLERANCE = 0.08;

export function simulateAgc(
  options: AgcSimulationOptions,
): AgcSimulationResult {
  const attackCoefficient = settingToCoefficient(options.attackSetting);
  const decayCoefficient = settingToCoefficient(options.decaySetting);
  const minGain = options.minGain ?? DEFAULT_MIN_GAIN;
  const maxGain = options.maxGain ?? DEFAULT_MAX_GAIN;
  const time = new Float64Array(options.sampleCount);
  const input = new Float64Array(options.sampleCount);
  const output = new Float64Array(options.sampleCount);
  const inputEnvelope = new Float64Array(options.sampleCount);
  const outputEnvelope = new Float64Array(options.sampleCount);
  const measuredLevel = new Float64Array(options.sampleCount);
  const gain = new Float64Array(options.sampleCount);
  const error = new Float64Array(options.sampleCount);
  const inputGain = new Float64Array(options.sampleCount);
  const random = createSeededRandom(options.seed);
  let currentGain = 1;
  let currentMeasurement = options.targetLevel;

  for (let index = 0; index < options.sampleCount; index += 1) {
    const scriptedGain = gainStepAt(index, options.sampleCount, options.stepSeverity);
    const carrier =
      0.7 * Math.sin(2 * Math.PI * 0.031 * index) +
      0.35 * Math.sin(2 * Math.PI * 0.073 * index + 0.6);
    const noise = options.noiseLevel * gaussianRandom(random);
    const sample = scriptedGain * carrier + noise;
    const controlled = sample * currentGain;
    const magnitude = Math.abs(controlled);

    currentMeasurement +=
      ENVELOPE_COEFFICIENT * (magnitude - currentMeasurement);

    const levelError = options.targetLevel - currentMeasurement;
    const coefficient =
      levelError > 0 ? attackCoefficient : decayCoefficient;
    currentGain = clamp(
      currentGain * (1 + coefficient * levelError / options.targetLevel),
      minGain,
      maxGain,
    );

    time[index] = index;
    input[index] = sample;
    output[index] = controlled;
    inputEnvelope[index] = Math.abs(sample);
    outputEnvelope[index] = magnitude;
    measuredLevel[index] = currentMeasurement;
    gain[index] = currentGain;
    error[index] = levelError;
    inputGain[index] = scriptedGain;
  }

  return {
    time,
    input,
    output,
    inputEnvelope,
    outputEnvelope,
    measuredLevel,
    gain,
    error,
    inputGain,
    attackCoefficient,
    decayCoefficient,
    attackTimeConstantSamples: coefficientToTimeConstant(attackCoefficient),
    decayTimeConstantSamples: coefficientToTimeConstant(decayCoefficient),
    finalOutputRms: computeTailRms(output, Math.floor(options.sampleCount * 0.15)),
    peakOvershoot: computePeakOvershoot(outputEnvelope, options.targetLevel),
    settlingTimeSamples: findSettlingTime(output, options.targetLevel),
  };
}

export function settingToCoefficient(setting: number): number {
  const boundedSetting = clamp(setting, 1, 100);
  return 1 - Math.exp(-boundedSetting / 450);
}

function coefficientToTimeConstant(coefficient: number): number {
  return -1 / Math.log(1 - coefficient);
}

function gainStepAt(index: number, sampleCount: number, severity: number): number {
  const lowGain = 1 / severity;
  const highGain = severity;

  if (index < sampleCount * 0.24) {
    return 1;
  }

  if (index < sampleCount * 0.5) {
    return lowGain;
  }

  if (index < sampleCount * 0.74) {
    return highGain;
  }

  return 1;
}

function computeTailRms(values: Float64Array, tailLength: number): number {
  const startIndex = Math.max(0, values.length - tailLength);
  let energy = 0;

  for (let index = startIndex; index < values.length; index += 1) {
    energy += values[index] * values[index];
  }

  return Math.sqrt(energy / (values.length - startIndex));
}

function computePeakOvershoot(envelope: Float64Array, targetLevel: number): number {
  let maxOvershoot = 0;

  for (const value of envelope) {
    maxOvershoot = Math.max(maxOvershoot, value - targetLevel);
  }

  return maxOvershoot;
}

function findSettlingTime(output: Float64Array, targetLevel: number): number | null {
  const tolerance = targetLevel * SETTLING_TOLERANCE;
  const windowLength = 80;
  const startIndex = Math.floor(output.length * 0.74);

  for (let index = startIndex; index <= output.length - windowLength; index += 1) {
    let energy = 0;

    for (let offset = 0; offset < windowLength; offset += 1) {
      const value = output[index + offset];
      energy += value * value;
    }

    if (Math.abs(Math.sqrt(energy / windowLength) - targetLevel) <= tolerance) {
      return index;
    }
  }

  return null;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function gaussianRandom(random: () => number): number {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();

  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
