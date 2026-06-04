export type ComplexSample = {
  i: number;
  q: number;
};

export type ComplexSignal = {
  i: Float64Array;
  q: Float64Array;
  sampleRate: number;
};

export type RealSignal = {
  samples: Float64Array;
  sampleRate: number;
};

export type EyeDiagram = {
  traces: Float64Array[];
  samplesPerSymbol: number;
};
