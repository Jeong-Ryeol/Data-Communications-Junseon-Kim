import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import type { PollDoc } from '@/lib/types';

// PATCH: 라이브 투표 닫기/열기/결과공개 토글 (교수 전용)
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<'/api/polls/[id]'>,
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    status?: 'open' | 'closed';
    showResultsLive?: boolean;
  };
  if (!body.sessionId) {
    return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 });
  }

  const sessionRef = getAdminDb().collection('sessions').doc(body.sessionId);
  const pollRef = sessionRef.collection('polls').doc(id);
  const snap = await pollRef.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  }

  const updates: Partial<PollDoc> = {};
  if (body.status === 'open' || body.status === 'closed') updates.status = body.status;
  if (typeof body.showResultsLive === 'boolean') updates.showResultsLive = body.showResultsLive;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: 'no fields to update' }, { status: 400 });
  }

  await pollRef.update(updates);
  if (updates.status === 'closed') {
    await sessionRef.update({ activePollId: null });
  }
  return NextResponse.json({ ok: true });
}
