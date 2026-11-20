export type GateView = "app" | "gate" | "gate-offline" | "loading";

export type GateConfig = "pending" | "failed" | "open" | "required";

export interface GateInput {
  hasSession: boolean;
  config: GateConfig;
}

export function decideGate({ hasSession, config }: GateInput): GateView {
  if (hasSession) {
    return "app";
  }
  switch (config) {
    case "pending":
      return "loading";
    case "failed":
      return "gate-offline";
    case "open":
      return "app";
    case "required":
      return "gate";
  }
}

export function gateConfigOf(state: {
  googleClientId: string | null | undefined;
  configFailed: boolean;
}): GateConfig {
  if (typeof state.googleClientId === "string") {
    return "required";
  }
  if (state.googleClientId === null) {
    return "open";
  }
  return state.configFailed ? "failed" : "pending";
}
