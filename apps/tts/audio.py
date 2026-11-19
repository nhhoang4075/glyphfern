import io
import subprocess
import wave

import numpy as np

MP3_BITRATE = "48k"
ENCODE_TIMEOUT_SECONDS = 30
FFMPEG_COMMAND = [
    "ffmpeg",
    "-loglevel",
    "error",
    "-f",
    "wav",
    "-i",
    "pipe:0",
    "-ac",
    "1",
    "-b:a",
    MP3_BITRATE,
    "-f",
    "mp3",
    "pipe:1",
]


class EncodeError(Exception):
    pass


def wav_bytes(samples: np.ndarray, sample_rate: int) -> bytes:
    clipped = np.clip(np.asarray(samples, dtype=np.float32), -1.0, 1.0)
    pcm = (clipped * 32767.0).astype("<i2")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(sample_rate)
        writer.writeframes(pcm.tobytes())
    return buffer.getvalue()


def encode_mp3(wav: bytes) -> bytes:
    try:
        result = subprocess.run(
            FFMPEG_COMMAND,
            input=wav,
            capture_output=True,
            timeout=ENCODE_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise EncodeError(str(error)) from error
    if result.returncode != 0 or not result.stdout:
        raise EncodeError(result.stderr.decode("utf-8", "replace"))
    return result.stdout
