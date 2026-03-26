'use client';

import { cn } from '@/lib/utils';
import type { ModuleConfig } from '@/config/modules';

interface ModuleCardProps {
  module: ModuleConfig;
  onClick: () => void;
}

export function ModuleCard({ module, onClick }: ModuleCardProps) {
  const Icon = module.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-card p-6 text-center shadow-sm',
        'transition-all duration-200 hover:border-primary hover:shadow-lg hover:-translate-y-1 hover:bg-primary/5'
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 transition-transform duration-200 group-hover:scale-110">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <p className="font-semibold text-sm text-card-foreground">{module.label}</p>
    </button>
  );
}
