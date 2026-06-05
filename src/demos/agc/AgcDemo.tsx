import { useMemo, useState } from "react";
import { simulateAgc } from "../../shared/dsp/agc";
import { PlotPanel } from "../../shared/plot/PlotPanel";
import { ParameterSlider } from "../../shared/ui/ParameterSlider";

type AgcDemoParams = {
  targetLevel: number;
  attackSetting: number;
  decaySetting: number;
  stepSeverity: number;
  noiseLevel: number;
  seed: number;
};

const SAMPLE_COUNT = 1800;
const GAIN_Y_RANGE: [number, number] = [0, 5];

export function AgcDemo() {
  const [params, setParams] = useState<AgcDemoParams>({
    targetLevel: 0.75,
    attackSetting: 48,
    decaySetting: 24,
    stepSeverity: 2.5,
    noiseLevel: 0.03,
    seed: 17,
  });

  const simulation = useMemo(
    () =>
      simulateAgc({
        sampleCount: SAMPLE_COUNT,
        seed: params.seed,
        targetLevel: params.targetLevel,
        attackSetting: params.attackSetting,
        decaySetting: params.decaySetting,
        stepSeverity: params.stepSeverity,
        noiseLevel: params.noiseLevel,
      }),
    [params],
  );

  function updateParam<Key extends keyof AgcDemoParams>(
    key: Key,
    value: AgcDemoParams[Key],
  ) {
    setParams((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="demo-workbench">
      <div className="demo-heading">
        <div>
          <p className="eyebrow">Digital Communications</p>
          <h1>AGC Gain Step Explorer</h1>
          <p>
            Drive an automatic gain control loop with sudden input level changes
            and watch the internal measurement, loop gain, and normalized output
            settle back toward the target level.
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => updateParam("seed", params.seed + 1)}
        >
          Randomize noise
        </button>
      </div>

      <section className="theory-band agc-model-band">
        <div>
          <h2>Internal AGC model</h2>
          <p>
            The demo applies the current gain to each input sample, measures the
            output magnitude with a one-pole smoother, compares that measurement
            with the target level, then updates the gain. A positive error uses
            the attack coefficient to raise gain; a negative error uses the
            decay coefficient to reduce gain.
          </p>
        </div>
        <div
          className="formula-box"
          aria-label="AGC update equation"
        >
          <span>g[n+1] = clamp(g[n] * (1 + k * e[n] / target))</span>
          <small>
            e[n] = target - measuredLevel[n]. The user sliders choose friendly
            attack and decay settings; the displayed coefficients are the exact
            k values used by this update.
          </small>
        </div>
      </section>

      <div className="workbench-grid">
        <aside className="control-panel">
          <h2>Parameters</h2>
          <ParameterSlider
            label="Target output level"
            value={params.targetLevel}
            min={0.35}
            max={1.2}
            step={0.05}
            onChange={(value) => updateParam("targetLevel", value)}
          />
          <ParameterSlider
            label="Attack setting"
            value={params.attackSetting}
            min={1}
            max={100}
            step={1}
            onChange={(value) => updateParam("attackSetting", value)}
          />
          <ParameterSlider
            label="Decay setting"
            value={params.decaySetting}
            min={1}
            max={100}
            step={1}
            onChange={(value) => updateParam("decaySetting", value)}
          />
          <ParameterSlider
            label="Input step severity"
            value={params.stepSeverity}
            min={1.2}
            max={4}
            step={0.1}
            onChange={(value) => updateParam("stepSeverity", value)}
          />
          <ParameterSlider
            label="Noise level"
            value={params.noiseLevel}
            min={0}
            max={0.18}
            step={0.01}
            onChange={(value) => updateParam("noiseLevel", value)}
          />

          <div className="metric-list">
            <div>
              <span>Final output RMS</span>
              <strong>{simulation.finalOutputRms.toFixed(3)}</strong>
            </div>
            <div>
              <span>Peak overshoot</span>
              <strong>{simulation.peakOvershoot.toFixed(3)}</strong>
            </div>
            <div>
              <span>Settling time</span>
              <strong>{formatSettlingTime(simulation.settlingTimeSamples)}</strong>
            </div>
            <div>
              <span>Final AGC gain</span>
              <strong>{simulation.gain[simulation.gain.length - 1].toFixed(3)}</strong>
            </div>
            <div>
              <span>attackCoefficient</span>
              <strong>{simulation.attackCoefficient.toFixed(5)}</strong>
            </div>
            <div>
              <span>decayCoefficient</span>
              <strong>{simulation.decayCoefficient.toFixed(5)}</strong>
            </div>
            <div>
              <span>Attack time constant</span>
              <strong>
                {simulation.attackTimeConstantSamples.toFixed(1)} samples
              </strong>
            </div>
            <div>
              <span>Decay time constant</span>
              <strong>{simulation.decayTimeConstantSamples.toFixed(1)} samples</strong>
            </div>
            <div>
              <span>Seed</span>
              <strong>{params.seed}</strong>
            </div>
          </div>
        </aside>

        <div className="plot-grid">
          <PlotPanel
            title="Input waveform with gain steps"
            xLabel="Sample"
            yLabel="Amplitude"
            data={[
              {
                name: "Input",
                x: Array.from(simulation.time),
                y: Array.from(simulation.input),
                type: "scatter",
                mode: "lines",
                line: { color: "#2563eb", width: 1.3 },
              },
              {
                name: "Input gain",
                x: Array.from(simulation.time),
                y: Array.from(simulation.inputGain),
                type: "scatter",
                mode: "lines",
                line: { color: "#64748b", width: 1.2, dash: "dash" },
              },
            ]}
          />
          <PlotPanel
            title="AGC output waveform"
            xLabel="Sample"
            yLabel="Amplitude"
            data={[
              {
                name: "Output",
                x: Array.from(simulation.time),
                y: Array.from(simulation.output),
                type: "scatter",
                mode: "lines",
                line: { color: "#0f766e", width: 1.4 },
              },
            ]}
          />
          <PlotPanel
            title="Measured level and target"
            xLabel="Sample"
            yLabel="Magnitude"
            yRange={[0, params.targetLevel * 2.1]}
            data={[
              {
                name: "Input envelope",
                x: Array.from(simulation.time),
                y: Array.from(simulation.inputEnvelope),
                type: "scatter",
                mode: "lines",
                line: { color: "rgba(37, 99, 235, 0.45)", width: 1 },
              },
              {
                name: "Output envelope",
                x: Array.from(simulation.time),
                y: Array.from(simulation.outputEnvelope),
                type: "scatter",
                mode: "lines",
                line: { color: "rgba(15, 118, 110, 0.45)", width: 1 },
              },
              {
                name: "Measured level",
                x: Array.from(simulation.time),
                y: Array.from(simulation.measuredLevel),
                type: "scatter",
                mode: "lines",
                line: { color: "#dc2626", width: 2 },
              },
              {
                name: "Target",
                x: Array.from(simulation.time),
                y: Array.from(
                  { length: simulation.time.length },
                  () => params.targetLevel,
                ),
                type: "scatter",
                mode: "lines",
                line: { color: "#111827", width: 1, dash: "dash" },
              },
            ]}
          />
          <PlotPanel
            title="AGC gain and level error"
            xLabel="Sample"
            yLabel="Gain / Error"
            yRange={GAIN_Y_RANGE}
            data={[
              {
                name: "AGC gain",
                x: Array.from(simulation.time),
                y: Array.from(simulation.gain),
                type: "scatter",
                mode: "lines",
                line: { color: "#7c3aed", width: 2 },
              },
              {
                name: "Level error",
                x: Array.from(simulation.time),
                y: Array.from(simulation.error),
                type: "scatter",
                mode: "lines",
                line: { color: "#f59e0b", width: 1.4 },
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function formatSettlingTime(samples: number | null): string {
  return samples === null ? "Not settled" : `${samples} samples`;
}
