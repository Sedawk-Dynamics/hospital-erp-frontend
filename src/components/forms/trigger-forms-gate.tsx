'use client';

import { useState, useEffect } from 'react';
import { FileWarning, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { IntakeFormsModal } from './intake-forms-modal';
import { usePendingFormsForContext } from '@/hooks/use-forms';
import type { FormTrigger } from '@/types/forms';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────
// Reusable component that any page/dialog can drop in to
// auto-detect and prompt pending required forms for a given
// (trigger + tenant + entity) context.
//
// Behaviors:
//   - On mount, queries /forms/pending for the given context
//   - If results are non-empty AND autoOpen=true, opens the modal
//   - Renders a warning banner (optional)
//   - Modal cannot be dismissed until all required forms are filled
//   - Refetches automatically on submission so multi-form sequences work
//   - Refetches on window focus
//
// Drop-in usage anywhere a workflow step happens:
//   <TriggerFormsGate
//     trigger="visit_check_in"
//     tenantId={apt.tenantId}
//     context={{ appointmentId: apt.id, patientId: apt.patientId }}
//   />
// ─────────────────────────────────────────────────────────

interface TriggerFormsGateProps {
  trigger: FormTrigger;
  /** Tenant the forms live in. Defaults to current user's tenant if omitted. */
  tenantId?: string | null;
  context: {
    appointmentId?: string | null;
    admissionId?: string | null;
    visitId?: string | null;
    patientId?: string | null;
  };
  /** Show the warning banner above the modal. Default: true */
  showBanner?: boolean;
  /** Auto-open the modal when pending forms are detected. Default: true */
  autoOpen?: boolean;
  /** Visible label override for the banner heading */
  bannerHeading?: string;
  /** Disable the entire gate (e.g., when context isn't ready yet) */
  enabled?: boolean;
  /** Called when all required forms have been filled */
  onAllComplete?: () => void;
  /** Optional className for the banner container */
  className?: string;
}

export function TriggerFormsGate({
  trigger,
  tenantId,
  context,
  showBanner = true,
  autoOpen = true,
  bannerHeading,
  enabled = true,
  onAllComplete,
  className,
}: TriggerFormsGateProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [autoOpenedFor, setAutoOpenedFor] = useState<string | null>(null);

  const { data: pending } = usePendingFormsForContext({
    trigger,
    tenantId: tenantId ?? undefined,
    appointmentId: context.appointmentId ?? undefined,
    admissionId: context.admissionId ?? undefined,
    visitId: context.visitId ?? undefined,
    patientId: context.patientId ?? undefined,
    enabled,
  });

  // Compute a context fingerprint so we only auto-open once per unique context.
  // (Prevents the modal from re-opening over and over after the user closes it
  // without filling — they can only see the banner instead.)
  const contextKey = JSON.stringify({
    trigger,
    tenantId,
    ...context,
  });

  useEffect(() => {
    if (!autoOpen) return;
    if (!pending || pending.length === 0) return;
    if (autoOpenedFor === contextKey) return; // already auto-opened once for this context
    setOpen(true);
    setAutoOpenedFor(contextKey);
  }, [autoOpen, pending, contextKey, autoOpenedFor]);

  const handleComplete = () => {
    setOpen(false);
    // Refetch pending so any subsequent forms can be detected
    queryClient.invalidateQueries({ queryKey: ['forms', 'pending'] });
    if (onAllComplete) onAllComplete();
  };

  if (!enabled) return null;
  if (!pending || pending.length === 0) return null;

  return (
    <>
      {showBanner && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100/70 transition-colors',
            className,
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-200 shrink-0">
            <FileWarning className="h-5 w-5 text-amber-800" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {bannerHeading ||
                `${pending.length} required form${pending.length > 1 ? 's' : ''} pending`}
            </p>
            <p className="text-[11px] text-amber-800">
              Click to fill {pending.length > 1 ? 'them' : 'it'} now.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-amber-800 shrink-0" />
        </button>
      )}

      <IntakeFormsModal
        open={open}
        trigger={trigger}
        tenantId={tenantId}
        context={{
          appointmentId: context.appointmentId ?? undefined,
          admissionId: context.admissionId ?? undefined,
          visitId: context.visitId ?? undefined,
          patientId: context.patientId ?? undefined,
        }}
        onComplete={handleComplete}
      />
    </>
  );
}
