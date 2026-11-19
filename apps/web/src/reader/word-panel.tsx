import type { Sentence } from "@glyphfern/core";
import { Fragment } from "react";
import type { TapTarget } from "../app/api";
import { useApp } from "../app/use-app";
import { Icon } from "../icons/icon";
import type { IconName } from "../icons/icon-data";
import { toDictEntry } from "../lexicon/lexicon-client";
import { useLookup } from "../lexicon/use-lookup";
import { SENTENCE_RATE, WORD_RATE, speak } from "../speech/speak";
import { Chip, IconButton, Section, Segmented, Sheet } from "../ui";
import {
  type RevealState,
  groupMembers,
  groupSurface,
  isRevealOpen,
  noteSegments,
  sentenceText,
  showsLemmaChip,
} from "./reader-logic";

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
  const staticEntry = state.pack.dict[lemma];
  const looked = useLookup(state.lang, token?.surf ?? "", token !== undefined && !staticEntry);
  const entry = staticEntry ?? (looked ? toDictEntry(looked) : undefined);
  const lemmaShown = staticEntry ? lemma : (looked?.lemma ?? lemma);
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
    <Sheet variant="dock" open={open} aria-label="Từ">
      <div className="pw">
        <h3>{surface}</h3>
        <IconButton
          variant="sm"
          icon="speaker"
          label="Phát âm từ"
          onClick={() => speak(surface, locale, WORD_RATE)}
        />
      </div>
      <Section className="chips">
        <Chip>{entry?.pos ?? ""}</Chip>
        {token && showsLemmaChip(lemmaShown, surface) ? (
          <Chip className="lem">
            <Icon name="root" />
            {lemmaShown}
          </Chip>
        ) : null}
        <Chip className="ipa">{entry?.pronunciation ?? ""}</Chip>
        {token?.morphemes?.map((morpheme, index) => (
          <Chip className="mo" key={`${index}-${morpheme.form}`}>
            <b>{morpheme.form}</b>
            {morpheme.gloss}
          </Chip>
        ))}
      </Section>
      <p className="mean">{entry?.meaning ?? ""}</p>
      <div className="note" hidden={!entry?.note}>
        <Icon name="bulb" />
        <span>{entry?.note ?? ""}</span>
      </div>
      <Section className="acts">
        <Segmented
          container="fieldset"
          className="stg"
          label="Trạng thái"
          optionClassName="st"
          activeClassName="on"
          value={STATE_BUTTONS.find((button) => button.target === current.kind)?.target ?? null}
          onChange={choose}
          options={STATE_BUTTONS.map((button) => ({
            value: button.target,
            label: button.label,
            className: button.className,
            content: <Icon name={button.icon} />,
          }))}
        />
        <span className="sp" />
        <IconButton
          variant="st"
          className="cd"
          active={hasCard}
          icon="cardplus"
          label={hasCard ? "Xóa thẻ" : "Thêm thẻ"}
          aria-pressed={hasCard}
          onClick={toggleCard}
        />
      </Section>
      <Section className="ctx">
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
          <IconButton
            variant="sm"
            icon="speaker"
            label="Đọc câu"
            onClick={() => sentence && speak(sentenceText(sentence), locale, SENTENCE_RATE)}
          />
          <IconButton
            variant="sm"
            className="tgl"
            active={reveal.translation}
            icon="translate"
            label="Dịch câu"
            aria-pressed={reveal.translation}
            onClick={() => onToggleReveal("translation")}
          />
          <IconButton
            variant="sm"
            className="tgl"
            active={reveal.grammar}
            icon="sparkle"
            label="Phân tích câu"
            aria-pressed={reveal.grammar}
            onClick={() => onToggleReveal("grammar")}
          />
        </div>
      </Section>
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
    </Sheet>
  );
}
