import { expect, test } from "bun:test";
import { FRAGMENT_SOURCE, VERTEX_SOURCE } from "./shader";

test("shader sources contain the specified constants", () => {
  expect(FRAGMENT_SOURCE).toContain("uPaper*0.985");
  expect(FRAGMENT_SOURCE).toContain("1.0-0.11*exp(-(t-a)/90.0)");
  expect(FRAGMENT_SOURCE).toContain("mix(0.94,1.0,smoothstep(0.0,25.0,ts))");
  expect(FRAGMENT_SOURCE).toContain("0.12*exp(-(t-a)/26.0)");
  expect(FRAGMENT_SOURCE).toContain("0.14*exp(-max(edge-t,0.0)/30.0)");
  expect(FRAGMENT_SOURCE).toContain("smoothstep(edge-6.0,a+2.0,t)");
  expect(FRAGMENT_SOURCE).toContain("R*3.0+10.0");
  expect(VERTEX_SOURCE).toContain("vPx=a*uSize");
});

test("shader sources contain no comments", () => {
  expect(FRAGMENT_SOURCE).not.toMatch(/\/\/|\/\*/);
  expect(VERTEX_SOURCE).not.toMatch(/\/\/|\/\*/);
});
