# TTS sidecar

Purpose: a small Python HTTP service that reads one short text aloud with the Kokoro neural voice (`kokoro-onnx`, int8 model, CPU only) and answers MP3. It is the voice engine behind `GET /tts` of `apps/api`.

## How the API uses it

`apps/api` is the only caller. On a cache miss it posts `{ "text", "voice", "speed" }` to `{TTS_URL}/synthesize` and stores the returned MP3 in its `tts_audio` table. The sidecar has no authentication, no rate limit and no cache: those live in the API. It must never be exposed publicly. Bind it to a private network (the default host is `127.0.0.1`; in a container set `TTS_HOST=0.0.0.0` and publish the port only on the private network).

## Endpoints

- `GET /health`: `{"ok": true}`.
- `POST /synthesize` with JSON `{ "text": string, "voice": string, "speed": number }`: 200 `audio/mpeg`, mono, 48 kbit/s.

Validation answers 400 with `{"error": "<code>"}`:

| Code | When |
| --- | --- |
| `invalid_json` | the body is not a JSON object, is not UTF-8, or is over 64 KB |
| `invalid_text` | `text` is not a string, is empty after trimming, or is over 500 characters after trimming |
| `invalid_speed` | `speed` is not a number from 0.5 to 1.5 |
| `invalid_voice` | `voice` is not in the loaded voice list restricted to languages in `languages.py` |

A failure in synthesis or in ffmpeg answers 500 `{"error": "synthesis_failed"}` and is printed to stderr.

## Flow

1. `validation.py` turns the raw body into a `SynthesisRequest` or raises `ValidationError` with the error code.
2. `languages.py` maps the first letter of the voice id to the espeak language code (`e` is `es`). Adding a language is one line in `LANGUAGE_BY_VOICE_PREFIX`; voices whose letter is not in the table are not offered.
3. `Kokoro.create(text, voice, speed, lang)` returns float samples and a sample rate. One request is synthesized at a time (a lock); HTTP handling is threaded so validation and encoding of other requests never wait for the model.
4. `audio.py` writes the samples as 16-bit mono WAV in memory and pipes it through `ffmpeg -f wav -i pipe:0 -ac 1 -b:a 48k -f mp3 pipe:1`.

## Configuration

| Variable | Meaning | Default |
| --- | --- | --- |
| `TTS_HOST` | listen address | `127.0.0.1` |
| `TTS_PORT` | listen port | `8788` |
| `TTS_THREADS` | intra-op threads of onnxruntime; keep it at or below the CPU limit of the container, otherwise it competes with itself and synthesis becomes many times slower | `2` |
| `TTS_MODEL_PATH` | ONNX model file | `models/kokoro-v1.0.int8.onnx` |
| `TTS_VOICES_PATH` | voices file | `models/voices-v1.0.bin` |

## Running

Local, from `apps/tts`:

```text
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
sh fetch-models.sh
.venv/bin/python server.py
```

`ffmpeg` must be on the `PATH`. `fetch-models.sh` downloads the two model files into `models/` (git-ignored) and skips files that already exist.

Container: `docker build -t glyphfern-tts apps/tts`. The image is `python:3.12-slim` with `ffmpeg`, the pinned requirements and the models fetched at build time; it listens on port 8788.

## Failure modes

- Model files missing at start: the process exits with the loader's error.
- ffmpeg missing or failing: 500 `synthesis_failed`.
- A text the phonemizer cannot handle: 500 `synthesis_failed`; the API turns it into 502 `tts_failed`.

## Testing

From `apps/tts`, with the virtual environment above (the model is not loaded):

```text
.venv/bin/python -m unittest discover -s test
```

The tests cover request validation, the voice-to-language table and the WAV writer.
