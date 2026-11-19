export const DEFAULT_BODY_LIMIT_BYTES = 512 * 1024;
export const BOOK_UPLOAD_LIMIT_BYTES = 32 * 1024 * 1024;
const BOOK_UPLOAD_PREFIX = "/api/books/";

export function bodyLimitFor(method: string, pathname: string): number {
  return method === "PUT" &&
    pathname.startsWith(BOOK_UPLOAD_PREFIX) &&
    pathname.length > BOOK_UPLOAD_PREFIX.length
    ? BOOK_UPLOAD_LIMIT_BYTES
    : DEFAULT_BODY_LIMIT_BYTES;
}

export class BodyTooLargeError extends Error {}

export async function readBodyWithin(request: Request, limit: number): Promise<ArrayBuffer> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > limit) {
    throw new BodyTooLargeError();
  }
  const reader = request.body?.getReader();
  if (!reader) {
    return new ArrayBuffer(0);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}
