export const TAP_THRESHOLD_PX = 6;
export const COMPLETE_FRACTION = 0.3;
export const TAP_TURN_MS = 1250;
export const SWEEP_MS = 760;
export const CANCEL_MS = 220;
export const NORT_MS = 120;

export type ReleaseDecision = "tap" | "complete" | "cancel";

export function exceedsTap(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > TAP_THRESHOLD_PX;
}

export function decideRelease(input: {
  moved: boolean;
  cancelled: boolean;
  distanceFromCorner: number;
  bookWidth: number;
}): ReleaseDecision {
  if (input.cancelled) return "cancel";
  if (!input.moved) return "tap";
  return input.distanceFromCorner > input.bookWidth * COMPLETE_FRACTION ? "complete" : "cancel";
}
