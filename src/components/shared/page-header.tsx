'use client';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-surface-container animate-fade-in-up', className)}>
      <div>
        <h1 className="font-headline text-xl lg:text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && (
          <p className="font-label text-sm text-on-surface-variant mt-1">{description}</p>
        )}
      </div>
      {action && <div className="mt-2 sm:mt-0">{action}</div>}
    </div>
  );
}
