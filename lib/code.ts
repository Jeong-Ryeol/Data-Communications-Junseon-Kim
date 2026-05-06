// 3자리 숫자 코드 (000~999, 1000 조합)
const ALPHABET = '0123456789';
const CODE_LENGTH = 3;

export function generateCode(length = CODE_LENGTH): string {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

export function normalizeCode(input: string): string {
  return input.replace(/[^0-9]/g, '');
}

export function isValidCode(s: string): boolean {
  return /^[0-9]{3}$/.test(s);
}
