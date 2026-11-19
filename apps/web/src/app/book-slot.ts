export const SLOT_MIN = 1000;
export const SLOT_LIMIT = 2 ** 30;

export function allocateSlot(taken: Iterable<number>, random: () => number): number {
  const used = new Set(taken);
  let slot = SLOT_MIN + Math.floor(random() * (SLOT_LIMIT - SLOT_MIN));
  while (used.has(slot)) {
    slot = SLOT_MIN + Math.floor(random() * (SLOT_LIMIT - SLOT_MIN));
  }
  return slot;
}
