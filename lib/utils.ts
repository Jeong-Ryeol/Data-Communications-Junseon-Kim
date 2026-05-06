import { clsx, type ClassValue } from 'clsx';

export const cn = (...args: ClassValue[]) => clsx(args);

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
