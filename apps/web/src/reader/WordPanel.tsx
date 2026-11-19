import type { Sentence } from "@glyphfern/core";
import { Fragment } from "react";
import type { TapTarget } from "../app/api";
import { useApp } from "../app/useApp";
import { Icon } from "../icons/Icon";
import type { IconName } from "../icons/iconData";
import { SENTENCE_RATE, WORD_RATE, speak } from "../speech/speak";
import {
  type RevealState,
  groupMembers,
  groupSurface,
  isRevealOpen,
  noteSegments,
  sentenceText,
  showsLemmaChip,
} from "./readerLogic";

export interface ActiveWord {
  sentence: Sentence;
  tokenIndex: number;
}

interface WordPanelProps {
  open: boolean;
  word: ActiveWord | null;
  reveal: RevealState;
  onToggleReveal: (which: keyof RevealState) => void;
  onPulse: () => void;
}

interface StateButton {
  target: TapTarget;
  className: string;
  icon: IconName;
  label: string;
}

const STATE_BUTTONS: readonly StateButton[] = [
  { target: "new", className: "nw", icon: "circle", label: "Mới" },
  { target: "learning", className: "lamp", icon: "flame", label: "Đang học" },
  { target: "known", className: "ok", icon: "check", label: "Đã biết" },
];

function Note({ markup }: { markup: string }) {
  return (
    <>
      {noteSegments(markup).map((segment, index) => {
        const key = `${index}-${segment.text}`;
        if (segment.bold) return <b key={key}>{segment.text}</b>;
        if (segment.italic) return <i key={key}>{segment.text}</i>;
        return <Fragment key={key}>{segment.text}</Fragment>;
      })}
    </>
  );
}

export function WordPanel({ open, word, reveal, onToggleReveal, onPulse }: WordPanelProps) {
  const { state, stateOf, actions } = useApp();
  const sentence = word?.sentence ?? null;
  const token = sentence?.tokens[word?.tokenIndex ?? 0];
  const lemma = token?.lemma ?? "";
  const members = sentence && word ? groupMembers(sentence, word.tokenIndex) : [];
  const surface = sentence && word ? groupSurface(sentence, word.tokenIndex) : "";
  const entry = state.pack.dict[lemma];
  const current = stateOf(lemma);
  const hasCard = state.cards.some((card) => card.lemma === lemma);
  const locale = state.pack.ttsLocale;
  const extraOpen = isRevealOpen(reveal);

  const choose = (target: TapTarget) => {
    if (!token) return;
    if (actions.setWordState(lemma, target).pulse) onPulse();
  };

  const toggleCard = () => {
    if (!token || !sentence) return;
    if (hasCard) {
      actions.removeCard(lemma);
      return;
    }
    if (actions.addCard(lemma, sentence.id).pulse) onPulse();
  };

  return (
    <div className="panel" hidden={!open} aria-hidden={!open} aria-label="Từ">
      <div className="pw">
        <h3>{surface}</h3>
        <button
          type="button"
          className="sm"
          aria-label="Phát âm từ"
          onClick={() => speak(surface, locale, WORD_RATE)}
        >
          <Icon name="speaker" />
        </button>
      </div>
      <div className="chips">
        <span className="chip">{entry?.pos ?? ""}</span>
        <span className="chip ipa">{entry?.pronunciation ?? ""}</span>
        {token && showsLemmaChip(lemma, surface) ? (
          <span className="chip lem">
            <Icon name="root" />
            {lemma}
          </span>
        ) : null}
        {token?.morphemes?.map((morpheme, index) => (
          <span className="chip mo" key={`${index}-${morpheme.form}`}>
            <b>{morpheme.form}</b>
            {morpheme.gloss}
          </span>
        ))}
      </div>
      <p className="mean">{entry?.meaning ?? ""}</p>
      <div className="note" hidden={!entry?.note}>
        <Icon name="bulb" />
        <span>{entry?.note ?? ""}</span>
      </div>
      <div className="acts">
        <fieldset className="stg" aria-label="Trạng thái">
          {STATE_BUTTONS.map((button) => {
            const active =
              (button.target === "new" && current.kind === "new") ||
              (button.target === "learning" && current.kind === "learning") ||
              (button.target === "known" && current.kind === "known");
            return (
              <button
                type="button"
                key={button.target}
                className={active ? `st ${button.className} on` : `st ${button.className}`}
                aria-label={button.label}
                aria-pressed={active}
                onClick={() => choose(button.target)}
              >
                <Icon name={button.icon} />
              </button>
            );
          })}
        </fieldset>
        <span className="sp" />
        <button
          type="button"
          className={hasCard ? "st cd on" : "st cd"}
          aria-label={hasCard ? "Xóa thẻ" : "Thêm thẻ"}
          aria-pressed={hasCard}
          onClick={toggleCard}
        >
          <Icon name="cardplus" />
        </button>
      </div>
      <div className="ctx">
        <p>
          {sentence?.tokens.map((item, index) => (
            <Fragment key={`${index}-${item.surf}`}>
              {index > 0 ? " " : ""}
              {members.includes(index) ? (
                <em>{item.lead + item.surf + item.trail}</em>
              ) : (
                item.lead + item.surf + item.trail
              )}
            </Fragment>
          ))}
        </p>
        <div className="tools">
          <button
            type="button"
            className="sm"
            aria-label="Đọc câu"
            onClick={() => sentence && speak(sentenceText(sentence), locale, SENTENCE_RATE)}
          >
            <Icon name="speaker" />
          </button>
          <button
            type="button"
            className={reveal.translation ? "sm tgl on" : "sm tgl"}
            aria-label="Dịch câu"
            aria-pressed={reveal.translation}
            onClick={() => onToggleReveal("translation")}
          >
            <Icon name="translate" />
          </button>
          <button
            type="button"
            className={reveal.grammar ? "sm tgl on" : "sm tgl"}
            aria-label="Phân tích câu"
            aria-pressed={reveal.grammar}
            onClick={() => onToggleReveal("grammar")}
          >
            <Icon name="sparkle" />
          </button>
        </div>
      </div>
      <div className={extraOpen ? "extra open" : "extra"}>
        <div className={reveal.translation ? "xw on" : "xw"}>
          <div className="xi">
            <p className="tr">{sentence?.vi ?? ""}</p>
          </div>
        </div>
        <div className={reveal.grammar ? "xw on" : "xw"}>
          <div className="xi">
            <ul className="notes">
              {(sentence?.notes ?? []).map((note, index) => (
                <li key={`${index}-${note}`}>
                  <Note markup={note} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
