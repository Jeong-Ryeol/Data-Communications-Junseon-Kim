'use client';

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import type { PollDoc, VoteDoc } from '@/lib/types';

type Props = {
  sessionId: string;
  pollId: string;
  fingerprint: string;
  onClose?: () => void;
};

export default function PollOverlay({ sessionId, pollId, fingerprint, onClose }: Props) {
  const [poll, setPoll] = useState<PollDoc | null>(null);
  const [tally, setTally] = useState<number[]>([]);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 폴 메타 구독 (작음, 학생당 1 doc)
  useEffect(() => {
    const pollRef = doc(db, 'sessions', sessionId, 'polls', pollId);
    const unsubPoll = onSnapshot(pollRef, (s) => {
      setPoll(s.exists() ? (s.data() as PollDoc) : null);
    });
    return () => unsubPoll();
  }, [sessionId, pollId]);

  // 본인 투표 doc만 구독 — fan-out 없음 (학생 N명 × 본인 doc 1개)
  useEffect(() => {
    const myVoteRef = doc(db, 'sessions', sessionId, 'polls', pollId, 'votes', fingerprint);
    const unsubMine = onSnapshot(myVoteRef, (s) => {
      if (s.exists()) {
        setMyVote((s.data() as VoteDoc).optionIndex);
      } else {
        setMyVote(null);
      }
    });
    return () => unsubMine();
  }, [sessionId, pollId, fingerprint]);

  // 전체 votes 구독은 결과를 보여줄 때만 — fan-out 50명×N votes 비용 절감
  const shouldSubscribeAll = !!poll && (poll.showResultsLive || poll.status === 'closed');
  useEffect(() => {
    if (!shouldSubscribeAll) {
      setTally([]);
      return;
    }
    const votesRef = collection(db, 'sessions', sessionId, 'polls', pollId, 'votes');
    const unsubVotes = onSnapshot(votesRef, (snap) => {
      const counts: number[] = [];
      snap.forEach((d) => {
        const v = d.data() as VoteDoc;
        counts[v.optionIndex] = (counts[v.optionIndex] ?? 0) + 1;
      });
      setTally(counts);
    });
    return () => unsubVotes();
  }, [shouldSubscribeAll, sessionId, pollId]);

  if (!poll) return null;

  const total = tally.reduce((a, b) => a + (b ?? 0), 0);
  const isClosed = poll.status === 'closed';
  const showResults = poll.showResultsLive || isClosed;

  async function vote(idx: number) {
    if (submitting || isClosed) return;
    setSubmitting(true);
    try {
      await fetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, fingerprint, optionIndex: idx }),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-neutral-950 border border-indigo-400/30 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-2 text-xs text-indigo-300">
            <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse-glow" />
            라이브 투표 {isClosed && '(종료)'}
          </span>
          {isClosed && onClose && (
            <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-200">
              닫기
            </button>
          )}
        </div>
        <h3 className="text-lg font-medium mb-4">{poll.question}</h3>
        <div className="flex flex-col gap-2">
          {poll.options.map((opt, idx) => {
            const count = tally[idx] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const selected = myVote === idx;
            return (
              <button
                key={idx}
                onClick={() => vote(idx)}
                disabled={isClosed || submitting}
                className={cn(
                  'relative overflow-hidden rounded-2xl px-4 py-3 text-left ring-1',
                  selected
                    ? 'ring-indigo-400 ring-2 bg-indigo-500/25 shadow-md shadow-indigo-500/30 font-medium'
                    : 'ring-neutral-800 bg-neutral-900 hover:bg-neutral-800/50',
                  (isClosed || submitting) && 'cursor-not-allowed',
                )}
              >
                {showResults && (
                  <div
                    className="absolute inset-y-0 left-0 bg-indigo-500/15 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between">
                  <span>{opt}</span>
                  {showResults && (
                    <span className="text-sm font-mono tabular-nums text-neutral-400">
                      {count} · {pct}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {!showResults && myVote !== null && !isClosed && (
          <p className="mt-3 text-xs text-neutral-500 text-center">
            투표 완료 — 결과는 교수님이 닫은 뒤 공개돼요
          </p>
        )}
      </div>
    </div>
  );
}
