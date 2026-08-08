'use client';

// Doctor OT Schedule
// ──────────────────────────────────────────────────────────────────────────
// The surgeon's side of the OT booking loop:
//
//   1. Doctor raises a request with a *preferred* date/time. It stays
//      `requested` so it lands in the OT admin's pending queue — a doctor
//      cannot self-schedule a theatre.
//   2. OT admin books the real slot. If it is not the slot the doctor asked
//      for, the request comes back here as "Awaiting your confirmation" with
//      the admin's reason.
//   3. Doctor accepts it (surgery may then start), asks for another time
//      (goes back to the OT desk as a fresh preference), or cancels.
//
// Everything the doctor sees is scoped with `mine` — the server resolves the
// caller's DoctorProfile, since the client only knows the User id.

import { useMemo, useState, useCallback } from 'react';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import {
  Search,
  Printer,
  Plus,
  Eye,
  CalendarIcon,
  CalendarClock,
  CheckCircle2,
  Ban,
  Clock3,
  Loader2,
  PackageOpen,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useDoctorOTRequests,
  useCreateOTRequest,
  type DoctorOTRequest,
} from '@/hooks/use-doctor';
import { useRespondToOtSchedule } from '@/hooks/use-ot';
import { useAdmissions } from '@/hooks/use-clinical';
import { AdmissionTypeBadge } from '@/components/shared/admission-type-badge';
import { RequestKitDialog } from '@/components/ot-kit/request-kit-dialog';
import { useOtKitIssues, type OtKitIssue } from '@/hooks/use-ot-kit';

const AWAITING_DOCTOR = 'awaiting_doctor';

// `awaiting` is not a DB status — it is the reschedule sub-state the doctor has
// to act on, so it gets its own tab and is filtered client-side.
const otStatItems = [
  { key: 'all', label: 'All', color: 'text-on-surface' },
  { key: 'awaiting', label: 'Needs My OK', color: 'text-amber-600' },
  { key: 'requested', label: 'Pending with OT', color: 'text-on-surface-variant' },
  { key: 'scheduled', label: 'Scheduled', color: 'text-primary' },
  { key: 'in_progress', label: 'In Progress', color: 'text-secondary' },
  { key: 'completed', label: 'Completed', color: 'text-tertiary' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-error' },
];

const PAGE_SIZE = 10;

// A kit can be raised while a case is still ahead of the theatre. Once it is
// completed or cancelled there is nothing left to issue.
const KIT_REQUESTABLE = new Set(['requested', 'scheduled', 'in_progress']);

function hhmm(v?: string | null): string {
  return v ? (v.match(/\d{2}:\d{2}/)?.[0] ?? '') : '';
}

function slotText(date?: string | null, time?: string | null): string | null {
  if (!date) return null;
  const t = hhmm(time);
  return `${formatDate(date)}${t ? ` · ${t}` : ''}`;
}

function statusLabel(status: string): string {
  if (status === 'requested') return 'Pending with OT';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DoctorOTListPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  // Blank by default — a doctor must be able to see a reschedule proposal
  // whatever day it lands on, not only today's list.
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<DoctorOTRequest | null>(null);
  const [respondTarget, setRespondTarget] = useState<DoctorOTRequest | null>(null);
  const [kitTarget, setKitTarget] = useState<DoctorOTRequest | null>(null);

  // Form state
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [surgeryName, setSurgeryName] = useState('');
  const [surgeryType, setSurgeryType] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [priority, setPriority] = useState('routine');
  const [preOpDiagnosis, setPreOpDiagnosis] = useState('');
  const [otNotes, setOtNotes] = useState('');

  // Status + the awaiting sub-state are filtered client-side over one fetch:
  // `scheduleState` lives in a raw column the server can only filter after
  // paging, so paging here keeps the counts honest.
  const { data: otData, isLoading } = useDoctorOTRequests({
    mine: true,
    limit: 200,
    search: search || undefined,
    date: dateFilter || undefined,
  });

  // Admitted patients only — IP, Emergency and Day Care alike, since all three
  // are admissions. The surgery charge posts to the in-patient bill, so booking
  // theatre for a walk-in would leave the charge with nowhere to land. Tenant
  // scoping comes from the endpoint; `status: 'admitted'` also covers the
  // ready-to-discharge patients who are still in a bed.
  const { data: admittedData, isLoading: patientsLoading } = useAdmissions({
    status: 'admitted',
    search: patientSearch || undefined,
    limit: 50,
  });
  const admittedMatches = admittedData?.data ?? [];
  const createOTMutation = useCreateOTRequest();

  const allRequests = useMemo(() => otData?.data ?? [], [otData]);

  const stats = useMemo(() => {
    const s: Record<string, number> = {
      all: allRequests.length,
      awaiting: 0,
      requested: 0,
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const r of allRequests) {
      if (r.scheduleState === AWAITING_DOCTOR && r.status !== 'cancelled') s.awaiting++;
      if (s[r.status] !== undefined) s[r.status]++;
    }
    return s;
  }, [allRequests]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return allRequests;
    if (activeFilter === 'awaiting') {
      return allRequests.filter(
        (r) => r.scheduleState === AWAITING_DOCTOR && r.status !== 'cancelled',
      );
    }
    return allRequests.filter((r) => r.status === activeFilter);
  }, [allRequests, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const otRequests = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const resetForm = () => {
    setSelectedPatient(null);
    setPatientSearch('');
    setSurgeryName('');
    setSurgeryType('');
    setSpeciality('');
    setPreferredDate('');
    setPreferredTime('');
    setPriority('routine');
    setPreOpDiagnosis('');
    setOtNotes('');
  };

  const handleCreateOTRequest = useCallback(async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!surgeryName.trim()) {
      toast.error('Please enter surgery name');
      return;
    }
    try {
      await createOTMutation.mutateAsync({
        patientId: selectedPatient.id,
        surgeryName,
        surgeryType: surgeryType || undefined,
        speciality: speciality || undefined,
        // No surgeonId: the server resolves the calling doctor's profile. The
        // page previously sent the User id here, which the API rejected.
        // No scheduledDate either — that is the OT desk's call.
        preferredDate: preferredDate || undefined,
        preferredTime: preferredTime || undefined,
        priority,
        preOpDiagnosis: preOpDiagnosis || undefined,
        notes: otNotes || undefined,
      });
      toast.success('OT request sent to the OT desk');
      setCreateDialogOpen(false);
      resetForm();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ??
        (e as { message?: string })?.message ??
        'Failed to create OT request';
      toast.error(msg);
    }
  }, [
    selectedPatient,
    surgeryName,
    surgeryType,
    speciality,
    preferredDate,
    preferredTime,
    priority,
    preOpDiagnosis,
    otNotes,
    createOTMutation,
  ]);

  const awaitingCount = stats.awaiting;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">OT Schedule</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Printer className="h-4 w-4" />
          </Button>
          <Button className="gap-1.5 h-8" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New OT Request
          </Button>
        </div>
      </div>

      {/* Reschedules waiting on this doctor — the whole point of the loop. */}
      {awaitingCount > 0 && (
        <button
          onClick={() => {
            setActiveFilter('awaiting');
            setPage(1);
          }}
          className="flex w-full items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 transition-colors hover:bg-amber-100"
        >
          <Clock3 className="h-4 w-4 shrink-0" />
          <span>
            <b>{awaitingCount}</b> surgery{awaitingCount === 1 ? '' : 's'} rescheduled by the OT
            desk {awaitingCount === 1 ? 'is' : 'are'} waiting for your confirmation.
          </span>
        </button>
      )}

      {/* Date filter */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-8 text-xs w-full sm:w-[150px]"
          />
        </div>
        {dateFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              setDateFilter('');
              setPage(1);
            }}
          >
            All dates
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {otStatItems.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setActiveFilter(item.key);
              setPage(1);
            }}
            className={cn(
              'flex flex-col items-center rounded-lg border-2 px-3 py-2 min-w-[90px] shadow-sm hover:shadow-md transition-all duration-200',
              activeFilter === item.key
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-card hover:border-border'
            )}
          >
            <span className={cn('text-lg font-bold', item.color)}>{stats[item.key] ?? 0}</span>
            <span className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex justify-end">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient or surgery..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-8 text-xs w-[220px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden shadow-sm ring-1 ring-foreground/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient Details</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">OT Name</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Surgery/Speciality</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">My Request / Booked</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Surgeon</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading OT requests...</p>
                  </td>
                </tr>
              ) : otRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center font-label text-on-surface-variant">
                    No OT requests found for the selected criteria.
                  </td>
                </tr>
              ) : (
                otRequests.map((req) => {
                  const patient = req.patient;
                  const patientName = patient
                    ? `${patient.firstName} ${patient.lastName}`.toUpperCase()
                    : 'Unknown';
                  const awaiting =
                    req.scheduleState === AWAITING_DOCTOR && req.status !== 'cancelled';

                  return (
                    <tr
                      key={req.id}
                      className={cn(
                        'group transition-colors hover:bg-surface-container-low',
                        awaiting && 'bg-amber-50/60',
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {patient?.firstName?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground text-xs">{patientName}</p>
                            <p className="text-xs text-muted-foreground">{patient?.mrn || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{req.otName || '-'}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground text-xs">{req.surgeryName}</p>
                          {req.speciality && (
                            <p className="text-xs text-muted-foreground">{req.speciality}</p>
                          )}
                          {req.surgeryType && (
                            <p className="text-xs text-muted-foreground">{req.surgeryType}</p>
                          )}
                        </div>
                      </td>

                      {/* What I asked for vs what the OT desk booked */}
                      <td className="px-4 py-3">
                        <div className="space-y-0.5 text-xs">
                          {slotText(req.preferredDate, req.preferredTime) && (
                            <p className={cn(awaiting && 'text-muted-foreground line-through')}>
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                Asked:{' '}
                              </span>
                              {slotText(req.preferredDate, req.preferredTime)}
                            </p>
                          )}
                          {req.scheduledDate ? (
                            <p className={cn('font-medium', awaiting && 'text-amber-700')}>
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                Booked:{' '}
                              </span>
                              {slotText(req.scheduledDate, req.scheduledStartTime)}
                            </p>
                          ) : (
                            <p className="italic text-muted-foreground">Not scheduled yet</p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm text-foreground">
                        {req.surgeon?.user
                          ? `Dr ${req.surgeon.user.firstName} ${req.surgeon.user.lastName}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'font-label text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full',
                          req.status === 'scheduled' && 'bg-primary/10 text-primary',
                          req.status === 'requested' && 'bg-surface-container-high text-on-surface-variant',
                          req.status === 'in_progress' && 'bg-secondary/10 text-secondary',
                          req.status === 'completed' && 'bg-tertiary/10 text-tertiary',
                          req.status === 'cancelled' && 'bg-error/10 text-error',
                        )}>
                          {statusLabel(req.status)}
                        </span>
                        {awaiting && (
                          <div className="mt-1">
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-100 text-[10px] text-amber-800"
                            >
                              Needs your OK
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {awaiting && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                              onClick={() => setRespondTarget(req)}
                            >
                              <CalendarClock className="mr-1 h-3.5 w-3.5" />
                              Review
                            </Button>
                          )}
                          {/* The surgeon is the one who knows which preference
                              card a case needs, so the kit request belongs on
                              their own row. Closed cases have nothing to kit. */}
                          {KIT_REQUESTABLE.has(req.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Request OT kit from the pharmacy"
                              onClick={() => setKitTarget(req)}
                            >
                              <PackageOpen className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="View details"
                            onClick={() => setViewTarget(req)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <span className="font-medium">{PAGE_SIZE}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {filtered.length > 0
                ? `${(pageSafe - 1) * PAGE_SIZE + 1}-${(pageSafe - 1) * PAGE_SIZE + otRequests.length} of ${filtered.length}`
                : '0-0 of 0'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={pageSafe <= 1}
              onClick={() => setPage(pageSafe - 1)}
            >
              &#8249;
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage(pageSafe + 1)}
            >
              &#8250;
            </Button>
          </div>
        </div>
      </div>

      {/* Respond to a rescheduled slot */}
      {respondTarget && (
        <RespondToRescheduleDialog
          request={respondTarget}
          onClose={() => setRespondTarget(null)}
        />
      )}

      {/* Read-only details */}
      {viewTarget && (
        <OTDetailsDialog
          request={viewTarget}
          onClose={() => setViewTarget(null)}
          onRequestKit={() => {
            setKitTarget(viewTarget);
            setViewTarget(null);
          }}
          onRespond={() => {
            setRespondTarget(viewTarget);
            setViewTarget(null);
          }}
        />
      )}

      {/* Ask the pharmacy for this case's preference-card kit. Same dialog the
          OT nurse uses, with the case fixed to the row it was opened from. */}
      <RequestKitDialog
        open={!!kitTarget}
        onOpenChange={(v) => !v && setKitTarget(null)}
        surgery={kitTarget}
      />

      {/* Create OT Request Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New OT Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Patient Search */}
            <div>
              <label className="text-sm font-medium">Patient *</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between rounded-lg border p-2 mt-1">
                  <span className="text-sm font-medium">{selectedPatient.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedPatient(null)}>
                    <span className="text-xs">x</span>
                  </Button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search patient..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-8"
                  />
                  {patientSearch.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-10 max-h-56 overflow-y-auto rounded-lg border bg-background shadow-lg">
                      {patientsLoading ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
                      ) : admittedMatches.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          No admitted patient matches. Only patients currently admitted here —
                          IP, Emergency or Day Care — can be booked for theatre.
                        </p>
                      ) : (
                        admittedMatches.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatient({
                                id: a.patientId,
                                name: `${a.patient?.firstName ?? ''} ${a.patient?.lastName ?? ''}`.trim(),
                              });
                              setPatientSearch('');
                            }}
                            className="w-full border-b px-3 py-2 text-left text-sm transition-colors last:border-0 hover:bg-muted/50"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="font-medium">
                                {a.patient?.firstName} {a.patient?.lastName}
                              </span>
                              <AdmissionTypeBadge type={(a as { admissionType?: string }).admissionType} />
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {(a.patient as { mrn?: string } | undefined)?.mrn ?? a.patient?.uhid ?? ''}
                              {a.ward?.name ? ` · ${a.ward.name}` : ''}
                              {a.bed?.bedNumber ? ` / Bed ${a.bed.bedNumber}` : ''}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Only admitted patients (IP / Emergency / Day Care) can be booked — the surgery
                charge goes onto their in-patient bill.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Surgery Name *</label>
              <Input
                value={surgeryName}
                onChange={(e) => setSurgeryName(e.target.value)}
                placeholder="Enter surgery name"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Surgery Type</label>
                <Input
                  value={surgeryType}
                  onChange={(e) => setSurgeryType(e.target.value)}
                  placeholder="e.g., Elective"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Speciality</label>
                <Input
                  value={speciality}
                  onChange={(e) => setSpeciality(e.target.value)}
                  placeholder="e.g., Orthopedics"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Preferred, not scheduled — the OT desk owns the theatre diary. */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Preferred Date</label>
                <Input
                  type="date"
                  value={preferredDate}
                  min={toInputDateStr()}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Preferred Time</label>
                <Input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <p className="-mt-2 text-[11px] text-muted-foreground">
              This is your preference. The OT desk confirms the theatre slot — if they have to move
              it, you will be asked to approve the new time before the surgery goes ahead.
            </p>

            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? 'routine')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Pre-Op Diagnosis</label>
              <Input
                value={preOpDiagnosis}
                onChange={(e) => setPreOpDiagnosis(e.target.value)}
                placeholder="Enter pre-operative diagnosis"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={otNotes}
                onChange={(e) => setOtNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleCreateOTRequest} disabled={createOTMutation.isPending}>
                {createOTMutation.isPending ? 'Creating...' : 'Send to OT desk'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Details (read-only)
// ============================================================

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '' || value === '-') return null;
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function OTDetailsDialog({
  request: r,
  onClose,
  onRespond,
  onRequestKit,
}: {
  request: DoctorOTRequest;
  onClose: () => void;
  onRespond: () => void;
  onRequestKit: () => void;
}) {
  const awaiting = r.scheduleState === AWAITING_DOCTOR && r.status !== 'cancelled';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {r.surgeryName}
            <Badge variant="outline" className="text-xs">
              {statusLabel(r.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Patient
            </h4>
            <Row
              label="Name"
              value={r.patient ? `${r.patient.firstName} ${r.patient.lastName ?? ''}`.trim() : undefined}
            />
            <Row label="MRN" value={r.patient?.mrn} />
          </section>
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Timing
            </h4>
            <Row label="I asked for" value={slotText(r.preferredDate, r.preferredTime) ?? undefined} />
            <Row label="Booked" value={slotText(r.scheduledDate, r.scheduledStartTime) ?? undefined} />
            <Row label="Theatre" value={r.otName} />
          </section>
          {(r.rescheduleReason || r.doctorResponse) && (
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rescheduling
              </h4>
              <Row
                label="Moved from"
                value={slotText(r.previousScheduledDate, r.previousScheduledTime) ?? undefined}
              />
              <Row label="OT desk's reason" value={r.rescheduleReason ?? undefined} />
              <Row
                label="Times moved"
                value={r.rescheduleCount ? String(r.rescheduleCount) : undefined}
              />
              <Row
                label="My response"
                value={
                  r.doctorResponse === 'accepted'
                    ? 'Accepted'
                    : r.doctorResponse === 'rejected'
                      ? 'Asked for a change'
                      : undefined
                }
              />
              <Row label="My remark" value={r.doctorResponseNote ?? undefined} />
            </section>
          )}
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Clinical
            </h4>
            <Row label="Pre-op diagnosis" value={r.preOpDiagnosis} />
            <Row label="Notes" value={r.notes} />
            {r.status === 'cancelled' && <Row label="Cancelled because" value={r.cancellationReason ?? undefined} />}
          </section>
          <OtKitStatusSection otRequestId={r.id} />
        </div>
        <DialogFooter>
          {awaiting && <Button onClick={onRespond}>Review new time</Button>}
          {KIT_REQUESTABLE.has(r.status) && (
            <Button variant="outline" className="gap-1.5" onClick={onRequestKit}>
              <PackageOpen className="h-4 w-4" />
              Request OT Kit
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Where this case's kit has got to on the pharmacy side. Without it the
// surgeon could raise a request and never learn whether it was issued, so the
// only way to find out was to ask the OT nurse.
const KIT_STATUS_LABEL: Record<string, string> = {
  requested: 'Requested — with the pharmacy',
  issued: 'Issued to theatre',
  reconciled: 'Reconciled & billed',
  cancelled: 'Cancelled',
};

function OtKitStatusSection({ otRequestId }: { otRequestId: string }) {
  const { data, isLoading } = useOtKitIssues({ otRequestId });
  const kits = data?.items ?? [];
  if (isLoading || kits.length === 0) return null;
  return (
    <section>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        OT Kits
      </h4>
      {kits.map((k) => (
        <div key={k.id} className="mb-2">
          <Row label={k.issueNumber} value={KIT_STATUS_LABEL[k.status] ?? k.status} />
          <KitItemList issue={k} />
        </div>
      ))}
    </section>
  );
}

/**
 * What is actually in the kit — the whole point of asking. Before the pharmacy
 * issues it these are the requested quantities; afterwards the same rows carry
 * what went to theatre and, once reconciled, what was used. The surgeon should
 * not have to ask the OT nurse which it is.
 */
function KitItemList({ issue }: { issue: OtKitIssue }) {
  const [open, setOpen] = useState(false);
  const items = issue.items ?? [];
  if (items.length === 0) return null;

  const reconciled = issue.status === 'reconciled';
  const issued = issue.status === 'issued' || reconciled;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
      >
        <PackageOpen className="h-3 w-3" />
        {open ? 'Hide contents' : `See what's in this kit (${items.length})`}
      </button>

      {open && (
        <div className="mt-1 overflow-hidden rounded-md border">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/40">
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1 font-medium">Item</th>
                <th className="px-2 py-1 text-right font-medium">
                  {issued ? 'Issued' : 'Requested'}
                </th>
                {reconciled && <th className="px-2 py-1 text-right font-medium">Returned</th>}
                {reconciled && <th className="px-2 py-1 text-right font-medium">Used</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const used = i.consumedQty ?? i.issuedQty - (i.returnedQty ?? 0);
                return (
                  <tr key={i.id} className="border-t">
                    <td className="px-2 py-1">
                      {i.drugName ?? '—'}
                      {i.batchNumber && (
                        <span className="ml-1 text-muted-foreground">· {i.batchNumber}</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {i.issuedQty}
                      {i.looseUnitLabel ? ` ${i.looseUnitLabel}` : ''}
                    </td>
                    {reconciled && (
                      <td className="px-2 py-1 text-right font-mono">{i.returnedQty ?? 0}</td>
                    )}
                    {reconciled && <td className="px-2 py-1 text-right font-mono">{used}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {reconciled && (
            <p className="border-t bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground">
              Only what was used is billed — returns go back to pharmacy stock.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Respond to a reschedule — accept / ask for another time / cancel
// ============================================================

function RespondToRescheduleDialog({
  request: r,
  onClose,
}: {
  request: DoctorOTRequest;
  onClose: () => void;
}) {
  const respond = useRespondToOtSchedule();
  const [mode, setMode] = useState<'accept' | 'reschedule' | 'cancel'>('accept');
  const [note, setNote] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const submit = () => {
    if (mode === 'reschedule') {
      if (!newDate) {
        toast.error('Pick the date you want instead');
        return;
      }
      if (!note.trim()) {
        toast.error('Tell the OT desk why this time does not work');
        return;
      }
    }
    if (mode === 'cancel' && !note.trim()) {
      toast.error('A reason is required to cancel the surgery');
      return;
    }
    respond.mutate(
      {
        id: r.id,
        action: mode,
        note: note.trim() || undefined,
        preferredDate: mode === 'reschedule' ? newDate : undefined,
        preferredTime: mode === 'reschedule' ? newTime || undefined : undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            mode === 'accept'
              ? 'Time confirmed — the OT desk has been notified'
              : mode === 'reschedule'
                ? 'New time requested — the OT desk has been notified'
                : 'Surgery cancelled',
          );
          onClose();
        },
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data
              ?.message ??
            (e as { message?: string })?.message ??
            'Could not record your response';
          toast.error(msg);
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Surgery rescheduled</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
          <p>
            <span className="font-medium">Surgery:</span> {r.surgeryName}
          </p>
          <p>
            <span className="font-medium">Patient:</span>{' '}
            {r.patient ? `${r.patient.firstName} ${r.patient.lastName ?? ''}`.trim() : '-'}
          </p>
          <p className="text-muted-foreground line-through">
            You asked for {slotText(r.previousScheduledDate, r.previousScheduledTime) ??
              slotText(r.preferredDate, r.preferredTime) ??
              'no particular time'}
          </p>
          <p className="font-semibold text-amber-700">
            OT desk booked {slotText(r.scheduledDate, r.scheduledStartTime) ?? 'a new slot'}
            {r.otName ? ` in ${r.otName}` : ''}
          </p>
          {r.rescheduleReason && (
            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[13px] text-amber-900">
              <span className="font-medium">Reason:</span> {r.rescheduleReason}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: 'accept', label: 'Accept & proceed', icon: CheckCircle2 },
              { key: 'reschedule', label: 'Ask for another time', icon: CalendarClock },
              { key: 'cancel', label: 'Cancel surgery', icon: Ban },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
                mode === m.key
                  ? 'bg-primary text-primary-foreground ring-primary'
                  : 'text-muted-foreground ring-border/60 hover:bg-muted',
              )}
            >
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'reschedule' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>New preferred date *</Label>
              <Input
                type="date"
                min={toInputDateStr()}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>New preferred time</Label>
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>
            {mode === 'accept'
              ? 'Remark (optional)'
              : mode === 'cancel'
                ? 'Reason for cancelling *'
                : 'Why this time does not work *'}
          </Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={
              mode === 'accept'
                ? 'Anything the OT desk should know…'
                : mode === 'cancel'
                  ? 'e.g. patient not fit for surgery this week'
                  : 'e.g. I am in OPD until 2 PM that day'
            }
          />
        </div>

        {mode === 'reschedule' && (
          <p className="text-[11px] text-muted-foreground">
            This frees the booked slot and sends the request back to the OT desk as a fresh
            preference.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={respond.isPending}>
            Close
          </Button>
          <Button
            onClick={submit}
            disabled={respond.isPending}
            variant={mode === 'cancel' ? 'destructive' : 'default'}
          >
            {respond.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {mode === 'accept'
              ? 'Accept & proceed'
              : mode === 'reschedule'
                ? 'Request new time'
                : 'Cancel surgery'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
