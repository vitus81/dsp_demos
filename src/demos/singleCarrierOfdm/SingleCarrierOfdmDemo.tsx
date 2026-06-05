import { useMemo, useState } from "react";
import {
  runWaveformComparison,
  type WaveformKind,
  type WaveformResult,
} from "../../shared/dsp/ofdm";
import type { DigitalModulation } from "../../shared/dsp/qpsk";
import { PlotPanel } from "../../shared/plot/PlotPanel";
import { ParameterSlider } from "../../shared/ui/ParameterSlider";

type DisplayMode = "all" | WaveformKind;

type SingleCarrierOfdmParams = {
  mode: DisplayMode;
  seed: number;
  rolloff: number;
  activeSubcarriers: number;
  modulation: DigitalModulation;
};

const MODE_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "single-carrier", label: "QPSK RRC" },
  { value: "ofdm", label: "OFDM" },
  { value: "dft-s-ofdm", label: "DFT-s-OFDM" },
];
const MODULATION_OPTIONS: DigitalModulation[] = ["QPSK", "16-QAM"];

const SPECTRUM_Y_RANGE: [number, number] = [-80, 5];
const ENVELOPE_Y_RANGE: [number, number] = [0, 3];
export const SIMULATION_BLOCKS = 1000;

export function SingleCarrierOfdmDemo() {
  const [params, setParams] = useState<SingleCarrierOfdmParams>({
    mode: "all",
    seed: 17,
    rolloff: 0.25,
    activeSubcarriers: 32,
    modulation: "QPSK",
  });

  const waveforms = useMemo(
    () =>
      runWaveformComparison({
        seed: params.seed,
        rolloff: params.rolloff,
        activeSubcarriers: params.activeSubcarriers,
        blockCount: SIMULATION_BLOCKS,
        modulation: params.modulation,
      }),
    [
      params.activeSubcarriers,
      params.modulation,
      params.rolloff,
      params.seed,
    ],
  );
  const visibleWaveforms = useMemo(
    () => selectWaveforms(waveforms, params.mode),
    [params.mode, waveforms],
  );
  const selectedWaveform = params.mode === "all" ? undefined : visibleWaveforms[0];

  function updateParam<Key extends keyof SingleCarrierOfdmParams>(
    key: Key,
    value: SingleCarrierOfdmParams[Key],
  ) {
    setParams((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="demo-workbench">
      <div className="demo-heading">
        <div>
          <p className="eyebrow">Digital Communications</p>
          <h1>Single-Carrier vs OFDM</h1>
          <p>
            Compare RRC-shaped QPSK, OFDM, and DFT-s-OFDM at the same nominal
            occupied bandwidth. The plots show why multicarrier waveforms tend
            to have higher PAPR and a wider IQ magnitude distribution.
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => updateParam("seed", params.seed + 1)}
        >
          Randomize symbols
        </button>
      </div>

      <section className="theory-band">
        <div>
          <h2>What to compare</h2>
          <p>
            Average power is normalized before measuring PAPR. OFDM sums many
            active subcarriers in time, so its envelope has deeper fades and
            taller peaks. DFT-s-OFDM keeps OFDM-style subcarrier mapping but
            spreads each block first, pulling the envelope closer to
            single-carrier behavior. The OFDM branches include a cyclic prefix
            on every transmitted block. Active subcarriers are contiguous
            modulation-bearing FFT bins centered around DC.
          </p>
        </div>
        <div
          className="formula-box"
          aria-label="PAPR formula: peak power divided by average power in decibels"
        >
          <div
            className="math-formula"
            dangerouslySetInnerHTML={{
              __html: `
                <math display="block">
                  <mrow>
                    <mi>PAPR</mi>
                    <mo>=</mo>
                    <mn>10</mn>
                    <msub>
                      <mi>log</mi>
                      <mn>10</mn>
                    </msub>
                    <mo>(</mo>
                    <mfrac>
                      <msub><mi>P</mi><mtext>peak</mtext></msub>
                      <msub><mi>P</mi><mtext>avg</mtext></msub>
                    </mfrac>
                    <mo>)</mo>
                  </mrow>
                </math>
              `,
            }}
          />
          <small>
            Spectra are plotted on an occupied-bandwidth-normalized frequency
            axis so the main lobes can be compared directly.
          </small>
        </div>
      </section>

      <div className="workbench-grid">
        <aside className="control-panel">
          <h2>Parameters</h2>
          <label className="parameter-control">
            <span className="parameter-label">
              View
              <strong>{MODE_OPTIONS.find((option) => option.value === params.mode)?.label}</strong>
            </span>
            <select
              className="parameter-select"
              value={params.mode}
              onChange={(event) =>
                updateParam("mode", event.target.value as DisplayMode)
              }
            >
              {MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="parameter-control">
            <span className="parameter-label">
              Modulation
              <strong>{params.modulation}</strong>
            </span>
            <select
              className="parameter-select"
              value={params.modulation}
              onChange={(event) =>
                updateParam(
                  "modulation",
                  event.target.value as DigitalModulation,
                )
              }
            >
              {MODULATION_OPTIONS.map((modulation) => (
                <option key={modulation} value={modulation}>
                  {modulation}
                </option>
              ))}
            </select>
          </label>
          <ParameterSlider
            label="RRC roll-off"
            value={params.rolloff}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => updateParam("rolloff", value)}
          />
          <ParameterSlider
            label="Active subcarriers"
            value={params.activeSubcarriers}
            min={8}
            max={52}
            step={4}
            onChange={(value) => updateParam("activeSubcarriers", value)}
          />

          <div className="metric-list">
            {visibleWaveforms.map((waveform) => (
              <div key={`${waveform.kind}-papr`}>
                <span>{waveform.label} PAPR</span>
                <strong>{waveform.paprDb.toFixed(2)} dB</strong>
              </div>
            ))}
            <div>
              <span>Average power</span>
              <strong>{formatAveragePower(visibleWaveforms)}</strong>
            </div>
            <div>
              <span>Nominal bandwidth</span>
              <strong>{visibleWaveforms[0]?.nominalBandwidth.toFixed(2)}</strong>
            </div>
            <div>
              <span>Blocks</span>
              <strong>{SIMULATION_BLOCKS}</strong>
            </div>
            <div>
              <span>Seed</span>
              <strong>{params.seed}</strong>
            </div>
          </div>
        </aside>

        <div className="plot-grid">
          <PlotPanel
            title="IQ envelope"
            xLabel="Sample index"
            yLabel="|I + jQ|"
            yRange={ENVELOPE_Y_RANGE}
            data={visibleWaveforms.map((waveform) => ({
              name: waveform.label,
              x: createIndexAxis(waveform.envelope.length),
              y: Array.from(waveform.envelope),
              type: "scatter",
              mode: "lines",
              line: { color: waveform.color, width: 1.8 },
            }))}
          />
          <PlotPanel
            title="PAPR CCDF"
            xLabel="Threshold above average power (dB)"
            yLabel="Probability"
            yScale="log"
            yRange={[1e-4, 1]}
            data={visibleWaveforms.map((waveform) => ({
              name: waveform.label,
              x: Array.from(waveform.ccdf.thresholdDb),
              y: Array.from(waveform.ccdf.probability),
              type: "scatter",
              mode: "lines",
              line: { color: waveform.color, width: 2 },
            }))}
          />
          <PlotPanel
            title="IQ magnitude histogram"
            xLabel="|I + jQ|"
            yLabel="Samples"
            barMode="overlay"
            data={visibleWaveforms.map((waveform) => ({
              name: waveform.label,
              x: Array.from(waveform.histogram.binCenters),
              y: Array.from(waveform.histogram.counts),
              type: "bar",
              marker: { color: waveform.color, opacity: 0.42 },
            }))}
          />
          <PlotPanel
            title="Matched-bandwidth spectrum"
            xLabel="Frequency / occupied bandwidth"
            yLabel="Magnitude (dB)"
            xRange={[-2.5, 2.5]}
            yRange={SPECTRUM_Y_RANGE}
            data={[
              ...createOccupiedBandwidthMarkers(SPECTRUM_Y_RANGE),
              ...visibleWaveforms.map((waveform) => ({
                name: waveform.label,
                x: Array.from(waveform.spectrum.frequency),
                y: Array.from(waveform.spectrum.magnitudeDb),
                type: "scatter" as const,
                mode: "lines" as const,
                line: { color: waveform.color, width: 1.9 },
              })),
            ]}
          />
          <section className="plot-panel">
            <h2>Why the OFDM tails stay visible</h2>
            <p>
              OFDM and DFT-s-OFDM are transmitted as rectangular blocks with a
              cyclic prefix. The prefix provides a guard interval for circular
              convolution, but it does not smooth the discontinuities between
              independent blocks. Those hard time edges create sidelobes that
              can sit around -20 dB below the in-band plateau; lowering them
              requires windowing or filtering, not just CP.
            </p>
          </section>
          {selectedWaveform ? (
            <PlotPanel
              title={`${selectedWaveform.label} constellation preview`}
              xLabel="In-phase"
              yLabel="Quadrature"
              xRange={[-1.6, 1.6]}
              yRange={[-1.6, 1.6]}
              squareAxes
              showLegend={false}
              data={[
                {
                  name: selectedWaveform.label,
                  x: Array.from(selectedWaveform.constellation.i),
                  y: Array.from(selectedWaveform.constellation.q),
                  type: "scatter",
                  mode: "markers",
                  marker: {
                    color: selectedWaveform.color,
                    size: 6,
                    opacity: 0.65,
                  },
                },
              ]}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function selectWaveforms(
  waveforms: WaveformResult[],
  mode: DisplayMode,
): WaveformResult[] {
  if (mode === "all") {
    return waveforms;
  }

  return waveforms.filter((waveform) => waveform.kind === mode);
}

function createIndexAxis(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}

function formatAveragePower(waveforms: WaveformResult[]): string {
  if (waveforms.length === 0) {
    return "n/a";
  }

  const min = Math.min(...waveforms.map((waveform) => waveform.averagePower));
  const max = Math.max(...waveforms.map((waveform) => waveform.averagePower));

  if (Math.abs(max - min) < 0.005) {
    return max.toFixed(2);
  }

  return `${min.toFixed(2)}-${max.toFixed(2)}`;
}

function createOccupiedBandwidthMarkers(yRange: [number, number]) {
  const [yMin, yMax] = yRange;

  return [
    {
      name: "Nominal occupied band",
      x: [-1, 1, 1, -1, -1],
      y: [yMin, yMin, yMax, yMax, yMin],
      type: "scatter" as const,
      mode: "lines" as const,
      fill: "toself" as const,
      fillcolor: "rgba(15, 118, 110, 0.08)",
      line: { color: "rgba(15, 118, 110, 0.18)", width: 1 },
      hoverinfo: "skip" as const,
      showlegend: false,
    },
  ];
}
