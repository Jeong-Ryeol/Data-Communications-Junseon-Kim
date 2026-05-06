// 0/O/1/I/L 제외 — 혼동 글자 제거
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCode(length = 6): string {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidCode(s: string): boolean {
  if (!/^[A-Z0-9]{6}$/.test(s)) return false;
  for (const c of s) if (!ALPHABET.includes(c)) return false;
  return true;
}
