'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ArrowRight, ArrowDownLeft, ArrowUpRight, ClipboardList } from 'lucide-react';
import { useHandoverFeed, type HandoverFeedIncoming, type HandoverFeedOutgoing } from '@/hooks/use-nurse-assignments';

const SHIFT_LABEL: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
  general: 'General',
};

interface Props {
  variant?: 'banner' | 'card';
  /** When true, the empty state is rendered instead of returning null. */
  showEmpty?: boolean;
}

/**
 * Renders the per-nurse handover feed sourced from /clinical/nurse-assignments/handover-feed.
 *
 * - "Incoming" = nurse_admin assigned patients to me from a previous shift's nurse.
 * - "Outgoing" = patients I've just been handed off to the next nurse.
 *
 * Always-visible — the whole point is that nurses see the relief plan
 * nurse_admin built in the roster without needing to open another screen.
 */
export function AdminHandoverBanner({ variant = 'banner', showEmpty = false }: Props) {
  const { data, isLoading } = useHandoverFeed();
  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];

  if (isLoading) return null;

  if (incoming.length === 0 && outgoing.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        No handovers in the last 24 hours. Nurse-admin will plan your shift handover here.
      </div>
    );
  }

  return (
    <div className={variant === 'card' ? 'space-y-3' : 'space-y-2'}>
      {incoming.length > 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-900">
            <ArrowDownLeft className="h-4 w-4" />
            Nurse-admin set up {incoming.length} patient{incoming.length === 1 ? '' : 's'} for you to take over
          </div>
          <ul className="space-y-1.5">
            {incoming.map((row) => (
              <IncomingRow key={row.sourceAssignmentId} row={row} />
            ))}
          </ul>
        </div>
      ) : null}

      {outgoing.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
            <ArrowUpRight className="h-4 w-4" />
            You handed over {outgoing.length} patient{outgoing.length === 1 ? '' : 's'} to the next shift
          </div>
          <ul className="space-y-1.5">
            {outgoing.map((row) => (
              <OutgoingRow key={row.sourceAssignmentId} row={row} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function IncomingRow({ row }: { row: HandoverFeedIncoming }) {
  const fromName = row.fromNurse
    ? `${row.fromNurse.firstName} ${row.fromNurse.lastName ?? ''}`.trim()
    : 'Previous nurse';
  const patient = row.admission?.patient;
  const patientName = patient
    ? `${patient.firstName} ${patient.lastName ?? ''}`.trim()
    : 'Unknown patient';
  return (
    <li className="flex flex-wrap items-center gap-2 text-xs text-emerald-900">
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold">{fromName}</span>
      <ArrowRight className="h-3 w-3 opacity-60" />
      <span className="font-semibold">You</span>
      <span className="text-muted-foreground">·</span>
      <span className="font-medium">{patientName}</span>
      {row.bed?.bedNumber ? <span className="text-muted-foreground">Bed {row.bed.bedNumber}</span> : null}
      {row.ward?.name ? <span className="text-muted-foreground">{row.ward.name}</span> : null}
      <span className="text-muted-foreground">
        Handed over {SHIFT_LABEL[row.fromShiftType] ?? row.fromShiftType} ·{' '}
        {format(parseISO(row.fromShiftDate), 'dd/MM')}
        {row.handedOverAt ? ` @ ${format(new Date(row.handedOverAt), 'HH:mm')}` : ''}
      </span>
      {row.note ? (
        <Link
          href="/nurse/handover"
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-800 hover:bg-emerald-50"
        >
          <ClipboardList className="h-3 w-3" />
          Read note
        </Link>
      ) : null}
    </li>
  );
}

function OutgoingRow({ row }: { row: HandoverFeedOutgoing }) {
  const toName = row.toNurse
    ? `${row.toNurse.firstName} ${row.toNurse.lastName ?? ''}`.trim()
    : 'Next nurse';
  const patient = row.admission?.patient;
  const patientName = patient
    ? `${patient.firstName} ${patient.lastName ?? ''}`.trim()
    : 'Unknown patient';
  return (
    <li className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
      <span className="font-semibold">You</span>
      <ArrowRight className="h-3 w-3 opacity-60" />
      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold">{toName}</span>
      <span className="text-muted-foreground">·</span>
      <span className="font-medium">{patientName}</span>
      {row.bed?.bedNumber ? <span className="text-muted-foreground">Bed {row.bed.bedNumber}</span> : null}
      {row.ward?.name ? <span className="text-muted-foreground">{row.ward.name}</span> : null}
      <span className="text-muted-foreground">
        From {SHIFT_LABEL[row.shiftType] ?? row.shiftType} ·{' '}
        {format(parseISO(row.shiftDate), 'dd/MM')}
        {row.handedOverAt ? ` @ ${format(new Date(row.handedOverAt), 'HH:mm')}` : ''}
      </span>
    </li>
  );
}
