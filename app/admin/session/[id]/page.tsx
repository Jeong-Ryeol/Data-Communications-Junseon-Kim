'use client';

import {
  use,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query as fsQuery,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Power,
  Eye,
  QrCode,
  Megaphone,
  Plus,
  X,
  ThumbsUp,
  Sparkles,
  UserX,
  Trash2,
} from 'lucide-react';
import CategoryPicker from '@/components/CategoryPicker';
import QuestionCard from '@/components/QuestionCard';
import QrModal from '@/components/QrModal';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import type {
  PollDoc,
  QuestionCategory,
  QuestionDoc,
  QuestionStatus,
  SessionDoc,
} from '@/lib/types';

type QItem = QuestionDoc & { id: string };
type PItem = PollDoc & { id: string };

export default function AdminSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<SessionDoc | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [questions, setQuestions] = useState<QItem[]>([]);
  const [polls, setPolls] = useState<PItem[]>([]);
  const [filter, setFilter] = useState<QuestionCategory | 'all'>('all');
  const [showQr, setShowQr] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);

  // 세션 doc
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'sessions', id), (snap) => {
      setSession(snap.exists() ? (snap.data() as SessionDoc) : null);
      setSessionLoaded(true);
    });
    return () => unsub();
  }, [id]);

  // questions
  useEffect(() => {
    const q = fsQuery(
      collection(db, 'sessions', id, 'questions'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: QItem[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as QuestionDoc) }));
      setQuestions(items);
    });
    return () => unsub();
  }, [id]);

  // polls
  useEffect(() => {
    const q = fsQuery(
      collection(db, 'sessions', id, 'polls'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: PItem[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as PollDoc) }));
      setPolls(items);
    });
    return () => unsub();
  }, [id]);

  // Pending → 검수 모드의 대기열
  const pending = useMemo(() => {
    const arr = questions.filter((q) => q.status === 'pending');
    arr.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    return arr;
  }, [questions]);

  // 메인 리스트 정렬 + 필터
  const sorted = useMemo(() => {
    const items = questions.filter((q) => q.status !== 'pending');
    items.sort((a, b) => {
      const rankA = a.status === 'answered' || a.status === 'hidden' ? 1 : 0;
      const rankB = b.status === 'answered' || b.status === 'hidden' ? 1 : 0;
      if (rankA !== rankB) return rankA - rankB;
      if ((b.upvotes ?? 0) !== (a.upvotes ?? 0)) return (b.upvotes ?? 0) - (a.upvotes ?? 0);
      return (a.createdAt ?? 0) - (b.createdAt ?? 0);
    });
    return items;
  }, [questions]);

  const filtered = useMemo(() => {
    if (filter === 'all') return sorted;
    return sorted.filter((q) => q.category === filter);
  }, [sorted, filter]);

  const stats = useMemo(() => {
    const total = questions.length;
    const answered = questions.filter((q) => q.status === 'answered').length;
    const participants = session
      ? Object.keys(session.fingerprintToNumber ?? {}).length
      : 0;
    return { total, answered, participants };
  }, [questions, session]);

  async function patchSession(updates: Partial<SessionDoc>) {
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }

  async function moderate(qid: string, action: QuestionStatus, answerNote?: string) {
    await fetch(`/api/questions/${qid}/moderate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: id, action, answerNote }),
    });
  }

  async function ban(fingerprint: string, questionId?: string) {
    await fetch('/api/admin/ban', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: id, fingerprint, questionId }),
    });
  }

  async function deleteSession() {
    if (!session) return;
    if (
      !window.confirm(
        `세션 "${session.title}"을(를) 영구 삭제할까요?\n\n• 모든 질문 / 투표 / 응답 데이터가 즉시 삭제됩니다.\n• 복구 불가능합니다.`,
      )
    )
      return;
    const r = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (r.ok) router.push('/admin');
    else alert('삭제 실패');
  }

  async function startPulsePoll() {
    await fetch('/api/polls', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: id,
        question: '지금 이해되시나요?',
        options: ['이해됨', '모르겠음'],
        showResultsLive: false,
      }),
    });
  }

  if (!sessionLoaded) return <main className="min-h-dvh" />;
  if (!session) {
    return (
      <main className="min-h-dvh grid place-items-center">
        <p className="text-neutral-400">세션을 찾을 수 없어요</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh max-w-3xl mx-auto pb-12">
      {/* 상단 바 */}
      <header className="sticky top-0 z-10 backdrop-blur bg-neutral-950/80 border-b border-neutral-900 px-4 py-3 flex items-center justify-between gap-3">
        <button
          onClick={() => router.push('/admin')}
          className="rounded-lg p-1.5 hover:bg-neutral-900 transition"
          aria-label="뒤로"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-medium truncate">{session.title}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            <span className="font-mono">{session.code}</span>
            {' · '}
            {session.isOpen ? (
              <span className="text-emerald-400">진행 중</span>
            ) : (
              <span>종료됨</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowQr(true)}
          className="rounded-lg p-2 bg-neutral-900 hover:bg-neutral-800 transition"
          aria-label="QR 보기"
        >
          <QrCode className="size-5" />
        </button>
      </header>

      {/* 컨트롤 패널 */}
      <section className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-neutral-900">
        <Stat label="접속자" value={stats.participants} />
        <Stat label="질문" value={stats.total} />
        <Stat label="답변완료" value={stats.answered} />
      </section>

      <section className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-neutral-900">
        <ControlChip
          active={session.reviewMode}
          onClick={() => patchSession({ reviewMode: !session.reviewMode })}
          icon={<Eye className="size-3.5" />}
          label={`검수 ${session.reviewMode ? 'ON' : 'OFF'}`}
        />
        <button
          onClick={() => {
            // 한도 초과 상태면 재시도 (플래그 클리어 + AI 켬)
            if (session.aiQuotaExceeded) {
              patchSession({ aiQuotaExceeded: false, aiModerationEnabled: true });
            } else {
              patchSession({ aiModerationEnabled: session.aiModerationEnabled === false });
            }
          }}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ring-1',
            session.aiQuotaExceeded
              ? 'bg-amber-500/35 text-amber-50 ring-amber-400/60 shadow-sm shadow-amber-500/30 font-medium animate-pulse-glow'
              : session.aiModerationEnabled !== false
                ? 'bg-indigo-500/35 text-indigo-50 ring-indigo-400/60 shadow-sm shadow-indigo-500/30 font-medium'
                : 'bg-neutral-900 text-neutral-300 ring-neutral-800 hover:bg-neutral-800',
          )}
          title={
            session.aiQuotaExceeded
              ? 'Gemini 무료 한도 소진 — 클릭 시 재시도'
              : 'AI 필터 (Gemini)'
          }
        >
          <Sparkles className="size-3.5" />
          {session.aiQuotaExceeded
            ? 'AI 한도초과'
            : `AI 필터 ${session.aiModerationEnabled !== false ? 'ON' : 'OFF'}`}
        </button>
        <button
          onClick={startPulsePoll}
          disabled={!!session.activePollId}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ring-1 transition',
            session.activePollId
              ? 'bg-neutral-900 text-neutral-600 ring-neutral-800 cursor-not-allowed'
              : 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30 hover:bg-emerald-500/25',
          )}
          title={session.activePollId ? '진행 중인 투표가 있어요' : '학생들에게 즉석 이해도 체크'}
        >
          <ThumbsUp className="size-3.5" /> 이해도 체크
        </button>
        <ControlChip
          active={!session.activePollId && !showPollForm}
          onClick={() => setShowPollForm((v) => !v)}
          icon={<Megaphone className="size-3.5" />}
          label="투표"
        />
        <button
          onClick={() => patchSession({ isOpen: !session.isOpen })}
          className={cn(
            'ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ring-1 transition',
            session.isOpen
              ? 'bg-rose-500/15 text-rose-200 ring-rose-400/30 hover:bg-rose-500/25'
              : 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30 hover:bg-emerald-500/25',
          )}
        >
          <Power className="size-3.5" /> {session.isOpen ? '종료' : '재개'}
        </button>
        <button
          onClick={deleteSession}
          className="inline-flex items-center gap-1 rounded-full bg-neutral-900 hover:bg-rose-500/15 ring-1 ring-neutral-800 hover:ring-rose-400/30 text-neutral-500 hover:text-rose-300 px-2.5 py-1.5 text-xs transition"
          title="세션 영구 삭제"
        >
          <Trash2 className="size-3.5" />
        </button>
      </section>

      {/* 폴 생성 폼 */}
      {showPollForm && (
        <PollCreateForm
          sessionId={id}
          activePollId={session.activePollId}
          onClose={() => setShowPollForm(false)}
        />
      )}

      {/* 활성 폴 카드 */}
      {session.activePollId && (
        <ActivePoll
          sessionId={id}
          pollId={session.activePollId}
          poll={polls.find((p) => p.id === session.activePollId)}
        />
      )}

      {/* 차단 목록 — 차단된 학생 있을 때만 표시 */}
      {session.bannedFingerprints && session.bannedFingerprints.length > 0 && (
        <section className="px-4 py-3 border-b border-neutral-900 bg-rose-500/5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-rose-300/80 inline-flex items-center gap-1 mr-1">
              <UserX className="size-3.5" /> 차단됨 ({session.bannedFingerprints.length})
            </span>
            {session.bannedFingerprints.map((fp) => {
              const num = session.fingerprintToNumber?.[fp];
              return (
                <button
                  key={fp}
                  onClick={() => ban(fp)}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 ring-1 ring-rose-400/30 hover:bg-rose-500/25 px-2.5 py-1 text-xs text-rose-200"
                  title="클릭하면 차단 해제됨"
                >
                  학생#{num ?? '?'} <X className="size-3" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 검수 대기열 */}
      {session.reviewMode && pending.length > 0 && (
        <section className="px-4 py-3 border-b border-neutral-900">
          <h2 className="text-xs font-medium text-amber-300 mb-2 inline-flex items-center gap-1">
            <Eye className="size-3.5" /> 검수 대기 ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((q) => (
              <QuestionCard
                key={q.id}
                id={q.id}
                q={q}
                myFingerprint=""
                isAdmin
                bannedFingerprints={session.bannedFingerprints}
                onMarkAnswered={() => moderate(q.id, 'visible')}
                onHide={() => moderate(q.id, 'hidden')}
                onBan={() => ban(q.authorFingerprint, q.id)}
                onSetAnswerNote={(note) => moderate(q.id, 'visible', note)}
              />
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => pending.forEach((q) => moderate(q.id, 'visible'))}
                className="text-xs rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30 px-3 py-1 text-emerald-200 hover:bg-emerald-500/25"
              >
                전체 통과
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 카테고리 필터 */}
      <div className="px-4 py-3 border-b border-neutral-900">
        <CategoryPicker value={filter} onChange={setFilter} includeAll />
      </div>

      {/* 메인 카드 리스트 */}
      <section className="px-4 py-4 space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-neutral-500 py-12">
            {filter === 'all' ? '아직 질문이 없어요' : '이 카테고리엔 없어요'}
          </p>
        )}
        {filtered.map((q) => (
          <QuestionCard
            key={q.id}
            id={q.id}
            q={q}
            myFingerprint=""
            isAdmin
            bannedFingerprints={session.bannedFingerprints}
            onMarkAnswered={() => moderate(q.id, 'answered')}
            onHide={() => moderate(q.id, 'hidden')}
            onBan={() => ban(q.authorFingerprint)}
            onSetAnswerNote={(note) => moderate(q.id, 'answered', note)}
          />
        ))}
      </section>

      {showQr && <QrModal code={session.code} onClose={() => setShowQr(false)} />}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-neutral-900/40 ring-1 ring-neutral-800 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ControlChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ring-1',
        active
          ? 'bg-indigo-500/35 text-indigo-50 ring-indigo-400/60 shadow-sm shadow-indigo-500/30 font-medium'
          : 'bg-neutral-900 text-neutral-300 ring-neutral-800 hover:bg-neutral-800',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PollCreateForm({
  sessionId,
  activePollId,
  onClose,
}: {
  sessionId: string;
  activePollId: string | null;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [showResultsLive, setShowResultsLive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (activePollId) {
      setError('이미 진행 중인 투표가 있어요. 먼저 종료해주세요');
      return;
    }
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) {
      setError('질문과 옵션 2개 이상');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          question: question.trim(),
          options: opts,
          showResultsLive,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? '실패');
      } else {
        setQuestion('');
        setOptions(['', '']);
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="px-4 py-3 border-b border-neutral-900 bg-neutral-900/30 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-neutral-300">새 투표</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-neutral-500 hover:text-neutral-200"
        >
          <X className="size-4" />
        </button>
      </div>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="질문 (예: 다음 진도 어디까지?)"
        className="rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        maxLength={200}
      />
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={o}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              setOptions(next);
            }}
            placeholder={`옵션 ${i + 1}`}
            maxLength={80}
            className="flex-1 rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          {options.length > 2 && (
            <button
              type="button"
              onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
              className="text-neutral-500 hover:text-rose-400 p-1"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ))}
      {options.length < 5 && (
        <button
          type="button"
          onClick={() => setOptions([...options, ''])}
          className="inline-flex items-center gap-1 self-start text-xs text-neutral-400 hover:text-neutral-200"
        >
          <Plus className="size-3" /> 옵션 추가
        </button>
      )}
      <label className="inline-flex items-center gap-2 text-xs text-neutral-300 mt-1">
        <input
          type="checkbox"
          checked={showResultsLive}
          onChange={(e) => setShowResultsLive(e.target.checked)}
          className="accent-indigo-500"
        />
        실시간 결과 공개 (체크 안 하면 닫을 때까지 결과 숨김)
      </label>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-800 px-3 py-2 text-sm font-medium transition"
      >
        {submitting ? '...' : '투표 시작'}
      </button>
    </form>
  );
}

function ActivePoll({
  sessionId,
  pollId,
  poll,
}: {
  sessionId: string;
  pollId: string;
  poll: PItem | undefined;
}) {
  const [voteCounts, setVoteCounts] = useState<number[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'sessions', sessionId, 'polls', pollId, 'votes'),
      (snap) => {
        const counts: number[] = [];
        snap.forEach((d) => {
          const idx = (d.data() as { optionIndex: number }).optionIndex;
          counts[idx] = (counts[idx] ?? 0) + 1;
        });
        setVoteCounts(counts);
      },
    );
    return () => unsub();
  }, [sessionId, pollId]);

  async function close() {
    await fetch(`/api/polls/${pollId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, status: 'closed' }),
    });
  }
  async function toggleLive() {
    await fetch(`/api/polls/${pollId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, showResultsLive: !poll?.showResultsLive }),
    });
  }

  if (!poll) return null;
  const total = voteCounts.reduce((a, b) => a + (b ?? 0), 0);

  return (
    <section className="px-4 py-3 border-b border-neutral-900 bg-indigo-500/5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-medium text-indigo-300 inline-flex items-center gap-1">
          <Megaphone className="size-3.5" /> 진행 중 — {total}명 투표
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLive}
            className={cn(
              'text-xs rounded-full px-2 py-0.5 ring-1 transition',
              poll.showResultsLive
                ? 'bg-emerald-500/15 ring-emerald-400/30 text-emerald-200'
                : 'bg-neutral-900 ring-neutral-800 text-neutral-400',
            )}
          >
            {poll.showResultsLive ? '결과 라이브 ON' : '결과 OFF'}
          </button>
          <button
            onClick={close}
            className="text-xs rounded-full bg-rose-500/15 ring-1 ring-rose-400/30 px-2 py-0.5 text-rose-200"
          >
            종료
          </button>
        </div>
      </div>
      <p className="text-sm mb-2">{poll.question}</p>
      <div className="space-y-1">
        {poll.options.map((o, i) => {
          const c = voteCounts[i] ?? 0;
          const pct = total > 0 ? Math.round((c / total) * 100) : 0;
          return (
            <div
              key={i}
              className="relative overflow-hidden rounded-lg bg-neutral-900/60 ring-1 ring-neutral-800 px-3 py-1.5 text-sm"
            >
              <div
                className="absolute inset-y-0 left-0 bg-indigo-500/20"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span>{o}</span>
                <span className="font-mono tabular-nums text-neutral-400">
                  {c} · {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
