import { useEffect, useMemo, useRef, useState } from "react";
import {
  appendRollingRealSamples,
  computeAudioLevelMetrics,
  findDominantFrequencyHz,
} from "../../shared/dsp/audioAnalysis";
import {
  computeWelchPeriodogramDb,
  type Spectrum,
} from "../../shared/dsp/spectrum";
import { PlotPanel } from "../../shared/plot/PlotPanel";

type AnalyzerStatus =
  | "idle"
  | "requesting"
  | "active"
  | "paused"
  | "unsupported"
  | "denied"
  | "error";

type AudioInputDevice = {
  deviceId: string;
  label: string;
};

type AudioProcessorEvent = {
  inputBuffer: {
    numberOfChannels: number;
    getChannelData(channel: number): Float32Array;
  };
};

type BrowserAudioWindow = {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

type BrowserMediaDevices = {
  getUserMedia?: MediaDevices["getUserMedia"];
};

const FFT_SIZE_OPTIONS = [512, 1024, 2048, 4096];
const BUFFER_SIZE_OPTIONS = [4096, 8192, 16384, 32768];
const Y_RANGE_OPTIONS = [
  { label: "60 dB", value: 60 },
  { label: "80 dB", value: 80 },
  { label: "100 dB", value: 100 },
];
const WATERFALL_COLOR_SCALE_OPTIONS = ["Viridis", "Cividis", "Turbo", "Jet"];
const EMPTY_BUFFER = new Float64Array(0);
const PLOT_UPDATE_MS = 120;
const WATERFALL_HISTORY_LENGTH = 90;
const PROCESSOR_BUFFER_SIZE = 2048;

export function LiveAudioAnalyzerDemo() {
  const [status, setStatus] = useState<AnalyzerStatus>(() =>
    isMicrophoneSupported() ? "idle" : "unsupported",
  );
  const [fftSize, setFftSize] = useState(2048);
  const [bufferSize, setBufferSize] = useState(16384);
  const [yRangeDb, setYRangeDb] = useState(80);
  const [waterfallColorScale, setWaterfallColorScale] = useState("Viridis");
  const [isPlotPaused, setIsPlotPaused] = useState(false);
  const [sampleRate, setSampleRate] = useState(48000);
  const [plotBuffer, setPlotBuffer] = useState<Float64Array>(EMPTY_BUFFER);
  const [waterfallRows, setWaterfallRows] = useState<number[][]>([]);
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [message, setMessage] = useState(
    isMicrophoneSupported()
      ? "Microphone capture is ready."
      : "This browser does not expose microphone capture.",
  );
  const [metrics, setMetrics] = useState({
    sampleCount: 0,
    callbackRate: 0,
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const rollingBufferRef = useRef<Float64Array>(EMPTY_BUFFER);
  const sampleCountRef = useRef(0);
  const callbackCountRef = useRef(0);
  const lastRateCallbackCountRef = useRef(0);
  const lastRateTimestampRef = useRef(performance.now());
  const bufferSizeRef = useRef(bufferSize);
  const isPlotPausedRef = useRef(isPlotPaused);
  const plotTimerRef = useRef<number | undefined>(undefined);
  const rateTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    isPlotPausedRef.current = isPlotPaused;
  }, [isPlotPaused]);

  useEffect(() => {
    bufferSizeRef.current = bufferSize;
    rollingBufferRef.current = appendRollingRealSamples(
      EMPTY_BUFFER,
      rollingBufferRef.current,
      bufferSize,
    );
    setPlotBuffer(rollingBufferRef.current);
  }, [bufferSize]);

  useEffect(() => {
    plotTimerRef.current = window.setInterval(() => {
      if (!isPlotPausedRef.current) {
        setPlotBuffer(rollingBufferRef.current);
      }
    }, PLOT_UPDATE_MS);

    rateTimerRef.current = window.setInterval(() => {
      const now = performance.now();
      const elapsedSeconds = Math.max(
        (now - lastRateTimestampRef.current) / 1000,
        1e-6,
      );
      const callbackDelta =
        callbackCountRef.current - lastRateCallbackCountRef.current;

      setMetrics((current) => ({
        ...current,
        callbackRate: callbackDelta / elapsedSeconds,
      }));
      lastRateCallbackCountRef.current = callbackCountRef.current;
      lastRateTimestampRef.current = now;
    }, 1000);

    return () => {
      if (plotTimerRef.current) {
        window.clearInterval(plotTimerRef.current);
      }
      if (rateTimerRef.current) {
        window.clearInterval(rateTimerRef.current);
      }
      stopAudioGraph();
    };
  }, []);

  const spectrum = useMemo(() => {
    if (plotBuffer.length < Math.min(fftSize, 16)) {
      return undefined;
    }

    return computeWelchPeriodogramDb(plotBuffer, {
      fftSize,
      segmentSize: fftSize,
      overlapRatio: 0.5,
    });
  }, [fftSize, plotBuffer]);

  useEffect(() => {
    if (!spectrum) {
      return;
    }

    const positiveSpectrum = createPositiveSpectrum(spectrum);

    if (!positiveSpectrum) {
      return;
    }

    setWaterfallRows((current) => [
      ...current.slice(-(WATERFALL_HISTORY_LENGTH - 1)),
      Array.from(positiveSpectrum.magnitudeDb),
    ]);
  }, [spectrum]);

  useEffect(() => {
    setWaterfallRows([]);
  }, [fftSize]);

  const levelMetrics = useMemo(
    () => computeAudioLevelMetrics(plotBuffer),
    [plotBuffer],
  );
  const positiveSpectrum = useMemo(() => createPositiveSpectrum(spectrum), [spectrum]);
  const dominantFrequencyHz = useMemo(
    () => findDominantFrequencyHz(positiveSpectrum, sampleRate),
    [positiveSpectrum, sampleRate],
  );
  const timeAxisMs = useMemo(() => {
    const visibleSamples = createWaveformSamples(plotBuffer);
    return Array.from(visibleSamples, (_, index) =>
      sampleRate > 0
        ? ((index - visibleSamples.length + 1) / sampleRate) * 1000
        : index,
    );
  }, [plotBuffer, sampleRate]);
  const waveform = useMemo(() => createWaveformSamples(plotBuffer), [plotBuffer]);
  const positiveSpectrumFrequencyHz = positiveSpectrum
    ? Array.from(
        positiveSpectrum.frequency,
        (frequency) => frequency * sampleRate,
      )
    : [];
  const positiveSpectrumMagnitudeDb = positiveSpectrum
    ? Array.from(positiveSpectrum.magnitudeDb)
    : [];
  const logSpectrumStartIndex = positiveSpectrumFrequencyHz.findIndex(
    (frequency) => frequency >= 20,
  );
  const logSpectrumFrequencyHz =
    logSpectrumStartIndex >= 0
      ? positiveSpectrumFrequencyHz.slice(logSpectrumStartIndex)
      : [];
  const logSpectrumMagnitudeDb =
    logSpectrumStartIndex >= 0
      ? positiveSpectrumMagnitudeDb.slice(logSpectrumStartIndex)
      : [];
  const logSpectrumXRange: [number, number] =
    logSpectrumFrequencyHz.length > 0
      ? [
          logSpectrumFrequencyHz[0],
          logSpectrumFrequencyHz[logSpectrumFrequencyHz.length - 1],
        ]
      : [20, sampleRate / 2];
  const isCapturing = status === "active" || status === "paused";
  const bufferFillPercent = Math.round(
    (Math.min(plotBuffer.length, bufferSize) / bufferSize) * 100,
  );
  const rmsLabel = formatDbfs(levelMetrics.rmsDbfs);
  const peakLabel = formatDbfs(levelMetrics.peakDbfs);
  const dominantLabel =
    dominantFrequencyHz === undefined
      ? "n/a"
      : `${dominantFrequencyHz.toFixed(1)} Hz`;
  const levelPercent = Math.min(100, Math.round(levelMetrics.peakAmplitude * 100));

  async function start() {
    if (!isMicrophoneSupported()) {
      setStatus("unsupported");
      setMessage("This browser does not expose microphone capture.");
      return;
    }

    setStatus("requesting");
    setMessage("Waiting for microphone permission.");
    resetAnalyzerState();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : true,
      });
      const AudioContextConstructor = getAudioContextConstructor();

      if (!AudioContextConstructor) {
        stream.getTracks().forEach((track) => track.stop());
        setStatus("unsupported");
        setMessage("This browser does not expose microphone capture.");
        return;
      }

      const audioContext = new AudioContextConstructor();

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const sourceNode = audioContext.createMediaStreamSource(stream);
      const processorNode = audioContext.createScriptProcessor(
        PROCESSOR_BUFFER_SIZE,
        1,
        1,
      );

      processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
        receiveAudioFrame(event);
      };
      sourceNode.connect(processorNode);
      processorNode.connect(audioContext.destination);

      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceNodeRef.current = sourceNode;
      processorNodeRef.current = processorNode;
      setSampleRate(audioContext.sampleRate);
      setStatus(audioContext.state === "suspended" ? "paused" : "active");
      setMessage("Microphone analyzer is running.");
      refreshInputDevices();
    } catch (error) {
      stopAudioGraph();
      if (isPermissionDenied(error)) {
        setStatus("denied");
        setMessage("Microphone permission was denied.");
      } else {
        setStatus("error");
        setMessage("Microphone capture could not be started.");
      }
    }
  }

  function stop() {
    stopAudioGraph();
    setStatus("idle");
    setMessage("Microphone capture stopped.");
  }

  async function refreshInputDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = mediaDevices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
        }));

      setDevices(audioInputs);
      if (audioInputs.length === 0) {
        setMessage("No microphone input devices were found.");
      }
    } catch {
      setDevices([]);
    }
  }

  function receiveAudioFrame(event: AudioProcessorEvent) {
    const inputBuffer = event.inputBuffer;
    const channelCount = Math.max(1, inputBuffer.numberOfChannels);
    const firstChannel = inputBuffer.getChannelData(0);
    const frame = new Float64Array(firstChannel.length);

    for (let channel = 0; channel < channelCount; channel += 1) {
      const channelData = inputBuffer.getChannelData(channel);

      for (let index = 0; index < channelData.length; index += 1) {
        frame[index] += channelData[index] / channelCount;
      }
    }

    rollingBufferRef.current = appendRollingRealSamples(
      rollingBufferRef.current,
      frame,
      bufferSizeRef.current,
    );
    sampleCountRef.current += frame.length;
    callbackCountRef.current += 1;
    setMetrics((current) => ({
      ...current,
      sampleCount: sampleCountRef.current,
    }));
  }

  function resetAnalyzerState() {
    rollingBufferRef.current = EMPTY_BUFFER;
    setPlotBuffer(EMPTY_BUFFER);
    setWaterfallRows([]);
    sampleCountRef.current = 0;
    callbackCountRef.current = 0;
    lastRateCallbackCountRef.current = 0;
    lastRateTimestampRef.current = performance.now();
    setMetrics({
      sampleCount: 0,
      callbackRate: 0,
    });
  }

  function stopAudioGraph() {
    processorNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    processorNodeRef.current = null;
    sourceNodeRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  return (
    <div className="demo-workbench">
      <div className="demo-heading">
        <div>
          <p className="eyebrow">General DSP</p>
          <h1>Live Microphone Audio Analyzer</h1>
          <p>
            Capture microphone audio in the browser, convert it to mono samples,
            and watch the rolling waveform, FFT spectrum, waterfall, and dBFS
            levels update in real time.
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setIsPlotPaused((current) => !current)}
        >
          {isPlotPaused ? "Resume plots" : "Pause plots"}
        </button>
      </div>

      <section className="theory-band">
        <div>
          <h2>Audio analysis path</h2>
          <p>
            The demo uses Web Audio microphone frames, averages channels to mono,
            stores a rolling sample window, and estimates a Hann-windowed Welch
            spectrum. Levels are shown relative to full-scale browser samples.
          </p>
        </div>
        <div className="formula-box">
          <span>mono[n] = average(channels[n])</span>
          <small>Frequency is plotted in Hz from the active audio sample rate.</small>
        </div>
      </section>

      <div className="workbench-grid">
        <aside className="control-panel">
          <h2>Microphone</h2>
          <button
            className="secondary-button full-width-button"
            type="button"
            onClick={isCapturing ? stop : start}
            disabled={status === "requesting" || status === "unsupported"}
          >
            {isCapturing ? "Stop microphone" : "Start microphone"}
          </button>
          <label className="parameter-control audio-device-control">
            <span className="parameter-label">
              Input device
              <strong>{devices.length || "default"}</strong>
            </span>
            <select
              className="parameter-select"
              value={selectedDeviceId}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
              disabled={isCapturing}
              aria-label="Input device"
            >
              <option value="">Default microphone</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>

          <h2 className="control-section-heading">Analyzer</h2>
          <label className="parameter-control">
            <span className="parameter-label">
              FFT size
              <strong>{fftSize}</strong>
            </span>
            <select
              className="parameter-select"
              value={fftSize}
              onChange={(event) => setFftSize(Number(event.target.value))}
              aria-label="FFT size"
            >
              {FFT_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="parameter-control">
            <span className="parameter-label">
              Rolling buffer
              <strong>{bufferSize} samples</strong>
            </span>
            <select
              className="parameter-select"
              value={bufferSize}
              onChange={(event) => setBufferSize(Number(event.target.value))}
              aria-label="Rolling buffer"
            >
              {BUFFER_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} samples
                </option>
              ))}
            </select>
          </label>
          <label className="parameter-control">
            <span className="parameter-label">
              Dynamic range
              <strong>{yRangeDb} dB</strong>
            </span>
            <select
              className="parameter-select"
              value={yRangeDb}
              onChange={(event) => setYRangeDb(Number(event.target.value))}
              aria-label="Dynamic range"
            >
              {Y_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="parameter-control">
            <span className="parameter-label">
              Waterfall colormap
              <strong>{waterfallColorScale}</strong>
            </span>
            <select
              className="parameter-select"
              value={waterfallColorScale}
              onChange={(event) => setWaterfallColorScale(event.target.value)}
              aria-label="Waterfall colormap"
            >
              {WATERFALL_COLOR_SCALE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="audio-level-meter" aria-label="Peak level meter">
            <div style={{ width: `${levelPercent}%` }} />
          </div>
          <div className="metric-list">
            <div>
              <span>Status</span>
              <strong>{status}</strong>
            </div>
            <div>
              <span>Sample rate</span>
              <strong>{sampleRate.toLocaleString()} Hz</strong>
            </div>
            <div>
              <span>RMS</span>
              <strong>{rmsLabel}</strong>
            </div>
            <div>
              <span>Peak</span>
              <strong>{peakLabel}</strong>
            </div>
            <div>
              <span>Dominant</span>
              <strong>{dominantLabel}</strong>
            </div>
            <div>
              <span>Samples</span>
              <strong>{metrics.sampleCount.toLocaleString()}</strong>
            </div>
            <div>
              <span>Callbacks/s</span>
              <strong>{metrics.callbackRate.toFixed(1)}</strong>
            </div>
            <div>
              <span>Buffer fill</span>
              <strong>{bufferFillPercent}%</strong>
            </div>
          </div>
          <p className="status-message">{message}</p>
        </aside>

        <div className="plot-grid live-audio-grid">
          <PlotPanel
            title="Rolling audio spectrum"
            xLabel="Frequency (Hz)"
            yLabel="Magnitude (dB)"
            xRange={[0, sampleRate / 2]}
            yRange={[-yRangeDb, 5]}
            height={420}
            showLegend={false}
            data={[
              {
                name: "Spectrum",
                x: positiveSpectrumFrequencyHz,
                y: positiveSpectrumMagnitudeDb,
                type: "scatter",
                mode: "lines",
                line: { color: "#0f766e", width: 2 },
              },
            ]}
          />
          <PlotPanel
            title="Spectrum waterfall"
            xLabel="Frequency (Hz)"
            yLabel="Recent FFT frame"
            xRange={[0, sampleRate / 2]}
            height={320}
            showLegend={false}
            data={[
              {
                name: "Waterfall",
                x: positiveSpectrumFrequencyHz,
                y: createIndexAxis(waterfallRows.length),
                z: waterfallRows,
                type: "heatmap",
                colorscale: waterfallColorScale,
                zmin: -yRangeDb,
                zmax: 0,
                showscale: false,
              },
            ]}
          />
          <PlotPanel
            title="Log-frequency audio spectrum"
            xLabel="Frequency (Hz)"
            yLabel="Magnitude (dB)"
            xScale="log"
            xRange={logSpectrumXRange}
            yRange={[-yRangeDb, 5]}
            height={360}
            showLegend={false}
            data={[
              {
                name: "Log spectrum",
                x: logSpectrumFrequencyHz,
                y: logSpectrumMagnitudeDb,
                type: "scatter",
                mode: "lines",
                line: { color: "#334155", width: 2 },
              },
            ]}
          />
          <PlotPanel
            title="Time-domain waveform"
            xLabel="Time before now (ms)"
            yLabel="Amplitude"
            xRange={timeAxisMs.length ? [timeAxisMs[0], 0] : [-100, 0]}
            yRange={[-1.05, 1.05]}
            height={300}
            showLegend={false}
            data={[
              {
                name: "Waveform",
                x: timeAxisMs,
                y: Array.from(waveform),
                type: "scatter",
                mode: "lines",
                line: { color: "#172033", width: 1.4 },
              },
            ]}
          />
          <section className="plot-panel">
            <h2>Analyzer notes</h2>
            <p>
              Browser audio samples are normalized around +/-1, so the dBFS
              values are useful for relative level checks. The dominant
              frequency is estimated from the strongest current spectrum bin and
              will track tones more clearly than speech or noisy signals.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function isMicrophoneSupported(): boolean {
  const mediaDevices = navigator.mediaDevices as BrowserMediaDevices | undefined;

  return Boolean(
    mediaDevices?.getUserMedia &&
      getAudioContextConstructor(),
  );
}

function getAudioContextConstructor(): typeof AudioContext | undefined {
  const audioWindow = window as unknown as BrowserAudioWindow;

  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
}

function isPermissionDenied(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")
  );
}

function createIndexAxis(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}

function createPositiveSpectrum(spectrum: Spectrum | undefined): Spectrum | undefined {
  if (!spectrum) {
    return undefined;
  }

  const firstPositiveIndex = Array.from(spectrum.frequency).findIndex(
    (frequency) => frequency >= 0,
  );

  if (firstPositiveIndex < 0) {
    return {
      frequency: new Float64Array(0),
      magnitudeDb: new Float64Array(0),
    };
  }

  return {
    frequency: spectrum.frequency.slice(firstPositiveIndex),
    magnitudeDb: spectrum.magnitudeDb.slice(firstPositiveIndex),
  };
}

function createWaveformSamples(samples: Float64Array): Float64Array {
  const sampleCount = Math.min(samples.length, 2048);
  return samples.subarray(samples.length - sampleCount);
}

function formatDbfs(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(1)} dBFS` : "-inf dBFS";
}
