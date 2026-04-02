'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Search, Plus, MoreHorizontal, Eye, ArrowRightLeft, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { toast } from 'sonner';
import type { Admission, Patient, DoctorProfile, BedWithStatus } from '@/types';

// ---------------------------------------------------------------------------
// Stat items for the filter row
// ---------------------------------------------------------------------------
const statItems = [
  { key: 'all', label: 'Total', color: 'text-foreground' },
  { key: 'admitted', label: 'In IP', color: 'text-blue-600' },
  { key: 'discharged', label: 'Discharged', color: 'text-green-600' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-red-600' },
];

// ---------------------------------------------------------------------------
// Ward type (lightweight, from /infrastructure/wards)
// ---------------------------------------------------------------------------
interface Ward {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// AdmissionDialog — Create a new admission
// ---------------------------------------------------------------------------
function AdmissionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  // Form state
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedWardId, setSelectedWardId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [admissionDate, setAdmissionDate] = useState(toInputDateStr());
  const [expectedDischarge, setExpectedDischarge] = useState('');
  const [admissionReason, setAdmissionReason] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  // Debounced patient search
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPatientSearch(patientSearch), 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // Queries
  const { data: patientsData } = useQuery({
    queryKey: ['patients-search', debouncedPatientSearch],
    queryFn: () =>
      apiGet<Patient[]>('/patients', {
        params: { search: debouncedPatientSearch, limit: 10 },
      }),
    enabled: debouncedPatientSearch.length >= 2,
  });

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: () => apiGet<DoctorProfile[]>('/users', { params: { role: 'doctor', limit: 50 } }),
  });

  const { data: wardsData } = useQuery({
    queryKey: ['wards-list'],
    queryFn: () => apiGet<Ward[]>('/infrastructure/wards'),
  });

  const { data: bedsData } = useQuery({
    queryKey: ['beds-available', selectedWardId],
    queryFn: () =>
      apiGet<BedWithStatus[]>('/infrastructure/beds', {
        params: { wardId: selectedWardId, status: 'available' },
      }),
    enabled: !!selectedWardId,
  });

  // Reset bed when ward changes
  useEffect(() => {
    setSelectedBedId('');
  }, [selectedWardId]);

  const patients = patientsData?.data ?? [];
  const doctors = doctorsData?.data ?? [];
  const wards = wardsData?.data ?? [];
  const beds = bedsData?.data ?? [];

  // Mutation: create visit then admission
  const admitMutation = useMutation({
    mutationFn: async () => {
      // Step 1: create an IP visit
      const visitRes = await apiPost<{ id: string }>('/clinical/visits', {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        visitType: 'ip',
        visitDate: admissionDate,
      });
      const visitId = visitRes.data.id;

      // Step 2: create admission
      await apiPost('/clinical/admissions', {
        visitId,
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        wardId: selectedWardId,
        bedId: selectedBedId,
        admissionDate,
        expectedDischargeDate: expectedDischarge || undefined,
        admissionReason: admissionReason || undefined,
        depositAmount: depositAmount ? parseFloat(depositAmount) : 0,
      });
    },
    onSuccess: () => {
      toast.success('Patient admitted successfully');
      queryClient.invalidateQueries({ queryKey: ['hospital', 'admissions'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to admit patient');
    },
  });

  const resetForm = useCallback(() => {
    setPatientSearch('');
    setSelectedPatientId('');
    setSelectedDoctorId('');
    setSelectedWardId('');
    setSelectedBedId('');
    setAdmissionDate(toInputDateStr());
    setExpectedDischarge('');
    setAdmissionReason('');
    setDepositAmount('');
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admit Patient</DialogTitle>
          <DialogDescription>Fill in the details to admit a patient to IP.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Patient search */}
          <div className="grid gap-1.5">
            <Label>Patient *</Label>
            {selectedPatientId ? (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm">
                  {patients.find((p) => p.id === selectedPatientId)?.firstName}{' '}
                  {patients.find((p) => p.id === selectedPatientId)?.lastName}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPatientId('')}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  placeholder="Search by name, MRN, phone..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
                {patients.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border bg-popover">
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                        onClick={() => {
                          setSelectedPatientId(p.id);
                          setPatientSearch(`${p.firstName} ${p.lastName}`);
                        }}
                      >
                        <span className="font-medium">
                          {p.firstName} {p.lastName}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {p.mrn} | {p.phone}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Doctor */}
          <div className="grid gap-1.5">
            <Label>Doctor *</Label>
            <Select value={selectedDoctorId} onValueChange={(v) => setSelectedDoctorId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Dr. {d.user?.firstName} {d.user?.lastName} — {d.specialization}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ward */}
          <div className="grid gap-1.5">
            <Label>Ward *</Label>
            <Select value={selectedWardId} onValueChange={(v) => setSelectedWardId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select ward" />
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

          {/* Bed (filtered by ward) */}
          <div className="grid gap-1.5">
            <Label>Bed *</Label>
            <Select
              value={selectedBedId}
              onValueChange={(v) => setSelectedBedId(v ?? '')}
              disabled={!selectedWardId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={selectedWardId ? 'Select bed' : 'Select ward first'} />
              </SelectTrigger>
              <SelectContent>
                {beds.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    Bed {b.bedNumber}
                    {b.room ? ` (Room ${b.room.roomNumber})` : ''}
                  </SelectItem>
                ))}
                {beds.length === 0 && selectedWardId && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No available beds
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Admission Date *</Label>
              <Input
                type="date"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Expected Discharge</Label>
              <Input
                type="date"
                value={expectedDischarge}
                onChange={(e) => setExpectedDischarge(e.target.value)}
              />
            </div>
          </div>

          {/* Reason */}
          <div className="grid gap-1.5">
            <Label>Admission Reason</Label>
            <Textarea
              placeholder="Reason for admission..."
              value={admissionReason}
              onChange={(e) => setAdmissionReason(e.target.value)}
              rows={2}
            />
          </div>

          {/* Deposit */}
          <div className="grid gap-1.5">
            <Label>Deposit Amount</Label>
            <Input
              type="number"
              min={0}
              placeholder="0.00"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => admitMutation.mutate()}
            disabled={
              admitMutation.isPending ||
              !selectedPatientId ||
              !selectedDoctorId ||
              !selectedWardId ||
              !selectedBedId
            }
          >
            {admitMutation.isPending ? 'Admitting...' : 'Admit Patient'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// TransferDialog — Transfer a patient to a different ward/bed
// ---------------------------------------------------------------------------
function TransferDialog({
  admission,
  open,
  onOpenChange,
}: {
  admission: Admission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const [targetWardId, setTargetWardId] = useState('');
  const [targetBedId, setTargetBedId] = useState('');
  const [reason, setReason] = useState('');

  const { data: wardsData } = useQuery({
    queryKey: ['wards-list'],
    queryFn: () => apiGet<Ward[]>('/infrastructure/wards'),
  });

  const { data: bedsData } = useQuery({
    queryKey: ['beds-available', targetWardId],
    queryFn: () =>
      apiGet<BedWithStatus[]>('/infrastructure/beds', {
        params: { wardId: targetWardId, status: 'available' },
      }),
    enabled: !!targetWardId,
  });

  useEffect(() => {
    setTargetBedId('');
  }, [targetWardId]);

  const wards = wardsData?.data ?? [];
  const beds = bedsData?.data ?? [];

  const transferType =
    targetWardId && targetWardId !== admission.wardId ? 'ward_to_ward' : 'bed_to_bed';

  const transferMutation = useMutation({
    mutationFn: () =>
      apiPost('/clinical/transfers', {
        admissionId: admission.id,
        fromWardId: admission.wardId,
        fromBedId: admission.bedId,
        toWardId: targetWardId,
        toBedId: targetBedId,
        type: transferType,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      toast.success('Patient transferred successfully');
      queryClient.invalidateQueries({ queryKey: ['hospital', 'admissions'] });
      onOpenChange(false);
      setTargetWardId('');
      setTargetBedId('');
      setReason('');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Transfer failed');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Patient</DialogTitle>
          <DialogDescription>
            Transfer{' '}
            <strong>
              {admission.patient?.firstName} {admission.patient?.lastName}
            </strong>{' '}
            to a different ward/bed.
          </DialogDescription>
        </DialogHeader>

        {/* Current location */}
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Current:</span>{' '}
          <strong>{admission.ward?.name ?? '-'}</strong> / Bed{' '}
          <strong>{admission.bed?.bedNumber ?? '-'}</strong>
        </div>

        <div className="grid gap-4 py-2">
          {/* Target ward */}
          <div className="grid gap-1.5">
            <Label>Target Ward *</Label>
            <Select value={targetWardId} onValueChange={(v) => setTargetWardId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select ward" />
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

          {/* Target bed */}
          <div className="grid gap-1.5">
            <Label>Target Bed *</Label>
            <Select
              value={targetBedId}
              onValueChange={(v) => setTargetBedId(v ?? '')}
              disabled={!targetWardId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={targetWardId ? 'Select bed' : 'Select ward first'} />
              </SelectTrigger>
              <SelectContent>
                {beds.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    Bed {b.bedNumber}
                    {b.room ? ` (Room ${b.room.roomNumber})` : ''}
                  </SelectItem>
                ))}
                {beds.length === 0 && targetWardId && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No available beds
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="grid gap-1.5">
            <Label>Reason</Label>
            <Textarea
              placeholder="Reason for transfer..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => transferMutation.mutate()}
            disabled={transferMutation.isPending || !targetWardId || !targetBedId}
          >
            {transferMutation.isPending ? 'Transferring...' : 'Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DischargeDialog — Confirm discharge of a patient
// ---------------------------------------------------------------------------
function DischargeDialog({
  admission,
  open,
  onOpenChange,
}: {
  admission: Admission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [dischargeDate, setDischargeDate] = useState(toInputDateStr());

  const dischargeMutation = useMutation({
    mutationFn: () =>
      apiPatch(`/clinical/admissions/${admission.id}/discharge`, {
        dischargeDate,
      }),
    onSuccess: () => {
      toast.success('Patient discharged successfully');
      queryClient.invalidateQueries({ queryKey: ['hospital', 'admissions'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Discharge failed');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Discharge Patient</DialogTitle>
          <DialogDescription>
            Are you sure you want to discharge{' '}
            <strong>
              {admission.patient?.firstName} {admission.patient?.lastName}
            </strong>
            ?
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Ward:</span> {admission.ward?.name ?? '-'}
            </p>
            <p>
              <span className="text-muted-foreground">Bed:</span>{' '}
              {admission.bed?.bedNumber ?? '-'}
            </p>
            <p>
              <span className="text-muted-foreground">Admitted:</span>{' '}
              {admission.admissionDate ? formatDate(admission.admissionDate) : '-'}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label>Discharge Date *</Label>
            <Input
              type="date"
              value={dischargeDate}
              onChange={(e) => setDischargeDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => dischargeMutation.mutate()}
            disabled={dischargeMutation.isPending}
          >
            {dischargeMutation.isPending ? 'Discharging...' : 'Confirm Discharge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// RowActionsMenu — Dropdown for each admission row
// ---------------------------------------------------------------------------
function RowActionsMenu({
  admission,
  onView,
}: {
  admission: Admission;
  onView: (adm: Admission) => void;
}) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);

  const isActive = admission.status === 'admitted';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onView(admission)}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          {isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDischargeOpen(true)}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Discharge
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Transfer dialog */}
      <TransferDialog
        admission={admission}
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />

      {/* Discharge dialog */}
      <DischargeDialog
        admission={admission}
        open={dischargeOpen}
        onOpenChange={setDischargeOpen}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// InPatientList — Main component (preserved + enhanced)
// ---------------------------------------------------------------------------
export function InPatientList() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [admitOpen, setAdmitOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'admissions', { status: statusFilter, search, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;
      const response = await apiGet<Admission[]>('/clinical/admissions', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const admissions = data?.data ?? [];

  const handleView = (adm: Admission) => {
    // TODO: navigate to admission detail or open a sheet
    toast.info(`Viewing admission for ${adm.patient?.firstName} ${adm.patient?.lastName}`);
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex gap-2 overflow-x-auto">
        {statItems.map((item) => (
          <button
            key={item.key}
            onClick={() => { setStatusFilter(item.key); setPage(1); }}
            className={cn(
              'flex flex-col items-center rounded-xl border-2 px-4 py-3 min-w-[90px] transition-all',
              statusFilter === item.key
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-surface-container-lowest hover:border-surface-container'
            )}
          >
            <span className={cn('text-xl font-bold', item.color)}>-</span>
            <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest mt-1">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Search + Admit button */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Search patient, IP number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
        <Button
          className="rounded-xl gap-1.5"
          onClick={() => setAdmitOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Admit Patient
        </Button>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient Details</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">IP Records</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Consultant</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Bed / Ward</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Advance</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : admissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No admissions found.
                  </td>
                </tr>
              ) : (
                admissions.map((adm) => {
                  const initials = `${adm.patient?.firstName?.[0] || ''}${adm.patient?.lastName?.[0] || ''}`.toUpperCase();
                  return (
                    <tr key={adm.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-label text-sm font-bold">{adm.patient?.firstName} {adm.patient?.lastName}</p>
                            <p className="font-label text-[10px] text-on-surface-variant">{adm.patient?.mrn} | {adm.patient?.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-[10px] text-on-surface-variant">{adm.admissionReason || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-sm">
                          {adm.doctor ? `Dr. ${adm.doctor.user?.firstName || ''} ${adm.doctor.user?.lastName || ''}` : '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-sm">{adm.bed?.bedNumber || '-'} / {adm.ward?.name || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-sm font-bold">{adm.depositAmount?.toLocaleString() ?? 0}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                          adm.status === 'admitted' && 'bg-primary/10 text-primary',
                          adm.status === 'discharged' && 'bg-primary/10 text-primary',
                          adm.status === 'transferred' && 'bg-secondary/10 text-secondary',
                          adm.status === 'absconded' && 'bg-error-container text-on-error-container',
                        )}>
                          {adm.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActionsMenu admission={adm} onView={handleView} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {(data?.meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <p className="font-label text-sm text-on-surface-variant">
              Page {page} of {data?.meta?.totalPages} ({data?.meta?.total} total)
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (data?.meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Admission dialog */}
      <AdmissionDialog open={admitOpen} onOpenChange={setAdmitOpen} />
    </div>
  );
}
