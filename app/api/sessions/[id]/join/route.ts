import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { SessionDoc } from '@/lib/types';

// POST: 학생이 세션 입장 — fingerprint 처음이면 임시번호 부여, 차단 여부 검사
export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/sessions/[id]/join'>,
) {
  const { id } = await ctx.params;
  const { fingerprint } = (await req.json().catch(() => ({}))) as { fingerprint?: string };
  if (!fingerprint) {
    return NextResponse.json({ ok: false, error: 'fingerprint required' }, { status: 400 });
  }

  const ref = getAdminDb().collection('sessions').doc(id);
  const result = await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { error: 'not found' as const };
    const data = snap.data() as SessionDoc;
    if (!data.isOpen) return { error: 'closed' as const };
    if (data.bannedFingerprints?.includes(fingerprint)) return { error: 'banned' as const };

    const map = data.fingerprintToNumber ?? {};
    if (map[fingerprint]) {
      return { authorNumber: map[fingerprint], session: data };
    }
    const number = data.nextNumber ?? 1;
    tx.update(ref, {
      [`fingerprintToNumber.${fingerprint}`]: number,
      nextNumber: number + 1,
    });
    return { authorNumber: number, session: { ...data, nextNumber: number + 1 } };
  });

  if ('error' in result) {
    const status = result.error === 'not found' ? 404 : 403;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, authorNumber: result.authorNumber });
}
