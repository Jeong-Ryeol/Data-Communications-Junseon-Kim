import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import type { PollDoc } from '@/lib/types';

// POST: 라이브 투표 생성 (교수 전용)
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    question?: string;
    options?: string[];
    showResultsLive?: boolean;
  };
  const sessionId = body.sessionId?.trim();
  const question = (body.question ?? '').trim();
  const options = (body.options ?? []).map((o) => o.trim()).filter(Boolean);

  if (!sessionId || !question || options.length < 2 || options.length > 5) {
    return NextResponse.json(
      { ok: false, error: '질문과 2~5개 옵션이 필요해요' },
      { status: 400 },
    );
  }

  const sessionRef = getAdminDb().collection('sessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    return NextResponse.json({ ok: false, error: 'session not found' }, { status: 404 });
  }

  const pollRef = sessionRef.collection('polls').doc();
  const doc: PollDoc = {
    question: question.slice(0, 200),
    options: options.map((o) => o.slice(0, 80)),
    status: 'open',
    showResultsLive: !!body.showResultsLive,
    createdAt: Date.now(),
  };
  await pollRef.set(doc);
  await sessionRef.update({ activePollId: pollRef.id });

  return NextResponse.json({ ok: true, id: pollRef.id, poll: doc });
}
