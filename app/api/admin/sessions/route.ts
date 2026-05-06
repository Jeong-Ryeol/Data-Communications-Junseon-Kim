import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { generateCode } from '@/lib/code';
import type { SessionDoc, PulseDecaySeconds } from '@/lib/types';

// GET: 과거 세션 목록 (교수 전용)
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const snap = await getAdminDb()
    .collection('sessions')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  const sessions = snap.docs.map((d) => ({ id: d.id, ...(d.data() as SessionDoc) }));
  return NextResponse.json({ ok: true, sessions });
}

// POST: 새 세션 생성 (교수 전용)
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    pulseDecaySeconds?: PulseDecaySeconds;
  };
  const title = (body.title ?? '').trim().slice(0, 80) || '새 세션';
  const pulseDecaySeconds: PulseDecaySeconds =
    body.pulseDecaySeconds === 30 || body.pulseDecaySeconds === 120 ? body.pulseDecaySeconds : 60;

  // 코드 생성 — 충돌 시 재시도
  let code = '';
  for (let i = 0; i < 8; i++) {
    const candidate = generateCode();
    const ref = getAdminDb().collection('sessions').doc(candidate);
    const exists = await ref.get();
    if (!exists.exists) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    return NextResponse.json({ ok: false, error: 'code 생성 실패' }, { status: 500 });
  }

  const now = Date.now();
  const doc: SessionDoc = {
    code,
    title,
    isOpen: true,
    createdAt: now,
    closedAt: null,
    reviewMode: false,
    bannedFingerprints: [],
    activePollId: null,
    pulseEnabled: true,
    pulseDecaySeconds,
    fingerprintToNumber: {},
    nextNumber: 1,
    aiModerationEnabled: true,
  };
  await getAdminDb().collection('sessions').doc(code).set(doc);

  return NextResponse.json({ ok: true, id: code, code, session: doc });
}
