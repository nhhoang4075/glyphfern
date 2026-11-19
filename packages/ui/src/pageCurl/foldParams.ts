import { FOLD_RADIUS, solveA } from "./solveA";

export type Corner = "r" | "l";

export type FoldParams = {
  cx: number;
  cy: number;
  ux: number;
  uy: number;
  L: number;
  a: number;
  R: number;
};

export function cornerPoint(corner: Corner, bw: number, bh: number): [number, number] {
  return corner === "r" ? [bw, bh] : [0, bh];
}

export function foldParams(
  corner: Corner,
  px: number,
  py: number,
  bw: number,
  bh: number,
): FoldParams {
  const [cx, cy] = cornerPoint(corner, bw, bh);
  const dx = px - cx;
  const dy = (py - cy) * 0.5;
  const m = Math.hypot(dx, dy);
  let ux: number;
  let uy: number;
  let L: number;
  if (m < 1) {
    ux = corner === "r" ? -1 : 1;
    uy = 0;
    L = 0;
  } else {
    ux = dx / m;
    uy = dy / m;
    L = Math.max(0, (px - cx) * ux + (py - cy) * uy);
  }
  const R = FOLD_RADIUS;
  return { cx, cy, ux, uy, L, a: solveA(L, R), R };
}
