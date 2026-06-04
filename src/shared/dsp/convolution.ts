export function convolve(signal: Float64Array, kernel: Float64Array): Float64Array {
  const output = new Float64Array(signal.length + kernel.length - 1);

  for (let signalIndex = 0; signalIndex < signal.length; signalIndex += 1) {
    const signalValue = signal[signalIndex];

    if (signalValue === 0) {
      continue;
    }

    for (let kernelIndex = 0; kernelIndex < kernel.length; kernelIndex += 1) {
      output[signalIndex + kernelIndex] += signalValue * kernel[kernelIndex];
    }
  }

  return output;
}
