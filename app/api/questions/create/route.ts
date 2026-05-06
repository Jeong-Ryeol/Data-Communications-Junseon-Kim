import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isProfane } from '@/lib/profanity';
import { moderate } from '@/lib/gemini';
import {
  CATEGORIES,
  RATE_LIMIT_SECONDS,
  TEXT_MAX,
  TEXT_MIN,
  type QuestionCategory,
  type QuestionDoc,
  type SessionDoc,
} from '@/lib/types';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    fingerprint?: string;
    text?: string;
    category?: QuestionCategory;
  };
  const sessionId = body.sessionId?.trim();
  const fingerprint = body.fingerprint?.trim();
  const text = body.text?.trim() ?? '';
  const category = (body.category ?? 'question') as QuestionCategory;

  if (!sessionId || !fingerprint) {
    return NextResponse.json({ ok: false, error: 'invalid request' }, { status: 400 });
  }
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ ok: false, error: 'invalid category' }, { status: 400 });
  }
  if (text.length < TEXT_MIN || text.length > TEXT_MAX) {
    return NextResponse.json(
      { ok: false, error: `${TEXT_MIN}~${TEXT_MAX}자 사이로 적어주세요` },
      { status: 400 },
    );
  }
  if (isProfane(text)) {
    return NextResponse.json({ ok: false, error: '부적절한 표현이 포함됐어요' }, { status: 400 });
  }

  // 세션 미리 read — AI 모더레이션 활성 여부 확인 + 일찍 not-found 처리
  const sessionRef = getAdminDb().collection('sessions').doc(sessionId);
  const earlySnap = await sessionRef.get();
  if (!earlySnap.exists) {
    return NextResponse.json({ ok: false, error: 'session not found' }, { status: 404 });
  }
  const earlySession = earlySnap.data() as SessionDoc;

  // AI 모더레이션 — 세션에서 비활성화돼있으면 스킵 (정적 비속어 필터는 위에서 이미 통과)
  if (earlySession.aiModerationEnabled !== false) {
    const result = await moderate(text);
    if (result.verdict === 'BLOCK') {
      return NextResponse.json(
        { ok: false, error: 'AI 모더레이션에서 거부됐어요' },
        { status: 400 },
      );
    }
    // 한도 상태 동기화 — 변화 있을 때만 write
    if (result.quotaExceeded && !earlySession.aiQuotaExceeded) {
      await sessionRef.update({ aiQuotaExceeded: true }).catch(() => {});
    } else if (!result.quotaExceeded && !result.unavailable && earlySession.aiQuotaExceeded) {
      await sessionRef.update({ aiQuotaExceeded: false }).catch(() => {});
    }
  }

  // 트랜잭션: 세션 검증 + rate limit + authorNumber 부여 + 질문 작성을 원자적으로
  const qRef = sessionRef.collection('questions').doc(); // 새 doc ID 미리 할당
  const now = Date.now();

  type TxResult =
    | { ok: true; id: string; status: 'pending' | 'visible' }
    | { ok: false; error: string; status: number };

  const result: TxResult = await getAdminDb().runTransaction(async (tx) => {
    const sSnap = await tx.get(sessionRef);
    if (!sSnap.exists) return { ok: false, error: 'session not found', status: 404 };
    const s = sSnap.data() as SessionDoc;
    if (!s.isOpen) return { ok: false, error: 'session closed', status: 403 };
    if (s.bannedFingerprints?.includes(fingerprint)) {
      return { ok: false, error: 'banned', status: 403 };
    }

    // Rate limit: 세션 doc의 lastQuestionAtByFp 맵에서 fp 시각 조회 (인덱스 불필요)
    const lastAt = s.lastQuestionAtByFp?.[fingerprint] ?? 0;
    const elapsed = (now - lastAt) / 1000;
    if (elapsed < RATE_LIMIT_SECONDS) {
      const wait = Math.ceil(RATE_LIMIT_SECONDS - elapsed);
      return { ok: false, error: `${wait}초 뒤에 다시 올려주세요`, status: 429 };
    }

    // authorNumber 부여 (없으면)
    const numMap = s.fingerprintToNumber ?? {};
    let number = numMap[fingerprint];
    const sessionUpdates: Record<string, unknown> = {
      [`lastQuestionAtByFp.${fingerprint}`]: now,
    };
    if (!number) {
      number = s.nextNumber ?? 1;
      sessionUpdates[`fingerprintToNumber.${fingerprint}`] = number;
      sessionUpdates.nextNumber = number + 1;
    }
    tx.update(sessionRef, sessionUpdates);

    const status = s.reviewMode ? 'pending' : 'visible';
    const qDoc: QuestionDoc = {
      text,
      upvotes: 0,
      upvoterFingerprints: [],
      authorFingerprint: fingerprint,
      authorNumber: number,
      status,
      category,
      answerNote: null,
      createdAt: now,
    };
    tx.set(qRef, qDoc);
    return { ok: true, id: qRef.id, status };
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, id: result.id, status: result.status });
}
