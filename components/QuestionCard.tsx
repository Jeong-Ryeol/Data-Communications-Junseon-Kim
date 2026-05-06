'use client';

import { Heart, Trash2, Check, EyeOff, UserX, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CATEGORY_CHIP,
  CATEGORY_LABEL,
  type QuestionDoc,
} from '@/lib/types';

type Props = {
  id: string;
  q: QuestionDoc;
  myFingerprint: string;
  // 학생 시점
  onUpvote?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  // 교수 시점
  isAdmin?: boolean;
  onMarkAnswered?: () => void;
  onHide?: () => void;
  onBan?: () => void;
  onSetAnswerNote?: (note: string) => void;
  bannedFingerprints?: string[];
};

export default function QuestionCard({
  id,
  q,
  myFingerprint,
  onUpvote,
  onDelete,
  canDelete,
  isAdmin,
  onMarkAnswered,
  onHide,
  onBan,
  onSetAnswerNote,
  bannedFingerprints,
}: Props) {
  const isMine = q.authorFingerprint === myFingerprint;
  const upvoted = q.upvoterFingerprints?.includes(myFingerprint);
  const isPending = q.status === 'pending';
  const isAnswered = q.status === 'answered';
  const isHidden = q.status === 'hidden';
  const banned = bannedFingerprints?.includes(q.authorFingerprint);

  return (
    <article
      key={id}
      className={cn(
        'animate-fade-in relative rounded-2xl border bg-neutral-900/50 px-4 py-3 transition',
        isMine && 'border-l-2 border-l-indigo-400/60',
        isAnswered && 'opacity-60',
        isHidden && 'opacity-40 line-through',
        isPending && 'border-amber-500/30 bg-amber-500/5',
        !isPending && !isAnswered && !isHidden && 'border-neutral-800',
      )}
    >
      <div className="flex items-start gap-3">
        {/* 추천 버튼 (학생) */}
        {!isAdmin && onUpvote && (
          <button
            onClick={onUpvote}
            className={cn(
              'shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-2 ring-1',
              upvoted
                ? 'bg-rose-500/30 text-rose-100 ring-rose-400/60 shadow-md shadow-rose-500/20'
                : 'bg-neutral-800/60 text-neutral-300 ring-neutral-700/50 hover:bg-neutral-800',
            )}
            aria-label="추천"
          >
            <Heart className={cn('size-4', upvoted && 'fill-current animate-pop')} />
            <span className="text-xs font-mono tabular-nums">{q.upvotes ?? 0}</span>
          </button>
        )}
        {isAdmin && (
          <div className="shrink-0 flex flex-col items-center justify-center rounded-xl bg-neutral-800/40 px-2.5 py-2">
            <Heart className="size-4 text-neutral-400" />
            <span className="text-xs font-mono tabular-nums text-neutral-300">{q.upvotes ?? 0}</span>
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 ring-1',
                CATEGORY_CHIP[q.category],
              )}
            >
              {CATEGORY_LABEL[q.category]}
            </span>
            {isAdmin ? (
              <span className="text-neutral-500 font-mono">
                학생#{q.authorNumber}
              </span>
            ) : isMine ? (
              <span className="text-indigo-300 font-mono font-medium">
                학생#{q.authorNumber} <span className="text-indigo-400/80 text-[10px] ml-0.5">나</span>
              </span>
            ) : (
              <span className="text-neutral-500">학생</span>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-1 text-amber-300/80">
                <Clock className="size-3" /> 검토 중
              </span>
            )}
            {isAnswered && (
              <span className="inline-flex items-center gap-1 text-emerald-400/80">
                <Check className="size-3" /> 답변 완료
              </span>
            )}
            {isHidden && isAdmin && (
              <span className="inline-flex items-center gap-1 text-rose-400/80">
                <EyeOff className="size-3" /> 숨김
              </span>
            )}
          </div>

          <p className="text-[15px] leading-relaxed text-neutral-100 break-words">
            {q.text}
          </p>

          {q.answerNote && (
            <div className="mt-2 rounded-xl bg-emerald-500/5 ring-1 ring-emerald-400/20 px-3 py-2">
              <p className="text-xs text-emerald-300/70 mb-0.5">교수님 메모</p>
              <p className="text-sm text-emerald-100 whitespace-pre-wrap">{q.answerNote}</p>
            </div>
          )}

          {/* 교수 액션 */}
          {isAdmin && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={onMarkAnswered}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs ring-1',
                  isAnswered
                    ? 'bg-emerald-500/35 text-emerald-50 ring-emerald-400/60 shadow-sm shadow-emerald-500/30'
                    : 'bg-neutral-800/60 text-neutral-300 ring-neutral-700 hover:bg-neutral-800',
                )}
              >
                <Check className="size-3" /> 답변
              </button>
              {!isAnswered && (
                <button
                  onClick={() => {
                    const note = window.prompt('답변 메모 (강의 후 학생 복습용)');
                    if (note != null) onSetAnswerNote?.(note);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs ring-1 bg-neutral-800/60 text-neutral-400 ring-neutral-700 hover:bg-neutral-800 transition"
                  title="메모와 함께 답변완료"
                >
                  <Check className="size-3" /> +메모
                </button>
              )}
              <button
                onClick={onHide}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs ring-1',
                  isHidden
                    ? 'bg-rose-500/35 text-rose-50 ring-rose-400/60 shadow-sm shadow-rose-500/30'
                    : 'bg-neutral-800/60 text-neutral-300 ring-neutral-700 hover:bg-neutral-800',
                )}
              >
                <EyeOff className="size-3" /> 숨김
              </button>
              <button
                onClick={() => {
                  if (banned) {
                    onBan?.();
                  } else if (
                    window.confirm(
                      '이 질문을 삭제하고 작성자를 차단할까요?\n\n• 이 질문이 즉시 삭제됩니다.\n• 작성자는 이 세션에서 차단됩니다 (다른 질문은 그대로).\n• 차단은 차단 목록에서 해제 가능해요.',
                    )
                  ) {
                    onBan?.();
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs ring-1',
                  banned
                    ? 'bg-rose-500/35 text-rose-50 ring-rose-400/60 shadow-sm shadow-rose-500/30'
                    : 'bg-neutral-800/60 text-neutral-300 ring-neutral-700 hover:bg-neutral-800',
                )}
              >
                <UserX className="size-3" /> {banned ? '차단됨' : '삭제+차단'}
              </button>
            </div>
          )}
        </div>

        {/* 학생: 30초 grace 삭제 */}
        {!isAdmin && canDelete && (
          <button
            onClick={onDelete}
            className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
            aria-label="삭제"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </article>
  );
}
