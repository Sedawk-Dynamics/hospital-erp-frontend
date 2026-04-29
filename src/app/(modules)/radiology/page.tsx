'use client';

import { useMemo, useState } from 'react';
import { formatDateTime, toInputDateStr } from '@/lib/date-utils';
import {
  Search, Calendar, Activity, Clock, CheckCircle2, Loader2,
  CalendarPlus, ImagePlus, ShieldCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import {
  useImagingRequests,
  useScheduleImaging,
  useUploadImagingResult,
  useAddImagingReport,
  useVerifyImagingResult,
  useImagingResults,
  type ImagingRequest,
  type ImagingResult,
} from '@/hooks/use-imaging';
import { useUsersList } from '@/hooks/use-users';
import { cn } from '@/lib/utils';
import { PatientFormSubmissionsPanel } from '@/components/forms/patient-form-submissions-panel';
import { toast } from 'sonner';

export default function RadiologyHomePage() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Radiology Home"
        description="Schedule imaging studies, upload results, and publish reports"
      />

      <Tabs defaultValue="dashboard">
        <TabsList variant="line">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="pt-4"><DashboardTab /></TabsContent>
        <TabsContent value="pending" className="pt-4"><RequestList status="requested" /></TabsContent>
        <TabsContent value="scheduled" className="pt-4"><RequestList status="scheduled" /></TabsContent>
        <TabsContent value="completed" className="pt-4"><RequestList status="completed" /></TabsContent>
        <TabsContent value="results" className="pt-4"><ResultsTab /></TabsContent>
      </Tabs>

      <PatientFormSubmissionsPanel
        title="Radiology Forms Submissions"
        viewLocation="radiology_home"
      />
    </div>
  );
}

// ============================================================
// Dashboard Tab — stats by status
// ============================================================
function DashboardTab() {
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(toInputDateStr());

  const { data, isLoading } = useImagingRequests({
    limit: 100,
    search: search || undefined,
    date: date || undefined,
  });

  const requests = (data?.data ?? []) as ImagingRequest[];

  const stats = useMemo(() => {
    let pending = 0, scheduled = 0, inProgress = 0, completed = 0;
    for (const r of requests) {
      if (r.status === 'requested') pending++;
      else if (r.status === 'scheduled') scheduled++;
      else if (r.status === 'in_progress') inProgress++;
      else if (r.status === 'completed') completed++;
    }
    return { pending, scheduled, inProgress, completed };
  }, [requests]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Pending" value={stats.pending} icon={Clock} className="bg-amber-50 text-amber-700" />
        <StatCard label="Scheduled" value={stats.scheduled} icon={Calendar} className="bg-blue-50 text-blue-700" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Loader2} className="bg-purple-50 text-purple-700" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} className="bg-emerald-50 text-emerald-700" />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
      </div>

      <RequestTable requests={requests} loading={isLoading} />
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, className,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl bg-surface-container-lowest shadow-sanctuary p-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide">{label}</p>
          <p className="font-headline text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="size-6" />
      </div>
    </div>
  );
}

// ============================================================
// Request list per status
// ============================================================
function RequestList({ status }: { status: string }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useImagingRequests({
    status,
    page,
    limit: 20,
    search: search || undefined,
  });

  const requests = (data?.data ?? []) as ImagingRequest[];

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
      </div>
      <RequestTable requests={requests} loading={isLoading} />
      {(data?.meta?.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">Page {page} of {data?.meta?.totalPages}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= (data?.meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestTable({ requests, loading }: { requests: ImagingRequest[]; loading: boolean }) {
  const [scheduleFor, setScheduleFor] = useState<ImagingRequest | null>(null);
  const [uploadFor, setUploadFor] = useState<ImagingRequest | null>(null);

  return (
    <>
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <Th>Patient</Th>
                <Th>Type</Th>
                <Th>Body Part</Th>
                <Th>Urgency</Th>
                <Th>Status</Th>
                <Th>Scheduled</Th>
                <Th>Technician</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center"><Loader2 className="size-5 animate-spin inline-block" /></td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No imaging requests.</td></tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 font-medium">
                      {r.patient?.firstName} {r.patient?.lastName}
                    </td>
                    <td className="px-4 py-3 capitalize">{r.imagingType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">{r.bodyPart ?? '-'}</td>
                    <td className="px-4 py-3"><Badge>{r.urgency ?? r.priority ?? 'routine'}</Badge></td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs">
                      {r.scheduledAt ? formatDateTime(r.scheduledAt) : '-'}
                      {r.room && <div className="text-muted-foreground">Room: {r.room}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.assignedTechnician
                        ? `${r.assignedTechnician.firstName} ${r.assignedTechnician.lastName}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        {(r.status === 'requested' || r.status === 'scheduled') && (
                          <Button size="sm" variant="outline" onClick={() => setScheduleFor(r)}>
                            <CalendarPlus className="size-3.5" /> Schedule
                          </Button>
                        )}
                        {r.status !== 'completed' && r.status !== 'cancelled' && !r.imagingResult && (
                          <Button size="sm" onClick={() => setUploadFor(r)}>
                            <ImagePlus className="size-3.5" /> Upload Result
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ScheduleDialog request={scheduleFor} onOpenChange={(open) => !open && setScheduleFor(null)} />
      <UploadResultDialog request={uploadFor} onOpenChange={(open) => !open && setUploadFor(null)} />
    </>
  );
}

// ============================================================
// Schedule Dialog (date + technician + room)
// ============================================================
function ScheduleDialog({
  request, onOpenChange,
}: {
  request: ImagingRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  const schedule = useScheduleImaging();
  const usersQ = useUsersList({ limit: 200 });

  const techs = useMemo(
    () =>
      (usersQ.data?.data ?? []).filter((u) =>
        u.userRoles?.some((ur) => ['radiologist', 'lab_technician'].includes(ur.role.name)),
      ),
    [usersQ.data],
  );

  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [techId, setTechId] = useState('');
  const [room, setRoom] = useState('');

  const handle = async () => {
    if (!request) return;
    if (!date) { toast.error('Pick a date'); return; }
    try {
      await schedule.mutateAsync({
        id: request.id,
        scheduledDate: date,
        scheduledTime: time,
        assignedTechnicianId: techId || undefined,
        room: room || undefined,
      });
      toast.success('Scheduled');
      setDate(''); setTime('09:00'); setTechId(''); setRoom('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to schedule');
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Imaging</DialogTitle>
          <DialogDescription>Assign date, room, and technician.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Technician</Label>
            <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm" value={techId} onChange={(e) => setTechId(e.target.value)}>
              <option value="">-- Select technician --</option>
              {techs.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Room</Label>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Radiology Room 2" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={schedule.isPending}>Cancel</Button>
          <Button onClick={handle} disabled={schedule.isPending}>{schedule.isPending ? 'Saving…' : 'Schedule'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Upload Result Dialog
// ============================================================
function UploadResultDialog({
  request, onOpenChange,
}: {
  request: ImagingRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  const upload = useUploadImagingResult();
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [imageUrls, setImageUrls] = useState('');
  const [pacsRef, setPacsRef] = useState('');

  const handle = async () => {
    if (!request) return;
    if (!findings.trim()) { toast.error('Findings are required'); return; }
    try {
      const urls = imageUrls
        .split(/\s|,|\n/)
        .map((u) => u.trim())
        .filter((u) => /^https?:\/\//i.test(u));
      await upload.mutateAsync({
        imagingRequestId: request.id,
        patientId: request.patientId,
        findings,
        impression: impression || undefined,
        imageUrls: urls.length ? urls : undefined,
        pacsReferenceId: pacsRef || undefined,
      });
      toast.success('Result uploaded');
      setFindings(''); setImpression(''); setImageUrls(''); setPacsRef('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to upload');
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Imaging Result</DialogTitle>
          <DialogDescription>
            Attach images (URLs from PACS or upload service) and structured findings/impression.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Findings *</Label>
            <Textarea rows={4} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Detailed findings…" />
          </div>
          <div>
            <Label>Impression</Label>
            <Textarea rows={3} value={impression} onChange={(e) => setImpression(e.target.value)} placeholder="Summary impression…" />
          </div>
          <div>
            <Label>Image URLs</Label>
            <Textarea
              rows={2}
              value={imageUrls}
              onChange={(e) => setImageUrls(e.target.value)}
              placeholder="https://…  https://…"
            />
            <p className="text-xs text-muted-foreground mt-1">One per line, comma, or space separated.</p>
          </div>
          <div>
            <Label>PACS Reference</Label>
            <Input value={pacsRef} onChange={(e) => setPacsRef(e.target.value)} placeholder="Optional PACS study UID" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={upload.isPending}>Cancel</Button>
          <Button onClick={handle} disabled={upload.isPending}>{upload.isPending ? 'Saving…' : 'Save Result'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Results Tab — finalize/sign/publish
// ============================================================
function ResultsTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useImagingResults({ page, limit: 20 });
  const results = (data?.data ?? []) as ImagingResult[];

  const addReport = useAddImagingReport();
  const verify = useVerifyImagingResult();

  const [reportFor, setReportFor] = useState<ImagingResult | null>(null);

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <Th>Patient</Th>
              <Th>Modality</Th>
              <Th>Status</Th>
              <Th>Radiologist</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="size-5 animate-spin inline-block" /></td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No results yet.</td></tr>
            ) : (
              results.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3">{(r as any).patient?.firstName} {(r as any).patient?.lastName}</td>
                  <td className="px-4 py-3 capitalize">{r.imagingRequest?.imagingType ?? (r as any).request?.imagingType ?? '-'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    {r.radiologist
                      ? `${r.radiologist.firstName} ${r.radiologist.lastName}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {r.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => setReportFor(r)}>Add Report</Button>
                      )}
                      {r.status === 'finalized' && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await verify.mutateAsync(r.id);
                              toast.success('Result verified & published');
                            } catch (err: any) {
                              toast.error(err?.response?.data?.message ?? 'Failed to verify');
                            }
                          }}
                          disabled={verify.isPending}
                        >
                          <ShieldCheck className="size-3.5" /> Sign & Publish
                        </Button>
                      )}
                      {r.pdfReportUrl && (
                        <a className="text-xs underline px-2 py-1" href={r.pdfReportUrl} target="_blank" rel="noreferrer">PDF</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddReportDialog
        result={reportFor}
        onOpenChange={(open) => !open && setReportFor(null)}
        onSubmit={async (payload) => {
          if (!reportFor) return;
          try {
            await addReport.mutateAsync({ id: reportFor.id, ...payload });
            toast.success('Report added');
            setReportFor(null);
          } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed');
          }
        }}
        pending={addReport.isPending}
      />

      {(data?.meta?.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">Page {page} of {data?.meta?.totalPages}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= (data?.meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddReportDialog({
  result, onOpenChange, onSubmit, pending,
}: {
  result: ImagingResult | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { findings: string; impression?: string; recommendation?: string; pdfReportUrl?: string }) => void;
  pending: boolean;
}) {
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [pdfReportUrl, setPdfReportUrl] = useState('');

  return (
    <Dialog open={!!result} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Final Report</DialogTitle>
          <DialogDescription>Finalize findings and an interpretation for sign-off.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Findings *</Label>
            <Textarea rows={4} value={findings} onChange={(e) => setFindings(e.target.value)} />
          </div>
          <div>
            <Label>Impression</Label>
            <Textarea rows={3} value={impression} onChange={(e) => setImpression(e.target.value)} />
          </div>
          <div>
            <Label>Recommendation</Label>
            <Textarea rows={2} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />
          </div>
          <div>
            <Label>PDF Report URL</Label>
            <Input value={pdfReportUrl} onChange={(e) => setPdfReportUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button
            disabled={pending || !findings.trim()}
            onClick={() =>
              onSubmit({
                findings,
                impression: impression || undefined,
                recommendation: recommendation || undefined,
                pdfReportUrl: pdfReportUrl || undefined,
              })
            }
          >
            {pending ? 'Saving…' : 'Save Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
      {children}
    </th>
  );
}
