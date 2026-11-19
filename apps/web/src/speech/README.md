# Speech

## Purpose

Reads words and sentences aloud. A `Tts` port (`tts.ts`) has two adapters: `system` (Web Speech API, the default) and `server` (Kokoro neural voice synthesized by the API). The preference `voice` (`"system"` or `"server"`) chooses between them. Screens never touch `speechSynthesis` or `Audio`; they call `useTts().speak(...)`.

## Contracts

- `SpeechRequest`: `{ text, lang, locale, rate }`. `lang` is the language code of the active language (`pack.lang`, for example `es`), `locale` is `pack.ttsLocale` (for example `es-ES`). The system adapter uses `locale`, the server adapter sends `lang`.
- Rates: `WORD_RATE` 0.88 for the word speaker button, `SENTENCE_RATE` 0.78 for the panel context button and the review flip. The call site picks the rate and every adapter receives it unchanged.
- `Tts`: `speak(request)` and `cancel()`. Speaking always cancels whatever is in progress.
- `createTtsRegistry(system, server)` returns one stable `Tts` per voice kind. Speaking through one entry first cancels the other adapter, so two voices never overlap, including right after the preference changes. `cancel()` on any entry cancels both.
- `useTts()` returns the registry entry for `state.preferences.voice`. The real adapters are created once at module load; the server adapter reads its base URL from `VITE_API_URL` and uses the system adapter as its fallback.

## Flow of the server adapter

`createServerVoice` receives its collaborators (base URL, fetcher, audio factory, object URL helpers, fallback adapter), so tests need no globals.

1. `speak` first stops the previous request: aborts the in-flight fetch, pauses the audio element, revokes the object URL.
2. No base URL: the fallback speaks the request and nothing else happens.
3. One shared audio element is created synchronously inside the first `speak` call, before any await, because browsers that tie playback to the user gesture only accept an element created there.
4. `GET <base>/tts?lang=<lang>&text=<text>&speed=<rate>` with an `AbortSignal`. Text is URI-encoded, `speed` is the request rate as is.
5. Status 200: the blob becomes an object URL, the element plays it, and the URL is revoked when playback ends or when another request replaces it.
6. A response, error or `play()` result that arrives after the request was cancelled or replaced is ignored: it never plays and never reaches the fallback.

## Contract with `GET /tts`

Returns `200` with `audio/mpeg`. Any other status (404 unsupported language, 429 rate limited, 502 or 503 service down) counts as a failure.

## Fallback rule

The adapter hands the same `SpeechRequest` to the fallback exactly once, and the user sees no error, when:
- no base URL is configured;
- the request throws (network down, API unreachable);
- the status is not 200;
- the server does not answer within 7 seconds (a sleeping sidecar is still waking): the request is aborted and the fallback speaks at once, while the API keeps waking the sidecar and caches the result for the next tap;
- `play()` rejects (for example the browser refuses playback outside a user gesture);
- the element raises an error event during playback.

## Failure modes

- No Web Speech: the system adapter does nothing and raises no error.
- No `Audio` constructor or no object URL support: the factory throws, the adapter falls back.
- Fallback to a system voice that is also missing: silent, no error.

## Testing

`apps/web/test/speech/` runs the server adapter with a fake fetcher, fake audio and fake object URLs (request URL, 200 playback, fallback on 404, 429, 502, 503, network error and rejected `play()`, no base URL, abort of an earlier request, late responses, `cancel()`), the system adapter with a fake synthesis, and the registry with recording adapters. The preference is covered in `apps/web/test/app/voice-preference.test.ts`. Real audio playback and iOS Safari gesture rules are not covered by tests.
