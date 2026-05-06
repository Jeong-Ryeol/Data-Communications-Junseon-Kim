import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import type { QuestionDoc, QuestionStatus } from '@/lib/types';

// POST: 교수 모더레이션 액션 (토글식)
//  body: { sessionId, action: 'answered'|'hidden'|'visible'|'pending', answerNote? }
//  action을 다시 누르면 'visible'로 복귀.
export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/questions/[id]/moderate'>,
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    action?: QuestionStatus;
    answerNote?: string | null;
  };
  if (!body.sessionId || !body.action) {
    return NextResponse.json({ ok: false, error: 'invalid request' }, { status: 400 });
  }
  const valid: QuestionStatus[] = ['answered', 'hidden', 'visible', 'pending'];
  if (!valid.includes(body.action)) {
    return NextResponse.json({ ok: false, error: 'invalid action' }, { status: 400 });
  }

  const qRef = getAdminDb()
    .collection('sessions')
    .doc(body.sessionId)
    .collection('questions')
    .doc(id);

  const result = await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(qRef);
    if (!snap.exists) return { error: 'not found' as const };
    const q = snap.data() as QuestionDoc;

    // 토글: 같은 상태 다시 누르면 'visible' 복귀 (단 action='visible'은 그대로)
    let target: QuestionStatus = body.action!;
    if (q.status === body.action && body.action !== 'visible') {
      target = 'visible';
    }
    const updates: Record<string, unknown> = { status: target };
    if (target === 'answered') {
      updates.answerNote = body.answerNote ?? q.answerNote ?? null;
    } else if (q.status === 'answered') {
      updates.answerNote = null;
    }
    tx.update(qRef, updates);
    return { status: target };
  });

  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true, status: result.status });
}
