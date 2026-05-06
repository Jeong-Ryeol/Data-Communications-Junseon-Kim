export type QuestionStatus = 'pending' | 'visible' | 'answered' | 'hidden';
export type QuestionCategory = 'question' | 'reexplain' | 'correction' | 'opinion';
export type PulseState = 'understood' | 'lost';
export type PulseDecaySeconds = 30 | 60 | 120;

export interface SessionDoc {
  code: string;
  title: string;
  isOpen: boolean;
  createdAt: number;
  closedAt: number | null;
  reviewMode: boolean;
  bannedFingerprints: string[];
  activePollId: string | null;
  pulseEnabled: boolean;
  pulseDecaySeconds: PulseDecaySeconds;
  fingerprintToNumber: Record<string, number>;
  nextNumber: number;
  /** rate limit용 — fp → 직전 질문 timestamp. 인덱스 없이 단일 doc read로 처리. */
  lastQuestionAtByFp?: Record<string, number>;
  /** AI 모더레이션 (Gemini) 활성 여부. 기본 true. 교수가 끄면 정적 비속어 필터만 작동. */
  aiModerationEnabled?: boolean;
  /** Gemini 무료 한도 소진 감지. true면 AI 호출 안 됨. 다음 성공 호출 시 자동 클리어. */
  aiQuotaExceeded?: boolean;
}

export interface QuestionDoc {
  text: string;
  upvotes: number;
  upvoterFingerprints: string[];
  authorFingerprint: string;
  authorNumber: number;
  status: QuestionStatus;
  category: QuestionCategory;
  answerNote: string | null;
  createdAt: number;
}

export interface PulseDoc {
  state: PulseState;
  updatedAt: number;
}

export interface PollDoc {
  question: string;
  options: string[];
  status: 'open' | 'closed';
  showResultsLive: boolean;
  createdAt: number;
}

export interface VoteDoc {
  optionIndex: number;
}

export const CATEGORIES: QuestionCategory[] = ['question', 'reexplain', 'correction', 'opinion'];

export const CATEGORY_LABEL: Record<QuestionCategory, string> = {
  question: '질문',
  reexplain: '다시 설명',
  correction: '오타·정정',
  opinion: '의견',
};

export const CATEGORY_CHIP: Record<QuestionCategory, string> = {
  question: 'text-indigo-300 bg-indigo-500/10 ring-indigo-400/30',
  reexplain: 'text-amber-300 bg-amber-500/10 ring-amber-400/30',
  correction: 'text-rose-300 bg-rose-500/10 ring-rose-400/30',
  opinion: 'text-emerald-300 bg-emerald-500/10 ring-emerald-400/30',
};

export const TEXT_MIN = 1;
export const TEXT_MAX = 200;
export const RATE_LIMIT_SECONDS = 5;
export const DELETE_GRACE_SECONDS = 30;
