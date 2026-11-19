import type { TextBlock } from "./html-blocks";
import { hasChapterHeadings } from "./paragraph-chapters";

const APPENDIX_START = /^(anexos?|resumen|vocabulario|preguntas|soluciones|respuestas)(?![a-z])/;

function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function isAppendixDocument(blocks: readonly TextBlock[]): boolean {
  const first = blocks[0];
  return first !== undefined && APPENDIX_START.test(foldText(first.text));
}

export function dropAppendixDocuments(documents: readonly TextBlock[][]): TextBlock[][] {
  if (!hasChapterHeadings(documents.flat())) {
    return [...documents];
  }
  return documents.filter((blocks) => !isAppendixDocument(blocks));
}
