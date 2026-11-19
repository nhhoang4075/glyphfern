const SPANISH_POS_ABBREVIATIONS: Readonly<Record<string, string>> = {
  dt: "danh từ",
  đg: "động từ",
  tt: "tính từ",
  gt: "giới từ",
  đt: "đại từ",
  số: "số từ",
};

export function expandPos(pos: string): string {
  const [head = "", ...rest] = pos.split(" ");
  const expanded = SPANISH_POS_ABBREVIATIONS[head];
  if (expanded === undefined) {
    return pos;
  }
  return [expanded, ...rest].join(" ");
}
