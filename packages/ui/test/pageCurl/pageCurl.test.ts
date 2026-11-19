import { expect, test } from "bun:test";
import { createPageCurl } from "../../src/pageCurl/pageCurl";
import type { Clock } from "../../src/pageCurl/tween";

type Handler = (e: unknown) => void;

function fakeElement() {
  const handlers = new Map<string, Set<Handler>>();
  const classes = new Set<string>();
  const style: Record<string, string> = {};
  return {
    clientWidth: 800,
    clientHeight: 1000,
    style,
    classes,
    classList: {
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      contains: (c: string) => classes.has(c),
    },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: () => {},
    addEventListener(type: string, h: Handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)?.add(h);
    },
    removeEventListener(type: string, h: Handler) {
      handlers.get(type)?.delete(h);
    },
    fire(type: string, e: Record<string, unknown> = {}) {
      for (const h of [...(handlers.get(type) ?? [])]) {
        h({ pointerId: 1, preventDefault: () => {}, ...e });
      }
    },
    count: () => [...handlers.values()].reduce((n, s) => n + s.size, 0),
  };
}

function fakeClock() {
  let time = 0;
  let pending: ((t: number) => void) | null = null;
  const clock: Clock = {
    now: () => time,
    request: (cb) => {
      pending = cb;
      return 1;
    },
    cancel: () => {
      pending = null;
    },
  };
  return {
    clock,
    step(ms: number) {
      time += ms;
      const cb = pending;
      pending = null;
      cb?.(time);
    },
    run(ms: number) {
      for (let i = 0; i < 400 && pending; i++) {
        time += ms;
        const cb = pending;
        pending = null;
        cb(time);
      }
    },
  };
}

function setup() {
  const book = fakeElement();
  const right = fakeElement();
  const left = fakeElement();
  const glCanvas = { getContext: () => null, style: {} };
  const domStyle = () => ({}) as Record<string, string>;
  const domFold = {
    top: { style: domStyle() },
    flap: { style: domStyle() },
    shadowCrease: { style: domStyle() },
    shadowFlap: { style: domStyle() },
    prepare: () => {
      prepared++;
    },
  };
  let prepared = 0;
  const turns: number[] = [];
  const f = fakeClock();
  const curl = createPageCurl({
    book: book as unknown as HTMLElement,
    cornerRight: right as unknown as HTMLElement,
    cornerLeft: left as unknown as HTMLElement,
    glCanvas: glCanvas as unknown as HTMLCanvasElement,
    getPageSurface: () => {
      throw new Error("not reached when WebGL is unavailable");
    },
    onTurn: (d) => turns.push(d),
    domFold: domFold as never,
    clock: f.clock,
    prefersReducedMotion: () => false,
  });
  return { book, right, left, curl, turns, f, domFold, prepared: () => prepared };
}

test("a tap on the right corner turns forward after the automatic sweep and sets nort", async () => {
  const s = setup();
  s.curl.enable();
  s.right.fire("pointerdown", { clientX: 790, clientY: 990 });
  s.right.fire("pointerup", { clientX: 790, clientY: 990 });
  expect(s.turns).toEqual([]);
  s.f.run(100);
  expect(s.turns).toEqual([1]);
  expect(s.book.classes.has("nort")).toBe(true);
  await new Promise((r) => setTimeout(r, 160));
  expect(s.book.classes.has("nort")).toBe(false);
  expect(s.domFold.top.style.clipPath).toBe("none");
});

test("a tap on the left corner turns back", () => {
  const s = setup();
  s.curl.enable();
  s.left.fire("pointerdown", { clientX: 10, clientY: 990 });
  s.left.fire("pointerup", { clientX: 10, clientY: 990 });
  s.f.run(100);
  expect(s.turns).toEqual([-1]);
});

test("a short drag animates back without turning", () => {
  const s = setup();
  s.curl.enable();
  s.right.fire("pointerdown", { clientX: 790, clientY: 990 });
  s.right.fire("pointermove", { clientX: 700, clientY: 960 });
  s.right.fire("pointerup", {});
  s.f.run(50);
  expect(s.turns).toEqual([]);
  expect(s.domFold.flap.style.display).toBe("none");
});

test("a long drag completes the turn", () => {
  const s = setup();
  s.curl.enable();
  s.right.fire("pointerdown", { clientX: 790, clientY: 990 });
  s.right.fire("pointermove", { clientX: 400, clientY: 900 });
  s.right.fire("pointerup", {});
  s.f.run(50);
  expect(s.turns).toEqual([1]);
});

test("pointercancel and lostpointercapture cancel a long drag", () => {
  const s = setup();
  s.curl.enable();
  s.right.fire("pointerdown", { clientX: 790, clientY: 990 });
  s.right.fire("pointermove", { clientX: 100, clientY: 900 });
  s.right.fire("pointercancel", {});
  s.f.run(50);
  s.right.fire("pointerdown", { clientX: 790, clientY: 990 });
  s.right.fire("pointermove", { clientX: 100, clientY: 900 });
  s.right.fire("lostpointercapture", {});
  s.f.run(50);
  expect(s.turns).toEqual([]);
});

test("disabled engine has no handlers and ignores turn requests until enabled", () => {
  const s = setup();
  expect(s.right.count()).toBe(0);
  s.curl.turn(1);
  s.f.run(100);
  expect(s.turns).toEqual([]);
  s.curl.enable();
  expect(s.right.count()).toBeGreaterThan(0);
  s.curl.disable();
  expect(s.right.count()).toBe(0);
  expect(s.left.count()).toBe(0);
});

test("disable in the middle of a turn stops it and restores the static page", () => {
  const s = setup();
  s.curl.enable();
  s.curl.turn(1);
  s.f.step(10);
  s.curl.disable();
  s.f.run(100);
  expect(s.turns).toEqual([]);
  expect(s.domFold.top.style.clipPath).toBe("none");
  expect(s.book.classes.has("nort")).toBe(false);
});

test("canTurn false blocks the turn", () => {
  const book = fakeElement();
  const right = fakeElement();
  const f = fakeClock();
  const turns: number[] = [];
  const curl = createPageCurl({
    book: book as unknown as HTMLElement,
    cornerRight: right as unknown as HTMLElement,
    cornerLeft: fakeElement() as unknown as HTMLElement,
    glCanvas: { getContext: () => null, style: {} } as unknown as HTMLCanvasElement,
    getPageSurface: () => {
      throw new Error("unused");
    },
    onTurn: (d) => turns.push(d),
    canTurn: () => false,
    clock: f.clock,
    prefersReducedMotion: () => false,
  });
  curl.enable();
  right.fire("pointerdown", { clientX: 790, clientY: 990 });
  right.fire("pointerup", {});
  f.run(100);
  expect(turns).toEqual([]);
});
