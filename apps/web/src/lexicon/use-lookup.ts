import { useEffect, useState } from "react";
import { type LookupResult, lexicon } from "./lexicon-client";

export function useLookup(lang: string, word: string, enabled: boolean): LookupResult | null {
  const [result, setResult] = useState<{ key: string; value: LookupResult | null } | null>(null);
  const key = `${lang}:${word}`;

  useEffect(() => {
    if (!enabled || word.length === 0) {
      return;
    }
    let cancelled = false;
    lexicon.lookup(lang, word).then((value) => {
      if (!cancelled) {
        setResult({ key, value });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, lang, word, key]);

  return enabled && result?.key === key ? result.value : null;
}
