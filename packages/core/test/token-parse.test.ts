import { describe, expect, test } from "bun:test";
import { parseTokens } from "../src/token-parse";

describe("token parsing", () => {
  test("an empty text produces no tokens", () => {
    expect(parseTokens("")).toEqual([]);
  });

  test("a bare surface gets the lowercased surface as lemma", () => {
    expect(parseTokens("Casa")).toEqual([{ lead: "", surf: "Casa", trail: "", lemma: "casa" }]);
  });

  test("an explicit lemma replaces the lowercased surface", () => {
    expect(parseTokens("Había|haber")).toEqual([
      { lead: "", surf: "Había", trail: "", lemma: "haber" },
    ]);
  });

  test("an empty group field leaves the token without a group", () => {
    const [token] = parseTokens("gato||");
    expect(token).toEqual({ lead: "", surf: "gato", trail: "", lemma: "gato" });
    expect(token).not.toHaveProperty("group");
  });

  test("a group field is kept on the token", () => {
    const [token] = parseTokens("se|se|fue");
    expect(token).toEqual({ lead: "", surf: "se", trail: "", lemma: "se", group: "fue" });
  });

  test("leading and trailing punctuation is split from the letters", () => {
    const [token] = parseTokens("“어디에|어디||어디=đâu+에=đến");
    expect(token).toEqual({
      lead: "“",
      surf: "어디에",
      trail: "",
      lemma: "어디",
      morphemes: [
        { form: "어디", gloss: "đâu" },
        { form: "에", gloss: "đến" },
      ],
    });
  });

  test("trailing punctuation is kept in trail and not in surf", () => {
    const [token] = parseTokens("sol.|sol");
    expect(token).toEqual({ lead: "", surf: "sol", trail: ".", lemma: "sol" });
  });

  test("morpheme glosses turn underscores into spaces", () => {
    const [token] = parseTokens("숲에서|숲||숲=rừng+에서=ở_(nơi_diễn_ra)");
    expect(token?.morphemes).toEqual([
      { form: "숲", gloss: "rừng" },
      { form: "에서", gloss: "ở (nơi diễn ra)" },
    ]);
  });

  test("a morpheme without a gloss separator gets an empty gloss", () => {
    const [token] = parseTokens("가|가||가");
    expect(token?.morphemes).toEqual([{ form: "가", gloss: "" }]);
  });

  test("several tokens are split on single spaces in order", () => {
    const tokens = parseTokens("Había|haber una|un “casa”");
    expect(tokens.map((token) => token.surf)).toEqual(["Había", "una", "casa"]);
    expect(tokens.map((token) => token.lemma)).toEqual(["haber", "un", "casa"]);
    expect(tokens[2]?.lead).toBe("“");
    expect(tokens[2]?.trail).toBe("”");
  });

  test("a token with no letters keeps its characters in lead", () => {
    const [token] = parseTokens("—|—");
    expect(token).toEqual({ lead: "—", surf: "", trail: "", lemma: "—" });
  });
});
