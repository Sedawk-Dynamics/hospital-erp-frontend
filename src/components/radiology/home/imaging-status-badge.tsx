'use client';

// Where a study actually is, in one badge.
//
// `ImagingRequest.status` alone cannot say it: a request sitting at `requested`
// might be waiting on the admin to accept it or on a radiologist to pick it up,
// and a `completed` one might be waiting for approval or already out. The badge
// folds in the acceptance flag and the result status so the row says the thing
// the reader needs to know. Mirrors the lab's StatusBadge, which does the same
// with LabReport.status.

import { cn } from '@/lib/utils';

export function ImagingStatusBadge({
  status,
  resultStatus,
  accepted,
}: {
  status?: string;
  resultStatus?: string | null;
  accepted?: boolean;
}) {
  const { label, cls } = resolve(status, resultStatus, accepted);
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold capitalize', cls)}>
      {label}
    </span>
  );
}

function resolve(status?: string, resultStatus?: string | null, accepted?: boolean) {
  if (resultStatus === 'published') {
    return { label: 'published', cls: 'bg-emerald-100 text-emerald-800' };
  }
  if (resultStatus === 'finalized') {
    return { label: 'awaiting approval', cls: 'bg-amber-100 text-amber-800' };
  }
  if (resultStatus === 'draft') {
    return { label: 'draft', cls: 'bg-indigo-100 text-indigo-800' };
  }
  switch (status) {
    case 'cancelled':
      return { label: 'cancelled', cls: 'bg-red-100 text-red-800' };
    case 'no_show':
      return { label: 'no-show', cls: 'bg-rose-100 text-rose-800' };
    case 'completed':
      return { label: 'completed', cls: 'bg-green-100 text-green-800' };
    case 'in_progress':
      return { label: 'in progress', cls: 'bg-indigo-100 text-indigo-800' };
    case 'scheduled':
      return { label: 'scheduled', cls: 'bg-blue-100 text-blue-800' };
    default:
      return accepted
        ? { label: 'to scan', cls: 'bg-purple-100 text-purple-800' }
        : { label: 'new order', cls: 'bg-amber-100 text-amber-800' };
  }
}
