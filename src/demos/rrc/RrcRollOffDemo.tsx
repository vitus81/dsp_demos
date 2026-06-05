import { useMemo, useState } from "react";
import { convolve } from "../../shared/dsp/convolution";
import { buildEyeDiagram } from "../../shared/dsp/eye";
import {
  generateSymbols,
  oversampleSymbols,
  oversampleSymbolsWithQuadratureDelay,
  type DigitalModulation,
} from "../../shared/dsp/qpsk";
import { createRrcFilter } from "../../shared/dsp/rrc";
import { computeSpectrumDb } from "../../shared/dsp/spectrum";
import { PlotPanel } from "../../shared/plot/PlotPanel";
import { ParameterSlider } from "../../shared/ui/ParameterSlider";

type RrcDemoParams = {
  modulation: RrcModulation;
  rolloff: number;
  samplesPerSymbol: number;
  spanSymbols: number;
  symbolCount: number;
  seed: number;
};

type RrcModulation = DigitalModulation | "OQPSK";

const MODULATION_OPTIONS: RrcModulation[] = ["QPSK", "16-QAM", "OQPSK"];
const SYMBOL_RATE = 1;
const QPSK_AXIS_LIMIT = Math.SQRT1_2;
const QAM16_AXIS_LIMIT = 3 / Math.sqrt(10);

export function RrcRollOffDemo() {
  const [params, setParams] = useState<RrcDemoParams>({
    modulation: "QPSK",
    rolloff: 0.35,
    samplesPerSymbol: 8,
    spanSymbols: 32,
    symbolCount: 96,
    seed: 7,
  });

  const simulation = useMemo(() => runRrcSimulation(params), [params]);

  function updateParam<Key extends keyof RrcDemoParams>(
    key: Key,
    value: RrcDemoParams[Key],
  ) {
    setParams((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="demo-workbench">
      <div className="demo-heading">
        <div>
          <p className="eyebrow">Digital Communications</p>
          <h1>RRC Roll-Off Explorer</h1>
          <p>
            Change the excess bandwidth of a root raised cosine pulse and watch
            the same parameter reshape the impulse response, occupied spectrum,
            IQ samples, and eye opening.
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
          <h2>Roll-off intuition</h2>
          <p>
            The roll-off factor alpha controls excess bandwidth. Smaller alpha
            packs the signal tighter in frequency; larger alpha gives the pulse
            more transition bandwidth and often a more forgiving eye.
          </p>
        </div>
        <div
          className="formula-box"
          aria-label="RRC bandwidth formula: bandwidth equals symbol rate times one plus alpha"
        >
          <div
            className="math-formula"
            dangerouslySetInnerHTML={{
              __html: `
                <math display="block">
                  <mrow>
                    <mi>B</mi>
                    <mo>=</mo>
                    <msub>
                      <mi>R</mi>
                      <mi>s</mi>
                    </msub>
                    <mo>(</mo>
                    <mn>1</mn>
                    <mo>+</mo>
                    <mi>α</mi>
                    <mo>)</mo>
                  </mrow>
                </math>
              `,
            }}
          />
          <small>Raised-cosine null-to-null bandwidth, normalized here with R_s = 1.</small>
        </div>
      </section>

      <div className="workbench-grid">
        <aside className="control-panel">
          <h2>Parameters</h2>
          <label className="parameter-control">
            <span className="parameter-label">
              Modulation
              <strong>{params.modulation}</strong>
            </span>
            <select
              className="parameter-select"
              value={params.modulation}
              onChange={(event) =>
                updateParam("modulation", event.target.value as RrcModulation)
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
            label="Roll-off alpha"
            value={params.rolloff}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(value) => updateParam("rolloff", value)}
          />
          <ParameterSlider
            label="Samples per symbol"
            value={params.samplesPerSymbol}
            min={4}
            max={16}
            step={2}
            onChange={(value) => updateParam("samplesPerSymbol", value)}
          />
          <ParameterSlider
            label="Filter span"
            value={params.spanSymbols}
            min={8}
            max={64}
            step={4}
            unit="symbols"
            onChange={(value) => updateParam("spanSymbols", value)}
          />
          <ParameterSlider
            label="Symbols"
            value={params.symbolCount}
            min={32}
            max={256}
            step={16}
            onChange={(value) => updateParam("symbolCount", value)}
          />

          <div className="metric-list">
            <div>
              <span>Filter taps</span>
              <strong>{simulation.filterTaps.length}</strong>
            </div>
            <div>
              <span>Seed</span>
              <strong>{params.seed}</strong>
            </div>
          </div>
        </aside>

        <div className="plot-grid">
          <PlotPanel
            title="RRC impulse response"
            xLabel="Symbols"
            yLabel="Amplitude"
            xRange={[-32, 32]}
            yRange={[-0.1, 0.5]}
            data={[
              {
                x: simulation.filterTime,
                y: Array.from(simulation.filterTaps),
                type: "scatter",
                mode: "lines",
                line: { color: "#0f766e", width: 2 },
              },
            ]}
          />
          <PlotPanel
            title="Filter magnitude response"
            xLabel="Normalized frequency f / Rs"
            yLabel="Magnitude (dB)"
            xRange={[-1, 1]}
            yRange={[-80, 5]}
            data={[
              {
                x: simulation.spectrumFrequency,
                y: simulation.spectrumMagnitudeDb,
                type: "scatter",
                mode: "lines",
                line: { color: "#334155", width: 2 },
              },
            ]}
          />
          <PlotPanel
            title="I/Q waveform"
            xLabel="Symbols"
            yLabel="Amplitude"
            xRange={[0, 24]}
            yRange={[-0.8, 0.8]}
            data={[
              {
                name: "I",
                x: simulation.waveformTime,
                y: simulation.waveformI,
                type: "scatter",
                mode: "lines",
                line: { color: "#2563eb", width: 1.8 },
              },
              {
                name: "Q",
                x: simulation.waveformTime,
                y: simulation.waveformQ,
                type: "scatter",
                mode: "lines",
                line: { color: "#dc2626", width: 1.8 },
              },
            ]}
          />
          <PlotPanel
            title="IQ trajectory"
            xLabel="In-phase"
            yLabel="Quadrature"
            xRange={[-simulation.iqAxisLimit, simulation.iqAxisLimit]}
            yRange={[-simulation.iqAxisLimit, simulation.iqAxisLimit]}
            squareAxes
            data={[
              {
                name: "Filtered samples",
                x: simulation.iqTrajectoryI,
                y: simulation.iqTrajectoryQ,
                type: "scatter",
                mode: "lines+markers",
                line: { color: "#7c3aed", width: 1.2 },
                marker: { color: "#7c3aed", size: 3, opacity: 0.55 },
              },
            ]}
          />
          <PlotPanel
            title="Eye diagram (I branch)"
            xLabel="Symbols"
            yLabel="Amplitude"
            yRange={[-0.8, 0.8]}
            showLegend={false}
            height={340}
            data={simulation.eyeTraces.map((trace) => ({
              x: simulation.eyeTime,
              y: Array.from(trace),
              type: "scatter",
              mode: "lines",
              line: { color: "#0f766e", width: 1 },
              opacity: 0.28,
              hoverinfo: "skip",
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function runRrcSimulation(params: RrcDemoParams) {
  const sampleRate = SYMBOL_RATE * params.samplesPerSymbol;
  const symbols = generateSymbols(
    params.symbolCount,
    params.seed,
    params.modulation === "16-QAM" ? "16-QAM" : "QPSK",
  );
  const oversampled =
    params.modulation === "OQPSK"
      ? oversampleSymbolsWithQuadratureDelay(
          symbols,
          params.samplesPerSymbol,
          params.samplesPerSymbol / 2,
        )
      : oversampleSymbols(symbols, params.samplesPerSymbol);
  const filterTaps = createRrcFilter({
    rolloff: params.rolloff,
    samplesPerSymbol: params.samplesPerSymbol,
    spanSymbols: params.spanSymbols,
  });

  const shapedI = convolve(oversampled.i, filterTaps);
  const shapedQ = convolve(oversampled.q, filterTaps);
  const groupDelay = Math.floor(filterTaps.length / 2);
  const alignedI = shapedI.slice(groupDelay, groupDelay + oversampled.i.length);
  const alignedQ = shapedQ.slice(groupDelay, groupDelay + oversampled.q.length);
  const spectrum = computeSpectrumDb(filterTaps);
  const eye = buildEyeDiagram(alignedI, params.samplesPerSymbol);

  const waveformSampleCount = Math.min(alignedI.length, params.samplesPerSymbol * 24);

  return {
    filterTaps,
    filterTime: Array.from(filterTaps, (_, index) => {
      const center = Math.floor(filterTaps.length / 2);
      return (index - center) / params.samplesPerSymbol;
    }),
    spectrumFrequency: Array.from(
      spectrum.frequency,
      (frequency) => frequency * params.samplesPerSymbol,
    ),
    spectrumMagnitudeDb: Array.from(spectrum.magnitudeDb),
    iqAxisLimit:
      params.modulation === "16-QAM" ? QAM16_AXIS_LIMIT : QPSK_AXIS_LIMIT,
    waveformTime: Array.from(
      { length: waveformSampleCount },
      (_, index) => index / sampleRate,
    ),
    waveformI: Array.from(alignedI.slice(0, waveformSampleCount)),
    waveformQ: Array.from(alignedQ.slice(0, waveformSampleCount)),
    iqTrajectoryI: Array.from(alignedI),
    iqTrajectoryQ: Array.from(alignedQ),
    eyeTime: Array.from(
      { length: params.samplesPerSymbol * 2 },
      (_, index) => index / params.samplesPerSymbol,
    ),
    eyeTraces: eye.traces,
  };
}
