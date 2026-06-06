import { useEffect, useMemo, useRef, useState } from "react";
import { computeComplexWelchPeriodogramDb } from "../../shared/dsp/spectrum";
import {
  appendRollingComplexSamples,
  decodeInterleavedInt16Iq,
} from "../../shared/dsp/iqStream";
import { PlotPanel } from "../../shared/plot/PlotPanel";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

type ComplexBuffer = {
  i: Float64Array;
  q: Float64Array;
};

const DEFAULT_WS_URL = "ws://127.0.0.1:8765";
const FFT_SIZE_OPTIONS = [256, 512, 1024, 2048];
const BUFFER_SIZE_OPTIONS = [2048, 4096, 8192, 16384];
const Y_RANGE_OPTIONS = [
  { label: "60 dB", value: 60 },
  { label: "80 dB", value: 80 },
  { label: "100 dB", value: 100 },
];
const WATERFALL_COLOR_SCALE_OPTIONS = ["Viridis", "Cividis", "Turbo", "Jet"];
const EMPTY_BUFFER: ComplexBuffer = {
  i: new Float64Array(0),
  q: new Float64Array(0),
};
const PLOT_UPDATE_MS = 120;
const WATERFALL_HISTORY_LENGTH = 90;
const DEFAULT_IQ_RANGE: [number, number] = [-1.05, 1.05];
const MIN_IQ_RANGE = 0.02;

export function LiveIqSpectrumDemo() {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [fftSize, setFftSize] = useState(1024);
  const [bufferSize, setBufferSize] = useState(8192);
  const [yRangeDb, setYRangeDb] = useState(80);
  const [waterfallColorScale, setWaterfallColorScale] = useState("Viridis");
  const [isPaused, setIsPaused] = useState(false);
  const [plotBuffer, setPlotBuffer] = useState<ComplexBuffer>(EMPTY_BUFFER);
  const [iqRange, setIqRange] = useState<[number, number]>(DEFAULT_IQ_RANGE);
  const [waterfallRows, setWaterfallRows] = useState<number[][]>([]);
  const [metrics, setMetrics] = useState({
    sampleCount: 0,
    packetCount: 0,
    packetRate: 0,
    unsupportedMessages: 0,
    droppedBytes: 0,
  });
  const socketRef = useRef<WebSocket | null>(null);
  const rollingBufferRef = useRef<ComplexBuffer>(EMPTY_BUFFER);
  const packetCountRef = useRef(0);
  const lastRatePacketCountRef = useRef(0);
  const lastRateTimestampRef = useRef(performance.now());
  const hasIqRangeRef = useRef(false);
  const packetRateTimerRef = useRef<number | undefined>(undefined);
  const plotTimerRef = useRef<number | undefined>(undefined);
  const isPausedRef = useRef(isPaused);
  const bufferSizeRef = useRef(bufferSize);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    bufferSizeRef.current = bufferSize;
    rollingBufferRef.current = appendRollingComplexSamples(
      EMPTY_BUFFER,
      rollingBufferRef.current,
      bufferSize,
    );
    setPlotBuffer(rollingBufferRef.current);
  }, [bufferSize]);

  useEffect(() => {
    packetRateTimerRef.current = window.setInterval(() => {
      const now = performance.now();
      const elapsedSeconds = Math.max(
        (now - lastRateTimestampRef.current) / 1000,
        1e-6,
      );
      const packetDelta =
        packetCountRef.current - lastRatePacketCountRef.current;

      setMetrics((current) => ({
        ...current,
        packetRate: packetDelta / elapsedSeconds,
      }));
      lastRatePacketCountRef.current = packetCountRef.current;
      lastRateTimestampRef.current = now;
    }, 1000);

    plotTimerRef.current = window.setInterval(() => {
      if (!isPausedRef.current) {
        setPlotBuffer(rollingBufferRef.current);
      }
    }, PLOT_UPDATE_MS);

    return () => {
      if (packetRateTimerRef.current) {
        window.clearInterval(packetRateTimerRef.current);
      }
      if (plotTimerRef.current) {
        window.clearInterval(plotTimerRef.current);
      }
      socketRef.current?.close();
    };
  }, []);

  const spectrum = useMemo(() => {
    if (plotBuffer.i.length < Math.min(fftSize, 16)) {
      return undefined;
    }

    return computeComplexWelchPeriodogramDb(plotBuffer, {
      fftSize,
      segmentSize: fftSize,
      overlapRatio: 0.5,
    });
  }, [fftSize, plotBuffer]);

  useEffect(() => {
    if (!spectrum) {
      return;
    }

    setWaterfallRows((current) => [
      ...current.slice(-(WATERFALL_HISTORY_LENGTH - 1)),
      Array.from(spectrum.magnitudeDb),
    ]);
  }, [spectrum]);

  useEffect(() => {
    setWaterfallRows([]);
  }, [fftSize]);

  const bufferFillPercent = Math.round(
    (Math.min(plotBuffer.i.length, bufferSize) / bufferSize) * 100,
  );
  const canConnect = status === "disconnected" || status === "error";

  function connect() {
    if (!canConnect) {
      disconnect();
      return;
    }

    setStatus("connecting");
    rollingBufferRef.current = EMPTY_BUFFER;
    setPlotBuffer(EMPTY_BUFFER);
    setIqRange(DEFAULT_IQ_RANGE);
    setWaterfallRows([]);
    setMetrics({
      sampleCount: 0,
      packetCount: 0,
      packetRate: 0,
      unsupportedMessages: 0,
      droppedBytes: 0,
    });
    packetCountRef.current = 0;
    lastRatePacketCountRef.current = 0;
    lastRateTimestampRef.current = performance.now();
    hasIqRangeRef.current = false;

    const socket = new WebSocket(wsUrl);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.addEventListener("open", () => setStatus("connected"));
    socket.addEventListener("error", () => setStatus("error"));
    socket.addEventListener("close", () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
        setStatus((current) => (current === "error" ? "error" : "disconnected"));
      }
    });
    socket.addEventListener("message", (event) => {
      if (!(event.data instanceof ArrayBuffer)) {
        setMetrics((current) => ({
          ...current,
          unsupportedMessages: current.unsupportedMessages + 1,
        }));
        return;
      }

      const decoded = decodeInterleavedInt16Iq(event.data);

      if (!hasIqRangeRef.current && decoded.i.length > 0) {
        setIqRange(computeInitialIqRange(decoded));
        hasIqRangeRef.current = true;
      }

      rollingBufferRef.current = appendRollingComplexSamples(
        rollingBufferRef.current,
        decoded,
        bufferSizeRef.current,
      );
      packetCountRef.current += 1;
      setMetrics((current) => ({
        ...current,
        sampleCount: current.sampleCount + decoded.i.length,
        packetCount: packetCountRef.current,
        droppedBytes: current.droppedBytes + decoded.droppedBytes,
      }));
    });
  }

  function disconnect() {
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("disconnected");
  }

  return (
    <div className="demo-workbench">
      <div className="demo-heading">
        <div>
          <p className="eyebrow">General DSP</p>
          <h1>Live IQ Spectrum</h1>
          <p>
            Connect to a binary WebSocket stream carrying signed 16-bit
            little-endian interleaved IQ samples and watch the rolling complex
            spectrum update in real time.
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setIsPaused((current) => !current)}
        >
          {isPaused ? "Resume plot" : "Pause plot"}
        </button>
      </div>

      <section className="theory-band">
        <div>
          <h2>Stream format</h2>
          <p>
            Every WebSocket binary frame is decoded as I,Q,I,Q signed 16-bit
            integers. Values are normalized by 32768 before the Welch spectrum
            estimate is computed. Text frames are ignored so status messages
            from simple tools do not disturb the plot.
          </p>
        </div>
        <div className="formula-box">
          <span>int16 LE: I0, Q0, I1, Q1...</span>
          <small>Frequency is normalized in cycles per sample.</small>
        </div>
      </section>

      <div className="workbench-grid">
        <aside className="control-panel">
          <h2>Connection</h2>
          <label className="parameter-control">
            <span className="parameter-label">
              WebSocket URL
              <strong>{status}</strong>
            </span>
            <input
              className="parameter-input"
              value={wsUrl}
              onChange={(event) => setWsUrl(event.target.value)}
              disabled={status === "connecting" || status === "connected"}
              aria-label="WebSocket URL"
            />
          </label>
          <button
            className="secondary-button full-width-button"
            type="button"
            onClick={connect}
          >
            {canConnect ? "Connect" : "Disconnect"}
          </button>

          <h2 className="control-section-heading">FFT</h2>
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

          <div className="metric-list">
            <div>
              <span>Status</span>
              <strong>{status}</strong>
            </div>
            <div>
              <span>Samples</span>
              <strong>{metrics.sampleCount.toLocaleString()}</strong>
            </div>
            <div>
              <span>Packets/s</span>
              <strong>{metrics.packetRate.toFixed(1)}</strong>
            </div>
            <div>
              <span>Buffer fill</span>
              <strong>{bufferFillPercent}%</strong>
            </div>
            <div>
              <span>Packets</span>
              <strong>{metrics.packetCount.toLocaleString()}</strong>
            </div>
            <div>
              <span>Unsupported</span>
              <strong>{metrics.unsupportedMessages}</strong>
            </div>
            <div>
              <span>Dropped bytes</span>
              <strong>{metrics.droppedBytes}</strong>
            </div>
          </div>
        </aside>

        <div className="plot-grid live-iq-grid">
          <PlotPanel
            title="Rolling IQ spectrum"
            xLabel="Normalized frequency (cycles/sample)"
            yLabel="Magnitude (dB)"
            xRange={[-0.5, 0.5]}
            yRange={[-yRangeDb, 5]}
            height={460}
            showLegend={false}
            data={[
              {
                name: "Spectrum",
                x: spectrum ? Array.from(spectrum.frequency) : [],
                y: spectrum ? Array.from(spectrum.magnitudeDb) : [],
                type: "scatter",
                mode: "lines",
                line: { color: "#0f766e", width: 2 },
              },
            ]}
          />
          <PlotPanel
            title="Spectrum waterfall"
            xLabel="Normalized frequency (cycles/sample)"
            yLabel="Recent FFT frame"
            xRange={[-0.5, 0.5]}
            height={320}
            showLegend={false}
            data={[
              {
                name: "Waterfall",
                x: spectrum ? Array.from(spectrum.frequency) : [],
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
            title="IQ buffer"
            xLabel="In-phase"
            yLabel="Quadrature"
            xRange={iqRange}
            yRange={iqRange}
            squareAxes
            showLegend={false}
            data={[
              {
                name: "IQ samples",
                x: Array.from(plotBuffer.i),
                y: Array.from(plotBuffer.q),
                type: "scatter",
                mode: "lines+markers",
                line: { color: "rgba(15, 118, 110, 0.42)", width: 0.8 },
                marker: {
                  color: "#172033",
                  size: 2,
                  opacity: 0.42,
                },
              },
            ]}
          />
          <section className="plot-panel">
            <h2>Live receiver notes</h2>
            <p>
              The app expects a converter or generator to provide WebSocket
              binary frames. Use the Python tool in the tools folder to produce
              cosine, triangle, square, or QPSK RRC test streams that match this
              parser.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function computeInitialIqRange(samples: ComplexBuffer): [number, number] {
  const sampleLength = Math.min(samples.i.length, samples.q.length);
  let maxMagnitude = 0;

  for (let index = 0; index < sampleLength; index += 1) {
    maxMagnitude = Math.max(
      maxMagnitude,
      Math.abs(samples.i[index]),
      Math.abs(samples.q[index]),
    );
  }

  const range = Math.max(maxMagnitude * 1.15, MIN_IQ_RANGE);

  return [-range, range];
}

function createIndexAxis(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}
