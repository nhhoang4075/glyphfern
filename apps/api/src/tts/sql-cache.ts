import type { SQL } from "bun";
import type { TtsCache } from "./tts-service";

export function createTtsSqlCache(sql: SQL): TtsCache {
  return {
    async get(hash) {
      const rows: { audio: Uint8Array }[] = await sql`
        SELECT audio FROM tts_audio WHERE hash = ${hash}`;
      const audio = rows[0]?.audio;
      return audio ? new Uint8Array(audio) : undefined;
    },
    async put(hash, audio) {
      await sql`
        INSERT INTO tts_audio (hash, audio) VALUES (${hash}, ${audio})
        ON CONFLICT DO NOTHING`;
    },
  };
}
