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
  marker: boolean;
};

export type IconSegment = {
  x: number;
  y: number;
  w: number;
  h: number;
  image: HTMLImageElement;
};

export type Segments = {
  texts: TextSegment[];
  boxes: BoxSegment[];
  icons: IconSegment[];
};

export const DEFAULT_BOX_SELECTOR = ".w.l1,.w.l2,.w.l3,.w.sel,.w.grp";

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

export function collectSegments(
  flow: HTMLElement,
  boxSelector: string = DEFAULT_BOX_SELECTOR,
): Segments {
  const frame = flow.getBoundingClientRect();
  const out: Segments = { texts: [], boxes: [], icons: [] };
  const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
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
      for (let k = 0; k < match[0].length; k++) {
        range.setStart(node, match.index + k);
        range.setEnd(node, match.index + k + 1);
        const glyph = range.getClientRects()[0];
        const char = match[0][k] ?? "";
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
      }
    }
  }
  for (const element of flow.querySelectorAll<HTMLElement>(boxSelector)) {
    const style = getComputedStyle(element);
    const marker = style.backgroundImage !== "none";
    let color = style.backgroundColor;
    if (marker) {
      const found = style.backgroundImage.match(/rgba?\([^)]*\)/g);
      color = found?.[found.length - 1] ?? color;
    }
    if (!marker && isTransparent(color)) continue;
    for (const rect of element.getClientRects()) {
      out.boxes.push({
        x: rect.left - frame.left,
        y: rect.top - frame.top,
        w: rect.width,
        h: rect.height,
        color,
        marker,
      });
    }
  }
  for (const svg of flow.querySelectorAll<SVGElement>("svg")) {
    const rect = svg.getBoundingClientRect();
    out.icons.push({
      x: rect.left - frame.left,
      y: rect.top - frame.top,
      w: rect.width,
      h: rect.height,
      image: iconImage(svg),
    });
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
    if (box.marker) ctx.fillRect(box.x, box.y + box.h * 0.52, box.w, box.h * 0.48);
    else ctx.fillRect(box.x, box.y, box.w, box.h);
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
    ctx.fillText(text.text, text.x, text.y + ascent);
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
