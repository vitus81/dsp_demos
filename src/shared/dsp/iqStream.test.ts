import { describe, expect, it } from "vitest";
import {
  appendRollingComplexSamples,
  decodeInterleavedInt16Iq,
} from "./iqStream";

describe("decodeInterleavedInt16Iq", () => {
  it("decodes little-endian signed int16 interleaved IQ samples", () => {
    const bytes = new ArrayBuffer(8);
    const view = new DataView(bytes);
    view.setInt16(0, 16384, true);
    view.setInt16(2, -16384, true);
    view.setInt16(4, -32768, true);
    view.setInt16(6, 32767, true);

    const decoded = decodeInterleavedInt16Iq(bytes);

    expect(Array.from(decoded.i)).toEqual([0.5, -1]);
    expect(decoded.q[0]).toBe(-0.5);
    expect(decoded.q[1]).toBeCloseTo(32767 / 32768, 12);
    expect(decoded.droppedBytes).toBe(0);
  });

  it("returns empty arrays for empty packets", () => {
    const decoded = decodeInterleavedInt16Iq(new ArrayBuffer(0));

    expect(decoded.i).toHaveLength(0);
    expect(decoded.q).toHaveLength(0);
    expect(decoded.droppedBytes).toBe(0);
  });

  it("drops incomplete trailing bytes", () => {
    const bytes = new ArrayBuffer(10);
    const view = new DataView(bytes);
    view.setInt16(0, 1000, true);
    view.setInt16(2, 2000, true);
    view.setInt16(4, 3000, true);
    view.setInt16(6, 4000, true);
    view.setInt16(8, 5000, true);

    const decoded = decodeInterleavedInt16Iq(bytes);

    expect(decoded.i).toHaveLength(2);
    expect(decoded.q).toHaveLength(2);
    expect(decoded.droppedBytes).toBe(2);
  });
});

describe("appendRollingComplexSamples", () => {
  it("keeps the newest samples within capacity", () => {
    const appended = appendRollingComplexSamples(
      {
        i: Float64Array.from([1, 2, 3]),
        q: Float64Array.from([4, 5, 6]),
      },
      {
        i: Float64Array.from([7, 8, 9]),
        q: Float64Array.from([10, 11, 12]),
      },
      4,
    );

    expect(Array.from(appended.i)).toEqual([3, 7, 8, 9]);
    expect(Array.from(appended.q)).toEqual([6, 10, 11, 12]);
  });
});
