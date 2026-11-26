'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Search, Plus, Calendar, Users, CheckCircle2, Clock, Hourglass, XCircle, Play, Check, X, HeartHandshake,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { NewSessionDialog } from '@/components/counsellor/new-session-dialog';
import {
  sessionTypeLabel,
  useCounsellingSessions,
  useCounsellingStats,
  useCounsellors,
  useUpdateCounsellingStatus,
  type CounsellingFilter,
  type CounsellingKind,
  type CounsellingSession,
  type CounsellingStats,
} from '@/hooks/use-counselling';
import { usePermissions } from '@/hooks/use-permissions';
import { formatDateTimeAmPm, toInputDateStr } from '@/lib/date-utils';
import { fullName } from '@/lib/person-name';
import { getApiErrorMessage } from '@/lib/utils';

// Gap #200: this page used to read OP visits, so a doctor's follow-up showed as
// a counselling session (counsellor = the doctor). It now reads ONLY counselling
// sessions/referrals, and every tile comes from the stats endpoint with the
// exact filter the table uses, so the tiles and the rows always agree.

const statCards: { label: string; key: keyof CounsellingStats; icon: typeof Users; color: string; bgColor: string }[] = [
  { label: 'Total Sessions', key: 'total', icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { label: 'Pending', key: 'pending', icon: Hourglass, color: 'text-sky-600', bgColor: 'bg-sky-50' },
  { label: 'In Progress', key: 'in_progress', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { label: 'Completed', key: 'completed', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { label: 'Cancelled', key: 'cancelled', icon: XCircle, color: 'text-rose-600', bgColor: 'bg-rose-50' },
];

const filterSelectClass =
  'h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type Row = CounsellingSession & Record<string, unknown>;

export default function CounsellorHomePage() {
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(toInputDateStr());
  const [kind, setKind] = useState<CounsellingKind | ''>('');
  const [counsellorId, setCounsellorId] = useState('');
  const [page, setPage] = useState(1);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [cancelling, setCancelling] = useState<CounsellingSession | null>(null);

  // Gap #298: gated on counselling:create, not appointments:create — a desk
  // user who can book doctor slots must not get this button.
  const { canAccess } = usePermissions();
  const canCreate = canAccess('counselling', 'create');
  const canUpdate = canAccess('counselling', 'update');

  // One filter object for both queries (gap #200).
  const filter: CounsellingFilter = {
    date: selectedDate || undefined,
    search: search.trim() || undefined,
    kind: kind || undefined,
    counsellorId: counsellorId || undefined,
  };
  const { data, isLoading } = useCounsellingSessions({ ...filter, page, limit: 20 });
  const { data: stats } = useCounsellingStats(filter);
  const { data: counsellors } = useCounsellors();
  const updateStatus = useUpdateCounsellingStatus();

  const rows = (data?.data ?? []) as Row[];
  const total = data?.meta?.total ?? 0;
  const filtered = !!(filter.search || filter.kind || filter.counsellorId);

  const move = async (s: CounsellingSession, status: 'in_progress' | 'completed' | 'cancelled', reason?: string) => {
    try {
      await updateStatus.mutateAsync({ id: s.id, status, reason });
      toast.success(
        status === 'in_progress' ? 'Session started' : status === 'completed' ? 'Session completed' : 'Session cancelled',
      );
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the session'));
      return false;
    }
  };

  const columns: Column<Row>[] = [
    {
      key: 'patient',
      label: 'Patient Name',
      render: (item) => (
        <div>
          <p className="font-medium text-foreground">{fullName(item.patient, '-')}</p>
          {item.patient?.mrn && <p className="text-xs text-muted-foreground">{item.patient.mrn}</p>}
        </div>
      ),
    },
    {
      key: 'sessionType',
      label: 'Session Type',
      render: (item) => (
        <div>
          <span className="font-medium">{sessionTypeLabel(item.sessionType)}</span>
          {item.kind === 'referral' && (
            <p className="text-xs text-muted-foreground">
              Referral{item.referralSource ? ` · ${item.referralSource}` : ''}
            </p>
          )}
        </div>
      ),
    },
    {
      // The ASSIGNED counsellor — never a visit's doctor (gap #200).
      key: 'counsellor',
      label: 'Counsellor',
      render: (item) => fullName(item.counsellor, '-'),
    },
    {
      key: 'scheduledAt',
      label: 'Time',
      render: (item) => formatDateTimeAmPm(item.scheduledAt),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (item) => (
        <span className="block max-w-[220px] truncate text-sm text-muted-foreground">
          {item.status === 'cancelled' && item.cancelledReason
            ? `Cancelled: ${item.cancelledReason}`
            : item.notes || '-'}
        </span>
      ),
    },
    ...(canUpdate
      ? [
          {
            key: 'actions',
            label: 'Actions',
            render: (item: Row) => (
              <div className="flex flex-wrap gap-1.5">
                {item.status === 'pending' && (
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={updateStatus.isPending}
                    onClick={() => move(item, 'in_progress')}>
                    <Play className="h-3 w-3" /> Start
                  </Button>
                )}
                {item.status === 'in_progress' && (
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={updateStatus.isPending}
                    onClick={() => move(item, 'completed')}>
                    <Check className="h-3 w-3" /> Complete
                  </Button>
                )}
                {(item.status === 'pending' || item.status === 'in_progress') && (
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive" disabled={updateStatus.isPending}
                    onClick={() => setCancelling(item)}>
                    <X className="h-3 w-3" /> Cancel
                  </Button>
                )}
              </div>
            ),
          } satisfies Column<Row>,
        ]
      : []),
  ];

  const newSessionButton = canCreate ? (
    <Button className="gap-2" onClick={() => setNewSessionOpen(true)}>
      <Plus className="h-4 w-4" />
      New Session
    </Button>
  ) : undefined;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Counsellor Home"
        description="Counselling sessions and referrals for the selected day"
        action={newSessionButton}
      />

      {canCreate && (
        <NewSessionDialog open={newSessionOpen} onOpenChange={setNewSessionOpen} defaultDate={selectedDate} />
      )}

      {/* Stats — same filter as the table */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {statCards.map((card) => (
          <div
            key={card.key}
            className={`bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary ${card.bgColor} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white/80 p-2">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="font-headline text-3xl font-extrabold">{stats?.[card.key] ?? 0}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient name or MRN..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
            className="pl-9 w-[180px]"
          />
        </div>
        <select
          aria-label="Filter by kind"
          className={filterSelectClass}
          value={kind}
          onChange={(e) => { setKind(e.target.value as CounsellingKind | ''); setPage(1); }}
        >
          <option value="">Sessions &amp; referrals</option>
          <option value="session">Sessions only</option>
          <option value="referral">Referrals only</option>
        </select>
        <select
          aria-label="Filter by counsellor"
          className={filterSelectClass}
          value={counsellorId}
          onChange={(e) => { setCounsellorId(e.target.value); setPage(1); }}
        >
          <option value="">All counsellors</option>
          {(counsellors ?? []).map((c) => (
            <option key={c.id} value={c.id}>{fullName(c, 'Unnamed user')}</option>
          ))}
        </select>
      </div>

      {/* Table, or a truthful empty state with the next step */}
      {!isLoading && total === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title={filtered ? 'No counselling sessions match these filters on this day' : 'No counselling sessions on this day'}
          description={
            canCreate
              ? 'Book one with New Session, or pick another date.'
              : 'Pick another date, or ask a counsellor to book a session.'
          }
          action={newSessionButton}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          page={page}
          totalPages={data?.meta?.totalPages ?? 1}
          total={total}
          onPageChange={setPage}
        />
      )}

      <CancelSessionDialog
        // Keyed per session so a half-typed reason never carries to another row.
        key={cancelling?.id ?? 'none'}
        session={cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={async (reason) => {
          if (cancelling && (await move(cancelling, 'cancelled', reason))) setCancelling(null);
        }}
        pending={updateStatus.isPending}
      />
    </div>
  );
}

/** Cancelling needs a reason — it is kept on the row and in the audit log. */
function CancelSessionDialog({
  session,
  onClose,
  onConfirm,
  pending,
}: {
  session: CounsellingSession | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={!!session} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel session</DialogTitle>
          <DialogDescription>
            {session ? `${fullName(session.patient, 'Patient')} — ${sessionTypeLabel(session.sessionType)}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cs-cancel-reason">Reason *</Label>
          <Textarea
            id="cs-cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(null); }}
            placeholder="Why is this session being cancelled?"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Keep session
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (!reason.trim()) {
                setError('A reason is required');
                return;
              }
              onConfirm(reason.trim());
            }}
          >
            Cancel session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
