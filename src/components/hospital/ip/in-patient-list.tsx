'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  ArrowRightLeft,
  LogOut,
  Printer,
  ClipboardCheck,
  CheckCircle2,
} from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { formatDate, formatDateTime, toInputDateStr } from '@/lib/date-utils';
import { toast } from 'sonner';
import type { Admission, Patient, DoctorProfile, BedWithStatus } from '@/types';

// ---------------------------------------------------------------------------
// Stat items for the filter row
// ---------------------------------------------------------------------------
const statItems = [
  { key: 'all', label: 'Total', color: 'text-foreground' },
  { key: 'admitted', label: 'In IP', color: 'text-blue-600' },
  { key: 'discharged', label: 'Discharged', color: 'text-green-600' },
  { key: 'absconded', label: 'Cancelled', color: 'text-red-600' },
];

interface Floor {
  id: string;
  name: string;
  level: number;
}

interface Ward {
  id: string;
  name: string;
  wardType?: string;
  totalBeds?: number;
  floorId?: string | null;
  floor?: { id: string; name: string; level: number } | null;
}

interface WardAvailability {
  wardId: string;
  available: number;
  occupied: number;
  reserved: number;
  totalBeds: number;
}

// Standard admission checklist (used both during admission and on detail view)
const ADMISSION_CHECKLIST = [
  { key: 'id_proof', label: 'Government ID proof verified', required: true },
  { key: 'consent', label: 'Admission consent form signed', required: true },
  { key: 'insurance', label: 'Insurance / TPA card collected (if applicable)', required: false },
  { key: 'allergy', label: 'Drug allergy history recorded', required: true },
  { key: 'belongings', label: 'Patient belongings list signed', required: false },
  { key: 'kin_contact', label: 'Next-of-kin contact captured', required: true },
  { key: 'deposit', label: 'Advance deposit collected', required: true },
  { key: 'orientation', label: 'Ward / bed orientation given to attendant', required: false },
];

// ---------------------------------------------------------------------------
// AdmissionDialog — Create a new admission (multi-step: details → checklist)
// ---------------------------------------------------------------------------
function AdmissionDialog({
  open,
  onOpenChange,
  onAdmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdmitted: (admission: Admission) => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'details' | 'checklist'>('details');

  // Form state
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  // Hold on to the picked patient so the display survives search changes.
  const [selectedPatientSnapshot, setSelectedPatientSnapshot] = useState<Patient | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [selectedWardId, setSelectedWardId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [admissionDate, setAdmissionDate] = useState(toInputDateStr());
  const [expectedDischarge, setExpectedDischarge] = useState('');
  const [admissionReason, setAdmissionReason] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

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
    queryFn: () =>
      apiGet<DoctorProfile[]>('/appointments/doctors', { params: { limit: 100 } }),
  });

  const { data: floorsData } = useQuery({
    queryKey: ['floors-list'],
    queryFn: () =>
      apiGet<Floor[]>('/infrastructure/floors', { params: { limit: 200 } }),
  });

  const { data: wardsData } = useQuery({
    queryKey: ['wards-list', selectedFloorId],
    queryFn: () =>
      apiGet<Ward[]>('/infrastructure/wards', {
        params: { limit: 200, ...(selectedFloorId && { floorId: selectedFloorId }) },
      }),
  });

  // Per-ward availability (available/occupied/reserved/total) for dropdown badges
  const { data: availabilityData } = useQuery({
    queryKey: ['beds-availability-summary', selectedFloorId],
    queryFn: () =>
      apiGet<{ summary: unknown; wards: WardAvailability[] }>(
        '/infrastructure/beds/availability',
        { params: { ...(selectedFloorId && { floorId: selectedFloorId }) } },
      ),
  });

  const { data: bedsData } = useQuery({
    queryKey: ['beds-available', selectedWardId, selectedPatientId],
    queryFn: () =>
      apiGet<BedWithStatus[]>('/infrastructure/beds', {
        params: {
          wardId: selectedWardId,
          status: 'available',
          // Include this patient's already-reserved bed in the picker.
          ...(selectedPatientId ? { forPatientId: selectedPatientId } : {}),
          limit: 200,
        },
      }),
    enabled: !!selectedWardId,
  });

  // Reset bed when ward changes
  useEffect(() => {
    setSelectedBedId('');
  }, [selectedWardId]);

  // Reset ward + bed when floor changes
  useEffect(() => {
    setSelectedWardId('');
    setSelectedBedId('');
  }, [selectedFloorId]);

  const patients = patientsData?.data ?? [];
  const doctors = doctorsData?.data ?? [];
  const floors = floorsData?.data ?? [];
  const wards = wardsData?.data ?? [];
  const beds = bedsData?.data ?? [];
  const availabilityByWard = new Map(
    (availabilityData?.data?.wards ?? []).map((w) => [w.wardId, w]),
  );

  const selectedPatient =
    selectedPatientSnapshot ?? patients.find((p) => p.id === selectedPatientId);
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const selectedFloor = floors.find((f) => f.id === selectedFloorId);
  const selectedWard = wards.find((w) => w.id === selectedWardId);
  const selectedBed = beds.find((b) => b.id === selectedBedId);

  const doctorName = (d?: typeof doctors[number]) =>
    d ? `Dr. ${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.trim() : '';

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
      const admissionRes = await apiPost<Admission>('/clinical/admissions', {
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
      return admissionRes.data;
    },
    onSuccess: (admission) => {
      toast.success('Patient admitted successfully');
      queryClient.invalidateQueries({ queryKey: ['hospital', 'admissions'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'beds'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'reservations'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructure', 'beds'] });
      queryClient.invalidateQueries({ queryKey: ['beds-available'] });
      onAdmitted(admission);
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
    setSelectedPatientSnapshot(null);
    setSelectedDoctorId('');
    setSelectedFloorId('');
    setSelectedWardId('');
    setSelectedBedId('');
    setAdmissionDate(toInputDateStr());
    setExpectedDischarge('');
    setAdmissionReason('');
    setDepositAmount('');
    setChecklist({});
    setStep('details');
  }, []);

  const detailsValid =
    !!selectedPatientId && !!selectedDoctorId && !!selectedWardId && !!selectedBedId;

  const requiredChecklistDone = ADMISSION_CHECKLIST.filter((c) => c.required).every(
    (c) => checklist[c.key],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admit Patient</DialogTitle>
          <DialogDescription>
            {step === 'details'
              ? 'Fill in admission details (ward, bed, doctor, deposit).'
              : 'Verify the admission checklist before confirming.'}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'rounded-full px-3 py-1 font-bold',
              step === 'details' ? 'bg-primary text-white' : 'bg-primary/10 text-primary',
            )}
          >
            1. Details
          </span>
          <span className="text-muted-foreground">→</span>
          <span
            className={cn(
              'rounded-full px-3 py-1 font-bold',
              step === 'checklist'
                ? 'bg-primary text-white'
                : 'bg-surface-container-high text-on-surface-variant',
            )}
          >
            2. Checklist
          </span>
        </div>

        {step === 'details' && (
          <div className="grid gap-4 py-2">
            {/* Patient search */}
            <div className="grid gap-1.5">
              <Label>Patient *</Label>
              {selectedPatientId ? (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm">
                    {selectedPatient
                      ? `${selectedPatient.firstName} ${selectedPatient.lastName}${selectedPatient.mrn ? ` (${selectedPatient.mrn})` : ''}`
                      : 'Loading patient…'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPatientId('');
                      setSelectedPatientSnapshot(null);
                      setPatientSearch('');
                    }}
                  >
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
                            setSelectedPatientSnapshot(p);
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

            <div className="grid grid-cols-2 gap-3">
              {/* Doctor */}
              <div className="grid gap-1.5">
                <Label>Consultant Doctor *</Label>
                <Select value={selectedDoctorId} onValueChange={(v) => setSelectedDoctorId(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select doctor">
                      {() => (selectedDoctor ? doctorName(selectedDoctor) : 'Select doctor')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {doctorName(d)}
                        {d.specialization ? ` — ${d.specialization}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Floor (optional pre-filter) */}
              <div className="grid gap-1.5">
                <Label>Floor</Label>
                <Select
                  value={selectedFloorId || null}
                  onValueChange={(v) => setSelectedFloorId(v ?? '')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All floors">
                      {() =>
                        selectedFloor
                          ? `L${selectedFloor.level} — ${selectedFloor.name}`
                          : 'All floors'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {floors.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        L{f.level} — {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ward (filtered by floor when set) */}
              <div className="grid gap-1.5">
                <Label>Ward *</Label>
                <Select value={selectedWardId} onValueChange={(v) => setSelectedWardId(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select ward">
                      {() => (selectedWard ? selectedWard.name : 'Select ward')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {wards.map((w) => {
                      const a = availabilityByWard.get(w.id);
                      const floorPart = w.floor ? `L${w.floor.level}` : null;
                      const typePart = w.wardType ? w.wardType.toUpperCase() : null;
                      const availPart = a ? `${a.available}/${a.totalBeds} free` : null;
                      const meta = [floorPart, typePart, availPart].filter(Boolean).join(' · ');
                      const noBeds = a?.available === 0;
                      return (
                        <SelectItem key={w.id} value={w.id} disabled={noBeds}>
                          <span>
                            {w.name}
                            {meta ? <span className="text-muted-foreground"> · {meta}</span> : null}
                            {noBeds ? <span className="text-destructive"> (full)</span> : null}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Bed (filtered by ward) */}
              <div className="grid gap-1.5 col-span-2">
                <Label>Bed *</Label>
                <Select
                  value={selectedBedId}
                  onValueChange={(v) => setSelectedBedId(v ?? '')}
                  disabled={!selectedWardId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={selectedWardId ? 'Select available bed' : 'Select ward first'}
                    >
                      {() =>
                        selectedBed
                          ? `Bed ${selectedBed.bedNumber}${selectedBed.bedType ? ` · ${selectedBed.bedType.toUpperCase()}` : ''}`
                          : selectedWardId
                            ? 'Select available bed'
                            : 'Select ward first'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {beds.map((b) => {
                      const heldForThisPatient =
                        selectedPatientId && b.status !== 'available' &&
                        b.currentPatientId === selectedPatientId;
                      return (
                        <SelectItem key={b.id} value={b.id}>
                          <span>
                            Bed {b.bedNumber}
                            {b.bedType ? (
                              <span className="text-muted-foreground"> · {b.bedType.toUpperCase()}</span>
                            ) : null}
                            {heldForThisPatient ? (
                              <span className="text-primary"> · reserved for patient</span>
                            ) : null}
                          </span>
                        </SelectItem>
                      );
                    })}
                    {beds.length === 0 && selectedWardId && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No available beds in this ward
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Dates row */}
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

              {/* Deposit */}
              <div className="grid gap-1.5 col-span-2">
                <Label>Deposit / Advance Amount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Reason */}
            <div className="grid gap-1.5">
              <Label>Diagnosis / Admission Reason</Label>
              <Textarea
                placeholder="Provisional diagnosis or chief complaint..."
                value={admissionReason}
                onChange={(e) => setAdmissionReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        {step === 'checklist' && (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Patient:</span>{' '}
                <strong>
                  {selectedPatient?.firstName} {selectedPatient?.lastName}
                </strong>{' '}
                ({selectedPatient?.mrn})
              </p>
              <p>
                <span className="text-muted-foreground">Doctor:</span>{' '}
                <strong>
                  Dr. {selectedDoctor?.user?.firstName} {selectedDoctor?.user?.lastName}
                </strong>
              </p>
              <p>
                <span className="text-muted-foreground">Bed:</span>{' '}
                <strong>{selectedBed?.bedNumber}</strong> in{' '}
                <strong>{selectedWard?.name}</strong>
                {selectedWard?.floor ? (
                  <span className="text-muted-foreground">
                    {' '}· Floor {selectedWard.floor.level} ({selectedWard.floor.name})
                  </span>
                ) : null}
              </p>
              <p>
                <span className="text-muted-foreground">Deposit:</span>{' '}
                <strong>₹{Number(depositAmount || 0).toLocaleString('en-IN')}</strong>
              </p>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Confirm required documents (marked *) are collected.
            </p>
            <ul className="space-y-2">
              {ADMISSION_CHECKLIST.map((item) => (
                <li
                  key={item.key}
                  className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={!!checklist[item.key]}
                    onChange={(e) =>
                      setChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    className="mt-1 h-4 w-4 rounded border-input accent-primary cursor-pointer"
                  />
                  <span className="text-sm">
                    {item.label}
                    {item.required && <span className="text-destructive ml-1">*</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          {step === 'details' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!detailsValid} onClick={() => setStep('checklist')}>
                Next: Checklist
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('details')}>
                Back
              </Button>
              <Button
                onClick={() => admitMutation.mutate()}
                disabled={admitMutation.isPending || !requiredChecklistDone}
              >
                {admitMutation.isPending ? 'Admitting...' : 'Confirm Admission'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AdmissionSlipDialog — Printable admission slip
// ---------------------------------------------------------------------------
function AdmissionSlipDialog({
  admission,
  open,
  onOpenChange,
}: {
  admission: Admission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const slipRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!slipRef.current) return;
    const html = slipRef.current.innerHTML;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html><head><title>Admission Slip — ${admission?.patient?.firstName} ${admission?.patient?.lastName}</title>
<style>
  body{font-family:system-ui,sans-serif;color:#111;margin:24px;font-size:13px;line-height:1.5}
  h1{font-size:18px;margin:0 0 4px}
  h2{font-size:14px;margin:16px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;margin:6px 0}
  td{padding:4px 6px;vertical-align:top}
  td.lbl{color:#666;width:38%}
  td.val{font-weight:600}
  ul{margin:4px 0 0 0;padding-left:18px}
  li{margin-bottom:3px}
  .header{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #111;padding-bottom:8px}
  .muted{color:#666;font-size:11px}
  .signrow{display:flex;justify-content:space-between;margin-top:50px}
  .sign{border-top:1px solid #111;padding-top:4px;font-size:11px;width:200px;text-align:center}
</style>
</head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 250);
  };

  if (!admission) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admission Slip</DialogTitle>
          <DialogDescription>
            Generated for {admission.patient?.firstName} {admission.patient?.lastName}
          </DialogDescription>
        </DialogHeader>

        <div ref={slipRef} className="rounded-lg border bg-white p-6 text-foreground">
          <div className="header flex items-end justify-between border-b-2 border-foreground pb-2">
            <div>
              <h1 className="text-lg font-bold">ADMISSION SLIP</h1>
              <p className="muted text-xs text-muted-foreground">
                Generated: {formatDateTime(new Date())}
              </p>
            </div>
            <div className="text-right text-xs">
              <p>
                <strong>IP No:</strong> {admission.id?.slice(0, 8).toUpperCase()}
              </p>
              <p>
                <strong>Admission Date:</strong> {formatDate(admission.admissionDate)}
              </p>
            </div>
          </div>

          <h2 className="text-sm font-semibold mt-4 border-b pb-1">Patient Details</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="lbl text-muted-foreground py-1">Name</td>
                <td className="val font-semibold">
                  {admission.patient?.firstName} {admission.patient?.lastName}
                </td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">MRN</td>
                <td className="val font-semibold">{admission.patient?.mrn ?? '-'}</td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Phone</td>
                <td className="val font-semibold">{admission.patient?.phone ?? '-'}</td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-sm font-semibold mt-4 border-b pb-1">Admission Details</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="lbl text-muted-foreground py-1">Consultant</td>
                <td className="val font-semibold">
                  Dr. {admission.doctor?.user?.firstName} {admission.doctor?.user?.lastName}
                </td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Ward</td>
                <td className="val font-semibold">{admission.ward?.name ?? '-'}</td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Bed</td>
                <td className="val font-semibold">{admission.bed?.bedNumber ?? '-'}</td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Diagnosis / Reason</td>
                <td className="val font-semibold">{admission.admissionReason ?? '-'}</td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Expected Discharge</td>
                <td className="val font-semibold">
                  {admission.expectedDischargeDate
                    ? formatDate(admission.expectedDischargeDate)
                    : '-'}
                </td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Deposit Collected</td>
                <td className="val font-semibold">
                  ₹{Number(admission.depositAmount ?? 0).toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-sm font-semibold mt-4 border-b pb-1">Required Documents</h2>
          <ul className="text-sm">
            {ADMISSION_CHECKLIST.map((item) => (
              <li key={item.key}>
                ☐ {item.label}
                {item.required ? ' *' : ''}
              </li>
            ))}
          </ul>

          <div className="signrow flex justify-between mt-12 text-xs">
            <div className="sign border-t pt-1 w-[200px] text-center">
              Patient / Attendant
            </div>
            <div className="sign border-t pt-1 w-[200px] text-center">Admitting Officer</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print Slip
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
    queryFn: () => apiGet<Ward[]>('/infrastructure/wards', { params: { limit: 200 } }),
  });

  const { data: bedsData } = useQuery({
    queryKey: ['beds-available', targetWardId],
    queryFn: () =>
      apiGet<BedWithStatus[]>('/infrastructure/beds', {
        params: { wardId: targetWardId, status: 'available', limit: 200 },
      }),
    enabled: !!targetWardId,
  });

  useEffect(() => {
    setTargetBedId('');
  }, [targetWardId]);

  const wards = wardsData?.data ?? [];
  const beds = bedsData?.data ?? [];

  const transferType: 'ward_to_ward' | 'bed_to_bed' =
    targetWardId && targetWardId !== admission.wardId ? 'ward_to_ward' : 'bed_to_bed';

  const transferMutation = useMutation({
    mutationFn: () =>
      apiPost('/clinical/transfers', {
        patientId: admission.patientId,
        visitId: admission.visitId,
        transferType,
        fromWardId: admission.wardId,
        toWardId: targetWardId,
        fromBedId: admission.bedId,
        toBedId: targetBedId,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      toast.success('Transfer request created. Awaiting approval.');
      queryClient.invalidateQueries({ queryKey: ['hospital', 'admissions'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'beds'] });
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
// DischargeDialog
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
  const [notes, setNotes] = useState('');

  const dischargeMutation = useMutation({
    mutationFn: () =>
      apiPatch(`/clinical/admissions/${admission.id}/discharge`, {
        dischargeDate,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Patient discharged successfully');
      queryClient.invalidateQueries({ queryKey: ['hospital', 'admissions'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'beds'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructure', 'beds'] });
      queryClient.invalidateQueries({ queryKey: ['beds-available'] });
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
            Discharge{' '}
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

          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Discharge notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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
// ViewAdmissionDialog — read-only summary + slip / checklist tabs
// ---------------------------------------------------------------------------
function ViewAdmissionDialog({
  admission,
  open,
  onOpenChange,
}: {
  admission: Admission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [slipOpen, setSlipOpen] = useState(false);

  if (!admission) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {admission.patient?.firstName} {admission.patient?.lastName}
              <span
                className={cn(
                  'ml-2 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                  admission.status === 'admitted' && 'bg-blue-100 text-blue-700',
                  admission.status === 'discharged' && 'bg-green-100 text-green-700',
                  admission.status === 'transferred' && 'bg-cyan-100 text-cyan-700',
                  admission.status === 'absconded' && 'bg-red-100 text-red-700',
                )}
              >
                {admission.status}
              </span>
            </DialogTitle>
            <DialogDescription>
              MRN: {admission.patient?.mrn} · IP No: {admission.id?.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview">
            <TabsList variant="line">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailRow label="Consultant"
                  value={`Dr. ${admission.doctor?.user?.firstName ?? ''} ${admission.doctor?.user?.lastName ?? ''}`} />
                <DetailRow label="Ward" value={admission.ward?.name ?? '-'} />
                <DetailRow label="Bed" value={admission.bed?.bedNumber ?? '-'} />
                <DetailRow label="Admitted" value={formatDate(admission.admissionDate)} />
                <DetailRow
                  label="Expected Discharge"
                  value={
                    admission.expectedDischargeDate
                      ? formatDate(admission.expectedDischargeDate)
                      : '-'
                  }
                />
                <DetailRow
                  label="Deposit"
                  value={`₹${Number(admission.depositAmount ?? 0).toLocaleString('en-IN')}`}
                />
                <div className="col-span-2">
                  <DetailRow
                    label="Diagnosis / Reason"
                    value={admission.admissionReason ?? '-'}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="checklist" className="pt-4">
              <ul className="space-y-2">
                {ADMISSION_CHECKLIST.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <span>
                      {item.label}
                      {item.required && <span className="text-destructive ml-1">*</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Print the admission slip for the patient&apos;s record.
              </p>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => setSlipOpen(true)}>
              <Printer className="mr-2 h-4 w-4" />
              Admission Slip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdmissionSlipDialog
        admission={admission}
        open={slipOpen}
        onOpenChange={setSlipOpen}
      />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RowActionsMenu
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
  const [slipOpen, setSlipOpen] = useState(false);

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
          <DropdownMenuItem onClick={() => setSlipOpen(true)}>
            <Printer className="mr-2 h-4 w-4" />
            Print Admission Slip
          </DropdownMenuItem>
          {isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDischargeOpen(true)}>
                <LogOut className="mr-2 h-4 w-4" />
                Discharge
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <TransferDialog
        admission={admission}
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />
      <DischargeDialog
        admission={admission}
        open={dischargeOpen}
        onOpenChange={setDischargeOpen}
      />
      <AdmissionSlipDialog
        admission={admission}
        open={slipOpen}
        onOpenChange={setSlipOpen}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// useAdmissionStats — fetch counts per status (limit=1 + meta.total)
// ---------------------------------------------------------------------------
function useAdmissionStats() {
  return useQuery({
    queryKey: ['hospital', 'admission-stats'],
    queryFn: async () => {
      const fetchCount = async (status?: string) => {
        const params: Record<string, unknown> = { limit: 1, page: 1 };
        if (status) params.status = status;
        const res = await apiGet<unknown[]>('/clinical/admissions', { params });
        return res.meta?.total ?? 0;
      };
      const [all, admitted, discharged, absconded] = await Promise.all([
        fetchCount(),
        fetchCount('admitted'),
        fetchCount('discharged'),
        fetchCount('absconded'),
      ]);
      return { all, admitted, discharged, absconded } as Record<string, number>;
    },
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// InPatientList — Main component
// ---------------------------------------------------------------------------
export function InPatientList() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [admitOpen, setAdmitOpen] = useState(false);
  const [viewAdmission, setViewAdmission] = useState<Admission | null>(null);
  const [postAdmitSlip, setPostAdmitSlip] = useState<Admission | null>(null);

  const { data: stats } = useAdmissionStats();

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

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex gap-2 overflow-x-auto">
        {statItems.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setStatusFilter(item.key);
              setPage(1);
            }}
            className={cn(
              'flex flex-col items-center rounded-xl border-2 px-4 py-3 min-w-[100px] transition-all',
              statusFilter === item.key
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-surface-container-lowest hover:border-surface-container',
            )}
          >
            <span className={cn('text-xl font-bold', item.color)}>
              {stats ? stats[item.key] ?? 0 : '–'}
            </span>
            <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest mt-1">
              {item.label}
            </span>
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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
        <Button className="rounded-xl gap-1.5" onClick={() => setAdmitOpen(true)}>
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
                <th className="px-4 pb-4 pt-5 text-left font-semibold">IP Number</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Diagnosis</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Consultant</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Ward / Bed</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Advance</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center font-label text-on-surface-variant"
                  >
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : admissions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center font-label text-on-surface-variant"
                  >
                    No admissions found.
                  </td>
                </tr>
              ) : (
                admissions.map((adm) => {
                  const initials = `${adm.patient?.firstName?.[0] || ''}${
                    adm.patient?.lastName?.[0] || ''
                  }`.toUpperCase();
                  return (
                    <tr
                      key={adm.id}
                      className="group hover:bg-surface-container-low transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-label text-sm font-bold">
                              {adm.patient?.firstName} {adm.patient?.lastName}
                            </p>
                            <p className="font-label text-[10px] text-on-surface-variant">
                              {adm.patient?.mrn} | {adm.patient?.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {adm.id?.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-xs text-on-surface-variant truncate max-w-[180px]">
                          {adm.admissionReason || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-sm">
                          {adm.doctor
                            ? `Dr. ${adm.doctor.user?.firstName || ''} ${
                                adm.doctor.user?.lastName || ''
                              }`
                            : '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-sm">
                          {adm.ward?.name || '-'} / {adm.bed?.bedNumber || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-label text-sm font-bold">
                        ₹{Number(adm.depositAmount ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                            adm.status === 'admitted' && 'bg-blue-100 text-blue-700',
                            adm.status === 'discharged' && 'bg-green-100 text-green-700',
                            adm.status === 'transferred' && 'bg-cyan-100 text-cyan-700',
                            adm.status === 'absconded' && 'bg-red-100 text-red-700',
                          )}
                        >
                          {adm.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActionsMenu admission={adm} onView={setViewAdmission} />
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
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (data?.meta?.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Admission dialog */}
      <AdmissionDialog
        open={admitOpen}
        onOpenChange={setAdmitOpen}
        onAdmitted={(adm) => setPostAdmitSlip(adm)}
      />

      {/* Auto-open admission slip after admit */}
      <AdmissionSlipDialog
        admission={postAdmitSlip}
        open={!!postAdmitSlip}
        onOpenChange={(o) => !o && setPostAdmitSlip(null)}
      />

      {/* View details dialog */}
      <ViewAdmissionDialog
        admission={viewAdmission}
        open={!!viewAdmission}
        onOpenChange={(o) => !o && setViewAdmission(null)}
      />
    </div>
  );
}
