import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import type { PulseDecaySeconds } from '@/lib/types';

// PATCH: 세션 상태 업데이트 (교수 전용)
//  - isOpen, reviewMode, pulseEnabled, pulseDecaySeconds
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<'/api/sessions/[id]'>,
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    isOpen?: boolean;
    reviewMode?: boolean;
    pulseEnabled?: boolean;
    pulseDecaySeconds?: PulseDecaySeconds;
    aiModerationEnabled?: boolean;
    aiQuotaExceeded?: boolean;
  };

  const ref = getAdminDb().collection('sessions').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.isOpen === 'boolean') {
    updates.isOpen = body.isOpen;
    updates.closedAt = body.isOpen ? null : Date.now();
  }
  if (typeof body.reviewMode === 'boolean') updates.reviewMode = body.reviewMode;
  if (typeof body.pulseEnabled === 'boolean') updates.pulseEnabled = body.pulseEnabled;
  if (body.pulseDecaySeconds === 30 || body.pulseDecaySeconds === 60 || body.pulseDecaySeconds === 120) {
    updates.pulseDecaySeconds = body.pulseDecaySeconds;
  }
  if (typeof body.aiModerationEnabled === 'boolean') updates.aiModerationEnabled = body.aiModerationEnabled;
  if (typeof body.aiQuotaExceeded === 'boolean') updates.aiQuotaExceeded = body.aiQuotaExceeded;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: 'no fields to update' }, { status: 400 });
  }
  await ref.update(updates);
  return NextResponse.json({ ok: true });
}

// DELETE: 세션 영구 삭제 (교수 전용)
//  - 세션 doc + questions / polls / votes / pulse 서브컬렉션 모두 재귀 삭제
//  - 복구 불가
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/sessions/[id]'>,
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const db = getAdminDb();
  const ref = db.collection('sessions').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  }
  await db.recursiveDelete(ref);
  return NextResponse.json({ ok: true });
}
