'use client';

// The headline stat card shared by the lab and radiology home pages. Extracted
// so the two summary strips are the same component rather than two copies that
// drift apart — the point of the unified diagnostic flow is that a supervisor
// moving between the two departments sees the same screen.

import { cn } from '@/lib/utils';

export const SUMMARY_TONES: Record<string, { wrap: string; icon: string }> = {
  amber: { wrap: 'bg-amber-50', icon: 'text-amber-600' },
  indigo: { wrap: 'bg-indigo-50', icon: 'text-indigo-600' },
  blue: { wrap: 'bg-blue-50', icon: 'text-blue-600' },
  purple: { wrap: 'bg-purple-50', icon: 'text-purple-600' },
  cyan: { wrap: 'bg-cyan-50', icon: 'text-cyan-600' },
  teal: { wrap: 'bg-teal-50', icon: 'text-teal-600' },
  green: { wrap: 'bg-green-50', icon: 'text-green-600' },
  red: { wrap: 'bg-red-50', icon: 'text-red-600' },
};

export interface SummaryCardSpec {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}

export function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
  onClick,
}: SummaryCardSpec & {
  loading?: boolean;
  onClick?: () => void;
}) {
  const cls = SUMMARY_TONES[tone] ?? SUMMARY_TONES.indigo;
  // A count you can act on should be reachable from the number itself.
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'w-full rounded-xl bg-surface-container-lowest p-3 text-left shadow-sanctuary',
        onClick && 'cursor-pointer transition-colors hover:bg-surface-container-low',
      )}
    >
      <div className={cn('mb-2 inline-flex rounded-lg p-1.5', cls.wrap)}>
        <Icon className={cn('h-3.5 w-3.5', cls.icon)} />
      </div>
      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p className="mt-0.5 font-headline text-xl font-bold">
        {loading ? <span className="text-muted-foreground/40">—</span> : value}
      </p>
    </Wrapper>
  );
}
