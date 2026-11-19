const LABELS: Record<string, string> = {
  noun: "danh từ",
  name: "danh từ riêng",
  verb: "động từ",
  adj: "tính từ",
  adv: "phó từ",
  prep: "giới từ",
  pron: "đại từ",
  conj: "liên từ",
  intj: "thán từ",
  det: "định từ",
  article: "mạo từ",
  num: "số từ",
  particle: "tiểu từ",
  phrase: "cụm từ",
  contraction: "từ rút gọn",
  prefix: "tiền tố",
  suffix: "hậu tố",
};

export function posLabel(pos: string): string {
  return LABELS[pos] ?? pos;
}
