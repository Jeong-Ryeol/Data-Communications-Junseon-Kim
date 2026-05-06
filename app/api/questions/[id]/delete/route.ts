import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { DELETE_GRACE_SECONDS, type QuestionDoc } from '@/lib/types';

// POST: 본인 30초 grace + 추천 0인 경우 삭제
export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/questions/[id]/delete'>,
) {
  const { id } = await ctx.params;
  const { sessionId, fingerprint } = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    fingerprint?: string;
  };
  if (!sessionId || !fingerprint) {
    return NextResponse.json({ ok: false, error: 'invalid request' }, { status: 400 });
  }

  const qRef = getAdminDb().collection('sessions').doc(sessionId).collection('questions').doc(id);
  const result = await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(qRef);
    if (!snap.exists) return { error: 'not found' as const };
    const q = snap.data() as QuestionDoc;
    if (q.authorFingerprint !== fingerprint) return { error: 'not author' as const };
    if ((q.upvotes ?? 0) > 0) return { error: 'already upvoted' as const };
    const elapsed = (Date.now() - (q.createdAt ?? 0)) / 1000;
    if (elapsed > DELETE_GRACE_SECONDS) return { error: 'grace expired' as const };
    tx.delete(qRef);
    return { ok: true as const };
  });

  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
