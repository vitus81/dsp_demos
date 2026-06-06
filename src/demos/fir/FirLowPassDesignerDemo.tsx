import { useMemo, useState } from "react";
import {
  FIR_WINDOWS,
  createWindowedLowPassFir,
  findBandwidthAtDb,
  getFirGroupDelay,
  getIntegerBits,
  quantizeFirCoefficients,
  type FirWindow,
} from "../../shared/dsp/fir";
import { computeSpectrumDb } from "../../shared/dsp/spectrum";
import { PlotPanel } from "../../shared/plot/PlotPanel";
import { ParameterSlider } from "../../shared/ui/ParameterSlider";

type FirDesignerParams = {
  cutoff: number;
  tapCount: number;
  window: FirWindow;
  kaiserBeta: number;
  wordLength: number;
  fractionalBits: number;
  exportFormat: ExportFormat;
};

type ExportFormat = "Float" | "Fixed-point integers";

const WORD_LENGTHS = [8, 16, 32];
const MIN_TAP_COUNT = 11;
const MAX_TAP_COUNT = 512;
const DEFAULT_PARAMS: FirDesignerParams = {
  cutoff: 0.16,
  tapCount: 63,
  window: "Hamming",
  kaiserBeta: 8,
  wordLength: 16,
  fractionalBits: 14,
  exportFormat: "Float",
};

export function FirLowPassDesignerDemo() {
  const [params, setParams] = useState<FirDesignerParams>(DEFAULT_PARAMS);
  const [copyStatus, setCopyStatus] = useState("Ready");
  const design = useMemo(() => runFirDesign(params), [params]);

  function updateParam<Key extends keyof FirDesignerParams>(
    key: Key,
    value: FirDesignerParams[Key],
  ) {
    setParams((current) => {
      if (key === "wordLength") {
        const wordLength = value as number;

        return {
          ...current,
          wordLength,
          fractionalBits: Math.min(current.fractionalBits, wordLength - 1),
        };
      }

      return { ...current, [key]: value };
    });
  }

  function updateTapCount(value: number) {
    updateParam("tapCount", clampTapCount(value));
  }

  async function copyCoefficients() {
    if (!navigator.clipboard) {
      setCopyStatus("Copy unavailable");
      return;
    }

    await navigator.clipboard.writeText(design.coefficientText);
    setCopyStatus("Copied");
  }

  return (
    <div className="demo-workbench">
      <div className="demo-heading">
        <div>
          <p className="eyebrow">General DSP</p>
          <h1>Windowed FIR Low-Pass Designer</h1>
          <p>
            Design a linear-phase low-pass FIR from an ideal sinc, choose the
            window, inspect the frequency response, and export comma-separated
            coefficients as floating-point taps or signed fixed-point integers.
          </p>
        </div>
      </div>

      <section className="theory-band">
        <div>
          <h2>Window method</h2>
          <p>
            The ideal low-pass impulse response is infinite. A finite window
            controls the trade-off between transition width and stopband ripple,
            then the taps are normalized for unity gain at DC.
          </p>
        </div>
        <div
          className="formula-box"
          aria-label="Ideal low-pass impulse response equation"
        >
          <div
            className="math-formula"
            dangerouslySetInnerHTML={{
              __html: `
                <math display="block">
                  <mrow>
                    <mi>h</mi>
                    <mo>[</mo>
                    <mi>n</mi>
                    <mo>]</mo>
                    <mo>=</mo>
                    <mn>2</mn>
                    <msub>
                      <mi>f</mi>
                      <mi>c</mi>
                    </msub>
                    <mo>*</mo>
                    <mi>sinc</mi>
                    <mo>(</mo>
                    <mn>2</mn>
                    <msub>
                      <mi>f</mi>
                      <mi>c</mi>
                    </msub>
                    <mi>n</mi>
                    <mo>)</mo>
                  </mrow>
                </math>
              `,
            }}
          />
          <small>Frequency is normalized to cycles/sample, so Nyquist is 0.5.</small>
        </div>
      </section>

      <div className="workbench-grid">
        <aside className="control-panel">
          <h2>Parameters</h2>
          <ParameterSlider
            label="Cutoff"
            value={params.cutoff}
            min={0.01}
            max={0.49}
            step={0.01}
            unit="cycles/sample"
            onChange={(value) => updateParam("cutoff", value)}
          />
          <ParameterSlider
            label="Filter length"
            value={params.tapCount}
            min={MIN_TAP_COUNT}
            max={MAX_TAP_COUNT}
            step={8}
            unit="taps"
            onChange={updateTapCount}
          />
          <label className="parameter-control">
            <span className="parameter-label">
              Exact filter length
              <strong>{params.tapCount} taps</strong>
            </span>
            <input
              className="parameter-input"
              type="number"
              value={params.tapCount}
              min={MIN_TAP_COUNT}
              max={MAX_TAP_COUNT}
              step={1}
              onChange={(event) => updateTapCount(Number(event.target.value))}
            />
          </label>
          <label className="parameter-control">
            <span className="parameter-label">
              Window
              <strong>{params.window}</strong>
            </span>
            <select
              className="parameter-select"
              value={params.window}
              onChange={(event) =>
                updateParam("window", event.target.value as FirWindow)
              }
            >
              {FIR_WINDOWS.map((window) => (
                <option key={window} value={window}>
                  {window}
                </option>
              ))}
            </select>
          </label>
          {params.window === "Kaiser" ? (
            <ParameterSlider
              label="Kaiser beta"
              value={params.kaiserBeta}
              min={0}
              max={14}
              step={0.5}
              onChange={(value) => updateParam("kaiserBeta", value)}
            />
          ) : null}

          <h2 className="control-section-heading">Export</h2>
          <label className="parameter-control">
            <span className="parameter-label">
              Format
              <strong>{params.exportFormat}</strong>
            </span>
            <select
              className="parameter-select"
              value={params.exportFormat}
              onChange={(event) =>
                updateParam("exportFormat", event.target.value as ExportFormat)
              }
            >
              <option value="Float">Float</option>
              <option value="Fixed-point integers">Fixed-point integers</option>
            </select>
          </label>
          <label className="parameter-control">
            <span className="parameter-label">
              Word length
              <strong>{params.wordLength} bit</strong>
            </span>
            <select
              className="parameter-select"
              value={params.wordLength}
              onChange={(event) =>
                updateParam("wordLength", Number(event.target.value))
              }
            >
              {WORD_LENGTHS.map((wordLength) => (
                <option key={wordLength} value={wordLength}>
                  {wordLength} bit
                </option>
              ))}
            </select>
          </label>
          <ParameterSlider
            label="Fractional bits"
            value={params.fractionalBits}
            min={0}
            max={params.wordLength - 1}
            step={1}
            onChange={(value) => updateParam("fractionalBits", value)}
          />

          <div className="metric-list">
            <div>
              <span>Group delay</span>
              <strong>{design.groupDelayText} samples</strong>
            </div>
            <div>
              <span>1 dB bandwidth</span>
              <strong>{design.bandwidth1DbText}</strong>
            </div>
            <div>
              <span>3 dB bandwidth</span>
              <strong>{design.bandwidth3DbText}</strong>
            </div>
            <div>
              <span>Q format</span>
              <strong>Q({design.integerBits}.{params.fractionalBits})</strong>
            </div>
            <div>
              <span>Scale</span>
              <strong>2^{params.fractionalBits}</strong>
            </div>
            <div>
              <span>Integer range</span>
              <strong>
                {design.quantized.minInteger} to {design.quantized.maxInteger}
              </strong>
            </div>
            <div>
              <span>Clipped taps</span>
              <strong>{design.quantized.clippedCount}</strong>
            </div>
          </div>
        </aside>

        <div className="plot-grid">
          <PlotPanel
            title="Impulse response"
            xLabel="Tap index"
            yLabel="Coefficient"
            data={[
              {
                name: "Float",
                x: design.tapIndex,
                y: Array.from(design.taps),
                type: "scatter",
                mode: "lines+markers",
                line: { color: "#0f766e", width: 2 },
                marker: { color: "#0f766e", size: 4 },
              },
              {
                name: "Quantized",
                x: design.tapIndex,
                y: Array.from(design.quantized.reconstructed),
                type: "scatter",
                mode: "markers",
                marker: { color: "#dc2626", size: 4, opacity: 0.75 },
              },
            ]}
          />
          <PlotPanel
            title="Magnitude response"
            xLabel="Normalized frequency"
            yLabel="Magnitude (dB)"
            xRange={[0, 0.5]}
            yRange={[-100, 5]}
            data={[
              {
                name: "Float",
                x: design.positiveFrequency,
                y: design.positiveMagnitudeDb,
                type: "scatter",
                mode: "lines",
                line: { color: "#334155", width: 2 },
              },
              {
                name: "Quantized",
                x: design.positiveQuantizedFrequency,
                y: design.positiveQuantizedMagnitudeDb,
                type: "scatter",
                mode: "lines",
                line: { color: "#dc2626", width: 1.6, dash: "dot" },
              },
            ]}
          />
          <PlotPanel
            title="Passband ripple"
            xLabel="Normalized frequency"
            yLabel="Magnitude (dB)"
            xRange={[0, design.passbandEdge]}
            yRange={[-0.25, 0.05]}
            data={[
              {
                name: "Float",
                x: design.passbandFrequency,
                y: design.passbandMagnitudeDb,
                type: "scatter",
                mode: "lines",
                line: { color: "#0f766e", width: 2 },
              },
              {
                name: "Quantized",
                x: design.passbandQuantizedFrequency,
                y: design.passbandQuantizedMagnitudeDb,
                type: "scatter",
                mode: "lines",
                line: { color: "#dc2626", width: 1.6, dash: "dot" },
              },
            ]}
          />
          <section className="plot-panel coefficient-panel">
            <h2>Comma-separated coefficients</h2>
            <textarea
              className="coefficient-output"
              readOnly
              value={design.coefficientText}
              aria-label="Comma-separated coefficients"
            />
            <div className="coefficient-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => void copyCoefficients()}
              >
                Copy coefficients
              </button>
              <span>{copyStatus}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function runFirDesign(params: FirDesignerParams) {
  const taps = createWindowedLowPassFir({
    cutoff: params.cutoff,
    tapCount: params.tapCount,
    window: params.window,
    kaiserBeta: params.kaiserBeta,
  });
  const quantized = quantizeFirCoefficients(taps, {
    wordLength: params.wordLength,
    fractionalBits: params.fractionalBits,
  });
  const spectrum = computeSpectrumDb(taps, 2048);
  const quantizedSpectrum = computeSpectrumDb(quantized.reconstructed, 2048);
  const positiveSpectrum = getPositiveSpectrum(
    spectrum.frequency,
    spectrum.magnitudeDb,
  );
  const positiveQuantizedSpectrum = getPositiveSpectrum(
    quantizedSpectrum.frequency,
    quantizedSpectrum.magnitudeDb,
  );
  const passbandEdge = Math.max(0.01, params.cutoff * 0.8);
  const passbandSpectrum = getBandLimitedSpectrum(
    positiveSpectrum.frequency,
    positiveSpectrum.magnitudeDb,
    passbandEdge,
  );
  const passbandQuantizedSpectrum = getBandLimitedSpectrum(
    positiveQuantizedSpectrum.frequency,
    positiveQuantizedSpectrum.magnitudeDb,
    passbandEdge,
  );
  const bandwidth1Db = findBandwidthAtDb(
    positiveSpectrum.frequency,
    positiveSpectrum.magnitudeDb,
    -1,
  );
  const bandwidth3Db = findBandwidthAtDb(
    positiveSpectrum.frequency,
    positiveSpectrum.magnitudeDb,
    -3,
  );
  const coefficientText =
    params.exportFormat === "Float"
      ? Array.from(taps, (tap) => tap.toPrecision(10)).join(", ")
      : Array.from(quantized.integers, (tap) => tap.toString()).join(", ");

  return {
    taps,
    quantized,
    coefficientText,
    integerBits: getIntegerBits(params.wordLength, params.fractionalBits),
    groupDelayText: formatGroupDelay(getFirGroupDelay(params.tapCount)),
    bandwidth1DbText: formatBandwidth(bandwidth1Db),
    bandwidth3DbText: formatBandwidth(bandwidth3Db),
    tapIndex: Array.from(taps, (_, index) => index),
    positiveFrequency: positiveSpectrum.frequency,
    positiveMagnitudeDb: positiveSpectrum.magnitudeDb,
    positiveQuantizedFrequency: positiveQuantizedSpectrum.frequency,
    positiveQuantizedMagnitudeDb: positiveQuantizedSpectrum.magnitudeDb,
    passbandEdge,
    passbandFrequency: passbandSpectrum.frequency,
    passbandMagnitudeDb: passbandSpectrum.magnitudeDb,
    passbandQuantizedFrequency: passbandQuantizedSpectrum.frequency,
    passbandQuantizedMagnitudeDb: passbandQuantizedSpectrum.magnitudeDb,
  };
}

function formatGroupDelay(groupDelay: number): string {
  return Number.isInteger(groupDelay)
    ? groupDelay.toFixed(0)
    : groupDelay.toFixed(1);
}

function formatBandwidth(bandwidth: { frequency: number | null; crossed: boolean }) {
  if (!bandwidth.crossed || bandwidth.frequency === null) {
    return "> 0.5000";
  }

  return bandwidth.frequency.toFixed(4);
}

function clampTapCount(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_TAP_COUNT;
  }

  return Math.min(MAX_TAP_COUNT, Math.max(MIN_TAP_COUNT, Math.round(value)));
}

function getPositiveSpectrum(frequency: Float64Array, magnitudeDb: Float64Array) {
  const positiveFrequency: number[] = [];
  const positiveMagnitudeDb: number[] = [];

  for (let index = 0; index < frequency.length; index += 1) {
    if (frequency[index] >= 0) {
      positiveFrequency.push(frequency[index]);
      positiveMagnitudeDb.push(magnitudeDb[index]);
    }
  }

  return {
    frequency: positiveFrequency,
    magnitudeDb: positiveMagnitudeDb,
  };
}

function getBandLimitedSpectrum(
  frequency: number[],
  magnitudeDb: number[],
  maxFrequency: number,
) {
  const limitedFrequency: number[] = [];
  const limitedMagnitudeDb: number[] = [];

  for (let index = 0; index < frequency.length; index += 1) {
    if (frequency[index] <= maxFrequency) {
      limitedFrequency.push(frequency[index]);
      limitedMagnitudeDb.push(magnitudeDb[index]);
    }
  }

  return {
    frequency: limitedFrequency,
    magnitudeDb: limitedMagnitudeDb,
  };
}
