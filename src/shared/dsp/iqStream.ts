export type ComplexSampleBlock = {
  i: Float64Array;
  q: Float64Array;
  droppedBytes: number;
};

const INT16_SCALE = 32768;
const BYTES_PER_IQ_SAMPLE = 4;

export function decodeInterleavedInt16Iq(
  payload: ArrayBuffer,
): ComplexSampleBlock {
  const completeBytes =
    payload.byteLength - (payload.byteLength % BYTES_PER_IQ_SAMPLE);
  const sampleCount = completeBytes / BYTES_PER_IQ_SAMPLE;
  const view = new DataView(payload);
  const i = new Float64Array(sampleCount);
  const q = new Float64Array(sampleCount);

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const byteOffset = sample * BYTES_PER_IQ_SAMPLE;
    i[sample] = view.getInt16(byteOffset, true) / INT16_SCALE;
    q[sample] = view.getInt16(byteOffset + 2, true) / INT16_SCALE;
  }

  return {
    i,
    q,
    droppedBytes: payload.byteLength - completeBytes,
  };
}

export function appendRollingComplexSamples(
  current: { i: Float64Array; q: Float64Array },
  incoming: { i: Float64Array; q: Float64Array },
  capacity: number,
): { i: Float64Array; q: Float64Array } {
  const incomingLength = Math.min(incoming.i.length, incoming.q.length);
  const safeCapacity = Math.max(0, capacity);

  if (safeCapacity === 0) {
    return { i: new Float64Array(0), q: new Float64Array(0) };
  }

  if (incomingLength >= safeCapacity) {
    return {
      i: incoming.i.slice(incomingLength - safeCapacity, incomingLength),
      q: incoming.q.slice(incomingLength - safeCapacity, incomingLength),
    };
  }

  const currentLength = Math.min(current.i.length, current.q.length);
  const retainedLength = Math.min(currentLength, safeCapacity - incomingLength);
  const next = {
    i: new Float64Array(retainedLength + incomingLength),
    q: new Float64Array(retainedLength + incomingLength),
  };
  const retainedStart = currentLength - retainedLength;

  next.i.set(current.i.slice(retainedStart, currentLength), 0);
  next.q.set(current.q.slice(retainedStart, currentLength), 0);
  next.i.set(incoming.i.slice(0, incomingLength), retainedLength);
  next.q.set(incoming.q.slice(0, incomingLength), retainedLength);

  return next;
}
