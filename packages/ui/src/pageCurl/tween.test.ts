import { expect, test } from "bun:test";
import { type Clock, runTween } from "./tween";

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
    advance(ms: number) {
      time += ms;
      const cb = pending;
      pending = null;
      cb?.(time);
    },
    hasPending: () => pending !== null,
  };
}

test("linear tween reaches the end value and calls done once", () => {
  const f = fakeClock();
  const values: number[] = [];
  let done = 0;
  runTween({
    from: 0,
    to: 10,
    ms: 100,
    ease: (k) => k,
    clock: f.clock,
    onFrame: (v) => values.push(v),
    onDone: () => done++,
    onError: () => {},
  });
  f.advance(50);
  f.advance(50);
  expect(values).toEqual([5, 10]);
  expect(done).toBe(1);
  expect(f.hasPending()).toBe(false);
});

test("an exception in a frame ends the tween and reports the error", () => {
  const f = fakeClock();
  let errors = 0;
  let done = 0;
  runTween({
    from: 0,
    to: 1,
    ms: 100,
    clock: f.clock,
    onFrame: () => {
      throw new Error("boom");
    },
    onDone: () => done++,
    onError: () => errors++,
  });
  f.advance(10);
  expect(errors).toBe(1);
  expect(done).toBe(0);
  expect(f.hasPending()).toBe(false);
});

test("zero duration applies the end value immediately", () => {
  const values: number[] = [];
  let done = 0;
  runTween({
    from: 0,
    to: 3,
    ms: 0,
    onFrame: (v) => values.push(v),
    onDone: () => done++,
    onError: () => {},
  });
  expect(values).toEqual([3]);
  expect(done).toBe(1);
});

test("the returned stop function cancels the pending frame", () => {
  const f = fakeClock();
  const stop = runTween({
    from: 0,
    to: 1,
    ms: 100,
    clock: f.clock,
    onFrame: () => {},
    onDone: () => {},
    onError: () => {},
  });
  stop();
  expect(f.hasPending()).toBe(false);
});
