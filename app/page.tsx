'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isValidCode, normalizeCode } from '@/lib/code';

function HomeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  // QR로 들어왔으면 자동 채움 + 자동 입장
  useEffect(() => {
    const c = params?.get('c');
    if (!c) return;
    const norm = normalizeCode(c);
    if (isValidCode(norm)) {
      router.replace(`/session/${norm}`);
    }
  }, [params, router]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const norm = normalizeCode(code);
    if (!isValidCode(norm)) {
      setError('영문/숫자 6자리예요');
      return;
    }
    router.push(`/session/${norm}`);
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 ring-1 ring-indigo-400/20 px-3 py-1 text-xs text-indigo-300">
            <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse-glow" />
            익명 보장
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">강의실 QnA</h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            학번 / 이름 / IP 어디에도 저장하지 않아요.<br />
            누가 누군지 아무도 몰라요.
          </p>
        </div>

        <form onSubmit={onSubmit} className="w-full flex flex-col gap-4">
          <input
            value={code}
            onChange={(e) => {
              setCode(normalizeCode(e.target.value));
              setError(null);
            }}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="6자리 코드"
            className="w-full text-center text-3xl tracking-[0.4em] font-mono uppercase bg-neutral-900/70 border border-neutral-800 rounded-2xl py-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition placeholder:text-neutral-700"
            maxLength={6}
            aria-label="세션 코드"
          />
          {error && (
            <p className="text-sm text-rose-400 text-center -mt-1">{error}</p>
          )}
          <button
            type="submit"
            disabled={code.length < 6}
            className="rounded-2xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-800 disabled:text-neutral-500 active:scale-[0.98] transition py-4 text-lg font-medium"
          >
            입장
          </button>
        </form>

        <p className="text-xs text-neutral-500 text-center leading-relaxed">
          교수님이 수업을 시작해야 입장할 수 있어요.<br />
          QR 코드를 찍으면 자동으로 입장돼요.
        </p>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <HomeInner />
    </Suspense>
  );
}
