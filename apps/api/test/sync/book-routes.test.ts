import { describe, expect, test } from "bun:test";
import { type Api, createApi, push, useKeys } from "./sync-support";

useKeys();

function gz(text: string): Uint8Array {
  return Bun.gzipSync(new TextEncoder().encode(text));
}

function put(
  api: Api,
  token: string,
  id: string,
  body: Uint8Array,
  query = "?lang=es&title=Don%20Quijote&addedAt=1700",
) {
  return api.call(`/books/${id}${query}`, token, {
    method: "PUT",
    headers: { "content-type": "application/gzip", "content-length": String(body.length) },
    body,
  });
}

describe("books", () => {
  test("a book round-trips as gzip bytes and shows in pull metadata", async () => {
    const api = await createApi();
    const data = gz("book json");
    expect((await put(api, api.owner, "b1", data)).status).toBe(204);
    const got = await api.call("/books/b1", api.owner);
    expect(got.status).toBe(200);
    expect(got.headers.get("content-type")).toBe("application/gzip");
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(data);
    const page = (await (await api.call("/sync/pull", api.owner)).json()) as { books: unknown[] };
    expect(page.books).toEqual([
      {
        id: "b1",
        lang: "es",
        title: "Don Quijote",
        addedAt: 1700,
        seq: 1,
        deleted: false,
        bytes: data.length,
      },
    ]);
  });

  test("deleting writes a tombstone with a newer seq and the book answers 404", async () => {
    const api = await createApi();
    await put(api, api.owner, "b1", gz("x"));
    expect((await api.call("/books/b1", api.owner, { method: "DELETE" })).status).toBe(204);
    expect((await api.call("/books/b1", api.owner)).status).toBe(404);
    const page = (await (await api.call("/sync/pull", api.owner)).json()) as {
      books: { deleted: boolean; seq: number; bytes: number }[];
    };
    expect(page.books[0]).toMatchObject({ deleted: true, seq: 2, bytes: 0 });
  });

  test("book writes and record writes share one seq sequence", async () => {
    const api = await createApi();
    await push(api, api.owner, [
      { kind: "position", key: "b1", payload: { sentenceId: 1 }, updatedAt: 1, deleted: false },
    ]);
    await put(api, api.owner, "b1", gz("x"));
    const page = (await (await api.call("/sync/pull", api.owner)).json()) as {
      records: { seq: number }[];
      books: { seq: number }[];
      cursor: number;
    };
    expect(page.records[0]?.seq).toBe(1);
    expect(page.books[0]?.seq).toBe(2);
    expect(page.cursor).toBe(2);
  });

  test("invalid ids, queries, content types and bodies are refused", async () => {
    const api = await createApi();
    const data = gz("x");
    expect((await put(api, api.owner, "bad%20id", data)).status).toBe(400);
    expect((await put(api, api.owner, "a".repeat(65), data)).status).toBe(400);
    expect((await put(api, api.owner, "b1", data, "?lang=fr&title=T")).status).toBe(400);
    expect((await put(api, api.owner, "b1", data, "?lang=es&title=")).status).toBe(400);
    expect(
      (await put(api, api.owner, "b1", data, `?lang=es&title=${"t".repeat(301)}`)).status,
    ).toBe(400);
    expect((await put(api, api.owner, "b1", data, "?lang=es&title=T&addedAt=x")).status).toBe(400);
    expect((await put(api, api.owner, "b1", new Uint8Array(0))).status).toBe(400);
    expect((await put(api, api.owner, "b1", new TextEncoder().encode("plain text"))).status).toBe(
      400,
    );
    const wrongType = await api.call("/books/b1?lang=es&title=T", api.owner, {
      method: "PUT",
      headers: { "content-type": "text/plain", "content-length": String(data.length) },
      body: data,
    });
    expect(wrongType.status).toBe(415);
    const tooBig = await api.call("/books/b1?lang=es&title=T", api.owner, {
      method: "PUT",
      headers: { "content-type": "application/gzip", "content-length": String(33 * 1024 * 1024) },
      body: data,
    });
    expect(tooBig.status).toBe(413);
    expect((await api.call("/books/b1", api.owner, { method: "POST" })).status).toBe(405);
  });

  test("the 51st live book answers 413 quota_exceeded", async () => {
    const api = await createApi();
    for (let index = 0; index < 50; index += 1) {
      expect((await put(api, api.owner, `b${index}`, gz("x"))).status).toBe(204);
    }
    const over = await put(api, api.owner, "extra", gz("x"));
    expect(over.status).toBe(413);
    expect(await over.json()).toEqual({ error: "quota_exceeded" });
    expect((await put(api, api.owner, "b0", gz("y"))).status).toBe(204);
    await api.call("/books/b1", api.owner, { method: "DELETE" });
    expect((await put(api, api.owner, "extra", gz("x"))).status).toBe(204);
  });

  test("the total size quota is 200 MB", async () => {
    const api = await createApi();
    const chunk = new Uint8Array(30 * 1024 * 1024);
    chunk.set([0x1f, 0x8b, 8]);
    for (let index = 0; index < 6; index += 1) {
      expect((await put(api, api.owner, `big${index}`, chunk)).status).toBe(204);
    }
    const over = await put(api, api.owner, "big6", chunk);
    expect(over.status).toBe(413);
    expect(await over.json()).toEqual({ error: "quota_exceeded" });
  });

  test("a second user cannot read, overwrite or delete the first user's book", async () => {
    const api = await createApi();
    const data = gz("owner book");
    await put(api, api.owner, "shared-id", data);
    expect((await api.call("/books/shared-id", api.second)).status).toBe(404);
    await put(api, api.second, "shared-id", gz("intruder"), "?lang=es&title=Other");
    await api.call("/books/shared-id", api.second, { method: "DELETE" });
    const got = await api.call("/books/shared-id", api.owner);
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(data);
    const page = (await (await api.call("/sync/pull", api.owner)).json()) as {
      books: { title: string; deleted: boolean }[];
    };
    expect(page.books).toHaveLength(1);
    expect(page.books[0]).toMatchObject({ title: "Don Quijote", deleted: false });
  });
});
