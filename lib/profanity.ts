// 정적 비속어 1차 필터. 자모 분리 우회/치환은 Gemini가 잡음.
const BAD_KO = [
  '씨발', '시발', '씨바', '시바',
  '병신', '븅신', '븅쉰',
  '존나', '졸라',
  '좆', '좇',
  '니애미', '니애비', '느금마', '느그미', '느금', '엠창',
  '개새', '개색', '개쒝',
  '미친놈', '미친년',
];
const BAD_EN = ['fuck', 'fck', 'shit', 'bitch', 'asshole', 'bastard'];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\-_.,!?*~`'"·…ㆍ]+/g, '')
    .normalize('NFC');
}

export function isProfane(text: string): boolean {
  const n = normalize(text);
  if (BAD_KO.some((w) => n.includes(w))) return true;
  if (BAD_EN.some((w) => n.includes(w))) return true;
  // 자모 분리 단순 휴리스틱: 호환 자모(ㅅ ㅂ 등) 단독으로 3자 이상 연속이면 의심
  const compatJamo = n.match(/[ㄱ-ㆎ]/g);
  if (compatJamo && compatJamo.length >= 3 && compatJamo.length / n.length > 0.5) {
    return true;
  }
  return false;
}
