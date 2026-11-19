import { describe, expect, test } from "bun:test";
import { type SettleTimers, createSettler } from "../../src/app/settle";

function fakeTimers() {
  let now = 0;
  let nextHandle = 1;
  const scheduled = new Map<number, { at: number; callback: () => void }>();
  const timers: SettleTimers = {
    set(callback, delayMs) {
      const handle = nextHandle++;
      scheduled.set(handle, { at: now + delayMs, callback });
      return handle;
    },
    clear(handle) {
      scheduled.delete(handle);
    },
  };
  function advance(ms: number) {
    now += ms;
    for (const [handle, entry] of [...scheduled]) {
      if (entry.at <= now) {
        scheduled.delete(handle);
        entry.callback();
      }
    }
  }
  return { timers, advance };
}

function harness(delayMs = 150) {
  const clock = fakeTimers();
  const log: string[] = [];
  const settler = createSettler({
    delayMs,
    timers: clock.timers,
    onUnsettled: () => log.push("unsettled"),
    onSettled: () => log.push("settled"),
  });
  return { ...clock, settler, log };
}

describe("createSettler", () => {
  test("a single touch settles once after the delay", () => {
    const { settler, advance, log } = harness();
    settler.touch();
    advance(149);
    expect(log).toEqual(["unsettled"]);
    advance(1);
    expect(log).toEqual(["unsettled", "settled"]);
  });

  test("a burst of touches reports one unsettled and one settled, after the last touch", () => {
    const { settler, advance, log } = harness();
    settler.touch();
    advance(100);
    settler.touch();
    advance(100);
    settler.touch();
    advance(149);
    expect(log).toEqual(["unsettled"]);
    advance(1);
    expect(log).toEqual(["unsettled", "settled"]);
  });

  test("a touch after settling starts a new burst", () => {
    const { settler, advance, log } = harness();
    settler.touch();
    advance(150);
    settler.touch();
    advance(150);
    expect(log).toEqual(["unsettled", "settled", "unsettled", "settled"]);
  });

  test("cancel drops the pending settle", () => {
    const { settler, advance, log } = harness();
    settler.touch();
    expect(settler.pending()).toBe(true);
    settler.cancel();
    advance(500);
    expect(settler.pending()).toBe(false);
    expect(log).toEqual(["unsettled"]);
  });
});
