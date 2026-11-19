import { type Corner, cornerPoint } from "./foldParams";

export type DomFoldTarget = {
  top: HTMLElement;
  flap: HTMLElement;
  shadowCrease: HTMLElement;
  shadowFlap: HTMLElement;
  prepare?: (corner: Corner) => void;
};

export type Vec = [number, number];

export function clipHalf(
  poly: Vec[],
  mx: number,
  my: number,
  nx: number,
  ny: number,
  sign: number,
): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Vec;
    const b = poly[(i + 1) % poly.length] as Vec;
    const da = sign * ((a[0] - mx) * nx + (a[1] - my) * ny);
    const db = sign * ((b[0] - mx) * nx + (b[1] - my) * ny);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function polygonCss(poly: Vec[]): string {
  return `polygon(${poly.map((q) => `${q[0].toFixed(1)}px ${q[1].toFixed(1)}px`).join(",")})`;
}

export function clearDomFold(target: DomFoldTarget): void {
  target.top.style.clipPath = "none";
  target.top.style.visibility = "";
  target.flap.style.display = "none";
  target.shadowCrease.style.display = "none";
  target.shadowFlap.style.display = "none";
}

export function applyDomFold(
  target: DomFoldTarget,
  corner: Corner,
  px: number,
  py: number,
  bw: number,
  bh: number,
): void {
  const [cx, cy] = cornerPoint(corner, bw, bh);
  const dx = px - cx;
  const dy = py - cy;
  const L = Math.hypot(dx, dy);
  if (L < 2) {
    clearDomFold(target);
    return;
  }
  const nx = dx / L;
  const ny = dy / L;
  const mx = (cx + px) / 2;
  const my = (cy + py) / 2;
  const rect: Vec[] = [
    [0, 0],
    [bw, 0],
    [bw, bh],
    [0, bh],
  ];
  const kept = clipHalf(rect, mx, my, nx, ny, 1);
  const removed = clipHalf(rect, mx, my, nx, ny, -1);
  if (kept.length < 3) {
    target.top.style.visibility = "hidden";
  } else {
    target.top.style.visibility = "";
    target.top.style.clipPath = polygonCss(kept);
  }
  if (removed.length >= 3) {
    const nm = nx * mx + ny * my;
    target.flap.style.display = "block";
    target.flap.style.clipPath = polygonCss(removed);
    target.flap.style.transform = `matrix(${1 - 2 * nx * nx},${-2 * nx * ny},${-2 * nx * ny},${1 - 2 * ny * ny},${2 * nm * nx},${2 * nm * ny})`;
  } else {
    target.flap.style.display = "none";
  }
  const angleCrease = Math.atan2(-ny, -nx);
  const angleFlap = Math.atan2(ny, nx);
  target.shadowCrease.style.display = "block";
  target.shadowCrease.style.background =
    "linear-gradient(90deg,rgba(24,40,32,.38),rgba(24,40,32,0))";
  target.shadowCrease.style.transform = `translate(${mx}px,${my}px) rotate(${angleCrease}rad) translate(0,-2000px)`;
  target.shadowFlap.style.display = "block";
  target.shadowFlap.style.width = "60px";
  target.shadowFlap.style.background = "linear-gradient(90deg,rgba(24,40,32,.22),rgba(24,40,32,0))";
  target.shadowFlap.style.transform = `translate(${mx}px,${my}px) rotate(${angleFlap}rad) translate(0,-2000px)`;
}
