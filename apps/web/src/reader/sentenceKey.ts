const KEY_PATTERN = /^\d+$/;

export function sentenceKey(id: number): string {
  return String(id);
}

export function parseSentenceKey(key: string | undefined): number | null {
  if (key === undefined || !KEY_PATTERN.test(key)) {
    return null;
  }
  return Number(key);
}
