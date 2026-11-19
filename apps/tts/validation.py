import json
import math
from dataclasses import dataclass
from typing import Collection

MAX_BODY_BYTES = 64 * 1024
MAX_TEXT_CHARACTERS = 500
MIN_SPEED = 0.5
MAX_SPEED = 1.5


class ValidationError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class SynthesisRequest:
    text: str
    voice: str
    speed: float


def parse_request(raw: bytes, voices: Collection[str]) -> SynthesisRequest:
    if len(raw) > MAX_BODY_BYTES:
        raise ValidationError("invalid_json")
    try:
        body = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise ValidationError("invalid_json") from None
    if not isinstance(body, dict):
        raise ValidationError("invalid_json")
    text = body.get("text")
    if not isinstance(text, str):
        raise ValidationError("invalid_text")
    text = text.strip()
    if not text or len(text) > MAX_TEXT_CHARACTERS:
        raise ValidationError("invalid_text")
    speed = body.get("speed")
    if isinstance(speed, bool) or not isinstance(speed, (int, float)):
        raise ValidationError("invalid_speed")
    if not math.isfinite(speed) or not MIN_SPEED <= speed <= MAX_SPEED:
        raise ValidationError("invalid_speed")
    voice = body.get("voice")
    if not isinstance(voice, str) or voice not in voices:
        raise ValidationError("invalid_voice")
    return SynthesisRequest(text=text, voice=voice, speed=float(speed))
