'use client';

import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDate as formatDateUtil, formatTime as formatTimeUtil, toInputDateStr } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  CheckCircle2,
  CalendarClock,
  CalendarDays,
  Eye,
  Loader2,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useOTRequests,
  useCreateOTRequest,
  useApproveOTRequest,
  useScheduleOT,
  useUpdateOTRequest,
  useOperatingTheaters,
  type OTRequest,
} from '@/hooks/use-ot';
import { useDoctorsList, usePatientSearch } from '@/hooks/use-hospital';

// ============================================================
// Constants
// ============================================================

// Status keys match the backend OtRequestStatus enum. We surface
// `requested` as "Pending" in the UI to align with the EmedHub vocabulary
// the OT team uses verbally.
const STAT_ITEMS = [
  { key: 'all', label: 'All', color: 'text-foreground' },
  { key: 'requested', label: 'Pending', color: 'text-amber-600' },
  { key: 'scheduled', label: 'Scheduled', color: 'text-blue-600' },
  { key: 'in_progress', label: 'In Progress', color: 'text-purple-600' },
  { key: 'completed', label: 'Completed', color: 'text-teal-600' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-red-600' },
];

const STATUS_BADGE_CLASSES: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-700 border-amber-300',
  scheduled: 'bg-blue-100 text-blue-700 border-blue-300',
  in_progress: 'bg-purple-100 text-purple-700 border-purple-300',
  completed: 'bg-teal-100 text-teal-700 border-teal-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
};

const SURGERY_TYPES = ['Major', 'Minor', 'Emergency', 'Elective', 'Day Case'];
const SPECIALITIES = [
  'General Surgery',
  'Orthopaedics',
  'Gynaecology',
  'ENT',
  'Ophthalmology',
  'Urology',
  'Neurosurgery',
  'Cardiothoracic',
  'Plastic Surgery',
  'Paediatric Surgery',
];
const PRIORITIES = ['routine', 'urgent', 'emergency'];

// ============================================================
// Zod Schemas
// ============================================================

const createOTSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  surgeryName: z.string().min(1, 'Surgery name is required'),
  surgeryType: z.string().optional(),
  speciality: z.string().optional(),
  surgeonId: z.string().optional(),
  anaesthetistId: z.string().optional(),
  scheduledDate: z.string().optional(),
  scheduledStartTime: z.string().optional(),
  scheduledEndTime: z.string().optional(),
  estimatedDuration: z.string().optional(),
  priority: z.string().optional(),
  preOpDiagnosis: z.string().optional(),
  notes: z.string().optional(),
});

type CreateOTFormValues = z.infer<typeof createOTSchema>;

const scheduleSchema = z.object({
  scheduledDate: z.string().min(1, 'Date is required'),
  scheduledStartTime: z.string().min(1, 'Start time is required'),
  scheduledEndTime: z.string().optional(),
  otId: z.string().optional(),
  otName: z.string().optional(),
  surgeonId: z.string().optional(),
  anaesthetistId: z.string().optional(),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

// ============================================================
// Helpers
// ============================================================

function formatPatientName(req: OTRequest): string {
  if (req.patient) {
    return `${req.patient.firstName} ${req.patient.lastName}`.trim();
  }
  return req.patientId;
}

function formatDoctorName(doctor?: { user?: { firstName: string; lastName: string } } | null): string {
  if (!doctor?.user) return '-';
  return `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`.trim();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    return formatDateUtil(dateStr);
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  if (timeStr.includes('T')) {
    try {
      return formatTimeUtil(timeStr);
    } catch {
      return timeStr;
    }
  }
  // HH:mm format - convert to 12hr
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function statusLabel(status: string): string {
  // `requested` is shown to the OT team as "Pending" to keep the EmedHub wording.
  if (status === 'requested') return 'Pending';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================
// Main Page
// ============================================================

export default function OTHomePage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);

  // Dialogs
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<OTRequest | null>(null);

  const statusFilter = activeFilter === 'all' ? undefined : activeFilter;

  // Fetch OT requests (filtered)
  const { data, isLoading, isError } = useOTRequests({
    page,
    limit: 20,
    status: statusFilter,
    search: search.trim() || undefined,
    date: dateFilter || undefined,
  });

  const requests = data?.data ?? [];
  const meta = data?.meta;

  // Fetch all to compute stat counts
  const { data: allData } = useOTRequests({ limit: 1000 });
  const allRequests = allData?.data ?? [];

  const statCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allRequests.length };
    for (const req of allRequests) {
      const s = (req.status ?? 'unknown').toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [allRequests]);

  // Mutations
  const approveMutation = useApproveOTRequest();
  const updateMutation = useUpdateOTRequest();

  // Surgery lifecycle: scheduled → in_progress stamps the actual start,
  // in_progress → completed stamps the actual end (feeds OT utilization).
  const handleStartSurgery = useCallback(
    (id: string) => {
      updateMutation.mutate(
        { id, status: 'in_progress', actualStartTime: new Date().toISOString() },
        {
          onSuccess: () => toast.success('Surgery started'),
          onError: (err: any) => toast.error(err?.message ?? 'Failed to start surgery'),
        },
      );
    },
    [updateMutation]
  );

  const handleCompleteSurgery = useCallback(
    (id: string) => {
      updateMutation.mutate(
        { id, status: 'completed', actualEndTime: new Date().toISOString() },
        {
          onSuccess: () => toast.success('Surgery completed'),
          onError: (err: any) => toast.error(err?.message ?? 'Failed to complete surgery'),
        },
      );
    },
    [updateMutation]
  );

  const handleApprove = useCallback(
    (id: string) => {
      approveMutation.mutate(id, {
        onSuccess: () => toast.success('OT request approved'),
        onError: (err: any) => toast.error(err?.message ?? 'Failed to approve'),
      });
    },
    [approveMutation]
  );

  const openScheduleDialog = useCallback((req: OTRequest) => {
    setScheduleTarget(req);
    setScheduleDialogOpen(true);
  }, []);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">OT Home</h1>
        <Button onClick={() => setBookDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Book OT
        </Button>
      </div>

      {/* Stat pills */}
      <div className="flex gap-2 overflow-x-auto pb-3">
        {STAT_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setActiveFilter(item.key);
              setPage(1);
            }}
            className={cn(
              'flex flex-col items-center rounded-lg border-2 px-3 py-2 min-w-[80px] shadow-sm hover:-translate-y-0.5 transition-all duration-150',
              activeFilter === item.key
                ? 'border-primary bg-primary/10 shadow-md'
                : 'border-transparent bg-card hover:border-border'
            )}
          >
            <span className={cn('text-lg font-bold', item.color)}>
              {isLoading ? '-' : (statCounts[item.key] ?? 0)}
            </span>
            <span className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Search + Date filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient, surgery..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="relative w-full sm:w-auto">
          <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="pl-9 w-full sm:w-[180px]"
          />
        </div>
        {dateFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFilter('');
              setPage(1);
            }}
            className="text-muted-foreground"
          >
            Clear date
          </Button>
        )}
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load OT requests. Please try again.
        </div>
      )}

      {/* Data table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Patient Details
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">OT Name</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Surgery / Speciality
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Surgeon</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Anaesthetist
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading OT requests...</p>
                  </td>
                </tr>
              ) : !isError && requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Stethoscope className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No OT requests found
                      {activeFilter !== 'all'
                        ? ` with "${statusLabel(activeFilter)}" status`
                        : ''}
                      .
                    </p>
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Patient Details */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{formatPatientName(req)}</div>
                      {(req.patient?.uhid || req.patient?.mrn) && (
                        <div className="text-xs text-muted-foreground">
                          UHID: {req.patient.uhid ?? req.patient.mrn}
                        </div>
                      )}
                      {req.scheduledDate && (
                        <div className="text-xs text-muted-foreground">
                          {formatDate(req.scheduledDate)}
                          {req.scheduledStartTime &&
                            ` | ${formatTime(req.scheduledStartTime)}`}
                          {req.scheduledEndTime &&
                            ` - ${formatTime(req.scheduledEndTime)}`}
                        </div>
                      )}
                    </td>

                    {/* OT Name */}
                    <td className="px-4 py-3 text-muted-foreground">{req.otName ?? '-'}</td>

                    {/* Surgery / Speciality */}
                    <td className="px-4 py-3">
                      <div className="font-medium">{req.surgeryName}</div>
                      {(req.surgeryType || req.speciality) && (
                        <div className="text-xs text-muted-foreground">
                          {[req.surgeryType, req.speciality].filter(Boolean).join(' | ')}
                        </div>
                      )}
                    </td>

                    {/* Surgeon */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDoctorName(req.surgeon)}
                    </td>

                    {/* Anaesthetist */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDoctorName(req.anaesthetist)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-medium',
                          STATUS_BADGE_CLASSES[req.status?.toLowerCase()] ??
                            'bg-gray-100 text-gray-700 border-gray-300'
                        )}
                      >
                        {statusLabel(req.status)}
                      </Badge>
                      {req.priority && req.priority !== 'routine' && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'ml-1 text-xs',
                            req.priority === 'emergency'
                              ? 'bg-red-100 text-red-700 border-red-300'
                              : 'bg-orange-100 text-orange-700 border-orange-300'
                          )}
                        >
                          {req.priority}
                        </Badge>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {req.status === 'requested' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleApprove(req.id)}
                              disabled={approveMutation.isPending}
                            >
                              {approveMutation.isPending ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => openScheduleDialog(req)}
                            >
                              <CalendarClock className="mr-1 h-3.5 w-3.5" />
                              Schedule
                            </Button>
                          </>
                        )}
                        {req.status === 'scheduled' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              onClick={() => handleStartSurgery(req.id)}
                              disabled={updateMutation.isPending}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Start
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => openScheduleDialog(req)}
                            >
                              <CalendarClock className="mr-1 h-3.5 w-3.5" />
                              Reschedule
                            </Button>
                          </>
                        )}
                        {req.status === 'in_progress' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                            onClick={() => handleCompleteSurgery(req.id)}
                            disabled={updateMutation.isPending}
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Complete
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              Showing {(meta.page - 1) * meta.limit + 1}-
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm">
                Page {page} of {meta.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Book OT Dialog */}
      <CreateOTDialog
        open={bookDialogOpen}
        onOpenChange={setBookDialogOpen}
      />

      {/* Schedule OT Dialog */}
      {scheduleTarget && (
        <ScheduleOTDialog
          request={scheduleTarget}
          open={scheduleDialogOpen}
          onOpenChange={(open) => {
            setScheduleDialogOpen(open);
            if (!open) setScheduleTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Create OT Dialog (React Hook Form + Zod)
// ============================================================

function CreateOTDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [patientQuery, setPatientQuery] = useState('');
  const { data: patients, isLoading: patientsLoading } = usePatientSearch(patientQuery);
  const { data: doctorsRaw } = useDoctorsList();
  const createMutation = useCreateOTRequest();

  const doctors = useMemo(
    () =>
      (doctorsRaw || []).map((d) => ({
        id: d.id || d.userId,
        name: `Dr. ${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim(),
      })),
    [doctorsRaw]
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateOTFormValues>({
    resolver: zodResolver(createOTSchema),
    defaultValues: {
      patientId: '',
      surgeryName: '',
      surgeryType: '',
      speciality: '',
      surgeonId: '',
      anaesthetistId: '',
      scheduledDate: '',
      scheduledStartTime: '',
      scheduledEndTime: '',
      estimatedDuration: '',
      priority: 'routine',
      preOpDiagnosis: '',
      notes: '',
    },
  });

  const selectedPatientId = watch('patientId');

  const selectedPatient = useMemo(() => {
    if (!selectedPatientId || !patients) return null;
    return patients.find((p) => p.id === selectedPatientId) ?? null;
  }, [selectedPatientId, patients]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    reset();
    setPatientQuery('');
  }, [onOpenChange, reset]);

  const onSubmit = (values: CreateOTFormValues) => {
    createMutation.mutate(
      {
        patientId: values.patientId,
        surgeryName: values.surgeryName,
        surgeryType: values.surgeryType || undefined,
        speciality: values.speciality || undefined,
        surgeonId: values.surgeonId || undefined,
        anaesthetistId: values.anaesthetistId || undefined,
        scheduledDate: values.scheduledDate || undefined,
        scheduledStartTime: values.scheduledStartTime || undefined,
        scheduledEndTime: values.scheduledEndTime || undefined,
        estimatedDuration: values.estimatedDuration
          ? Number(values.estimatedDuration)
          : undefined,
        priority: values.priority || undefined,
        preOpDiagnosis: values.preOpDiagnosis || undefined,
        notes: values.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('OT request created successfully');
          handleClose();
        },
        onError: (err: any) => {
          toast.error(err?.message ?? 'Failed to create OT request');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book OT Appointment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Patient Search */}
          <div className="space-y-1.5">
            <Label>Patient *</Label>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/30">
                <div>
                  <span className="font-medium">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </span>
                  {selectedPatient.mrn && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      MRN: {selectedPatient.mrn}
                    </span>
                  )}
                  {selectedPatient.phone && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {selectedPatient.phone}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setValue('patientId', '');
                    setPatientQuery('');
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  placeholder="Search by patient name or MRN..."
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                />
                {patientQuery.length >= 2 && (
                  <div className="rounded-md border bg-popover max-h-40 overflow-y-auto shadow-md">
                    {patientsLoading ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Searching...
                      </div>
                    ) : patients && patients.length > 0 ? (
                      patients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setValue('patientId', p.id, { shouldValidate: true });
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                        >
                          <span className="font-medium">
                            {p.firstName} {p.lastName}
                          </span>
                          {p.mrn && (
                            <span className="ml-2 text-muted-foreground">MRN: {p.mrn}</span>
                          )}
                          {p.phone && (
                            <span className="ml-2 text-muted-foreground">{p.phone}</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No patients found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {errors.patientId && (
              <p className="text-xs text-red-500">{errors.patientId.message}</p>
            )}
          </div>

          {/* Surgery Name + Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Surgery Name *</Label>
              <Input {...register('surgeryName')} placeholder="e.g., Appendectomy" />
              {errors.surgeryName && (
                <p className="text-xs text-red-500">{errors.surgeryName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Surgery Type</Label>
              <Select
                onValueChange={(v: string | null) => setValue('surgeryType', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {SURGERY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Speciality + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Speciality</Label>
              <Select
                onValueChange={(v: string | null) => setValue('speciality', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select speciality" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                defaultValue="routine"
                onValueChange={(v: string | null) => setValue('priority', v ?? 'routine')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Surgeon + Anaesthetist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Surgeon</Label>
              <Select
                onValueChange={(v: string | null) => setValue('surgeonId', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select surgeon" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                  {doctors.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No doctors found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Anaesthetist</Label>
              <Select
                onValueChange={(v: string | null) => setValue('anaesthetistId', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select anaesthetist" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                  {doctors.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No doctors found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Scheduled Date</Label>
              <Input type="date" {...register('scheduledDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Start Time</Label>
              <Input type="time" {...register('scheduledStartTime')} />
            </div>
            <div className="space-y-1.5">
              <Label>End Time</Label>
              <Input type="time" {...register('scheduledEndTime')} />
            </div>
          </div>

          {/* Duration + Pre-Op Diagnosis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Estimated Duration (min)</Label>
              <Input type="number" placeholder="e.g., 60" {...register('estimatedDuration')} />
            </div>
            <div className="space-y-1.5">
              <Label>Pre-Op Diagnosis</Label>
              <Input {...register('preOpDiagnosis')} placeholder="Diagnosis" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              {...register('notes')}
              placeholder="Additional notes..."
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              Book OT
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Schedule OT Dialog (React Hook Form + Zod)
// ============================================================

function ScheduleOTDialog({
  request,
  open,
  onOpenChange,
}: {
  request: OTRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const scheduleMutation = useScheduleOT();
  const { data: theaters } = useOperatingTheaters();
  const { data: doctorsRaw } = useDoctorsList();
  const doctors = useMemo(
    () => (doctorsRaw || []).map((d) => ({
      id: d.id || d.userId,
      name: `Dr. ${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim(),
    })),
    [doctorsRaw],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      scheduledDate: request.scheduledDate
        ? (() => {
            try {
              return toInputDateStr(request.scheduledDate);
            } catch {
              return '';
            }
          })()
        : '',
      scheduledStartTime: request.scheduledStartTime ?? '',
      scheduledEndTime: request.scheduledEndTime ?? '',
      otId: request.otId ?? '',
      otName: request.otName ?? request.ot?.name ?? '',
      surgeonId: request.surgeonId ?? '',
      anaesthetistId: request.anaesthetistId ?? '',
    },
  });

  const onSubmit = (values: ScheduleFormValues) => {
    scheduleMutation.mutate(
      {
        id: request.id,
        scheduledDate: values.scheduledDate,
        scheduledStartTime: values.scheduledStartTime,
        scheduledEndTime: values.scheduledEndTime || undefined,
        otId: values.otId || undefined,
        otName: values.otName || undefined,
        surgeonId: values.surgeonId || undefined,
        anaesthetistId: values.anaesthetistId || undefined,
      },
      {
        onSuccess: () => {
          toast.success('OT scheduled successfully');
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast.error(err?.message ?? 'Failed to schedule OT');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule OT</DialogTitle>
        </DialogHeader>

        {/* Request summary */}
        <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
          <p>
            <span className="font-medium">Patient:</span> {formatPatientName(request)}
          </p>
          <p>
            <span className="font-medium">Surgery:</span> {request.surgeryName}
          </p>
          {request.speciality && (
            <p>
              <span className="font-medium">Speciality:</span> {request.speciality}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Operating Theater</Label>
            <Select
              value={watch('otId') || 'none'}
              onValueChange={(v) => {
                if (v === 'none') {
                  setValue('otId', '');
                } else {
                  setValue('otId', v ?? '');
                  const t = theaters?.find((tt) => tt.id === v);
                  if (t) setValue('otName', t.name);
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select OT room" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Manual entry —</SelectItem>
                {(theaters ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.location ? ` · ${t.location}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input {...register('otName')} placeholder="Or enter OT name (e.g., OT-1)" className="mt-2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Surgeon</Label>
              <Select
                value={watch('surgeonId') || 'none'}
                onValueChange={(v) => setValue('surgeonId', v === 'none' ? '' : (v ?? ''))}
              >
                <SelectTrigger><SelectValue placeholder="Pick surgeon" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Anaesthetist</Label>
              <Select
                value={watch('anaesthetistId') || 'none'}
                onValueChange={(v) => setValue('anaesthetistId', v === 'none' ? '' : (v ?? ''))}
              >
                <SelectTrigger><SelectValue placeholder="Pick anaesthetist" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date *</Label>
            <Input type="date" {...register('scheduledDate')} />
            {errors.scheduledDate && (
              <p className="text-xs text-red-500">{errors.scheduledDate.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Start Time *</Label>
              <Input type="time" {...register('scheduledStartTime')} />
              {errors.scheduledStartTime && (
                <p className="text-xs text-red-500">{errors.scheduledStartTime.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>End Time</Label>
              <Input type="time" {...register('scheduledEndTime')} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={scheduleMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
