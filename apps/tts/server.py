import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from audio import encode_mp3, wav_bytes
from languages import language_of
from validation import SynthesisRequest, ValidationError, parse_request

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8788
DEFAULT_THREADS = 2
MODELS_DIRECTORY = Path(__file__).resolve().parent / "models"
DEFAULT_MODEL_FILE = "kokoro-v1.0.int8.onnx"
DEFAULT_VOICES_FILE = "voices-v1.0.bin"
MAX_READ_BYTES = 1_000_000


class Synthesizer:
    def __init__(self, kokoro):
        self.kokoro = kokoro
        self.voices = frozenset(
            voice for voice in kokoro.get_voices() if language_of(voice) is not None
        )
        self.lock = threading.Lock()

    def synthesize(self, request: SynthesisRequest) -> bytes:
        with self.lock:
            samples, sample_rate = self.kokoro.create(
                request.text,
                voice=request.voice,
                speed=request.speed,
                lang=language_of(request.voice),
            )
        return encode_mp3(wav_bytes(samples, sample_rate))


class Handler(BaseHTTPRequestHandler):
    synthesizer: Synthesizer

    def send_json(self, status: int, body: dict) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_audio(self, audio: bytes) -> None:
        self.send_response(200)
        self.send_header("content-type", "audio/mpeg")
        self.send_header("content-length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def read_body(self) -> bytes:
        try:
            declared = int(self.headers.get("content-length", "0"))
        except ValueError:
            declared = 0
        return self.rfile.read(max(0, min(declared, MAX_READ_BYTES)))

    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_json(200, {"ok": True})
        else:
            self.send_json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        if self.path != "/synthesize":
            self.send_json(404, {"error": "not_found"})
            return
        try:
            request = parse_request(self.read_body(), self.synthesizer.voices)
        except ValidationError as error:
            self.send_json(400, {"error": error.code})
            return
        started = time.monotonic()
        try:
            audio = self.synthesizer.synthesize(request)
        except Exception as error:
            print(f"synthesis failed: {error}", file=sys.stderr, flush=True)
            self.send_json(500, {"error": "synthesis_failed"})
            return
        elapsed = time.monotonic() - started
        print(
            f"synthesized {len(request.text)} characters with {request.voice} "
            f"at speed {request.speed} in {elapsed:.2f}s ({len(audio)} bytes)",
            file=sys.stderr,
            flush=True,
        )
        self.send_audio(audio)

    def log_message(self, format: str, *args) -> None:
        return


def load_synthesizer() -> Synthesizer:
    import onnxruntime
    from kokoro_onnx import Kokoro

    model = os.environ.get("TTS_MODEL_PATH", str(MODELS_DIRECTORY / DEFAULT_MODEL_FILE))
    voices = os.environ.get("TTS_VOICES_PATH", str(MODELS_DIRECTORY / DEFAULT_VOICES_FILE))
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = int(os.environ.get("TTS_THREADS", DEFAULT_THREADS))
    session = onnxruntime.InferenceSession(
        model, sess_options=options, providers=["CPUExecutionProvider"]
    )
    return Synthesizer(Kokoro.from_session(session, voices))


def main() -> None:
    host = os.environ.get("TTS_HOST", DEFAULT_HOST)
    port = int(os.environ.get("TTS_PORT", DEFAULT_PORT))
    Handler.synthesizer = load_synthesizer()
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"tts listening on {host}:{port}", file=sys.stderr, flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
