import { easeOut, yEase } from "./easing";
import type { Corner } from "./foldParams";

export type Point = [number, number];

export function sweepEnd(corner: Corner, bw: number, bh: number): Point {
  return corner === "r" ? [-1.3 * bw, bh] : [2.3 * bw, bh];
}

export function sweepPoint(from: Point, end: Point, t: number, bh: number): Point {
  const x = from[0] + (end[0] - from[0]) * t;
  const y = from[1] + (end[1] - from[1]) * yEase(t) - Math.sin(Math.PI * t) * bh * 0.1 * (1 - t);
  return [x, y];
}

export function sweepAt(from: Point, end: Point, k: number, bh: number): Point {
  return sweepPoint(from, end, easeOut(k), bh);
}

export function idlePoint(corner: Corner, h: number, bw: number, bh: number): Point {
  const x = corner === "r" ? bw - h : h;
  return [x, bh - h];
}
