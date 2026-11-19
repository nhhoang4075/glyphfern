import type { LanguagePack, Sentence } from "@glyphfern/core";
import { Fragment, memo } from "react";
import { Fern } from "../icons/Icon";
import { isRomanNumeral } from "./readerLogic";
import { sentenceKey } from "./sentenceKey";

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

function FlowContent({ pack }: { pack: LanguagePack }) {
  return (
    <>
      {pack.book.chapters.map((chapter, chapterIndex) => (
        <Fragment key={chapter.title.id}>
          <h2 data-ch={chapterIndex}>
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
