'use client';

import { use, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query as fsQuery,
} from 'firebase/firestore';
import { X } from 'lucide-react';
import CategoryPicker from '@/components/CategoryPicker';
import QuestionCard from '@/components/QuestionCard';
import PollOverlay from '@/components/PollOverlay';
import { db } from '@/lib/firebase';
import { getFingerprint } from '@/lib/fingerprint';
import { isValidCode } from '@/lib/code';
import {
  DELETE_GRACE_SECONDS,
  TEXT_MAX,
  TEXT_MIN,
  type QuestionCategory,
  type QuestionDoc,
  type SessionDoc,
} from '@/lib/types';

type QItem = QuestionDoc & { id: string };

export default function SessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const code = decodeURIComponent(rawCode).toUpperCase();
  const router = useRouter();

  const [fp, setFp] = useState<string>('');
  const [myAuthorNumber, setMyAuthorNumber] = useState<number | null>(null);
  const [session, setSession] = useState<SessionDoc | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [questions, setQuestions] = useState<QItem[]>([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<QuestionCategory>('question');
  const [filter, setFilter] = useState<QuestionCategory | 'all'>('all');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPoll, setShowPoll] = useState(true);
  const [, setTick] = useState(0);
  const prevVisibleCount = useRef<number>(0);
  const initialLoad = useRef(true);
  const [tabBadge, setTabBadge] = useState(0);

  // fingerprint 초기화 + join
  useEffect(() => {
    if (!isValidCode(code)) return;
    const myFp = getFingerprint();
    setFp(myFp);
  }, [code]);

  // 세션 입장 (authorNumber 부여)
  useEffect(() => {
    if (!fp || !isValidCode(code)) return;
    fetch(`/api/sessions/${code}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fingerprint: fp }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && typeof d.authorNumber === 'number') {
          setMyAuthorNumber(d.authorNumber);
        }
      })
      .catch(() => {});
  }, [fp, code]);

  // 질문 작성 후 number 부여될 수 있음 — questions 보면서 추적
  useEffect(() => {
    if (myAuthorNumber || !fp) return;
    const mine = questions.find((q) => q.authorFingerprint === fp);
    if (mine) setMyAuthorNumber(mine.authorNumber);
  }, [questions, fp, myAuthorNumber]);

  // 세션 doc subscribe
  useEffect(() => {
    if (!isValidCode(code)) return;
    const unsub = onSnapshot(doc(db, 'sessions', code), (snap) => {
      setSession(snap.exists() ? (snap.data() as SessionDoc) : null);
      setSessionLoaded(true);
    });
    return () => unsub();
  }, [code]);

  // questions subscribe
  useEffect(() => {
    if (!isValidCode(code)) return;
    const q = fsQuery(
      collection(db, 'sessions', code, 'questions'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: QItem[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as QuestionDoc) }));
      setQuestions(items);
    });
    return () => unsub();
  }, [code]);

  // 1초 단위 tick (30초 grace 카운트다운에 사용)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 정렬: status 우선 (visible/pending 앞, answered/hidden 뒤)
  // 추천 내림차순, tiebreaker = 오래된순 (createdAt 오름차순)
  const sortedVisible = useMemo(() => {
    const visible = questions.filter((q) => {
      if (q.status === 'pending') return q.authorFingerprint === fp; // 본인 pending만 본인에게
      if (q.status === 'hidden') return false; // 학생에겐 숨김 안 보임
      return true;
    });
    visible.sort((a, b) => {
      // active(visible) > answered
      const rankA = a.status === 'answered' ? 1 : 0;
      const rankB = b.status === 'answered' ? 1 : 0;
      if (rankA !== rankB) return rankA - rankB;
      // 추천 내림차순
      if ((b.upvotes ?? 0) !== (a.upvotes ?? 0)) {
        return (b.upvotes ?? 0) - (a.upvotes ?? 0);
      }
      // tiebreaker: 오래된 순
      return (a.createdAt ?? 0) - (b.createdAt ?? 0);
    });
    return visible;
  }, [questions, fp]);

  const filtered = useMemo(() => {
    if (filter === 'all') return sortedVisible;
    return sortedVisible.filter((q) => q.category === filter);
  }, [sortedVisible, filter]);

  // 새 질문 시 탭 배지
  useEffect(() => {
    if (initialLoad.current) {
      prevVisibleCount.current = sortedVisible.length;
      initialLoad.current = false;
      return;
    }
    const diff = sortedVisible.length - prevVisibleCount.current;
    if (diff > 0 && document.hidden) {
      setTabBadge((b) => b + diff);
    }
    prevVisibleCount.current = sortedVisible.length;
  }, [sortedVisible]);

  useEffect(() => {
    function clear() {
      if (!document.hidden) setTabBadge(0);
    }
    document.addEventListener('visibilitychange', clear);
    return () => document.removeEventListener('visibilitychange', clear);
  }, []);

  useEffect(() => {
    document.title = tabBadge > 0 ? `(${tabBadge}) 강의실 QnA` : '강의실 QnA';
  }, [tabBadge]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    const trimmed = text.trim();
    if (trimmed.length < TEXT_MIN) {
      setSubmitError(`${TEXT_MIN}자 이상 적어주세요`);
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/questions/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: code,
          fingerprint: fp,
          text: trimmed,
          category,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setSubmitError(data.error ?? '실패');
      } else {
        setText('');
      }
    } catch {
      setSubmitError('네트워크 오류');
    } finally {
      setSubmitting(false);
    }
  }

  async function upvote(qid: string) {
    await fetch(`/api/questions/${qid}/upvote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: code, fingerprint: fp }),
    });
  }

  async function deleteMine(qid: string) {
    await fetch(`/api/questions/${qid}/delete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: code, fingerprint: fp }),
    });
  }

  function canDelete(q: QItem): boolean {
    if (q.authorFingerprint !== fp) return false;
    if ((q.upvotes ?? 0) > 0) return false;
    const elapsed = (Date.now() - (q.createdAt ?? 0)) / 1000;
    return elapsed <= DELETE_GRACE_SECONDS;
  }

  // 검증되지 않은 코드 → 즉시 안내
  if (!isValidCode(code)) {
    return <NotJoinable msg="잘못된 코드예요" onHome={() => router.push('/')} />;
  }
  if (sessionLoaded && (!session || !session.isOpen)) {
    return <NotJoinable msg="수업이 진행 중이 아니에요" onHome={() => router.push('/')} />;
  }
  if (!sessionLoaded || !session) {
    return <main className="min-h-dvh" />;
  }

  const banned = session.bannedFingerprints?.includes(fp);
  if (banned) {
    return <NotJoinable msg="차단된 사용자예요" onHome={() => router.push('/')} />;
  }

  return (
    <main className="min-h-dvh flex flex-col max-w-2xl mx-auto">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 backdrop-blur bg-neutral-950/70 border-b border-neutral-900 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-medium truncate">{session.title}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            <span className="font-mono">{session.code}</span> · 익명 모드
          </p>
        </div>
        {myAuthorNumber && (
          <div
            className="shrink-0 rounded-full px-3 py-1.5 ring-1 ring-indigo-400/40 bg-indigo-500/15 font-mono text-sm text-indigo-200"
            title="이 세션에서 당신 번호 — 다른 학생에겐 보이지 않아요"
          >
            나는 <span className="font-semibold">학생#{myAuthorNumber}</span>
          </div>
        )}
      </header>

      {/* 카테고리 필터 */}
      <div className="px-4 py-3 border-b border-neutral-900">
        <CategoryPicker value={filter} onChange={setFilter} includeAll />
      </div>

      {/* 카드 리스트 */}
      <section className="flex-1 px-4 py-4 space-y-2 pb-32">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="size-14 rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-400/20 grid place-items-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm text-neutral-400">
              {filter === 'all' ? '아직 질문이 없어요' : '이 카테고리엔 질문이 없어요'}
            </p>
            {filter === 'all' && (
              <p className="text-xs text-neutral-600">첫 질문을 던져보세요</p>
            )}
          </div>
        )}
        {filtered.map((q) => (
          <QuestionCard
            key={q.id}
            id={q.id}
            q={q}
            myFingerprint={fp}
            onUpvote={() => upvote(q.id)}
            onDelete={() => deleteMine(q.id)}
            canDelete={canDelete(q)}
          />
        ))}
      </section>

      {/* 입력창 (하단 고정) */}
      <form
        onSubmit={submit}
        className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-neutral-950 via-neutral-950/95 to-neutral-950/0 pt-6"
      >
        <div className="max-w-2xl mx-auto px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <div className="mb-2">
            <CategoryPicker
              value={category}
              onChange={(v) => setCategory(v as QuestionCategory)}
            />
          </div>
          <div className="flex items-end gap-2 rounded-2xl bg-neutral-900 ring-1 ring-neutral-800 focus-within:ring-indigo-500/40 transition p-2">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSubmitError(null);
              }}
              onKeyDown={(e) => {
                // 한글 조합 중(IME composing)이면 무시 → 마지막 글자 안 잘림
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              enterKeyHint="send"
              placeholder="질문을 올려주세요 (이상한 글은 AI가 판단하여 차단됩니다)"
              maxLength={TEXT_MAX}
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none px-2 py-2 text-[15px] placeholder:text-neutral-600"
              style={{ minHeight: '40px', maxHeight: '120px' }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(120, t.scrollHeight) + 'px';
              }}
            />
            <button
              type="submit"
              disabled={submitting || text.trim().length < TEXT_MIN}
              className="rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-800 disabled:text-neutral-500 px-4 py-2 text-sm font-medium transition"
            >
              {submitting ? '...' : '올리기'}
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-500 mt-1.5 px-1">
            <span>{submitError ?? `${text.length} / ${TEXT_MAX}`}</span>
            {session.reviewMode && (
              <span className="text-amber-400/80">검수 모드 — 교수님이 통과시켜야 보여요</span>
            )}
          </div>
        </div>
      </form>

      {/* 라이브 투표 */}
      {session.activePollId && showPoll && (
        <PollOverlay
          sessionId={code}
          pollId={session.activePollId}
          fingerprint={fp}
          onClose={() => setShowPoll(false)}
        />
      )}
    </main>
  );
}

function NotJoinable({ msg, onHome }: { msg: string; onHome: () => void }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 gap-6">
      <div className="size-14 rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/20 grid place-items-center">
        <X className="size-6 text-rose-400" />
      </div>
      <p className="text-neutral-300">{msg}</p>
      <button
        onClick={onHome}
        className="rounded-xl bg-neutral-900 hover:bg-neutral-800 ring-1 ring-neutral-800 px-4 py-2 text-sm transition"
      >
        처음으로
      </button>
    </main>
  );
}
