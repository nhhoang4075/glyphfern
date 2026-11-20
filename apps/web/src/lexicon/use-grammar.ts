import { useEffect, useState } from "react";
import { type GrammarRequest, lexicon } from "./lexicon-client";

export const GRAMMAR_UNAVAILABLE = "Chưa phân tích được";

export type GrammarStatus = "idle" | "loading" | "done" | "failed";

export interface GrammarView {
  notes: string[] | null;
  status: GrammarStatus;
}

export function grammarViewKey(request: GrammarRequest): string {
  return `${request.lang}:${request.sentenceId}:${request.lemma}:${request.sentence}`;
}

export function resolveGrammarView(
  enabled: boolean,
  key: string,
  result: { key: string; value: string[] | null } | null,
): GrammarView {
  if (!enabled) {
    return { notes: null, status: "idle" };
  }
  if (result?.key !== key) {
    return { notes: null, status: "loading" };
  }
  return result.value === null
    ? { notes: null, status: "failed" }
    : { notes: result.value, status: "done" };
}

export function useGrammar(request: GrammarRequest, enabled: boolean): GrammarView {
  const [result, setResult] = useState<{ key: string; value: string[] | null } | null>(null);
  const key = grammarViewKey(request);
  const { lang, sentenceId, sentence, word, lemma } = request;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    lexicon.grammar({ lang, sentenceId, sentence, word, lemma }).then((value) => {
      if (!cancelled) {
        setResult({ key, value });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, key, lang, sentenceId, sentence, word, lemma]);

  return resolveGrammarView(enabled, key, result);
}
