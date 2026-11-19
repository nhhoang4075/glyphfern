export function easeOut(k: number): number {
  return 1 - (1 - k) ** 1.9;
}

export function easeInOutQuad(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
}

export function yEase(t: number): number {
  return 1 - (1 - t) ** 2.2;
}
