#!/usr/bin/env python
"""Generate binary WebSocket IQ streams for the Live IQ Spectrum demo."""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import math
import random
import struct
from dataclasses import dataclass
from typing import Iterable, Sequence


GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
INT16_MAX = 32767


def pack_iq_int16_le(samples: Iterable[tuple[float, float]], amplitude: float) -> bytes:
    clipped_amplitude = max(0.0, min(amplitude, 1.0))
    output = bytearray()

    for i_value, q_value in samples:
        i_int = float_to_int16(i_value * clipped_amplitude)
        q_int = float_to_int16(q_value * clipped_amplitude)
        output.extend(struct.pack("<hh", i_int, q_int))

    return bytes(output)


def float_to_int16(value: float) -> int:
    clipped = max(-1.0, min(value, 1.0))
    return int(round(clipped * INT16_MAX))


def websocket_binary_frame(payload: bytes) -> bytes:
    length = len(payload)

    if length < 126:
        header = struct.pack("!BB", 0x82, length)
    elif length <= 0xFFFF:
        header = struct.pack("!BBH", 0x82, 126, length)
    else:
        header = struct.pack("!BBQ", 0x82, 127, length)

    return header + payload


@dataclass
class Oscillator:
    signal: str
    frequency: float
    sample_index: int = 0

    def next_samples(self, count: int) -> list[tuple[float, float]]:
        samples = []

        for _ in range(count):
            phase = (self.sample_index * self.frequency) % 1.0

            if self.signal == "cosine":
                angle = 2.0 * math.pi * phase
                sample = (math.cos(angle), math.sin(angle))
            elif self.signal == "triangle":
                sample = (triangle_wave(phase), 0.0)
            elif self.signal == "square":
                sample = (1.0 if phase < 0.5 else -1.0, 0.0)
            else:
                raise ValueError(f"unsupported oscillator signal: {self.signal}")

            samples.append(sample)
            self.sample_index += 1

        return samples


class RepeatingWaveform:
    def __init__(self, waveform: list[tuple[float, float]]):
        self.waveform = waveform
        self.sample_index = 0

    def next_samples(self, count: int) -> list[tuple[float, float]]:
        samples = []
        waveform_length = len(self.waveform)

        for _ in range(count):
            samples.append(self.waveform[self.sample_index % waveform_length])
            self.sample_index += 1

        return samples


class QpskRrcSource:
    def __init__(
        self,
        seed: int,
        beta: float = 0.35,
        span_symbols: int = 8,
        samples_per_symbol: int = 8,
        offset_q: bool = False,
    ):
        self.rng = random.Random(seed)
        self.samples_per_symbol = samples_per_symbol
        self.sample_phase = 0
        self.offset_q = offset_q
        self.q_phase = samples_per_symbol // 2
        self.taps = root_raised_cosine_taps(
            beta=beta,
            span_symbols=span_symbols,
            samples_per_symbol=samples_per_symbol,
        )
        self.delay_line = [(0.0, 0.0)] * len(self.taps)

    def next_samples(self, count: int) -> list[tuple[float, float]]:
        samples = []

        for _ in range(count):
            self.delay_line.insert(0, self.next_upsampled_symbol())
            self.delay_line.pop()
            samples.append(self.filter_current_delay_line())

        return samples

    def next_upsampled_symbol(self) -> tuple[float, float]:
        i_value = 0.0
        q_value = 0.0
        scale = 1.0 / math.sqrt(2.0)

        if self.sample_phase == 0:
            i_value = (1.0 if self.rng.randrange(2) else -1.0) * scale

            if not self.offset_q:
                q_value = (1.0 if self.rng.randrange(2) else -1.0) * scale

        if self.offset_q and self.sample_phase == self.q_phase:
            q_value = (1.0 if self.rng.randrange(2) else -1.0) * scale

        self.sample_phase = (self.sample_phase + 1) % self.samples_per_symbol

        return (i_value, q_value)

    def filter_current_delay_line(self) -> tuple[float, float]:
        i_accumulator = 0.0
        q_accumulator = 0.0

        for tap, (i_value, q_value) in zip(self.taps, self.delay_line):
            i_accumulator += i_value * tap
            q_accumulator += q_value * tap

        return (i_accumulator, q_accumulator)


def triangle_wave(phase: float) -> float:
    return 4.0 * abs(phase - 0.5) - 1.0


def create_qpsk_rrc_waveform(seed: int, symbol_count: int = 4096) -> list[tuple[float, float]]:
    rng = random.Random(seed)
    samples_per_symbol = 8
    taps = root_raised_cosine_taps(beta=0.35, span_symbols=8, samples_per_symbol=samples_per_symbol)
    symbols = []

    for _ in range(symbol_count):
        i_value = 1.0 if rng.randrange(2) else -1.0
        q_value = 1.0 if rng.randrange(2) else -1.0
        scale = 1.0 / math.sqrt(2.0)
        symbols.append((i_value * scale, q_value * scale))

    upsampled = [(0.0, 0.0)] * (symbol_count * samples_per_symbol)

    for symbol_index, symbol in enumerate(symbols):
        upsampled[symbol_index * samples_per_symbol] = symbol

    filtered = convolve_complex_real(upsampled, taps)
    peak = max(math.hypot(i_value, q_value) for i_value, q_value in filtered) or 1.0

    return [(i_value / peak, q_value / peak) for i_value, q_value in filtered]


def root_raised_cosine_taps(
    beta: float,
    span_symbols: int,
    samples_per_symbol: int,
) -> list[float]:
    tap_count = span_symbols * samples_per_symbol + 1
    center = tap_count // 2
    taps = []

    for index in range(tap_count):
        t = (index - center) / samples_per_symbol

        if abs(t) < 1e-12:
            value = 1.0 + beta * (4.0 / math.pi - 1.0)
        elif beta > 0 and abs(abs(t) - 1.0 / (4.0 * beta)) < 1e-12:
            value = (
                beta
                / math.sqrt(2.0)
                * (
                    (1.0 + 2.0 / math.pi) * math.sin(math.pi / (4.0 * beta))
                    + (1.0 - 2.0 / math.pi) * math.cos(math.pi / (4.0 * beta))
                )
            )
        else:
            numerator = (
                math.sin(math.pi * t * (1.0 - beta))
                + 4.0 * beta * t * math.cos(math.pi * t * (1.0 + beta))
            )
            denominator = math.pi * t * (1.0 - (4.0 * beta * t) ** 2)
            value = numerator / denominator

        taps.append(value)

    energy = math.sqrt(sum(value * value for value in taps)) or 1.0
    return [value / energy for value in taps]


def convolve_complex_real(
    samples: list[tuple[float, float]],
    taps: list[float],
) -> list[tuple[float, float]]:
    output = []

    for sample_index in range(len(samples)):
        i_accumulator = 0.0
        q_accumulator = 0.0

        for tap_index, tap in enumerate(taps):
            source_index = sample_index - tap_index

            if source_index < 0:
                break

            i_value, q_value = samples[source_index]
            i_accumulator += i_value * tap
            q_accumulator += q_value * tap

        output.append((i_accumulator, q_accumulator))

    return output


def create_source(args: argparse.Namespace) -> Oscillator | QpskRrcSource:
    if args.signal == "qpsk-rrc":
        return QpskRrcSource(args.seed)

    if args.signal == "oqpsk-rrc":
        return QpskRrcSource(args.seed, offset_q=True)

    return Oscillator(signal=args.signal, frequency=args.frequency)


async def handle_client(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    args: argparse.Namespace,
) -> None:
    peer = writer.get_extra_info("peername")

    try:
        await websocket_handshake(reader, writer)
        print(f"client connected: {peer}")
        source = create_source(args)
        interval_seconds = packet_interval_seconds(args)

        while not writer.is_closing():
            samples = source.next_samples(args.packet_samples)
            payload = pack_iq_int16_le(samples, args.amplitude)
            writer.write(websocket_binary_frame(payload))
            await writer.drain()
            await asyncio.sleep(interval_seconds)
    except (ConnectionError, asyncio.IncompleteReadError, BrokenPipeError):
        pass
    finally:
        print(f"client disconnected: {peer}")
        writer.close()
        await writer.wait_closed()


async def websocket_handshake(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
) -> None:
    request = await reader.readuntil(b"\r\n\r\n")
    headers = parse_http_headers(request)
    key = headers.get("sec-websocket-key")

    if not key:
        raise ConnectionError("missing Sec-WebSocket-Key")

    accept = base64.b64encode(hashlib.sha1((key + GUID).encode("ascii")).digest()).decode("ascii")
    response = (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n"
        "\r\n"
    )
    writer.write(response.encode("ascii"))
    await writer.drain()


def parse_http_headers(request: bytes) -> dict[str, str]:
    lines = request.decode("ascii", errors="ignore").splitlines()
    headers = {}

    for line in lines[1:]:
        if ":" not in line:
            continue

        name, value = line.split(":", 1)
        headers[name.strip().lower()] = value.strip()

    return headers


def packet_interval_seconds(args: argparse.Namespace) -> float:
    if args.packets_per_second > 0:
        return 1.0 / args.packets_per_second

    return args.packet_samples / args.sample_rate


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="WebSocket bind host.")
    parser.add_argument("--port", type=int, default=8765, help="WebSocket bind port.")
    parser.add_argument(
        "--signal",
        choices=["cosine", "triangle", "square", "qpsk-rrc", "oqpsk-rrc"],
        default="cosine",
        help="Signal to generate.",
    )
    parser.add_argument(
        "--sample-rate",
        type=float,
        default=48000.0,
        help="Nominal stream sample rate used when packets per second is zero.",
    )
    parser.add_argument(
        "--packets-per-second",
        type=float,
        default=50.0,
        help="Packet pacing rate. Set to 0 to derive pacing from sample rate.",
    )
    parser.add_argument(
        "--packet-samples",
        type=int,
        default=512,
        help="Complex samples per WebSocket binary frame.",
    )
    parser.add_argument(
        "--amplitude",
        type=float,
        default=0.75,
        help="Output amplitude scale from 0 to 1.",
    )
    parser.add_argument(
        "--frequency",
        type=float,
        default=0.08,
        help="Normalized oscillator frequency in cycles per sample.",
    )
    parser.add_argument("--seed", type=int, default=17, help="Random seed for QPSK RRC.")

    return parser.parse_args(argv)


async def main() -> None:
    args = parse_args()
    server = await asyncio.start_server(
        lambda reader, writer: handle_client(reader, writer, args),
        args.host,
        args.port,
    )

    print(
        f"serving {args.signal} IQ stream at ws://{args.host}:{args.port} "
        f"({args.packet_samples} samples/frame)"
    )

    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
