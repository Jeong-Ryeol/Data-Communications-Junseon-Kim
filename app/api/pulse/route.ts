import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { PulseState, SessionDoc } from '@/lib/types';

// POST: 이해도 토글
//  state: 'understood'|'lost'|'clear' — clear면 doc 삭제 (= 같은 버튼 두 번 누름)
export async function POST(req: Request) {
  const { sessionId, fingerprint, state } = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    fingerprint?: string;
    state?: PulseState | 'clear';
  };
  if (!sessionId || !fingerprint || !state) {
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

  const pulseRef = sessionRef.collection('pulse').doc(fingerprint);
  if (state === 'clear') {
    await pulseRef.delete().catch(() => {});
    return NextResponse.json({ ok: true, state: null });
  }
  if (state !== 'understood' && state !== 'lost') {
    return NextResponse.json({ ok: false, error: 'invalid state' }, { status: 400 });
  }
  await pulseRef.set({ state, updatedAt: Date.now() });
  return NextResponse.json({ ok: true, state });
}
