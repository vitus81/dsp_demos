import { useMemo, useState } from "react";
import {
  applyInterpolationFir,
  computeRepeatBy2TheoryDb,
  createWindowedSincInterpolationFilter,
  generateBpskSamples,
  type InterpolationWindow,
  measureBandPeakDb,
  repeatBy2Normalized,
  zeroStuffBy2,
} from "../../shared/dsp/interpolation";
import { computeSpectrumDb, computeWelchPeriodogramDb } from "../../shared/dsp/spectrum";
import { PlotPanel } from "../../shared/plot/PlotPanel";
import { ParameterSlider } from "../../shared/ui/ParameterSlider";

type InterpolationDemoParams = {
  seed: number;
  filterLength: number;
  window: InterpolationWindow;
};

const SYMBOL_COUNT = 32768;
const TIME_SAMPLES = 16;
const FILTER_RESPONSE_FFT_SIZE = 1024;
const SIGNAL_FFT_SIZE = 256;
const SPECTRUM_SEGMENT_SIZE = 256;
const SPECTRUM_Y_RANGE: [number, number] = [-20, 0];
const WINDOWS: InterpolationWindow[] = ["Rectangular", "Hann", "Blackman"];

export function InterpolationDemo() {
  const [params, setParams] = useState<InterpolationDemoParams>({
    seed: 11,
    filterLength: 81,
    window: "Blackman",
  });

  const simulation = useMemo(() => runInterpolationSimulation(params), [params]);

  function updateParam<Key extends keyof InterpolationDemoParams>(
    key: Key,
    value: InterpolationDemoParams[Key],
  ) {
    setParams((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="demo-workbench">
      <div className="demo-heading">
        <div>
          <p className="eyebrow">General DSP</p>
          <h1>Interpolation x2: repeat vs zero-stuff</h1>
          <p>
            Compare two ways of preparing samples before the same windowed-sinc
            FIR: normalized repeat and zero-stuffing. The normalization gives
            both branches the same DC gain.
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => updateParam("seed", params.seed + 1)}
        >
          Randomize bits
        </button>
      </div>

      <section className="theory-band">
        <div>
          <h2>What to look for in the spectrum</h2>
          <p>
            After x2 upsampling, the old Nyquist limit lands at |f| = 0.25 in
            the new normalized frequency axis. The FIR is identical in both
            branches: only its input signal changes. The spectrum uses a Welch
            periodogram with a Hann window and 50% overlap. The repeat branch
            follows the theoretical [1/2, 1/2] boxcar envelope.
          </p>
        </div>
        <div
          className="formula-box"
          aria-label="Repeat theoretical response: absolute H repeat of f equals absolute cosine pi f"
        >
          <div
            className="math-formula"
            dangerouslySetInnerHTML={{
              __html: `
                <math display="block">
                  <mrow>
                    <mo>|</mo>
                    <msub>
                      <mi>H</mi>
                      <mtext>repeat</mtext>
                    </msub>
                    <mo>(</mo>
                    <mi>f</mi>
                    <mo>)</mo>
                    <mo>|</mo>
                    <mo>=</mo>
                    <mo>|</mo>
                    <mi>cos</mi>
                    <mo>(</mo>
                    <mi>π</mi>
                    <mi>f</mi>
                    <mo>)</mo>
                    <mo>|</mo>
                  </mrow>
                </math>
              `,
            }}
          />
          <small>
            For repeat / 2, equivalent to zero-stuffing followed by [1/2, 1/2].
          </small>
        </div>
      </section>

      <div className="workbench-grid">
        <aside className="control-panel">
          <h2>Parameters</h2>
          <label className="parameter-control">
            <span className="parameter-label">
              Window
              <strong>{params.window}</strong>
            </span>
            <select
              className="parameter-select"
              value={params.window}
              onChange={(event) =>
                updateParam("window", event.target.value as InterpolationWindow)
              }
            >
              {WINDOWS.map((window) => (
                <option key={window} value={window}>
                  {window}
                </option>
              ))}
            </select>
          </label>
          <ParameterSlider
            label="Filter length"
            value={params.filterLength}
            min={17}
            max={129}
            step={2}
            unit="taps"
            onChange={(value) => updateParam("filterLength", value)}
          />

          <div className="metric-list">
            <div>
              <span>Repeat/2 image peak</span>
              <strong>{simulation.repeatPreparedImagePeakDb.toFixed(1)} dB</strong>
            </div>
            <div>
              <span>Zero-stuff image peak</span>
              <strong>{simulation.zeroStuffPreparedImagePeakDb.toFixed(1)} dB</strong>
            </div>
            <div>
              <span>Shared FIR taps</span>
              <strong>{simulation.filterTaps}</strong>
            </div>
            <div>
              <span>Spectrum samples</span>
              <strong>{simulation.symbolCount}</strong>
            </div>
            <div>
              <span>Seed</span>
              <strong>{params.seed}</strong>
            </div>
          </div>
        </aside>

        <div className="plot-grid">
          <PlotPanel
            title="Original BPSK samples"
            xLabel="Original sample index"
            yLabel="Amplitude"
            yRange={[-1.25, 1.25]}
            data={[
              {
                x: simulation.originalTime,
                y: simulation.originalSamples,
                type: "scatter",
                mode: "lines+markers",
                line: { color: "#2563eb", width: 1.8, shape: "hv" },
                marker: { color: "#2563eb", size: 5 },
              },
            ]}
          />
          <PlotPanel
            title="Before the shared FIR"
            xLabel="Original sample index"
            yLabel="Amplitude"
            yRange={[-1.35, 1.35]}
            data={[
              {
                name: "Repeat / 2",
                x: simulation.interpolatedTime,
                y: simulation.repeatPreparedSamples,
                type: "scatter",
                mode: "lines+markers",
                line: { color: "#dc2626", width: 1.8, shape: "hv" },
                marker: { color: "#dc2626", size: 4 },
              },
              {
                name: "Zero-stuff",
                x: simulation.interpolatedTime,
                y: simulation.zeroStuffPreparedSamples,
                type: "scatter",
                mode: "lines+markers",
                line: { color: "#0f766e", width: 1.8 },
                marker: { color: "#0f766e", size: 4 },
              },
            ]}
          />
          <PlotPanel
            title="Windowed sinc filter response"
            xLabel="Normalized frequency"
            yLabel="Magnitude (dB)"
            xRange={[-0.5, 0.5]}
            yRange={[-90, 5]}
            data={[
              {
                name: params.window,
                x: simulation.filterFrequency,
                y: simulation.filterMagnitudeDb,
                type: "scatter",
                mode: "lines",
                line: { color: "#334155", width: 2 },
              },
            ]}
          />
          <PlotPanel
            title="After the same FIR"
            xLabel="Normalized frequency"
            yLabel="Magnitude (dB)"
            xRange={[-0.5, 0.5]}
            yRange={SPECTRUM_Y_RANGE}
            data={[
              ...simulation.imageBandMarkers,
              {
                name: "Repeat / 2 + FIR",
                x: simulation.signalFrequency,
                y: simulation.repeatFilteredMagnitudeDb,
                type: "scatter",
                mode: "lines",
                line: { color: "#dc2626", width: 1.7 },
              },
              {
                name: "Zero-stuff + FIR",
                x: simulation.signalFrequency,
                y: simulation.zeroStuffFilteredMagnitudeDb,
                type: "scatter",
                mode: "lines",
                line: { color: "#0f766e", width: 2 },
              },
              {
                name: "Repeat / 2 theory",
                x: simulation.signalFrequency,
                y: simulation.repeatTheoryMagnitudeDb,
                type: "scatter",
                mode: "lines",
                line: { color: "#111827", width: 1, dash: "dash" },
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function runInterpolationSimulation(params: InterpolationDemoParams) {
  const original = generateBpskSamples(SYMBOL_COUNT, params.seed);
  const filterTaps = createWindowedSincInterpolationFilter(
    params.filterLength,
    params.window,
  );
  const repeatPrepared = repeatBy2Normalized(original);
  const zeroStuffPrepared = zeroStuffBy2(original);
  const repeatFiltered = applyInterpolationFir(repeatPrepared, filterTaps);
  const zeroStuffFiltered = applyInterpolationFir(zeroStuffPrepared, filterTaps);
  const filterSpectrum = computeSpectrumDb(filterTaps, FILTER_RESPONSE_FFT_SIZE);
  const repeatPreparedSpectrum = computeWelchPeriodogramDb(repeatPrepared, {
    fftSize: SIGNAL_FFT_SIZE,
    segmentSize: SPECTRUM_SEGMENT_SIZE,
    overlapRatio: 0.5,
  });
  const zeroStuffPreparedSpectrum = computeWelchPeriodogramDb(
    zeroStuffPrepared,
    {
      fftSize: SIGNAL_FFT_SIZE,
      segmentSize: SPECTRUM_SEGMENT_SIZE,
      overlapRatio: 0.5,
    },
  );
  const repeatFilteredSpectrum = computeWelchPeriodogramDb(repeatFiltered, {
    fftSize: SIGNAL_FFT_SIZE,
    segmentSize: SPECTRUM_SEGMENT_SIZE,
    overlapRatio: 0.5,
  });
  const zeroStuffFilteredSpectrum = computeWelchPeriodogramDb(
    zeroStuffFiltered,
    {
      fftSize: SIGNAL_FFT_SIZE,
      segmentSize: SPECTRUM_SEGMENT_SIZE,
      overlapRatio: 0.5,
    },
  );
  const repeatTheoryMagnitudeDb = computeRepeatBy2TheoryDb(
    repeatFilteredSpectrum.frequency,
  );
  const imageBand = (frequency: number) => Math.abs(frequency) > 0.25;

  return {
    filterTaps: filterTaps.length,
    symbolCount: SYMBOL_COUNT,
    originalTime: Array.from({ length: TIME_SAMPLES }, (_, index) => index),
    originalSamples: Array.from(original.slice(0, TIME_SAMPLES)),
    interpolatedTime: Array.from(
      { length: TIME_SAMPLES * 2 },
      (_, index) => index / 2,
    ),
    repeatPreparedSamples: Array.from(repeatPrepared.slice(0, TIME_SAMPLES * 2)),
    zeroStuffPreparedSamples: Array.from(
      zeroStuffPrepared.slice(0, TIME_SAMPLES * 2),
    ),
    filterFrequency: Array.from(filterSpectrum.frequency),
    filterMagnitudeDb: Array.from(filterSpectrum.magnitudeDb),
    signalFrequency: Array.from(repeatFilteredSpectrum.frequency),
    repeatFilteredMagnitudeDb: Array.from(repeatFilteredSpectrum.magnitudeDb),
    zeroStuffFilteredMagnitudeDb: Array.from(
      zeroStuffFilteredSpectrum.magnitudeDb,
    ),
    repeatTheoryMagnitudeDb: Array.from(repeatTheoryMagnitudeDb),
    repeatPreparedImagePeakDb: measureBandPeakDb(
      repeatPreparedSpectrum.frequency,
      repeatPreparedSpectrum.magnitudeDb,
      imageBand,
    ),
    zeroStuffPreparedImagePeakDb: measureBandPeakDb(
      zeroStuffPreparedSpectrum.frequency,
      zeroStuffPreparedSpectrum.magnitudeDb,
      imageBand,
    ),
    imageBandMarkers: createImageBandMarkers(SPECTRUM_Y_RANGE),
  };
}

function createImageBandMarkers(yRange: [number, number]) {
  const [yMin, yMax] = yRange;

  return [
    {
      name: "Image band",
      x: [-0.5, -0.25, -0.25, -0.5, -0.5],
      y: [yMin, yMin, yMax, yMax, yMin],
      type: "scatter" as const,
      mode: "lines" as const,
      fill: "toself" as const,
      fillcolor: "rgba(220, 38, 38, 0.08)",
      line: { color: "rgba(220, 38, 38, 0.18)", width: 1 },
      hoverinfo: "skip" as const,
      showlegend: false,
    },
    {
      x: [0.25, 0.5, 0.5, 0.25, 0.25],
      y: [yMin, yMin, yMax, yMax, yMin],
      type: "scatter" as const,
      mode: "lines" as const,
      fill: "toself" as const,
      fillcolor: "rgba(220, 38, 38, 0.08)",
      line: { color: "rgba(220, 38, 38, 0.18)", width: 1 },
      hoverinfo: "skip" as const,
      showlegend: false,
    },
  ];
}
