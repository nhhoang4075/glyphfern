import { type DomFoldTarget, applyDomFold, clearDomFold } from "./domFold";
import {
  CANCEL_MS,
  NORT_MS,
  SWEEP_MS,
  TAP_TURN_MS,
  decideRelease,
  exceedsTap,
} from "./dragDecision";
import { easeOut } from "./easing";
import { type Corner, cornerPoint } from "./foldParams";
import { type GlCurl, type Rgb, createGlCurl } from "./glCurl";
import { type Point, idlePoint, sweepEnd, sweepPoint } from "./sweepPath";
import { type Clock, runTween } from "./tween";

export type TurnDirection = 1 | -1;

export type PageSurface = {
  front: HTMLCanvasElement;
  under: HTMLCanvasElement;
  paper?: Rgb;
};

export type PageCurlOptions = {
  book: HTMLElement;
  cornerRight: HTMLElement;
  cornerLeft: HTMLElement;
  glCanvas: HTMLCanvasElement;
  getPageSurface: (direction: TurnDirection) => PageSurface;
  onTurn: (direction: TurnDirection) => void;
  canTurn?: (direction: TurnDirection) => boolean;
  domFold?: DomFoldTarget;
  clock?: Clock;
  prefersReducedMotion?: () => boolean;
};

export type PageCurl = {
  enable(): void;
  disable(): void;
  turn(direction: TurnDirection): void;
  destroy(): void;
};

const IDLE_HEIGHT = 26;
const DEFAULT_PAPER: Rgb = [252 / 255, 251 / 255, 249 / 255];

function directionOf(corner: Corner): TurnDirection {
  return corner === "r" ? 1 : -1;
}

function capture(target: HTMLElement, pointerId: number): boolean {
  try {
    target.setPointerCapture(pointerId);
    return true;
  } catch {
    return false;
  }
}

function samplePaper(front: HTMLCanvasElement): Rgb {
  try {
    const data = front.getContext("2d")?.getImageData(1, 1, 1, 1).data;
    if (data) return [(data[0] ?? 252) / 255, (data[1] ?? 251) / 255, (data[2] ?? 249) / 255];
  } catch {
    return DEFAULT_PAPER;
  }
  return DEFAULT_PAPER;
}

export function createPageCurl(options: PageCurlOptions): PageCurl {
  const { book, cornerRight, cornerLeft, glCanvas, getPageSurface, onTurn } = options;
  const clock = options.clock;
  const reduced = (): boolean =>
    options.prefersReducedMotion
      ? options.prefersReducedMotion()
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let enabled = false;
  let destroyed = false;
  let busy = false;
  let dragging = false;
  let moved = false;
  let corner: Corner = "r";
  let startX = 0;
  let startY = 0;
  let px = 0;
  let py = 0;
  let idleHeight = IDLE_HEIGHT;
  let gl: GlCurl | null = null;
  let glActive = false;
  let glFailed = false;
  let begun = false;
  let stopTween: (() => void) | null = null;
  let norTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners: Array<{ target: HTMLElement; type: string; handler: (e: never) => void }> = [];

  const bw = (): number => book.clientWidth;
  const bh = (): number => book.clientHeight;

  function clearStatic(): void {
    gl?.end();
    glActive = false;
    begun = false;
    if (options.domFold) clearDomFold(options.domFold);
  }

  function failGl(): void {
    glFailed = true;
    glActive = false;
    gl?.end();
  }

  function begin(c: Corner): void {
    begun = true;
    const direction = directionOf(c);
    if (!glFailed) {
      try {
        gl ??= createGlCurl(glCanvas);
        const surface = getPageSurface(direction);
        gl.begin(
          surface.front,
          surface.under,
          surface.paper ?? samplePaper(surface.front),
          bw(),
          bh(),
        );
        glActive = true;
        return;
      } catch {
        failGl();
      }
    }
    options.domFold?.prepare?.(c);
  }

  function fold(c: Corner, x: number, y: number): void {
    if (glActive && gl) {
      try {
        gl.fold(c, x, y, bw(), bh());
        return;
      } catch {
        failGl();
        options.domFold?.prepare?.(c);
      }
    }
    if (options.domFold) applyDomFold(options.domFold, c, x, y, bw(), bh());
  }

  function restoreStatic(): void {
    stopTween = null;
    clearStatic();
    busy = false;
    dragging = false;
    moved = false;
    idleHeight = IDLE_HEIGHT;
  }

  function onTweenError(): void {
    if (glActive) glFailed = true;
    restoreStatic();
  }

  function finalize(direction: TurnDirection): void {
    stopTween = null;
    book.classList.add("nort");
    clearStatic();
    busy = false;
    dragging = false;
    moved = false;
    idleHeight = IDLE_HEIGHT;
    try {
      onTurn(direction);
    } finally {
      if (norTimer) clearTimeout(norTimer);
      norTimer = setTimeout(() => {
        norTimer = null;
        book.classList.remove("nort");
      }, NORT_MS);
    }
  }

  function sweep(c: Corner, from: Point, ms: number): void {
    const end = sweepEnd(c, bw(), bh());
    busy = true;
    stopTween = runTween({
      from: 0,
      to: 1,
      ms: reduced() ? 0 : ms,
      ease: easeOut,
      clock,
      onFrame: (t) => {
        const [x, y] = sweepPoint(from, end, t, bh());
        fold(c, x, y);
      },
      onDone: () => finalize(directionOf(c)),
      onError: onTweenError,
    });
  }

  function cancelFold(c: Corner, fromX: number, fromY: number): void {
    const home = idlePoint(c, IDLE_HEIGHT, bw(), bh());
    busy = true;
    stopTween = runTween({
      from: 0,
      to: 1,
      ms: reduced() ? 0 : CANCEL_MS,
      clock,
      onFrame: (t) => fold(c, fromX + (home[0] - fromX) * t, fromY + (home[1] - fromY) * t),
      onDone: restoreStatic,
      onError: onTweenError,
    });
  }

  function allowed(c: Corner): boolean {
    return options.canTurn ? options.canTurn(directionOf(c)) : true;
  }

  function startAutomaticTurn(c: Corner): void {
    if (!enabled || busy || !allowed(c)) return;
    begin(c);
    sweep(c, idlePoint(c, idleHeight, bw(), bh()), TAP_TURN_MS);
  }

  function release(c: Corner, cancelled: boolean): void {
    if (!dragging || corner !== c) return;
    dragging = false;
    const [cx, cy] = cornerPoint(c, bw(), bh());
    const decision = decideRelease({
      moved,
      cancelled,
      distanceFromCorner: Math.hypot(px - cx, py - cy),
      bookWidth: bw(),
    });
    if (decision === "tap") {
      startAutomaticTurn(c);
      return;
    }
    if (decision === "complete") {
      sweep(c, [px, py], SWEEP_MS);
      return;
    }
    if (moved) cancelFold(c, px, py);
    else restoreStatic();
  }

  function attach(target: HTMLElement, c: Corner): void {
    const add = <E extends Event>(type: string, handler: (e: E) => void): void => {
      target.addEventListener(type, handler as EventListener);
      listeners.push({ target, type, handler: handler as (e: never) => void });
    };
    add<PointerEvent>("pointerdown", (e) => {
      if (!enabled || busy || dragging || !allowed(c)) return;
      e.preventDefault();
      capture(target, e.pointerId);
      dragging = true;
      corner = c;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = book.getBoundingClientRect();
      px = e.clientX - rect.left;
      py = e.clientY - rect.top;
    });
    add<PointerEvent>("pointermove", (e) => {
      if (!dragging || corner !== c) return;
      const rect = book.getBoundingClientRect();
      const x = Math.max(-bw() * 0.2, Math.min(bw() * 1.2, e.clientX - rect.left));
      const y = Math.max(8, Math.min(bh(), e.clientY - rect.top));
      if (exceedsTap(e.clientX - startX, e.clientY - startY)) moved = true;
      px = x;
      py = y;
      if (!moved) return;
      if (!begun) begin(c);
      fold(c, x, y);
    });
    add<PointerEvent>("pointerup", () => release(c, false));
    add<PointerEvent>("pointercancel", () => release(c, true));
    add<PointerEvent>("lostpointercapture", () => release(c, true));
  }

  function enable(): void {
    if (enabled || destroyed) return;
    enabled = true;
    attach(cornerRight, "r");
    attach(cornerLeft, "l");
  }

  function disable(): void {
    for (const { target, type, handler } of listeners) {
      target.removeEventListener(type, handler as unknown as EventListener);
    }
    listeners.length = 0;
    enabled = false;
    stopTween?.();
    stopTween = null;
    if (norTimer) clearTimeout(norTimer);
    norTimer = null;
    book.classList.remove("nort");
    restoreStatic();
  }

  return {
    enable,
    disable,
    turn(direction) {
      if (dragging) return;
      startAutomaticTurn(direction === 1 ? "r" : "l");
    },
    destroy() {
      disable();
      destroyed = true;
      gl?.dispose();
      gl = null;
    },
  };
}
