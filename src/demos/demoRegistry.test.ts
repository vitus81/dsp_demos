import { describe, expect, it } from "vitest";
import { demoRegistry, getDemoById } from "./demoRegistry";

describe("demoRegistry", () => {
  it("contains demos with route-friendly metadata", () => {
    expect(demoRegistry.length).toBeGreaterThan(0);

    demoRegistry.forEach((demo) => {
      expect(demo.id).toMatch(/^[a-z0-9-]+$/);
      expect(demo.title).toBeTruthy();
      expect(demo.description).toBeTruthy();
      expect(demo.category).toMatch(/Digital Communications|General DSP/);
      expect(demo.component).toBeTypeOf("function");
    });
  });

  it("finds demos by id", () => {
    expect(getDemoById("rrc-rolloff")?.title).toBe("RRC Roll-Off Explorer");
    expect(getDemoById("interpolation-x2")?.title).toBe(
      "Interpolation x2: repeat vs zero-stuff",
    );
    expect(getDemoById("fir-low-pass-designer")?.title).toBe(
      "Windowed FIR Low-Pass Designer",
    );
    expect(getDemoById("single-carrier-ofdm")?.title).toBe(
      "Single-Carrier vs OFDM",
    );
    expect(getDemoById("live-iq-spectrum")?.title).toBe("Live IQ Spectrum");
    expect(getDemoById("live-audio-analyzer")?.title).toBe(
      "Live Microphone Audio Analyzer",
    );
  });
});
