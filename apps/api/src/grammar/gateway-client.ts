import { type GrammarClient, GrammarClientError, type GrammarRequest } from "./grammar-client";
import { GRAMMAR_SYSTEM_PROMPT, grammarUserPrompt } from "./grammar-prompt";
import { parseNotes } from "./parse-notes";

export const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
export const DEFAULT_GRAMMAR_MODEL = "deepseek/deepseek-v4.1-flash-1017";

const TEMPERATURE = 0.2;
const MAX_TOKENS = 1500;
const TIMEOUT_MS = 20_000;

export interface GatewayOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

interface Completion {
  choices?: { message?: { content?: unknown } }[];
}

export function createGatewayGrammarClient(options: GatewayOptions): GrammarClient {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  return {
    model: options.model,
    async analyze(request: GrammarRequest) {
      let response: Response;
      try {
        response = await fetcher(GATEWAY_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify({
            model: options.model,
            messages: [
              { role: "system", content: GRAMMAR_SYSTEM_PROMPT },
              { role: "user", content: grammarUserPrompt(request) },
            ],
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new GrammarClientError(`grammar request failed: ${String(error)}`);
      }
      if (!response.ok) {
        throw new GrammarClientError(`grammar request failed with ${response.status}`);
      }
      let body: Completion;
      try {
        body = (await response.json()) as Completion;
      } catch {
        throw new GrammarClientError("grammar reply is not JSON");
      }
      const content = body.choices?.[0]?.message?.content;
      const notes = typeof content === "string" ? parseNotes(content) : undefined;
      if (!notes) {
        throw new GrammarClientError("grammar reply has no valid notes");
      }
      return notes;
    },
  };
}
