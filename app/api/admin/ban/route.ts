import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { isAdmin } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import type { SessionDoc } from '@/lib/types';

// POST: 작성자 차단 토글 (교수 전용)
//  - body.questionId 제공 시: 그 질문만 삭제 + 작성자 차단
//  - body.questionId 없으면: 단순 토글 (해제 시 호출되는 경로)
//  - 차단 해제는 toggle off, 질문 복구는 안 됨 (이미 지워졌으면)
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const { sessionId, fingerprint, questionId } = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    fingerprint?: string;
    questionId?: string;
  };
  if (!sessionId || !fingerprint) {
    return NextResponse.json({ ok: false, error: 'invalid request' }, { status: 400 });
  }

  const ref = getAdminDb().collection('sessions').doc(sessionId);
  const result = await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { error: 'not found' as const };
    const s = snap.data() as SessionDoc;
    const banned = s.bannedFingerprints ?? [];
    const isCurrentlyBanned = banned.includes(fingerprint);

    if (isCurrentlyBanned) {
      // 해제 — 질문은 그대로 둠 (이미 지워졌으면 복구 X)
      tx.update(ref, { bannedFingerprints: FieldValue.arrayRemove(fingerprint) });
      return { banned: false, deletedCount: 0 };
    }

    // 차단 진행 — 지정된 질문만 삭제 (선택)
    tx.update(ref, { bannedFingerprints: FieldValue.arrayUnion(fingerprint) });
    let deletedCount = 0;
    if (questionId) {
      const qRef = ref.collection('questions').doc(questionId);
      tx.delete(qRef);
      deletedCount = 1;
    }
    return { banned: true, deletedCount };
  });

  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true, banned: result.banned, deletedCount: result.deletedCount });
}
