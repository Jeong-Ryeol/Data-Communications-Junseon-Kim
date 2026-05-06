import { NextResponse, type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { QuestionDoc, SessionDoc } from '@/lib/types';

// POST: 추천 토글
export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/questions/[id]/upvote'>,
) {
  const { id } = await ctx.params;
  const { sessionId, fingerprint } = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    fingerprint?: string;
  };
  if (!sessionId || !fingerprint) {
    return NextResponse.json({ ok: false, error: 'invalid request' }, { status: 400 });
  }

  const sessionRef = getAdminDb().collection('sessions').doc(sessionId);
  const qRef = sessionRef.collection('questions').doc(id);

  const result = await getAdminDb().runTransaction(async (tx) => {
    const sSnap = await tx.get(sessionRef);
    if (!sSnap.exists) return { error: 'session not found' as const };
    const s = sSnap.data() as SessionDoc;
    if (s.bannedFingerprints?.includes(fingerprint)) return { error: 'banned' as const };

    const qSnap = await tx.get(qRef);
    if (!qSnap.exists) return { error: 'question not found' as const };
    const q = qSnap.data() as QuestionDoc;
    const arr = q.upvoterFingerprints ?? [];
    const has = arr.includes(fingerprint);

    if (has) {
      tx.update(qRef, {
        upvotes: FieldValue.increment(-1),
        upvoterFingerprints: FieldValue.arrayRemove(fingerprint),
      });
      return { voted: false, upvotes: Math.max(0, (q.upvotes ?? 0) - 1) };
    } else {
      tx.update(qRef, {
        upvotes: FieldValue.increment(1),
        upvoterFingerprints: FieldValue.arrayUnion(fingerprint),
      });
      return { voted: true, upvotes: (q.upvotes ?? 0) + 1 };
    }
  });

  if ('error' in result) {
    const err = String(result.error);
    const status = err.includes('not found') ? 404 : 403;
    return NextResponse.json({ ok: false, error: err }, { status });
  }
  return NextResponse.json({ ok: true, ...result });
}
