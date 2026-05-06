import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { PollDoc, SessionDoc } from '@/lib/types';

// POST: 학생 투표
export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/polls/[id]/vote'>,
) {
  const { id: pollId } = await ctx.params;
  const { sessionId, fingerprint, optionIndex } = (await req
    .json()
    .catch(() => ({}))) as { sessionId?: string; fingerprint?: string; optionIndex?: number };

  if (
    !sessionId ||
    !fingerprint ||
    typeof optionIndex !== 'number' ||
    optionIndex < 0 ||
    optionIndex > 4
  ) {
    return NextResponse.json({ ok: false, error: 'invalid request' }, { status: 400 });
  }

  const sessionRef = getAdminDb().collection('sessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    return NextResponse.json({ ok: false, error: 'session not found' }, { status: 404 });
  }
  const s = sessionSnap.data() as SessionDoc;
  if (!s.isOpen) {
    return NextResponse.json({ ok: false, error: 'session closed' }, { status: 403 });
  }
  if (s.bannedFingerprints?.includes(fingerprint)) {
    return NextResponse.json({ ok: false, error: 'banned' }, { status: 403 });
  }

  const pollRef = sessionRef.collection('polls').doc(pollId);
  const pollSnap = await pollRef.get();
  if (!pollSnap.exists) {
    return NextResponse.json({ ok: false, error: 'poll not found' }, { status: 404 });
  }
  const poll = pollSnap.data() as PollDoc;
  if (poll.status !== 'open') {
    return NextResponse.json({ ok: false, error: 'poll closed' }, { status: 403 });
  }
  if (optionIndex >= poll.options.length) {
    return NextResponse.json({ ok: false, error: 'invalid option' }, { status: 400 });
  }

  await pollRef.collection('votes').doc(fingerprint).set({ optionIndex });
  return NextResponse.json({ ok: true });
}
