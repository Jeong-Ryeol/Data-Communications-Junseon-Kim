'use client';

import { CATEGORIES, CATEGORY_CHIP, CATEGORY_LABEL, type QuestionCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  value: QuestionCategory | 'all';
  onChange: (v: QuestionCategory | 'all') => void;
  includeAll?: boolean;
};

export default function CategoryPicker({ value, onChange, includeAll = false }: Props) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
      {includeAll && (
        <button
          onClick={() => onChange('all')}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs ring-1',
            value === 'all'
              ? 'bg-neutral-100 text-neutral-900 ring-neutral-100 shadow-md shadow-white/10'
              : 'bg-neutral-900 text-neutral-400 ring-neutral-800 hover:text-neutral-200',
          )}
        >
          전체
        </button>
      )}
      {CATEGORIES.map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs ring-1',
              active
                ? CATEGORY_CHIP[c].replace('/10', '/30') + ' ring-current shadow-sm shadow-current/20 font-medium'
                : 'bg-neutral-900 text-neutral-400 ring-neutral-800 hover:text-neutral-200',
            )}
          >
            {CATEGORY_LABEL[c]}
          </button>
        );
      })}
    </div>
  );
}
