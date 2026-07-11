'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePatient } from '@/hooks/use-hospital';
import {
  usePrescriptions,
  useCreatePrescription,
  useFormularySearch,
  useAllergyCheck,
  usePatientSearch,
  useCancelPrescription,
  usePrescriptionDetail,
  useUpdatePrescriptionItem,
  useAddPrescriptionItem,
  useRemovePrescriptionItem,
  type Prescription,
  type PrescriptionItem,
  type FormularyDrug,
  type AllergyCheckResult,
} from '@/hooks/use-doctor';
import { apiGet } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { formatDate, formatDateTimeAmPm, toInputDateStr } from '@/lib/date-utils';
import { printPrescription } from '@/lib/print-prescription';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Search,
  Plus,
  Eye,
  XCircle,
  Loader2,
  Pill,
  UserRound,
  CalendarIcon,
  Printer,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileText,
  Pencil,
  Check,
  X,
  Clock,
  Shield,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'dispensed', label: 'Dispensed' },
  { value: 'partially_dispensed', label: 'Partially Dispensed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: 'bg-primary-container/10 text-primary-container',
  dispensed: 'bg-primary/10 text-primary',
  partially_dispensed: 'bg-secondary/10 text-secondary',
  cancelled: 'bg-error/10 text-error',
};

const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Thrice daily',
  'Four times daily',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'As needed/SOS',
  'Before meals',
  'After meals',
  'At bedtime',
] as const;

const ROUTE_OPTIONS = [
  'Oral',
  'IV',
  'IM',
  'Topical',
  'Sublingual',
  'Inhalation',
] as const;

type DrugFormItem = {
  drugName: string;
  genericName: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  quantity: number;
  instructions: string;
};

function emptyDrugItem(): DrugFormItem {
  return {
    drugName: '',
    genericName: '',
    dosage: '',
    frequency: 'Once daily',
    duration: '',
    route: 'Oral',
    quantity: 1,
    instructions: '',
  };
}

interface Visit {
  id: string;
  visitType: string;
  visitDate: string;
  status?: string;
}

// ── Main Page ────────────────────────────────────────────────

export default function EPrescriptionPage() {
  const { user } = useAuthStore();

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState(toInputDateStr());
  const [toDate, setToDate] = useState(toInputDateStr());
  const [page, setPage] = useState(1);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [prescriptionToCancel, setPrescriptionToCancel] = useState<string | null>(null);

  // Arriving from an IP patient (…?patientId=&admissionId=&type=ip) pre-fills and
  // auto-opens the create dialog with the patient locked — no re-searching.
  const searchParams = useSearchParams();
  const urlPatientId = searchParams.get('patientId') ?? undefined;
  const urlAdmissionId = searchParams.get('admissionId') ?? undefined;
  const urlType = (searchParams.get('type') as 'op' | 'ip' | null) ?? undefined;
  const { data: presetPatientData } = usePatient(urlPatientId ?? '');
  const presetPatient = urlPatientId && presetPatientData
    ? {
        id: presetPatientData.id,
        firstName: presetPatientData.firstName ?? '',
        lastName: presetPatientData.lastName ?? '',
        mrn: presetPatientData.mrn ?? undefined,
      }
    : null;
  const presetType: 'op' | 'ip' | undefined = urlType ?? (urlAdmissionId ? 'ip' : undefined);

  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (urlPatientId && !openedFromUrl.current) {
      openedFromUrl.current = true;
      setCreateDialogOpen(true);
    }
  }, [urlPatientId]);

  // Fetch prescriptions
  const { data: prescriptionsData, isLoading } = usePrescriptions({
    page,
    limit: 10,
    doctorId: user?.id,
    search: search || undefined,
  });

  const cancelMutation = useCancelPrescription();

  const prescriptions = prescriptionsData?.data ?? [];
  const meta = prescriptionsData?.meta;

  // Client-side status filter
  const filteredPrescriptions = useMemo(() => {
    if (statusFilter === 'all') return prescriptions;
    return prescriptions.filter((p) => p.status === statusFilter);
  }, [prescriptions, statusFilter]);

  const handleViewPrescription = useCallback((id: string) => {
    setSelectedPrescriptionId(id);
    setViewDialogOpen(true);
  }, []);

  const handleOpenCancelDialog = useCallback((id: string) => {
    setPrescriptionToCancel(id);
    setCancelDialogOpen(true);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!prescriptionToCancel) return;
    try {
      await cancelMutation.mutateAsync(prescriptionToCancel);
      toast.success('Prescription cancelled successfully');
      setCancelDialogOpen(false);
      setPrescriptionToCancel(null);
    } catch {
      toast.error('Failed to cancel prescription');
    }
  }, [prescriptionToCancel, cancelMutation]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">e-Prescription</h1>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Prescription
        </Button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patient name / MRN..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-8 text-xs w-[220px]"
            />
          </div>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">From:</span>
          <div className="relative">
            <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="pl-8 h-8 text-xs w-full sm:w-[140px]"
            />
          </div>
          <span className="text-xs text-muted-foreground">To:</span>
          <div className="relative">
            <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="pl-8 h-8 text-xs w-full sm:w-[140px]"
            />
          </div>
        </div>
      </div>

      {/* Prescriptions Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden shadow-sm ring-1 ring-foreground/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Date</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Doctor</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Items</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading prescriptions...</p>
                  </td>
                </tr>
              ) : filteredPrescriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Pill className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-3 text-sm text-muted-foreground">No prescriptions found.</p>
                  </td>
                </tr>
              ) : (
                filteredPrescriptions.map((rx) => {
                  const patientName = rx.patient
                    ? `${rx.patient.firstName || ''} ${rx.patient.lastName || ''}`.trim().toUpperCase()
                    : 'Unknown';
                  const doctorName = rx.doctor?.user
                    ? `Dr. ${rx.doctor.user.firstName || ''} ${rx.doctor.user.lastName || ''}`.trim()
                    : '-';
                  const statusStyle = STATUS_BADGE_STYLES[rx.status] || 'bg-surface-container-high text-on-surface-variant';
                  const statusLabel = rx.status
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());

                  const hoursElapsed = (Date.now() - new Date(rx.createdAt).getTime()) / (1000 * 60 * 60);
                  const isEditable = hoursElapsed <= 24 && rx.status === 'active';
                  const editHoursLeft = Math.max(0, Math.floor(24 - hoursElapsed));

                  return (
                    <tr
                      key={rx.id}
                      className="group hover:bg-surface-container-low transition-colors cursor-pointer"
                      onClick={() => handleViewPrescription(rx.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">{formatDate(rx.createdAt)}</span>
                        {isEditable && (
                          <p className="text-[9px] text-secondary font-medium mt-0.5">{editHoursLeft}h left to edit</p>
                        )}
                        {!isEditable && rx.status === 'active' && (
                          <p className="text-[9px] text-muted-foreground mt-0.5">Locked</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-foreground">{patientName}</p>
                          <p className="text-xs text-muted-foreground">{rx.patient?.mrn || '-'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">{doctorName}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {rx.items?.length ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusStyle)}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="View Prescription"
                            onClick={() => handleViewPrescription(rx.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {rx.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title="Cancel Prescription"
                              onClick={() => handleOpenCancelDialog(rx.id)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
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
            <span className="font-medium">10</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {filteredPrescriptions.length > 0
                ? `${(page - 1) * 10 + 1}-${(page - 1) * 10 + filteredPrescriptions.length} of ${meta?.total ?? filteredPrescriptions.length}`
                : '0-0 of 0'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= (meta?.totalPages ?? 1)}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Create Prescription Dialog */}
      <CreatePrescriptionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        userId={user?.id || ''}
        presetPatient={presetPatient}
        presetType={presetType}
        lockPatient={!!urlPatientId}
      />

      {/* View Prescription Dialog */}
      <ViewPrescriptionDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        prescriptionId={selectedPrescriptionId}
        onCancel={(id) => {
          setViewDialogOpen(false);
          handleOpenCancelDialog(id);
        }}
      />

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-secondary" />
              Cancel Prescription
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this prescription? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setCancelDialogOpen(false); setPrescriptionToCancel(null); }}
            >
              No, Keep It
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Create Prescription Dialog ───────────────────────────────

function CreatePrescriptionDialog({
  open,
  onOpenChange,
  userId,
  presetPatient,
  presetType,
  lockPatient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  // When opened from an IP patient's context, the patient + type are pre-filled
  // so the doctor doesn't re-search — write the prescription straight away.
  presetPatient?: { id: string; firstName: string; lastName: string; mrn?: string } | null;
  presetType?: 'op' | 'ip';
  lockPatient?: boolean;
}) {
  const createMutation = useCreatePrescription();

  // Wizard step
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Patient & Visit
  const [patientQuery, setPatientQuery] = useState('');
  const [debouncedPatientQuery, setDebouncedPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    mrn?: string;
  } | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [prescriptionType, setPrescriptionType] = useState<'op' | 'ip'>('op');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [visitsLoading, setVisitsLoading] = useState(false);

  // Debounce patient search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPatientQuery(patientQuery), 400);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  const { data: patientResults, isLoading: patientsLoading } = usePatientSearch(debouncedPatientQuery);

  // Fetch visits when patient selected
  useEffect(() => {
    if (!selectedPatient) {
      setVisits([]);
      setSelectedVisitId('');
      return;
    }
    let cancelled = false;
    setVisitsLoading(true);
    apiGet<Visit[]>('/clinical/visits', {
      params: { patientId: selectedPatient.id, status: 'active' },
    })
      .then((res) => {
        if (!cancelled) {
          const visitList = res.data ?? [];
          setVisits(visitList);
          if (visitList.length > 0) setSelectedVisitId(visitList[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setVisits([]);
      })
      .finally(() => {
        if (!cancelled) setVisitsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedPatient]);

  // Step 2: Drug items
  const [drugItems, setDrugItems] = useState<DrugFormItem[]>([]);
  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [debouncedDrugQuery, setDebouncedDrugQuery] = useState('');
  const [showDrugDropdown, setShowDrugDropdown] = useState(false);
  const [currentDrugItem, setCurrentDrugItem] = useState<DrugFormItem>(emptyDrugItem());
  const [allergyDrugName, setAllergyDrugName] = useState('');

  // Debounce drug search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDrugQuery(drugSearchQuery), 400);
    return () => clearTimeout(timer);
  }, [drugSearchQuery]);

  const { data: formularyResults, isLoading: formularyLoading } = useFormularySearch(debouncedDrugQuery);
  const { data: allergyResult } = useAllergyCheck(selectedPatient?.id || '', allergyDrugName);

  // Step 3: Notes
  const [notes, setNotes] = useState('');

  // Initialize the form whenever the dialog opens — honoring a preset patient /
  // type passed from the IP context so the doctor never re-searches the patient.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setPatientQuery('');
    setDebouncedPatientQuery('');
    setSelectedPatient(presetPatient ?? null);
    setShowPatientDropdown(false);
    setPrescriptionType(presetType ?? 'op');
    setVisits([]);
    setSelectedVisitId('');
    setDrugItems([]);
    setDrugSearchQuery('');
    setDebouncedDrugQuery('');
    setShowDrugDropdown(false);
    setCurrentDrugItem(emptyDrugItem());
    setAllergyDrugName('');
    setNotes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetPatient?.id, presetType]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  const handleSelectPatient = useCallback(
    (patient: { id: string; firstName: string; lastName: string; mrn?: string }) => {
      setSelectedPatient(patient);
      setPatientQuery('');
      setDebouncedPatientQuery('');
      setShowPatientDropdown(false);
    },
    [],
  );

  const handleSelectDrug = useCallback((drug: FormularyDrug) => {
    const item: DrugFormItem = {
      ...emptyDrugItem(),
      drugName: drug.drugName,
      genericName: drug.genericName || '',
      dosage: drug.strength || '',
    };
    setCurrentDrugItem(item);
    setDrugSearchQuery('');
    setDebouncedDrugQuery('');
    setShowDrugDropdown(false);
    // Trigger allergy check
    setAllergyDrugName(drug.drugName);
  }, []);

  const handleAddDrugItem = useCallback(() => {
    if (!currentDrugItem.drugName || !currentDrugItem.dosage || !currentDrugItem.duration) {
      toast.error('Please fill in drug name, dosage, and duration');
      return;
    }
    setDrugItems((prev) => [...prev, { ...currentDrugItem }]);
    setCurrentDrugItem(emptyDrugItem());
    setAllergyDrugName('');
    setDrugSearchQuery('');
    setDebouncedDrugQuery('');
  }, [currentDrugItem]);

  const handleRemoveDrugItem = useCallback((index: number) => {
    setDrugItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const canProceedStep1 = !!selectedPatient && !!selectedVisitId;
  const canProceedStep2 = drugItems.length > 0;

  const handleSave = useCallback(async () => {
    if (!selectedPatient || !selectedVisitId || drugItems.length === 0) return;
    try {
      await createMutation.mutateAsync({
        patientId: selectedPatient.id,
        doctorId: userId,
        visitId: selectedVisitId,
        prescriptionType,
        items: drugItems.map((item) => ({
          drugName: item.drugName,
          genericName: item.genericName || undefined,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          route: item.route || undefined,
          instructions: item.instructions || undefined,
          quantity: item.quantity,
        })),
        notes: notes || undefined,
      });
      toast.success('Prescription created successfully');
      handleOpenChange(false);
    } catch {
      toast.error('Failed to create prescription');
    }
  }, [selectedPatient, selectedVisitId, drugItems, notes, prescriptionType, userId, createMutation, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            New Prescription
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Step 1: Select patient and visit'}
            {step === 2 && 'Step 2: Add drugs to the prescription'}
            {step === 3 && 'Step 3: Review and save'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 px-1">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {s}
              </div>
              <span className={cn('text-xs hidden sm:inline', step >= s ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                {s === 1 ? 'Patient' : s === 2 ? 'Drugs' : 'Review'}
              </span>
              {s < 3 && <div className={cn('flex-1 h-0.5 rounded', step > s ? 'bg-primary' : 'bg-muted')} />}
            </div>
          ))}
        </div>

        {/* Step 1: Patient & Visit */}
        {step === 1 && (
          <div className="space-y-4 pt-2">
            {/* Patient Search */}
            <div className="space-y-1.5">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Patient
              </Label>
              {selectedPatient ? (
                <div className="flex items-center gap-2 rounded-lg border p-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <UserRound className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      MRN: {selectedPatient.mrn || '-'}
                    </p>
                  </div>
                  {!lockPatient && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedPatient(null)}>
                      Change
                    </Button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search patient by name or MRN..."
                    value={patientQuery}
                    onChange={(e) => {
                      setPatientQuery(e.target.value);
                      setShowPatientDropdown(true);
                    }}
                    onFocus={() => setShowPatientDropdown(true)}
                    className="pl-8 h-9 text-sm"
                  />
                  {showPatientDropdown && debouncedPatientQuery.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                      {patientsLoading ? (
                        <div className="flex items-center justify-center p-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-xs text-muted-foreground">Searching...</span>
                        </div>
                      ) : patientResults && patientResults.length > 0 ? (
                        patientResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                            onClick={() =>
                              handleSelectPatient({
                                id: p.id,
                                firstName: p.firstName || '',
                                lastName: p.lastName || '',
                                mrn: p.mrn,
                              })
                            }
                          >
                            <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium">
                              {p.firstName} {p.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto">{p.mrn || ''}</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-muted-foreground">No patients found</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Prescription Type */}
            <div className="space-y-1.5">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Prescription Type
              </Label>
              <div className="flex items-center gap-3">
                {(['op', 'ip'] as const).map((type) => (
                  <label
                    key={type}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 cursor-pointer transition-all',
                      prescriptionType === type
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30',
                    )}
                  >
                    <input
                      type="radio"
                      name="prescriptionType"
                      value={type}
                      checked={prescriptionType === type}
                      onChange={() => setPrescriptionType(type)}
                      className="accent-primary h-3.5 w-3.5"
                    />
                    <span className="text-sm font-medium">{type === 'op' ? 'Out Patient (OP)' : 'In Patient (IP)'}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Visit Selector */}
            {selectedPatient && (
              <div className="space-y-1.5">
                <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Visit
                </Label>
                {visitsLoading ? (
                  <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading visits...
                  </div>
                ) : visits.length > 0 ? (
                  <Select value={selectedVisitId} onValueChange={(v) => { if (v) setSelectedVisitId(v); }}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Select a visit" />
                    </SelectTrigger>
                    <SelectContent>
                      {visits.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.visitType.toUpperCase()} - {formatDate(v.visitDate)} {v.status ? `(${v.status})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-label text-xs p-2 rounded-lg bg-secondary/10 text-secondary">
                    No active visits found for this patient. A visit must be created first.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Add Drugs */}
        {step === 2 && (
          <div className="space-y-4 pt-2">
            {/* Drug Search */}
            <div className="space-y-1.5">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Search Drug
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search drug from formulary..."
                  value={drugSearchQuery}
                  onChange={(e) => {
                    setDrugSearchQuery(e.target.value);
                    setShowDrugDropdown(true);
                  }}
                  onFocus={() => setShowDrugDropdown(true)}
                  className="pl-8 h-9 text-sm"
                />
                {showDrugDropdown && debouncedDrugQuery.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                    {formularyLoading ? (
                      <div className="flex items-center justify-center p-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-xs text-muted-foreground">Searching...</span>
                      </div>
                    ) : formularyResults && formularyResults.length > 0 ? (
                      formularyResults.map((drug) => (
                        <button
                          key={drug.id ?? drug.drugMasterId ?? drug.drugName}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                          onClick={() => handleSelectDrug(drug)}
                        >
                          <Pill className="h-3.5 w-3.5 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{drug.drugName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {drug.genericName || ''} {drug.strength ? `| ${drug.strength}` : ''} {drug.dosageForm ? `| ${drug.dosageForm}` : ''}
                            </p>
                          </div>
                          {drug.price != null && (
                            <span className="text-xs text-muted-foreground shrink-0">Rs. {drug.price}</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-muted-foreground">No drugs found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Allergy Warning */}
            {allergyResult && allergyResult.hasAllergy && (
              <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3">
                <AlertTriangle className="h-4 w-4 text-error shrink-0 mt-0.5" />
                <div>
                  <p className="font-label text-sm font-semibold text-error">Allergy Alert</p>
                  <p className="font-label text-xs text-error mt-0.5">
                    This patient has known allergies related to this drug:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {allergyResult.matchedAllergies.map((a) => (
                      <li key={a.id} className="font-label text-xs text-error">
                        - {a.allergen} {a.reaction ? `(Reaction: ${a.reaction})` : ''} - Severity: {a.severity}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Drug Item Form */}
            {currentDrugItem.drugName && (
              <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{currentDrugItem.drugName}</p>
                  {currentDrugItem.genericName && (
                    <span className="text-xs text-muted-foreground">{currentDrugItem.genericName}</span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Dosage</Label>
                    <Input
                      placeholder="e.g., 500mg"
                      value={currentDrugItem.dosage}
                      onChange={(e) => setCurrentDrugItem((prev) => ({ ...prev, dosage: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Frequency</Label>
                    <Select
                      value={currentDrugItem.frequency}
                      onValueChange={(v) => { if (v) setCurrentDrugItem((prev) => ({ ...prev, frequency: v })); }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Duration</Label>
                    <Input
                      placeholder="e.g., 5 days"
                      value={currentDrugItem.duration}
                      onChange={(e) => setCurrentDrugItem((prev) => ({ ...prev, duration: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Route</Label>
                    <Select
                      value={currentDrugItem.route}
                      onValueChange={(v) => { if (v) setCurrentDrugItem((prev) => ({ ...prev, route: v })); }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROUTE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={currentDrugItem.quantity}
                      onChange={(e) => setCurrentDrugItem((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Instructions</Label>
                  <Textarea
                    placeholder="Special instructions for this drug..."
                    value={currentDrugItem.instructions}
                    onChange={(e) => setCurrentDrugItem((prev) => ({ ...prev, instructions: e.target.value }))}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                <Button size="sm" className="gap-1.5" onClick={handleAddDrugItem}>
                  <Plus className="h-3.5 w-3.5" />
                  Add to Prescription
                </Button>
              </div>
            )}

            {/* Added Drug Items List */}
            {drugItems.length > 0 && (
              <div className="space-y-2">
                <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Prescription Items ({drugItems.length})
                </Label>
                <div className="space-y-2">
                  {drugItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-lg border p-3 bg-surface-container-lowest"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{item.drugName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.dosage} | {item.frequency} | {item.duration} | {item.route} | Qty: {item.quantity}
                        </p>
                        {item.instructions && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">
                            {item.instructions}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                        onClick={() => handleRemoveDrugItem(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drugItems.length === 0 && !currentDrugItem.drugName && (
              <div className="rounded-lg border-2 border-dashed p-6 text-center">
                <Pill className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Search and add drugs to the prescription
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review & Save */}
        {step === 3 && (
          <div className="space-y-4 pt-2">
            {/* Patient Summary */}
            <div className="rounded-lg border p-3">
              <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Patient</p>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  <UserRound className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {selectedPatient?.firstName} {selectedPatient?.lastName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    MRN: {selectedPatient?.mrn || '-'} | Type: {prescriptionType.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            {/* Drug Items Summary */}
            <div className="rounded-lg border p-3">
              <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
                Drugs ({drugItems.length})
              </p>
              <div className="divide-y">
                {drugItems.map((item, index) => (
                  <div key={index} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-primary mt-0.5">{index + 1}.</span>
                      <div>
                        <p className="text-sm font-medium">{item.drugName}</p>
                        {item.genericName && (
                          <p className="text-[10px] text-muted-foreground">{item.genericName}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.dosage} | {item.frequency} | {item.duration} | {item.route} | Qty: {item.quantity}
                        </p>
                        {item.instructions && (
                          <p className="text-xs text-muted-foreground italic mt-0.5">{item.instructions}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Notes (optional)
              </Label>
              <Textarea
                placeholder="Additional notes for the prescription..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            {step < 3 ? (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              >
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSave}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                Save Prescription
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── View Prescription Dialog ─────────────────────────────────

function ViewPrescriptionDialog({
  open,
  onOpenChange,
  prescriptionId,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prescriptionId: string;
  onCancel: (id: string) => void;
}) {
  const { data: prescription, isLoading } = usePrescriptionDetail(open ? prescriptionId : '');
  const updateItemMutation = useUpdatePrescriptionItem();
  const addItemMutation = useAddPrescriptionItem();
  const removeItemMutation = useRemovePrescriptionItem();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Add-drug state (only shown within 24h edit window)
  const [addingDrug, setAddingDrug] = useState(false);
  const [newDrug, setNewDrug] = useState<DrugFormItem>(emptyDrugItem());
  const [newDrugSearch, setNewDrugSearch] = useState('');
  const [debouncedNewDrugSearch, setDebouncedNewDrugSearch] = useState('');
  const [showNewDrugDropdown, setShowNewDrugDropdown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedNewDrugSearch(newDrugSearch), 400);
    return () => clearTimeout(t);
  }, [newDrugSearch]);
  const { data: newDrugResults, isLoading: newDrugLoading } = useFormularySearch(debouncedNewDrugSearch);
  const { data: newDrugAllergy } = useAllergyCheck(
    prescription?.patient?.id || '',
    newDrug.drugName,
  );

  // 24-hour edit window check
  const isEditable = prescription
    ? (Date.now() - new Date(prescription.createdAt).getTime()) / (1000 * 60 * 60) <= 24
      && prescription.status === 'active'
    : false;

  const editHoursLeft = prescription
    ? Math.max(0, Math.floor(24 - (Date.now() - new Date(prescription.createdAt).getTime()) / (1000 * 60 * 60)))
    : 0;

  const startEditing = useCallback((item: any) => {
    setEditingItemId(item.id);
    setEditValues({
      dosage: item.dosage || '',
      frequency: item.frequency || '',
      duration: item.duration || '',
      route: item.route || '',
      instructions: item.instructions || '',
    });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingItemId(null);
    setEditValues({});
  }, []);

  const saveEditing = useCallback(() => {
    if (!editingItemId || !prescription) return;
    updateItemMutation.mutate(
      {
        prescriptionId: prescription.id,
        itemId: editingItemId,
        dosage: editValues.dosage,
        frequency: editValues.frequency,
        duration: editValues.duration,
        route: editValues.route,
        instructions: editValues.instructions,
      },
      {
        onSuccess: () => {
          toast.success('Prescription item updated');
          setEditingItemId(null);
          setEditValues({});
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || 'Failed to update');
        },
      },
    );
  }, [editingItemId, editValues, prescription, updateItemMutation]);

  const resetAddDrug = useCallback(() => {
    setAddingDrug(false);
    setNewDrug(emptyDrugItem());
    setNewDrugSearch('');
    setDebouncedNewDrugSearch('');
    setShowNewDrugDropdown(false);
  }, []);

  const handleSelectNewDrug = useCallback((drug: FormularyDrug) => {
    setNewDrug({
      ...emptyDrugItem(),
      drugName: drug.drugName,
      genericName: drug.genericName || '',
      dosage: drug.strength || '',
    });
    setNewDrugSearch('');
    setDebouncedNewDrugSearch('');
    setShowNewDrugDropdown(false);
  }, []);

  const handleAddNewDrug = useCallback(() => {
    if (!prescription) return;
    if (!newDrug.drugName || !newDrug.dosage || !newDrug.duration) {
      toast.error('Please fill in drug name, dosage, and duration');
      return;
    }
    addItemMutation.mutate(
      {
        prescriptionId: prescription.id,
        drugName: newDrug.drugName,
        dosage: newDrug.dosage,
        frequency: newDrug.frequency,
        duration: newDrug.duration,
        route: newDrug.route.toLowerCase(),
        instructions: newDrug.instructions || undefined,
        quantity: newDrug.quantity,
      },
      {
        onSuccess: () => {
          toast.success('Drug added to prescription');
          resetAddDrug();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || 'Failed to add drug');
        },
      },
    );
  }, [prescription, newDrug, addItemMutation, resetAddDrug]);

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      if (!prescription) return;
      if (!window.confirm('Remove this drug from the prescription?')) return;
      removeItemMutation.mutate(
        { prescriptionId: prescription.id, itemId },
        {
          onSuccess: () => toast.success('Drug removed'),
          onError: (err: any) =>
            toast.error(err?.response?.data?.message || 'Failed to remove drug'),
        },
      );
    },
    [prescription, removeItemMutation],
  );

  const handlePrint = useCallback(() => {
    if (!prescription) return;
    printPrescription(prescription);
  }, [prescription]);

  const statusStyle = prescription ? (STATUS_BADGE_STYLES[prescription.status] || 'bg-surface-container-high text-on-surface-variant') : '';
  const statusLabel = prescription
    ? prescription.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  return (
    <Dialog open={open} onOpenChange={(v) => { cancelEditing(); resetAddDrug(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Prescription Details
            {prescription && isEditable && (
              <span className="text-[10px] font-medium text-secondary flex items-center gap-1 ml-auto">
                <Clock className="h-3 w-3" />
                {editHoursLeft}h left to edit
              </span>
            )}
            {prescription && !isEditable && prescription.status === 'active' && (
              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 ml-auto">
                <Shield className="h-3 w-3" />
                Locked (24h expired)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !prescription ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading prescription...</span>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Patient & Doctor Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1.5">Patient</p>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <UserRound className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {prescription.patient
                        ? `${prescription.patient.firstName || ''} ${prescription.patient.lastName || ''}`.trim()
                        : 'Unknown'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">MRN: {prescription.patient?.mrn || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1.5">Doctor</p>
                <p className="text-sm font-semibold">
                  {prescription.doctor?.user
                    ? `Dr. ${prescription.doctor.user.firstName || ''} ${prescription.doctor.user.lastName || ''}`.trim()
                    : '-'}
                </p>
                <p className="text-[10px] text-muted-foreground">{formatDateTimeAmPm(prescription.createdAt)}</p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusStyle)}>
                {statusLabel}
              </span>
            </div>

            {/* Drug Items — with inline editing */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Drug</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Dosage</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Frequency</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Duration</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Route</th>
                    {isEditable && <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant w-24">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {prescription.items.map((item: any, index: number) => {
                    const isEditingThis = editingItemId === item.id;

                    return (
                      <tr key={item.id || index} className={cn('border-t border-border/50', isEditingThis && 'bg-secondary/10')}>
                        <td className="px-3 py-2 text-xs font-bold text-primary align-top">{index + 1}</td>
                        <td className="px-3 py-2 align-top">
                          <p className="text-sm font-medium">{item.drugName}</p>
                          {item.genericName && (
                            <p className="text-[10px] text-muted-foreground">{item.genericName}</p>
                          )}
                          {isEditingThis ? (
                            <Input
                              value={editValues.instructions}
                              onChange={(e) => setEditValues((v) => ({ ...v, instructions: e.target.value }))}
                              placeholder="Instructions..."
                              className="mt-1 h-7 text-xs"
                            />
                          ) : (
                            item.instructions && (
                              <p className="text-[10px] text-muted-foreground italic mt-0.5">
                                {item.instructions}
                              </p>
                            )
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {isEditingThis ? (
                            <Input
                              value={editValues.dosage}
                              onChange={(e) => setEditValues((v) => ({ ...v, dosage: e.target.value }))}
                              className="h-7 text-xs w-20"
                            />
                          ) : (
                            <span className="text-sm">{item.dosage}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {isEditingThis ? (
                            <Input
                              value={editValues.frequency}
                              onChange={(e) => setEditValues((v) => ({ ...v, frequency: e.target.value }))}
                              className="h-7 text-xs w-24"
                            />
                          ) : (
                            <span className="text-sm">{item.frequency}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {isEditingThis ? (
                            <Input
                              value={editValues.duration}
                              onChange={(e) => setEditValues((v) => ({ ...v, duration: e.target.value }))}
                              className="h-7 text-xs w-20"
                            />
                          ) : (
                            <span className="text-sm">{item.duration}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {isEditingThis ? (
                            <Input
                              value={editValues.route}
                              onChange={(e) => setEditValues((v) => ({ ...v, route: e.target.value }))}
                              className="h-7 text-xs w-16"
                            />
                          ) : (
                            <span className="text-sm">{item.route || '-'}</span>
                          )}
                        </td>
                        {isEditable && (
                          <td className="px-3 py-2 text-center align-top">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1 justify-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-primary hover:text-primary/80"
                                  onClick={saveEditing}
                                  disabled={updateItemMutation.isPending}
                                >
                                  {updateItemMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={cancelEditing}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 justify-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  title="Edit item"
                                  onClick={() => startEditing(item)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  title="Remove item"
                                  onClick={() => handleRemoveItem(item.id)}
                                  disabled={removeItemMutation.isPending}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add Drug (within 24h edit window) */}
            {isEditable && (
              <div className="rounded-lg border border-dashed p-3 space-y-3">
                {!addingDrug ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 w-full"
                    onClick={() => setAddingDrug(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Drug
                  </Button>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                        Add a new drug
                      </p>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={resetAddDrug}>
                        Cancel
                      </Button>
                    </div>

                    {/* Formulary search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search drug from formulary..."
                        value={newDrugSearch}
                        onChange={(e) => {
                          setNewDrugSearch(e.target.value);
                          setShowNewDrugDropdown(true);
                        }}
                        onFocus={() => setShowNewDrugDropdown(true)}
                        className="pl-8 h-9 text-sm"
                      />
                      {showNewDrugDropdown && debouncedNewDrugSearch.length >= 2 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                          {newDrugLoading ? (
                            <div className="flex items-center justify-center p-3">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              <span className="ml-2 text-xs text-muted-foreground">Searching...</span>
                            </div>
                          ) : newDrugResults && newDrugResults.length > 0 ? (
                            newDrugResults.map((drug) => (
                              <button
                                key={drug.id ?? drug.drugMasterId ?? drug.drugName}
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                                onClick={() => handleSelectNewDrug(drug)}
                              >
                                <Pill className="h-3.5 w-3.5 text-primary shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{drug.drugName}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {drug.genericName || ''} {drug.strength ? `| ${drug.strength}` : ''} {drug.dosageForm ? `| ${drug.dosageForm}` : ''}
                                  </p>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-center text-xs text-muted-foreground">No drugs found</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Allergy Warning */}
                    {newDrugAllergy?.hasAllergy && (
                      <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3">
                        <AlertTriangle className="h-4 w-4 text-error shrink-0 mt-0.5" />
                        <div>
                          <p className="font-label text-sm font-semibold text-error">Allergy Alert</p>
                          <ul className="mt-1 space-y-0.5">
                            {newDrugAllergy.matchedAllergies.map((a) => (
                              <li key={a.id} className="font-label text-xs text-error">
                                - {a.allergen} {a.reaction ? `(Reaction: ${a.reaction})` : ''} - Severity: {a.severity}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Drug fields */}
                    {newDrug.drugName && (
                      <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">{newDrug.drugName}</p>
                          {newDrug.genericName && (
                            <span className="text-xs text-muted-foreground">{newDrug.genericName}</span>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Dosage</Label>
                            <Input
                              placeholder="e.g., 500mg"
                              value={newDrug.dosage}
                              onChange={(e) => setNewDrug((prev) => ({ ...prev, dosage: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Frequency</Label>
                            <Select
                              value={newDrug.frequency}
                              onValueChange={(v) => { if (v) setNewDrug((prev) => ({ ...prev, frequency: v })); }}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FREQUENCY_OPTIONS.map((f) => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Duration</Label>
                            <Input
                              placeholder="e.g., 5 days"
                              value={newDrug.duration}
                              onChange={(e) => setNewDrug((prev) => ({ ...prev, duration: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Route</Label>
                            <Select
                              value={newDrug.route}
                              onValueChange={(v) => { if (v) setNewDrug((prev) => ({ ...prev, route: v })); }}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROUTE_OPTIONS.map((r) => (
                                  <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Quantity</Label>
                            <Input
                              type="number"
                              min={1}
                              value={newDrug.quantity}
                              onChange={(e) => setNewDrug((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Instructions</Label>
                          <Textarea
                            placeholder="Special instructions for this drug..."
                            value={newDrug.instructions}
                            onChange={(e) => setNewDrug((prev) => ({ ...prev, instructions: e.target.value }))}
                            rows={2}
                            className="text-sm resize-none"
                          />
                        </div>

                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={handleAddNewDrug}
                          disabled={addItemMutation.isPending}
                        >
                          {addItemMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          Add to Prescription
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Notes */}
            {prescription.notes && (
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Notes</p>
                <p className="text-sm text-foreground whitespace-pre-line">{prescription.notes}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {prescription && prescription.status === 'active' && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 mr-auto"
              onClick={() => onCancel(prescription.id)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel Prescription
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint} disabled={!prescription}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
