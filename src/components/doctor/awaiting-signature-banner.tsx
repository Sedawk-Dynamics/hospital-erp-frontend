'use client';

/**
 * Consultations the doctor pinned but never signed.
 *
 * Pinning a section is the doctor saying "the patient should read this", but
 * pins only reach the portal once the note is signed. An unsigned pinned
 * consultation therefore looks finished from the doctor's side and is
 * invisible from the patient's — and nothing used to say so. This is the one
 * place that gap is visible.
 */

import { useRouter } from 'next/navigation';
import { PenLine, ChevronRight } from 'lucide-react';
import { useConsultationsAwaitingSignature } from '@/hooks/use-doctor';
import { formatDate } from '@/lib/date-utils';

export function AwaitingSignatureBanner() {
  const router = useRouter();
  const { data, isLoading } = useConsultationsAwaitingSignature();

  const notes = data ?? [];
  // Nothing outstanding is the normal state — say nothing rather than showing
  // an empty card on every visit to the dashboard.
  if (isLoading || notes.length === 0) return null;

  const open = (patientId?: string, appointmentId?: string | null) => {
    if (!patientId) return;
    router.push(
      `/doctor/consultation/${patientId}${appointmentId ? `?appointmentId=${appointmentId}` : ''}`,
    );
  };

  return (
    <section className="rounded-xl border-l-4 border-secondary bg-surface-container-lowest p-4 shadow-sanctuary">
      <div className="mb-3 flex items-start gap-2">
        <div className="rounded-lg bg-secondary/10 p-2 text-secondary">
          <PenLine className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-headline text-sm font-bold">
            {notes.length} consultation summar{notes.length === 1 ? 'y' : 'ies'} awaiting your
            signature
          </h2>
          <p className="text-xs text-muted-foreground">
            You pinned sections for the patient to read. They stay private until the note is
            signed.
          </p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {notes.slice(0, 5).map((n) => {
          const name = `${n.patient?.firstName ?? ''} ${n.patient?.lastName ?? ''}`.trim();
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n.patient?.id, n.visit?.appointmentId)}
                className="flex w-full items-center gap-2 rounded-lg border border-outline-variant/40 px-3 py-2 text-left transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{name || 'Patient'}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {n.patient?.mrn ?? ''}
                    {n.visit?.visitDate ? ` · ${formatDate(n.visit.visitDate)}` : ''}
                    {n._count?.pins ? ` · ${n._count.pins} pinned section${n._count.pins === 1 ? '' : 's'}` : ''}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>

      {notes.length > 5 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          and {notes.length - 5} more
        </p>
      )}
    </section>
  );
}
