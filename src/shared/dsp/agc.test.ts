import { describe, expect, it } from "vitest";
import { settingToCoefficient, simulateAgc } from "./agc";

describe("AGC helpers", () => {
  it("generates deterministic simulations for the same seed", () => {
    const first = simulateAgc(baseOptions({ seed: 21 }));
    const second = simulateAgc(baseOptions({ seed: 21 }));

    expect(Array.from(first.input.slice(0, 24))).toEqual(
      Array.from(second.input.slice(0, 24)),
    );
    expect(Array.from(first.gain.slice(0, 24))).toEqual(
      Array.from(second.gain.slice(0, 24)),
    );
  });

  it("moves the output RMS toward the target after gain steps", () => {
    const targetLevel = 0.8;
    const simulation = simulateAgc(baseOptions({ targetLevel }));

    expect(simulation.finalOutputRms).toBeGreaterThan(targetLevel * 0.72);
    expect(simulation.finalOutputRms).toBeLessThan(targetLevel * 1.28);
  });

  it("settles sooner with a faster attack setting", () => {
    const slow = simulateAgc(baseOptions({ attackSetting: 1 }));
    const fast = simulateAgc(baseOptions({ attackSetting: 100 }));
    const slowAttackSettling = findStepSettlingTime(slow, 0.24, 0.5);
    const fastAttackSettling = findStepSettlingTime(fast, 0.24, 0.5);

    expect(fast.attackCoefficient).toBeGreaterThan(slow.attackCoefficient);
    expect(fastAttackSettling).toBeLessThan(slowAttackSettling);
  });

  it("uses the decay setting for downward gain corrections", () => {
    const slowDecay = simulateAgc(baseOptions({ decaySetting: 8 }));
    const fastDecay = simulateAgc(baseOptions({ decaySetting: 80 }));
    const highStepStart = Math.floor(slowDecay.gain.length * 0.5);
    const compareIndex = highStepStart + 180;

    expect(fastDecay.decayCoefficient).toBeGreaterThan(
      slowDecay.decayCoefficient,
    );
    expect(fastDecay.gain[compareIndex]).toBeLessThan(
      slowDecay.gain[compareIndex],
    );
  });

  it("reports the same coefficients used by the simulation", () => {
    const simulation = simulateAgc(
      baseOptions({ attackSetting: 37, decaySetting: 64 }),
    );

    expect(simulation.attackCoefficient).toBeCloseTo(settingToCoefficient(37), 12);
    expect(simulation.decayCoefficient).toBeCloseTo(settingToCoefficient(64), 12);
  });

  it("clamps gain to the configured maximum", () => {
    const simulation = simulateAgc(
      baseOptions({ maxGain: 1.5, stepSeverity: 4, attackSetting: 100 }),
    );
    const maxGain = Math.max(...simulation.gain);

    expect(maxGain).toBeLessThanOrEqual(1.5);
  });
});

function baseOptions(
  overrides: Partial<Parameters<typeof simulateAgc>[0]> = {},
): Parameters<typeof simulateAgc>[0] {
  return {
    sampleCount: 1600,
    seed: 7,
    targetLevel: 0.75,
    attackSetting: 45,
    decaySetting: 28,
    stepSeverity: 2.5,
    noiseLevel: 0.02,
    ...overrides,
  };
}

function findStepSettlingTime(
  simulation: ReturnType<typeof simulateAgc>,
  startRatio: number,
  endRatio: number,
): number {
  const windowLength = 64;
  const startIndex = Math.floor(simulation.output.length * startRatio);
  const endIndex = Math.floor(simulation.output.length * endRatio) - windowLength;
  const tolerance = 0.16 * 0.75;

  for (let index = startIndex; index <= endIndex; index += 1) {
    let energy = 0;

    for (let offset = 0; offset < windowLength; offset += 1) {
      const value = simulation.output[index + offset];
      energy += value * value;
    }

    if (Math.abs(Math.sqrt(energy / windowLength) - 0.75) <= tolerance) {
      return index;
    }
  }

  return Infinity;
}
