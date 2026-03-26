'use client';

import { cn } from '@/lib/utils';
import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in-up',
        className
      )}
    >
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
        <Icon className="h-10 w-10 text-primary/60" />
      </div>
      <h3 className="font-headline text-lg font-bold">{title}</h3>
      {description && (
        <p className="mt-1 font-label text-sm text-on-surface-variant max-w-md">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
