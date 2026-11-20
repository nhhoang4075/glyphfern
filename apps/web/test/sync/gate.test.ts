import { describe, expect, test } from "bun:test";
import { decideGate, gateConfigOf } from "../../src/sync/gate";

describe("decideGate", () => {
  test("a stored session opens the app whatever the config says", () => {
    for (const config of ["pending", "failed", "open", "required"] as const) {
      expect(decideGate({ hasSession: true, config })).toBe("app");
    }
  });

  test("without a session the gate waits for the config", () => {
    expect(decideGate({ hasSession: false, config: "pending" })).toBe("loading");
  });

  test("without a session a server without auth skips the gate", () => {
    expect(decideGate({ hasSession: false, config: "open" })).toBe("app");
  });

  test("without a session and a client id the gate shows", () => {
    expect(decideGate({ hasSession: false, config: "required" })).toBe("gate");
  });

  test("without a session and an unreachable config the offline gate shows", () => {
    expect(decideGate({ hasSession: false, config: "failed" })).toBe("gate-offline");
  });
});

describe("gateConfigOf", () => {
  test("maps the account state to a config result", () => {
    expect(gateConfigOf({ googleClientId: "cid", configFailed: false })).toBe("required");
    expect(gateConfigOf({ googleClientId: null, configFailed: false })).toBe("open");
    expect(gateConfigOf({ googleClientId: undefined, configFailed: false })).toBe("pending");
    expect(gateConfigOf({ googleClientId: undefined, configFailed: true })).toBe("failed");
  });
});
