import { type Rating, type Sentence, reviewProgress } from "@glyphfern/core";
import { Fragment, useEffect, useState } from "react";
import { indexBook } from "../app/book-index";
import { useApp } from "../app/use-app";
import { Fern, Icon } from "../icons/icon";
import type { IconName } from "../icons/icon-data";
import { SENTENCE_RATE, speak } from "../speech/speak";
import { Button, Chip, IconButton } from "../ui";
import { buildReviewQueue, progressDots, sentenceText } from "./review-queue";

interface RatingButton {
  rating: Rating;
  className: string;
  icon: IconName;
  label: string;
}

const RATING_BUTTONS: readonly RatingButton[] = [
  { rating: "again", className: "r1", icon: "face1", label: "Lại" },
  { rating: "hard", className: "r2", icon: "face2", label: "Khó" },
  { rating: "good", className: "r3", icon: "face3", label: "Tốt" },
  { rating: "easy", className: "r4", icon: "face4", label: "Dễ" },
];

function Cloze({
  sentence,
  lemma,
  revealed,
}: { sentence: Sentence; lemma: string; revealed: boolean }) {
  return (
    <span className="ex cz">
      {sentence.tokens.map((token, position) => (
        <Fragment key={`${sentence.id}-${position}-${token.surf}`}>
          {position > 0 ? " " : ""}
          {token.lemma === lemma ? (
            <>
              {token.lead}
              <span className={revealed ? "blank ans" : "blank"}>{token.surf}</span>
              {token.trail}
            </>
          ) : (
            `${token.lead}${token.surf}${token.trail}`
          )}
        </Fragment>
      ))}
    </span>
  );
}

export function ReviewView() {
  const { state, actions } = useApp();
  const active = state.route === "review";
  const [queue, setQueue] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }
    const fresh = buildReviewQueue(state.cards, state.pack.dict);
    setQueue(fresh);
    setTotal(fresh.length);
    setFlipped(false);
  }, [active, state.cards, state.pack.dict]);

  const lemma = queue[0];
  const card = state.cards.find((candidate) => candidate.lemma === lemma);
  const sentence = card
    ? state.books.map((book) => indexBook(book).byId.get(card.sentenceId)).find(Boolean)
    : undefined;
  const entry = lemma === undefined ? undefined : state.pack.dict[lemma];

  if (lemma === undefined || !sentence || !entry) {
    return (
      <div className="rv">
        <div className="rest">
          <Fern />
          <Icon name="check" />
        </div>
      </div>
    );
  }

  const progress = reviewProgress(total, queue);

  const flip = () => {
    if (flipped) {
      return;
    }
    setFlipped(true);
    speak(sentenceText(sentence), state.pack.ttsLocale, SENTENCE_RATE);
  };

  const rate = (rating: Rating) => {
    setQueue(actions.rateCard(queue, rating));
    setFlipped(false);
  };

  return (
    <div className="rv">
      <div className="dots" aria-hidden="true">
        {progressDots(progress).map((dot) => (
          <i key={dot.id} className={dot.className} />
        ))}
      </div>
      <Button className="card" aria-pressed={flipped} onClick={flip}>
        <Cloze sentence={sentence} lemma={lemma} revealed={flipped} />
        {flipped ? (
          <span className="back">
            <span className="lemma">{lemma}</span>
            <Chip className="ipa">{entry.pronunciation}</Chip>
            <span className="mean">{entry.meaning}</span>
          </span>
        ) : null}
      </Button>
      <div className="rate" data-off={flipped ? "0" : "1"}>
        {RATING_BUTTONS.map((button) => (
          <IconButton
            key={button.rating}
            variant={null}
            className={button.className}
            icon={button.icon}
            label={button.label}
            disabled={!flipped}
            onClick={() => rate(button.rating)}
          />
        ))}
      </div>
    </div>
  );
}
