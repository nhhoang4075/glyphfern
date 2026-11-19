import { useEffect, useState } from "react";
import { lexicon } from "./lexicon-client";

export type TranslationStatus = "idle" | "loading" | "done" | "failed";

export interface TranslationView {
  text: string | null;
  status: TranslationStatus;
}

export function useTranslation(
  from: string,
  to: string,
  text: string | undefined,
  enabled: boolean,
): TranslationView {
  const [result, setResult] = useState<{ key: string; value: string | null } | null>(null);
  const key = `${from}:${to}:${text ?? ""}`;

  useEffect(() => {
    if (!enabled || !text) {
      return;
    }
    let cancelled = false;
    lexicon.translate(from, to, text).then((value) => {
      if (!cancelled) {
        setResult({ key, value });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, from, to, text, key]);

  if (!enabled || !text) {
    return { text: null, status: "idle" };
  }
  if (result?.key !== key) {
    return { text: null, status: "loading" };
  }
  return result.value === null
    ? { text: null, status: "failed" }
    : { text: result.value, status: "done" };
}
