import type { LanguagePack, Sentence } from "@glyphfern/core";
import { Fragment, memo } from "react";
import { Fern } from "../icons/icon";
import type { ChapterWindow } from "./chapter-window";
import { isRomanNumeral } from "./reader-logic";
import { sentenceKey } from "./sentence-key";

const WORD_ACCESSIBILITY = { role: "button", tabIndex: 0 } as const;

function Tokens({ sentence, title }: { sentence: Sentence; title: boolean }) {
  const key = sentenceKey(sentence.id);
  return (
    <span className="s" data-s={key}>
      {sentence.tokens.map((token, index) => (
        <Fragment key={`${index}-${token.surf}`}>
          {token.lead}
          {title && isRomanNumeral(token.surf) ? (
            token.surf
          ) : (
            <span
              className="w"
              {...WORD_ACCESSIBILITY}
              data-s={key}
              data-i={index}
              data-l={token.lemma}
              {...(token.unmatched ? { "data-u": "" } : {})}
              {...(token.group === undefined ? {} : { "data-g": token.group })}
            >
              {token.surf}
            </span>
          )}
          {token.trail}{" "}
        </Fragment>
      ))}
    </span>
  );
}

function FlowContent({ pack, span }: { pack: LanguagePack; span: ChapterWindow }) {
  const visible = pack.book.chapters.slice(span.first, span.last + 1);
  return (
    <>
      {visible.map((chapter, offset) => (
        <Fragment key={chapter.title.id}>
          <h2 data-ch={span.first + offset}>
            <Fern className="hfern" />
            <Tokens sentence={chapter.title} title />
          </h2>
          {chapter.paragraphs.map((paragraph) => (
            <p key={paragraph[0]?.id}>
              {paragraph.map((sentence) => (
                <Tokens key={sentence.id} sentence={sentence} title={false} />
              ))}
            </p>
          ))}
        </Fragment>
      ))}
    </>
  );
}

export const Flow = memo(FlowContent);
