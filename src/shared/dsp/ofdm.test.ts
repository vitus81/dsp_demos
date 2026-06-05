import { describe, expect, it } from "vitest";
import {
  createContiguousActiveSubcarrierBins,
  OFDM_CP_LENGTH,
  OFDM_FFT_SIZE,
  runWaveformComparison,
} from "./ofdm";

const DEFAULT_PARAMS = {
  seed: 17,
  rolloff: 0.25,
  activeSubcarriers: 32,
  blockCount: 32,
  modulation: "QPSK" as const,
};

describe("runWaveformComparison", () => {
  it("generates all waveform families", () => {
    const waveforms = runWaveformComparison(DEFAULT_PARAMS);

    expect(waveforms.map((waveform) => waveform.kind)).toEqual([
      "single-carrier",
      "ofdm",
      "dft-s-ofdm",
    ]);
  });

  it("is deterministic for a seed", () => {
    const first = runWaveformComparison(DEFAULT_PARAMS);
    const second = runWaveformComparison(DEFAULT_PARAMS);

    first.forEach((waveform, index) => {
      expect(waveform.paprDb).toBeCloseTo(second[index].paprDb, 12);
      expect(Array.from(waveform.envelope.slice(0, 12))).toEqual(
        Array.from(second[index].envelope.slice(0, 12)),
      );
    });
  });

  it("normalizes average power before comparison", () => {
    const waveforms = runWaveformComparison(DEFAULT_PARAMS);

    waveforms.forEach((waveform) => {
      expect(waveform.averagePower).toBeCloseTo(1, 10);
    });
  });

  it("includes a cyclic prefix on OFDM-family transmitted blocks", () => {
    const waveforms = runWaveformComparison(DEFAULT_PARAMS);
    const blockLength = OFDM_FFT_SIZE + OFDM_CP_LENGTH;

    waveforms
      .filter((waveform) => waveform.kind !== "single-carrier")
      .forEach((waveform) => {
        expect(waveform.samples.i).toHaveLength(
          DEFAULT_PARAMS.blockCount * blockLength,
        );

        for (let block = 0; block < DEFAULT_PARAMS.blockCount; block += 1) {
          const blockOffset = block * blockLength;

          for (let cpIndex = 0; cpIndex < OFDM_CP_LENGTH; cpIndex += 1) {
            const cpSample = blockOffset + cpIndex;
            const tailSample =
              blockOffset + OFDM_CP_LENGTH + OFDM_FFT_SIZE - OFDM_CP_LENGTH + cpIndex;

            expect(waveform.samples.i[cpSample]).toBeCloseTo(
              waveform.samples.i[tailSample],
              12,
            );
            expect(waveform.samples.q[cpSample]).toBeCloseTo(
              waveform.samples.q[tailSample],
              12,
            );
          }
        }
      });
  });

  it("keeps PAPR CCDF probabilities positive for log plotting", () => {
    const waveforms = runWaveformComparison(DEFAULT_PARAMS);

    waveforms.forEach((waveform) => {
      expect(Math.min(...Array.from(waveform.ccdf.probability))).toBeGreaterThan(0);
    });
  });

  it("uses the same nominal occupied bandwidth for every waveform", () => {
    const waveforms = runWaveformComparison(DEFAULT_PARAMS);
    const bandwidths = waveforms.map((waveform) => waveform.nominalBandwidth);

    expect(new Set(bandwidths).size).toBe(1);
    expect(bandwidths[0]).toBeCloseTo(32 / 64, 12);
  });

  it("maps active subcarriers as a DC-inclusive contiguous bin group", () => {
    const bins = createContiguousActiveSubcarrierBins(8);
    const dcBin = OFDM_FFT_SIZE / 2;

    expect(bins).toEqual([28, 29, 30, 31, 32, 33, 34, 35]);
    expect(bins).toContain(dcBin);
  });

  it("places the single-carrier spectrum near the matched bandwidth marker", () => {
    const [singleCarrier] = runWaveformComparison(DEFAULT_PARAMS);
    const occupiedFrequencies = Array.from(
      singleCarrier.spectrum.frequency,
    ).filter(
      (frequency, index) =>
        Math.abs(frequency) <= 1.25 &&
        singleCarrier.spectrum.magnitudeDb[index] > -18,
    );

    expect(Math.max(...occupiedFrequencies.map(Math.abs))).toBeGreaterThan(0.75);
  });
});
