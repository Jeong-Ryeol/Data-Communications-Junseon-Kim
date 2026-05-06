import { cookies } from 'next/headers';
import crypto from 'node:crypto';

const COOKIE = 'qna_admin';

function sign(value: string, secret: string): string {
  const sig = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  return `${value}.${sig}`;
}

function verify(token: string, secret: string): boolean {
  const idx = token.lastIndexOf('.');
  if (idx === -1) return false;
  const value = token.slice(0, idx);
  return sign(value, secret) === token;
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? '';
  if (!expected || !input) return false;
  if (input.length !== expected.length) return false;
  let r = 0;
  for (let i = 0; i < input.length; i++) {
    r |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return r === 0;
}

export async function setAdminCookie(): Promise<void> {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  const token = sign(`admin-${Date.now()}`, secret);
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function clearAdminCookie(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  if (!secret) return false;
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return false;
  return verify(token, secret);
}
