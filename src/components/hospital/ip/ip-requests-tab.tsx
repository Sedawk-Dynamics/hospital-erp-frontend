'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Search, BedDouble, Check, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate, formatDateTime, toInputDateStr } from '@/lib/date-utils';
import {
  useAdmissionRequests,
  useAcceptAdmissionRequest,
  useRejectAdmissionRequest,
  type AdmissionRequest,
} from '@/hooks/use-doctor';

interface Ward {
  id: string;
  name: string;
}

const statusFilters = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

const statusStyles: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
  accepted: { bg: 'bg-green-100', text: 'text-green-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const urgencyStyles: Record<string, { bg: string; text: string; ring: string }> = {
  routine: { bg: 'bg-primary/10', text: 'text-primary', ring: '' },
  urgent: { bg: 'bg-secondary/10', text: 'text-secondary', ring: '' },
  emergency: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    ring: 'ring-1 ring-destructive/30',
  },
};

export function IpRequestsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [acceptTarget, setAcceptTarget] = useState<AdmissionRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdmissionRequest | null>(null);

  const queryParams = useMemo(
    () => ({
      ...(statusFilter !== 'all' ? { status: statusFilter as any } : {}),
      ...(search ? { search } : {}),
      page,
      limit: 20,
    }),
    [statusFilter, search, page],
  );

  const { data, isLoading } = useAdmissionRequests(queryParams);
  const requests = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setStatusFilter(f.key);
                setPage(1);
              }}
              className={cn(
                'rounded-full px-3 py-1 text-[10px] font-bold transition-colors',
                statusFilter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-high/80',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
        <Input
          placeholder="Search patient or diagnosis..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Doctor</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Reason / Diagnosis</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Urgency</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Expected</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Requested</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center font-label text-on-surface-variant"
                  >
                    <BedDouble className="mx-auto h-8 w-8 text-on-surface-variant/40 mb-2" />
                    <p>No {statusFilter === 'all' ? '' : statusFilter} admission requests.</p>
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const st = statusStyles[req.status] ?? statusStyles.pending;
                  const ust = urgencyStyles[req.urgency] ?? urgencyStyles.routine;
                  const isPending = req.status === 'pending';
                  return (
                    <tr
                      key={req.id}
                      className="group hover:bg-surface-container-low transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-label text-sm font-bold">
                          {req.patient?.firstName} {req.patient?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {req.patient?.mrn || '-'} | {req.patient?.phone || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-label text-sm">
                        {req.doctor
                          ? `Dr. ${req.doctor.user?.firstName ?? ''} ${
                              req.doctor.user?.lastName ?? ''
                            }`.trim()
                          : '-'}
                      </td>
                      <td className="px-4 py-3 font-label text-sm max-w-xs">
                        <p className="font-semibold leading-tight truncate">{req.reason}</p>
                        {req.provisionalDiagnosis && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            Dx: {req.provisionalDiagnosis}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                            ust.bg,
                            ust.text,
                            ust.ring,
                          )}
                        >
                          {req.urgency}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-label text-xs text-on-surface-variant">
                        {req.expectedAdmissionDate
                          ? formatDate(req.expectedAdmissionDate)
                          : '—'}
                        {req.preferredWardType && (
                          <p className="text-[10px] text-muted-foreground">
                            {req.preferredWardType}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-label text-xs text-on-surface-variant">
                        {formatDateTime(req.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                            st.bg,
                            st.text,
                          )}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                              onClick={() => setRejectTarget(req)}
                            >
                              <X className="h-3 w-3" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => setAcceptTarget(req)}
                            >
                              <Check className="h-3 w-3" />
                              Accept
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            {req.processedAt ? formatDateTime(req.processedAt) : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {requests.length > 0
                ? `${(page - 1) * 20 + 1}-${(page - 1) * 20 + requests.length} of ${meta.total}`
                : '0 results'}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ‹
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page >= meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                ›
              </Button>
            </div>
          </div>
        )}
      </div>

      <AcceptRequestDialog
        request={acceptTarget}
        onOpenChange={(o) => !o && setAcceptTarget(null)}
      />
      <RejectRequestDialog
        request={rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
      />
    </div>
  );
}

// ─── Accept dialog ──────────────────────────────────────────────────────

function AcceptRequestDialog({
  request,
  onOpenChange,
}: {
  request: AdmissionRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  // Three actions front desk can take when accepting: just acknowledge, block
  // a bed via Reservation, or admit on the spot. Service refuses both action
  // flags at once, so we model it as a single radio.
  type AcceptAction = 'reserve' | 'admit' | 'accept_only';
  const [action, setAction] = useState<AcceptAction>('reserve');
  const [wardId, setWardId] = useState('');
  const [bedId, setBedId] = useState('');
  const [reservedDate, setReservedDate] = useState(toInputDateStr());
  const [expectedAdmission, setExpectedAdmission] = useState('');
  const [admissionDate, setAdmissionDate] = useState(toInputDateStr());
  const [expectedDischargeDate, setExpectedDischargeDate] = useState('');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const open = !!request;
  const accept = useAcceptAdmissionRequest();
  // Only a reservation shows ward/bed pickers now (to hold a slot). Direct-admit
  // and accept-only don't — the bed is assigned later from the IP workspace.
  const needsBed = action === 'reserve';

  // Reset on open
  useMemo(() => {
    if (open) {
      setAction('reserve');
      setWardId('');
      setBedId('');
      setReservedDate(toInputDateStr());
      setExpectedAdmission(
        request?.expectedAdmissionDate
          ? new Date(request.expectedAdmissionDate).toISOString().slice(0, 10)
          : '',
      );
      setAdmissionDate(toInputDateStr());
      setExpectedDischargeDate('');
      setDepositAmount(0);
      setAdvanceAmount(0);
      setNotes('');
    }
  }, [open, request?.expectedAdmissionDate]);

  const { data: wardsData } = useQuery({
    queryKey: ['infrastructure', 'wards'],
    queryFn: async () => {
      const res = await apiGet<Ward[]>('/infrastructure/wards', { params: { limit: 100 } });
      return res.data;
    },
    enabled: open && needsBed,
  });

  const { data: bedsData, isFetching: bedsLoading } = useQuery({
    queryKey: ['infrastructure', 'beds', { wardId, status: 'available' }],
    queryFn: async () => {
      const res = await apiGet<Array<{ id: string; bedNumber: string; bedType?: string }>>(
        '/infrastructure/beds',
        { params: { wardId, status: 'available', limit: 200 } },
      );
      return res.data;
    },
    enabled: open && needsBed && Boolean(wardId),
  });

  const wards = wardsData ?? [];
  const beds = bedsData ?? [];
  const selectedWard = wards.find((w) => w.id === wardId);
  const selectedBed = beds.find((b) => b.id === bedId);

  const handleSubmit = async () => {
    if (!request) return;
    // Only a reservation needs a ward (it holds a slot). Direct-admit no longer
    // takes a bed/ward — front desk assigns the bed later from the IP workspace.
    if (action === 'reserve' && !wardId) {
      toast.error('Pick a ward to create a reservation');
      return;
    }
    try {
      await accept.mutateAsync({
        id: request.id,
        payload: {
          ...(action === 'reserve'
            ? {
                createReservation: true,
                wardId,
                ...(bedId ? { bedId } : {}),
                ...(reservedDate
                  ? { reservedDate: new Date(reservedDate).toISOString() }
                  : {}),
                ...(expectedAdmission
                  ? { expectedAdmission: new Date(expectedAdmission).toISOString() }
                  : {}),
                ...(advanceAmount > 0 ? { advanceAmount } : {}),
                ...(notes ? { notes } : {}),
              }
            : action === 'admit'
              ? {
                  directAdmit: true,
                  ...(admissionDate
                    ? { admissionDate: new Date(admissionDate).toISOString() }
                    : {}),
                  ...(expectedDischargeDate
                    ? { expectedDischargeDate: new Date(expectedDischargeDate).toISOString() }
                    : {}),
                  ...(depositAmount > 0 ? { depositAmount } : {}),
                  ...(notes ? { admissionReason: notes } : {}),
                }
              : {}),
        },
      });
      toast.success(
        action === 'reserve'
          ? 'Request accepted — reservation created'
          : action === 'admit'
            ? 'Patient admitted'
            : 'Request accepted',
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to accept request');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" />
            Accept IP Admission Request
          </DialogTitle>
          <DialogDescription>
            {request ? (
              <>
                {request.patient?.firstName} {request.patient?.lastName} · Dr.{' '}
                {request.doctor?.user?.firstName} {request.doctor?.user?.lastName}
                {request.urgency !== 'routine' && (
                  <span
                    className={cn(
                      'ml-2 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                      urgencyStyles[request.urgency].bg,
                      urgencyStyles[request.urgency].text,
                    )}
                  >
                    {request.urgency}
                  </span>
                )}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
          {request && (
            <div className="rounded-lg bg-surface-container-low p-3 text-sm space-y-1">
              <p className="font-semibold">{request.reason}</p>
              {request.provisionalDiagnosis && (
                <p className="text-xs text-muted-foreground">
                  Dx: {request.provisionalDiagnosis}
                </p>
              )}
              {request.preferredWardType && (
                <p className="text-xs text-muted-foreground">
                  Doctor prefers: <span className="font-semibold">{request.preferredWardType}</span>
                </p>
              )}
              {request.notes && (
                <p className="text-xs text-muted-foreground italic">"{request.notes}"</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'reserve', label: 'Reserve a bed', hint: 'Block ward/bed for later' },
              { key: 'admit', label: 'Admit now', hint: 'Move straight into IP' },
              { key: 'accept_only', label: 'Just accept', hint: 'Acknowledge for now' },
            ] as Array<{ key: AcceptAction; label: string; hint: string }>).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setAction(opt.key)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-colors',
                  action === opt.key
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-outline-variant hover:bg-surface-container-low',
                )}
              >
                <p className="text-xs font-bold">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{opt.hint}</p>
              </button>
            ))}
          </div>

          {needsBed && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium">Ward *</Label>
                <Select
                  value={wardId || null}
                  onValueChange={(v) => {
                    setWardId(v ?? '');
                    setBedId('');
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select ward">
                      {() => (selectedWard ? selectedWard.name : 'Select ward')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {wards.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">
                  Bed {wardId ? '(optional)' : ''}
                </Label>
                <Select
                  value={bedId || null}
                  onValueChange={(v) => setBedId(v ?? '')}
                  disabled={!wardId || bedsLoading}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue
                      placeholder={
                        !wardId
                          ? 'Pick a ward first'
                          : bedsLoading
                            ? 'Loading...'
                            : beds.length === 0
                              ? 'No beds available'
                              : 'Select bed'
                      }
                    >
                      {() =>
                        selectedBed
                          ? `${selectedBed.bedNumber}${selectedBed.bedType ? ` — ${selectedBed.bedType}` : ''}`
                          : !wardId
                            ? 'Pick a ward first'
                            : bedsLoading
                              ? 'Loading...'
                              : beds.length === 0
                                ? 'No beds available'
                                : 'Select bed'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {beds.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bedNumber}
                        {b.bedType ? ` — ${b.bedType}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {action === 'reserve' ? (
                <>
                  <div>
                    <Label className="text-xs font-medium">Reserved Date</Label>
                    <Input
                      type="date"
                      value={reservedDate}
                      onChange={(e) => setReservedDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Expected Admission</Label>
                    <Input
                      type="date"
                      value={expectedAdmission}
                      onChange={(e) => setExpectedAdmission(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Advance Amount (₹)</Label>
                    <NumberInput
                      min={0}
                      value={advanceAmount}
                      onValueChange={setAdvanceAmount}
                      className="mt-1"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-xs font-medium">Admission Date</Label>
                    <Input
                      type="date"
                      value={admissionDate}
                      onChange={(e) => setAdmissionDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Expected Discharge</Label>
                    <Input
                      type="date"
                      value={expectedDischargeDate}
                      onChange={(e) => setExpectedDischargeDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Deposit Amount (₹)</Label>
                    <NumberInput
                      min={0}
                      value={depositAmount}
                      onValueChange={setDepositAmount}
                      className="mt-1"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {needsBed && (
            <div>
              <Label className="text-xs font-medium">
                {action === 'reserve' ? 'Notes' : 'Admission Reason / Notes'}
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  action === 'reserve'
                    ? 'Any extra notes for the reservation...'
                    : 'Defaults to the doctor\'s reason. Override if needed...'
                }
                rows={2}
                className="mt-1"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSubmit}
            disabled={accept.isPending}
          >
            {accept.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {action === 'admit'
              ? 'Accept & Admit'
              : action === 'reserve'
                ? 'Accept & Reserve'
                : 'Accept Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reject dialog ──────────────────────────────────────────────────────

function RejectRequestDialog({
  request,
  onOpenChange,
}: {
  request: AdmissionRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState('');
  const open = !!request;
  const reject = useRejectAdmissionRequest();

  useMemo(() => {
    if (open) setReason('');
  }, [open]);

  const handleSubmit = async () => {
    if (!request) return;
    if (!reason.trim()) {
      toast.error('Provide a reason for rejection');
      return;
    }
    try {
      await reject.mutateAsync({ id: request.id, rejectionReason: reason.trim() });
      toast.success('Request rejected');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reject request');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reject Admission Request</DialogTitle>
          <DialogDescription>
            {request
              ? `Send a reason back to Dr. ${request.doctor?.user?.firstName ?? ''} ${
                  request.doctor?.user?.lastName ?? ''
                }`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <Label className="text-xs font-medium">Rejection Reason *</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., No beds available for the next 24 hours"
            rows={3}
            className="text-sm resize-none"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={handleSubmit}
            disabled={reject.isPending}
          >
            {reject.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
