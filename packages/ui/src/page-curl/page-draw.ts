export type TextSegment = {
  text: string;
  x: number;
  y: number;
  w: number;
  font: string;
  color: string;
  letterSpacing: string;
};

export type BoxSegment = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
};

export type IconSegment = {
  x: number;
  y: number;
  w: number;
  h: number;
  image: HTMLImageElement;
};

export type DotSegment = {
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
};

export type StripSegment = {
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
};

const STRIP_ALPHA: Record<string, number> = { l1: 0.38, l2: 0.6, l3: 0.85 };
const STRIP_COLOR = "194, 217, 76";
const SPAN_MARGIN_PX = 2;

export type Segments = {
  strips: StripSegment[];
  dots: DotSegment[];
  texts: TextSegment[];
  boxes: BoxSegment[];
  icons: IconSegment[];
};

export const DEFAULT_BOX_SELECTOR = ".w.l1,.w.l2,.w.l3,.w.nw,.w.sel,.w.grp";

const iconCache = new Map<string, HTMLImageElement>();

function iconImage(svg: SVGElement): HTMLImageElement {
  const style = getComputedStyle(svg);
  const rect = svg.getBoundingClientRect();
  const source = svg.outerHTML
    .replace(/currentColor/g, style.color)
    .replace(
      "<svg",
      `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}"`,
    );
  let image = iconCache.get(source);
  if (!image) {
    image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    iconCache.set(source, image);
  }
  return image;
}

export const SOFT_HYPHEN = "\u00AD";

export function glyphText(char: string, width: number, upper: boolean): string | null {
  if (char === SOFT_HYPHEN) return width > 0 ? "-" : null;
  return upper ? char.toUpperCase() : char;
}

export function wordText(word: string, upper: boolean): string {
  const visible = word.split(SOFT_HYPHEN).join("");
  return upper ? visible.toUpperCase() : visible;
}

function isTransparent(color: string): boolean {
  return color === "transparent" || /^rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*0\s*\)$/.test(color);
}

export function chooseGlyphRect(rects: readonly { width: number }[], glyphWidth: number): number {
  let best = -1;
  let bestGap = Number.POSITIVE_INFINITY;
  rects.forEach((rect, index) => {
    const gap = Math.abs(rect.width - glyphWidth);
    if (gap < bestGap) {
      best = index;
      bestGap = gap;
    }
  });
  return best;
}

type RectPosition = { left: number; top: number };

const SAME_RECT_TOLERANCE_PX = 0.5;

export function withoutPreviousHyphen<T extends RectPosition>(
  rects: readonly T[],
  previousHyphen: RectPosition | undefined,
): readonly T[] {
  const first = rects[0];
  if (!previousHyphen || !first || rects.length < 2) return rects;
  const same =
    Math.abs(first.left - previousHyphen.left) <= SAME_RECT_TOLERANCE_PX &&
    Math.abs(first.top - previousHyphen.top) <= SAME_RECT_TOLERANCE_PX;
  return same ? rects.slice(1) : rects;
}

export function stripsForRects(
  rects: readonly { left: number; bottom: number; width: number }[],
  frame: { left: number; top: number },
  fontSize: number,
  alpha: number,
) {
  const height = fontSize * 0.42;
  return rects.map((rect) => ({
    x: rect.left - frame.left,
    y: rect.bottom - frame.top - fontSize * 0.07 - height,
    w: rect.width,
    h: height,
    alpha,
  }));
}

export function pageSpan(
  pages: readonly number[],
  pageStep: number,
  pageWidth: number,
): readonly (readonly [number, number])[] {
  return pages.map((page) => [
    page * pageStep - SPAN_MARGIN_PX,
    page * pageStep + pageWidth + SPAN_MARGIN_PX,
  ]);
}

export function touchesSpan(
  rects: readonly { left: number; right: number }[],
  frameLeft: number,
  spans: readonly (readonly [number, number])[],
): boolean {
  return rects.some((rect) =>
    spans.some(([from, to]) => rect.right - frameLeft >= from && rect.left - frameLeft <= to),
  );
}

export function blockElementsOnPages(
  flow: HTMLElement,
  pages: readonly number[],
  pageStep: number,
  pageWidth: number,
): Element[] {
  const frameLeft = flow.getBoundingClientRect().left;
  const spans = pageSpan(pages, pageStep, pageWidth);
  return [...flow.children].filter((block) =>
    touchesSpan([...block.getClientRects()], frameLeft, spans),
  );
}

export function preloadIcons(flow: HTMLElement): void {
  for (const svg of flow.querySelectorAll<SVGElement>("svg")) iconImage(svg);
}

export function collectSegments(
  flow: HTMLElement,
  boxSelector: string = DEFAULT_BOX_SELECTOR,
  scope: readonly Element[] = [flow],
): Segments {
  const frame = flow.getBoundingClientRect();
  const out: Segments = { texts: [], boxes: [], icons: [], dots: [], strips: [] };
  const range = document.createRange();
  const measure = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
  for (const root of scope) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = node.nodeValue ?? "";
      const parent = node.parentElement;
      if (!parent || !/\S/.test(value)) continue;
      const style = getComputedStyle(parent);
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const upper = style.textTransform === "uppercase";
      const words = /\S+/g;
      for (let match = words.exec(value); match; match = words.exec(value)) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rects = range.getClientRects();
        const first = rects[0];
        if (rects.length === 1 && first) {
          out.texts.push({
            text: wordText(match[0], upper),
            x: first.left - frame.left,
            y: first.top - frame.top,
            w: first.width,
            font,
            color: style.color,
            letterSpacing: style.letterSpacing,
          });
          continue;
        }
        measure.font = font;
        const spacing = Number.parseFloat(style.letterSpacing) || 0;
        let previousHyphen: DOMRect | undefined;
        for (let k = 0; k < match[0].length; k++) {
          range.setStart(node, match.index + k);
          range.setEnd(node, match.index + k + 1);
          const char = match[0][k] ?? "";
          const rects = [...range.getClientRects()];
          const shown = upper ? char.toUpperCase() : char;
          const expectedWidth = measure.measureText(shown).width + spacing;
          const chosen = chooseGlyphRect(rects, expectedWidth);
          const glyph = chosen === -1 ? undefined : rects[chosen];
          const text = glyph ? glyphText(char, glyph.width, upper) : null;
          if (glyph && text !== null) {
            out.texts.push({
              text,
              x: glyph.left - frame.left,
              y: glyph.top - frame.top,
              w: glyph.width,
              font,
              color: style.color,
              letterSpacing: style.letterSpacing,
            });
          }
          const hyphen = chosen === -1 ? undefined : rects[chosen + 1];
          if (hyphen && hyphen.width > 0 && chosen + 1 < rects.length) {
            previousHyphen = hyphen;
            out.texts.push({
              text: "-",
              x: hyphen.left - frame.left,
              y: hyphen.top - frame.top,
              w: hyphen.width,
              font,
              color: style.color,
              letterSpacing: style.letterSpacing,
            });
          }
        }
      }
    }
    for (const element of root.querySelectorAll<HTMLElement>(boxSelector)) {
      const style = getComputedStyle(element);
      if (style.backgroundImage !== "none") {
        const level = ["l1", "l2", "l3"].find((name) => element.classList.contains(name));
        const rects = element.getClientRects();
        if (level && !flow.classList.contains("nohl")) {
          const fontSize = Number.parseFloat(style.fontSize) || 16;
          out.strips.push(
            ...stripsForRects(
              [...rects],
              { left: frame.left, top: frame.top },
              fontSize,
              STRIP_ALPHA[level] as number,
            ),
          );
        }
        if (element.classList.contains("nw") && !flow.classList.contains("nohl")) {
          for (const rect of element.getClientRects()) {
            out.dots.push({
              x: rect.left - frame.left,
              y: rect.top - frame.top,
              w: rect.width,
              h: rect.height,
              fontSize: Number.parseFloat(style.fontSize) || 16,
            });
          }
        }
        continue;
      }
      const color = style.backgroundColor;
      if (isTransparent(color)) continue;
      for (const rect of element.getClientRects()) {
        out.boxes.push({
          x: rect.left - frame.left,
          y: rect.top - frame.top,
          w: rect.width,
          h: rect.height,
          color,
        });
      }
    }
    for (const svg of root.querySelectorAll<SVGElement>("svg")) {
      const rect = svg.getBoundingClientRect();
      out.icons.push({
        x: rect.left - frame.left,
        y: rect.top - frame.top,
        w: rect.width,
        h: rect.height,
        image: iconImage(svg),
      });
    }
  }
  return out;
}

export type DrawPageOptions = {
  pageIndex: number;
  step: number;
  width: number;
  height: number;
  sheet: { left: number; top: number; width: number; height: number };
  background: string;
  bookmarked: boolean;
  ribbonColor: string;
};

export function drawPage(
  canvas: HTMLCanvasElement,
  segments: Segments,
  options: DrawPageOptions,
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const { width: W, height: H, sheet } = options;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is not available");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, W, H);
  const x0 = options.pageIndex * options.step;
  const visible = (x: number, w: number): boolean => !(x + w < x0 - 2 || x > x0 + sheet.width + 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(sheet.left, sheet.top, sheet.width, sheet.height);
  ctx.clip();
  ctx.translate(sheet.left - x0, sheet.top);
  for (const box of segments.boxes) {
    if (!visible(box.x, box.w)) continue;
    ctx.fillStyle = box.color;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  for (const strip of segments.strips) {
    if (!visible(strip.x, strip.w)) continue;
    ctx.fillStyle = `rgba(${STRIP_COLOR}, ${strip.alpha})`;
    ctx.beginPath();
    ctx.roundRect(strip.x, strip.y, strip.w, strip.h, Math.min(3.5, strip.h / 2));
    ctx.fill();
  }
  ctx.fillStyle = "rgba(109, 123, 115, 0.7)";
  for (const dot of segments.dots) {
    if (!visible(dot.x, dot.w)) continue;
    const centerY = dot.y + dot.h - dot.fontSize * 0.06 - 1;
    for (let offset = 1; offset < dot.w; offset += 4) {
      ctx.beginPath();
      ctx.arc(dot.x + offset, centerY, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const icon of segments.icons) {
    if (!visible(icon.x, icon.w)) continue;
    if (icon.image.complete && icon.image.naturalWidth) {
      ctx.drawImage(icon.image, icon.x, icon.y, icon.w, icon.h);
    }
  }
  ctx.textBaseline = "alphabetic";
  for (const text of segments.texts) {
    if (!visible(text.x, text.w)) continue;
    ctx.font = text.font;
    ctx.fillStyle = text.color;
    if ("letterSpacing" in ctx) {
      ctx.letterSpacing = text.letterSpacing === "normal" ? "0px" : text.letterSpacing;
    }
    const ascent = ctx.measureText(text.text).fontBoundingBoxAscent || 0;
    ctx.fillText(text.text, text.x, Math.round(text.y) + ascent);
  }
  ctx.restore();
  if (options.bookmarked) {
    ctx.fillStyle = options.ribbonColor;
    ctx.beginPath();
    ctx.moveTo(W - 48, -4);
    ctx.lineTo(W - 26, -4);
    ctx.lineTo(W - 26, 56);
    ctx.lineTo(W - 37, 44);
    ctx.lineTo(W - 48, 56);
    ctx.closePath();
    ctx.fill();
  }
}
