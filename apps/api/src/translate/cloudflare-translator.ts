import { type Translator, TranslatorError } from "./translator";

export interface CloudflareOptions {
  accountId: string;
  apiToken: string;
  model?: string;
  fetcher?: typeof fetch;
}

const DEFAULT_MODEL = "@cf/meta/m2m100-1.2b";

interface CloudflareReply {
  success?: boolean;
  result?: { translated_text?: string };
}

export function createCloudflareTranslator(options: CloudflareOptions): Translator {
  const fetcher = options.fetcher ?? fetch;
  const model = options.model ?? DEFAULT_MODEL;
  const url = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai/run/${model}`;
  return {
    name: "cloudflare-m2m100",
    async translate(text, source, target) {
      const response = await fetcher(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ text, source_lang: source, target_lang: target }),
      });
      if (!response.ok) {
        throw new TranslatorError(`translation request failed with ${response.status}`);
      }
      const reply = (await response.json()) as CloudflareReply;
      const translated = reply.result?.translated_text;
      if (!reply.success || typeof translated !== "string" || translated.length === 0) {
        throw new TranslatorError("translation reply had no text");
      }
      return translated;
    },
  };
}
