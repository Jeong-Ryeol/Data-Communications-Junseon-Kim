import { NextResponse } from 'next/server';
import { checkPassword, setAdminCookie } from '@/lib/auth';

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!checkPassword(password ?? '')) {
    return NextResponse.json({ ok: false, error: '비밀번호가 틀려요' }, { status: 401 });
  }
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}
