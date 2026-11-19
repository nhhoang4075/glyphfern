import { describe, expect, test } from "bun:test";
import { expandPos } from "./expandPos";

describe("expandPos", () => {
  test.each([
    ["dt", "danh từ"],
    ["đg", "động từ"],
    ["tt", "tính từ"],
    ["gt", "giới từ"],
    ["đt", "đại từ"],
    ["số", "số từ"],
  ])("expands the abbreviation %s", (abbreviation, expected) => {
    expect(expandPos(abbreviation)).toBe(expected);
  });

  test("keeps the words that follow a leading abbreviation", () => {
    expect(expandPos("đg bất quy tắc")).toBe("động từ bất quy tắc");
    expect(expandPos("đt quan hệ")).toBe("đại từ quan hệ");
    expect(expandPos("đg phản thân")).toBe("động từ phản thân");
  });

  test("leaves labels that are already spelled out unchanged", () => {
    expect(expandPos("mạo từ")).toBe("mạo từ");
    expect(expandPos("trạng từ")).toBe("trạng từ");
    expect(expandPos("sở hữu")).toBe("sở hữu");
    expect(expandPos("liên từ")).toBe("liên từ");
    expect(expandPos("từ hỏi")).toBe("từ hỏi");
  });

  test("does not expand an abbreviation that appears in the middle of a label", () => {
    expect(expandPos("trạng dt")).toBe("trạng dt");
  });
});
