import { FERN_MARKUP } from "../icons/iconData";
import { parseMarkup, renderNodes } from "../icons/markup";
import type { ArtKey } from "./books";

const fernNodes = renderNodes(parseMarkup(FERN_MARKUP), "art");

function Motif({ art }: { art: ArtKey }) {
  if (art === "m") {
    return (
      <>
        <circle cx="62" cy="62" r="46" fill="rgba(255,255,255,.12)" />
        <circle cx="62" cy="62" r="24" fill="rgba(194,217,76,.9)" />
        <g transform="translate(70 26) scale(1.7)" color="#fff" opacity=".9">
          {fernNodes}
        </g>
      </>
    );
  }
  if (art === "w") {
    return (
      <>
        <path d="M0 120c40-30 70 10 120-20v100H0z" fill="rgba(255,255,255,.16)" />
        <circle cx="82" cy="46" r="18" fill="rgba(255,255,255,.35)" />
      </>
    );
  }
  if (art === "s") {
    return (
      <>
        <path d="M10 150l50-100 50 100z" fill="rgba(255,255,255,.14)" />
        <circle cx="60" cy="48" r="12" fill="rgba(255,255,255,.4)" />
      </>
    );
  }
  return (
    <>
      <circle cx="60" cy="70" r="34" fill="rgba(255,255,255,.16)" />
      <path d="M60 36l10 34-10 34-10-34z" fill="rgba(255,255,255,.45)" />
    </>
  );
}

export function CoverArt({ art }: { art: ArtKey }) {
  return (
    <svg
      className="art"
      viewBox="0 0 120 180"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <Motif art={art} />
    </svg>
  );
}
