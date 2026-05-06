'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Plus, Clock, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/utils';
import type { SessionDoc } from '@/lib/types';

type SessionItem = SessionDoc & { id: string };

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 세션 리스트
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // 새 세션
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  async function refresh() {
    setLoadingList(true);
    const r = await fetch('/api/admin/sessions');
    if (r.status === 401) {
      setAuthed(false);
      setLoadingList(false);
      return;
    }
    const data = await r.json();
    setSessions(data.sessions ?? []);
    setAuthed(true);
    setLoadingList(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? '로그인 실패');
      } else {
        setPw('');
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
  }

  async function createSession(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const r = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || '새 세션',
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setCreateError(data.error ?? '실패');
      } else {
        router.push(`/admin/session/${data.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  if (authed === null) {
    return <main className="min-h-dvh" />;
  }

  if (!authed) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6">
        <form onSubmit={login} className="w-full max-w-sm flex flex-col gap-5">
          <div className="text-center space-y-2">
            <div className="size-12 mx-auto rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-400/20 grid place-items-center">
              <Lock className="size-5 text-indigo-300" />
            </div>
            <h1 className="text-xl font-semibold">교수님 로그인</h1>
          </div>
          <input
            type="password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError(null);
            }}
            placeholder="비밀번호"
            className="rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 outline-none focus:border-indigo-500 transition"
            autoFocus
          />
          {error && <p className="text-sm text-rose-400 text-center">{error}</p>}
          <button
            type="submit"
            disabled={!pw || submitting}
            className="rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-800 px-4 py-3 font-medium transition"
          >
            {submitting ? '...' : '입장'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-dvh max-w-3xl mx-auto p-4 sm:p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">교수님 대시보드</h1>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 transition"
        >
          <LogOut className="size-3.5" /> 로그아웃
        </button>
      </header>

      {/* 새 세션 시작 */}
      <section className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-4 sm:p-5 mb-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">새 세션 시작</h2>
        <form onSubmit={createSession} className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="세션 제목 (예: 데이터통신 5주차)"
            maxLength={80}
            className="rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 outline-none focus:border-indigo-500 transition"
          />
          {createError && <p className="text-sm text-rose-400">{createError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-800 px-4 py-2.5 font-medium transition"
          >
            <Plus className="size-4" /> {creating ? '생성 중...' : '세션 시작'}
          </button>
        </form>
      </section>

      {/* 과거 세션 */}
      <section>
        <h2 className="text-sm font-medium text-neutral-300 mb-3">최근 세션</h2>
        {loadingList ? (
          <p className="text-sm text-neutral-500">불러오는 중...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-neutral-500">아직 세션이 없어요</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <a
                  href={`/admin/session/${s.id}`}
                  className="block rounded-xl bg-neutral-900/40 hover:bg-neutral-900 border border-neutral-800 px-4 py-3 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-xs text-neutral-500 mt-0.5 inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatTime(s.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm text-neutral-300">{s.code}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] ring-1',
                          s.isOpen
                            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30'
                            : 'bg-neutral-800 text-neutral-400 ring-neutral-700',
                        )}
                      >
                        {s.isOpen ? '진행 중' : '종료'}
                      </span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
