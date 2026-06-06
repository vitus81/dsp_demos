import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveAudioAnalyzerDemo } from "./LiveAudioAnalyzerDemo";

vi.mock("plotly.js-dist-min", () => ({
  default: {
    react: vi.fn().mockResolvedValue(undefined),
    newPlot: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn(),
  },
}));

type MockAudioContext = AudioContext & {
  close: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
};

const originalMediaDevices = navigator.mediaDevices;
const originalAudioContext = window.AudioContext;

describe("LiveAudioAnalyzerDemo", () => {
  beforeEach(() => {
    installMicrophoneMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: originalAudioContext,
    });
  });

  it("renders analyzer controls and initial metrics", () => {
    render(<LiveAudioAnalyzerDemo />);

    expect(
      screen.getByRole("heading", {
        name: "Live Microphone Audio Analyzer",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/FFT size/i)).toHaveValue("2048");
    expect(screen.getByLabelText(/Dynamic range/i)).toHaveValue("80");
    expect(screen.getByText("Rolling audio spectrum")).toBeInTheDocument();
    expect(screen.getByText("Spectrum waterfall")).toBeInTheDocument();
    expect(screen.getByText("Log-frequency audio spectrum")).toBeInTheDocument();
    expect(screen.getByText("Microphone capture is ready.")).toBeInTheDocument();
    expect(screen.getAllByText("-inf dBFS")).toHaveLength(2);
  });

  it("shows the unsupported browser state", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: undefined,
    });

    render(<LiveAudioAnalyzerDemo />);

    expect(screen.getByText("unsupported")).toBeInTheDocument();
    expect(
      screen.getByText("This browser does not expose microphone capture."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start microphone/i })).toBeDisabled();
  });

  it("reports denied microphone permission", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
      new DOMException("Denied", "NotAllowedError"),
    );

    render(<LiveAudioAnalyzerDemo />);
    fireEvent.click(screen.getByRole("button", { name: /Start microphone/i }));

    await waitFor(() => {
      expect(screen.getByText("denied")).toBeInTheDocument();
    });
    expect(screen.getByText("Microphone permission was denied.")).toBeInTheDocument();
  });

  it("starts and stops microphone capture", async () => {
    const trackStop = vi.fn();
    const close = vi.fn();
    installMicrophoneMocks({ trackStop, close });

    render(<LiveAudioAnalyzerDemo />);
    fireEvent.click(screen.getByRole("button", { name: /Start microphone/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Stop microphone/i }))
        .toBeInTheDocument();
    });
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByLabelText(/Input device/i)).toHaveValue("");
    expect(screen.getByText("Microphone analyzer is running.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Stop microphone/i }));

    expect(trackStop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(screen.getByText("idle")).toBeInTheDocument();
    expect(screen.getByText("Microphone capture stopped.")).toBeInTheDocument();
  });
});

function installMicrophoneMocks({
  trackStop = vi.fn(),
  close = vi.fn(),
}: {
  trackStop?: ReturnType<typeof vi.fn>;
  close?: ReturnType<typeof vi.fn>;
} = {}) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: trackStop }],
      }),
      enumerateDevices: vi.fn().mockResolvedValue([
        {
          deviceId: "default",
          kind: "audioinput",
          label: "Default microphone",
        },
      ]),
    },
  });

  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: vi.fn(() => createAudioContextMock(close)),
  });
}

function createAudioContextMock(close: ReturnType<typeof vi.fn>): MockAudioContext {
  const sourceNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const processorNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  };

  return {
    state: "running",
    sampleRate: 48000,
    destination: {},
    createMediaStreamSource: vi.fn(() => sourceNode),
    createScriptProcessor: vi.fn(() => processorNode),
    resume: vi.fn().mockResolvedValue(undefined),
    close,
  } as unknown as MockAudioContext;
}
