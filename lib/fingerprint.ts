const KEY = 'qna_fp';

export function getFingerprint(): string {
  if (typeof window === 'undefined') return '';
  let fp = window.localStorage.getItem(KEY);
  if (!fp) {
    fp =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(KEY, fp);
  }
  return fp;
}
