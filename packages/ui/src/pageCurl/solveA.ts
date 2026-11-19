export const FOLD_RADIUS = 0.6;
export const BISECTION_STEPS = 34;

export function foldLength(a: number, R: number): number {
  return a >= Math.PI * R ? 2 * a - Math.PI * R : a - R * Math.sin(a / R);
}

export function solveA(L: number, R: number = FOLD_RADIUS): number {
  if (L <= 0) return 0;
  let lo = 0;
  let hi = L + Math.PI * R;
  for (let i = 0; i < BISECTION_STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (foldLength(mid, R) < L) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
