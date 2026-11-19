import { describe, expect, test } from "bun:test";
import {
  BOOK_UPLOAD_LIMIT_BYTES,
  BodyTooLargeError,
  DEFAULT_BODY_LIMIT_BYTES,
  bodyLimitFor,
  readBodyWithin,
} from "../body-limit";

describe("body limit per route", () => {
  test("only PUT /api/books/<id> gets the 32 MB cap", () => {
    expect(bodyLimitFor("PUT", "/api/books/user-1")).toBe(BOOK_UPLOAD_LIMIT_BYTES);
    expect(bodyLimitFor("POST", "/api/books/user-1")).toBe(DEFAULT_BODY_LIMIT_BYTES);
    expect(bodyLimitFor("PUT", "/api/books/")).toBe(DEFAULT_BODY_LIMIT_BYTES);
    expect(bodyLimitFor("PUT", "/api/sync/push")).toBe(DEFAULT_BODY_LIMIT_BYTES);
    expect(bodyLimitFor("POST", "/api/lemmas")).toBe(DEFAULT_BODY_LIMIT_BYTES);
  });

  test("a body over the limit is rejected, one within it is read", async () => {
    const small = new Request("http://x/api/a", { method: "POST", body: new Uint8Array(10) });
    expect((await readBodyWithin(small, 10)).byteLength).toBe(10);
    const big = new Request("http://x/api/a", { method: "POST", body: new Uint8Array(11) });
    await expect(readBodyWithin(big, 10)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  test("a streamed body without a length is cut off at the limit", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
        controller.close();
      },
    });
    const request = new Request("http://x/api/a", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readBodyWithin(request, 10)).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});
