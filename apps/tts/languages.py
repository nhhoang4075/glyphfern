LANGUAGE_BY_VOICE_PREFIX = {
    "e": "es",
}


def language_of(voice: str) -> str | None:
    if not voice:
        return None
    return LANGUAGE_BY_VOICE_PREFIX.get(voice[0])
