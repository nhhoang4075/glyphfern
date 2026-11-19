export class EpubImportError extends Error {
  constructor(
    readonly reason: "container" | "package" | "empty",
    message: string,
  ) {
    super(message);
  }
}
