'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Search,
  ClipboardCheck,
  FlaskConical,
  Upload,
  CheckCircle2,
  Download,
  Trash2,
  FileText,
  FileImage,
  ClipboardEdit,
  Plus,
  Send,
  Eye,
  AlertTriangle,
  X as XIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useLabOrders,
  useLabReports,
  useAcceptLabOrder,
  useCollectSample,
  useUpdateSampleStatus,
  useCompleteLabOrderItem,
  useEnterResults,
  useVerifyResults,
  useSubmitLabReport,
  useLabOrder,
  type LabOrder,
} from '@/hooks/use-lab';
import { useUsersList } from '@/hooks/use-users';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useLabOrderAttachments,
  useUploadLabAttachment,
  useDeleteLabAttachment,
  resolveAttachmentUrl,
  formatFileSize,
  isImageMime,
  type LabAttachment,
} from '@/hooks/use-lab-attachments';
import { useLabRole } from '@/hooks/use-lab-role';
import { LabDashboardSummary } from '@/components/laboratory/lab-dashboard-summary';
import { LabReportPrintDialog } from '@/components/laboratory/lab-report-print-view';

export default function LaboratoryHomePage() {
  // Technicians get the worklist surface only: status, reports, order intake.
  // Workload-by-tech and outsourced-orders dashboards are supervisor management views.
  const { isSupervisor } = useLabRole();
  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Laboratory Home</h1>

      <LabDashboardSummary />

      <Tabs defaultValue="status">
        <TabsList variant="line">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="test-report">Test Report</TabsTrigger>
          {isSupervisor && <TabsTrigger value="technicians">For Technicians</TabsTrigger>}
          {isSupervisor && <TabsTrigger value="outsource">Outsource List</TabsTrigger>}
          <TabsTrigger value="order">Order</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="pt-4">
          <LabStatusTab />
        </TabsContent>
        <TabsContent value="test-report" className="pt-4">
          <TestReportTab />
        </TabsContent>
        {isSupervisor && (
          <TabsContent value="technicians" className="pt-4">
            <TechniciansTab />
          </TabsContent>
        )}
        {isSupervisor && (
          <TabsContent value="outsource" className="pt-4">
            <OutsourceTab />
          </TabsContent>
        )}
        <TabsContent value="order" className="pt-4">
          <IncomingOrderTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Status Tab — orders by status (sample collection lifecycle)
// ============================================================
function LabStatusTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [date, setDate] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useLabOrders({
    search: search || undefined,
    status: statusFilter,
    date: date || undefined,
    page,
    limit: 20,
  });

  const orders = data?.data ?? [];

  const [activeOrder, setActiveOrder] = useState<LabOrder | null>(null);
  const [collectFor, setCollectFor] = useState<LabOrder | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Search patient, MRN..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
        <select
          value={statusFilter ?? ''}
          onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ordered">Ordered</option>
          <option value="sample_collected">Sample Collected</option>
          <option value="in_transit">In Transit</option>
          <option value="received">Received</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <Input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1); }}
          className="w-44"
        />
      </div>

      <OrderTable
        orders={orders}
        loading={isLoading}
        emptyMsg="No lab orders found."
        onView={setActiveOrder}
        onCollect={setCollectFor}
      />

      <OrderDetailDialog
        order={activeOrder}
        onOpenChange={(open) => !open && setActiveOrder(null)}
      />
      <SampleCollectionDialog
        order={collectFor}
        onOpenChange={(open) => !open && setCollectFor(null)}
      />

      {(data?.meta?.totalPages ?? 1) > 1 && (
        <PaginationBar
          page={page}
          totalPages={data?.meta?.totalPages ?? 1}
          onPage={setPage}
        />
      )}
    </div>
  );
}

// ============================================================
// Test Report Tab — completed reports (status=completed)
// ============================================================
function TestReportTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useLabReports({
    search: search || undefined,
    status: 'published',
    page,
    limit: 20,
  });

  const reports = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
        <Input
          placeholder="Search by patient/MRN..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm outline-none"
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <Th>Order #</Th>
              <Th>Patient</Th>
              <Th>Status</Th>
              <Th>Published</Th>
              <Th>Version</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRow span={5} />
            ) : reports.length === 0 ? (
              <EmptyRow span={5} message="No completed reports yet." />
            ) : (
              reports.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-medium">{r.orderId?.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    {r.patient ? `${r.patient.firstName} ${r.patient.lastName ?? ''}` : '-'}
                  </td>
                  <td className="px-4 py-3"><Badge>{r.status}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(r as any).publishedAt ? formatDateTime((r as any).publishedAt) : '-'}
                  </td>
                  <td className="px-4 py-3">v{(r as any).version ?? 1}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(data?.meta?.totalPages ?? 1) > 1 && (
        <PaginationBar page={page} totalPages={data?.meta?.totalPages ?? 1} onPage={setPage} />
      )}
    </div>
  );
}

// ============================================================
// Technicians Tab — workload per technician
// ============================================================
function TechniciansTab() {
  // Pull active staff users (filter to lab-related roles client-side)
  const usersQ = useUsersList({ limit: 200 });
  const users = usersQ.data?.data ?? [];

  const labStaff = useMemo(
    () =>
      users.filter((u) =>
        u.userRoles?.some((ur) =>
          ['lab_technician', 'lab_supervisor'].includes(ur.role.name),
        ),
      ),
    [users],
  );

  const [selectedTech, setSelectedTech] = useState<string | undefined>(undefined);

  // When a tech is selected, use the server-side `assignedTo` filter (matches SOW: GET /lab/orders?assignedTo=)
  const visibleQuery = useLabOrders(
    selectedTech ? { assignedTo: selectedTech, limit: 50 } : { limit: 50 },
  );
  const visible = selectedTech
    ? visibleQuery.data?.data ?? []
    : (visibleQuery.data?.data ?? []).filter((o) => o.assignedToId);

  // Per-technician workload counts (separate query, all assigned orders, lightweight)
  const workloadQuery = useLabOrders({ limit: 200 });
  const workloadMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of workloadQuery.data?.data ?? []) {
      if (o.assignedToId) m.set(o.assignedToId, (m.get(o.assignedToId) ?? 0) + 1);
    }
    return m;
  }, [workloadQuery.data]);
  const totalAssigned = (workloadQuery.data?.data ?? []).filter((o) => o.assignedToId).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedTech(undefined)}
          className={cn(
            'rounded-full border px-4 py-1.5 text-xs font-medium transition-colors',
            !selectedTech ? 'bg-primary text-white border-primary' : 'bg-surface-container-low',
          )}
        >
          All ({totalAssigned})
        </button>
        {labStaff.map((u) => (
          <button
            key={u.id}
            onClick={() => setSelectedTech(u.id)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-xs font-medium transition-colors',
              selectedTech === u.id ? 'bg-primary text-white border-primary' : 'bg-surface-container-low',
            )}
          >
            {u.firstName} {u.lastName} ({workloadMap.get(u.id) ?? 0})
          </button>
        ))}
      </div>

      <OrderTable
        orders={visible}
        loading={visibleQuery.isLoading || usersQ.isLoading}
        emptyMsg={selectedTech ? 'No orders assigned to this technician.' : 'No orders are currently assigned.'}
        showAssignee
      />
    </div>
  );
}

// ============================================================
// Outsource Tab — third-party orders
// ============================================================
function OutsourceTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useLabOrders({ outsourced: true, page, limit: 20 });
  const orders = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <Th>Order #</Th>
              <Th>Patient</Th>
              <Th>Third-Party Lab</Th>
              <Th>Tests</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <LoadingRow span={5} /> : orders.length === 0 ? (
              <EmptyRow span={5} message="No outsourced orders." />
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3 font-medium">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{o.patient.firstName} {o.patient.lastName}</td>
                  <td className="px-4 py-3">{o.thirdPartyLabName ?? '-'}</td>
                  <td className="px-4 py-3">{o.labOrderItems?.length ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {(data?.meta?.totalPages ?? 1) > 1 && (
        <PaginationBar page={page} totalPages={data?.meta?.totalPages ?? 1} onPage={setPage} />
      )}
    </div>
  );
}

// ============================================================
// Order Tab — incoming/un-accepted orders requiring acceptance
// ============================================================
function IncomingOrderTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useLabOrders({ accepted: false, status: 'ordered', page, limit: 20 });
  const orders = data?.data ?? [];

  const [acceptFor, setAcceptFor] = useState<LabOrder | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-900">
        Orders shown here are awaiting acceptance from the lab. Assign a technician to start processing.
      </div>

      <OrderTable
        orders={orders}
        loading={isLoading}
        emptyMsg="No incoming orders."
        onAccept={setAcceptFor}
      />

      <AcceptOrderDialog
        order={acceptFor}
        onOpenChange={(open) => !open && setAcceptFor(null)}
      />

      {(data?.meta?.totalPages ?? 1) > 1 && (
        <PaginationBar page={page} totalPages={data?.meta?.totalPages ?? 1} onPage={setPage} />
      )}
    </div>
  );
}

// ============================================================
// Reusable order table
// ============================================================
function OrderTable({
  orders,
  loading,
  emptyMsg,
  onAccept,
  onView,
  onCollect,
  showAssignee,
}: {
  orders: LabOrder[];
  loading: boolean;
  emptyMsg: string;
  onAccept?: (o: LabOrder) => void;
  onView?: (o: LabOrder) => void;
  onCollect?: (o: LabOrder) => void;
  showAssignee?: boolean;
}) {
  const colCount = 8 + (showAssignee ? 1 : 0);
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <Th>Patient</Th>
              <Th>MRN</Th>
              <Th>Order #</Th>
              <Th>Tests</Th>
              <Th>Specimens</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              {showAssignee && <Th>Assigned</Th>}
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRow span={colCount} />
            ) : orders.length === 0 ? (
              <EmptyRow span={colCount} message={emptyMsg} />
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {o.patient.firstName} {o.patient.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{o.patient.mrn}</td>
                  <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{o.labOrderItems?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <SpecimensCell samples={o.labSamples} />
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={(o.urgency ?? o.priority) as string} /></td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  {showAssignee && (
                    <td className="px-4 py-3 text-xs">
                      {o.assignedTo ? `${o.assignedTo.firstName} ${o.assignedTo.lastName}` : '-'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {onView && (
                        <Button size="sm" variant="outline" onClick={() => onView(o)}>
                          View
                        </Button>
                      )}
                      {onAccept && !o.acceptedAt && (
                        <Button size="sm" onClick={() => onAccept(o)}>
                          <ClipboardCheck className="size-3.5" /> Accept
                        </Button>
                      )}
                      {onCollect && o.status === 'ordered' && o.acceptedAt && (
                        <Button size="sm" variant="outline" onClick={() => onCollect(o)}>
                          <FlaskConical className="size-3.5" /> Collect
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
  );
}

// ============================================================
// Accept Order Dialog
// ============================================================
function AcceptOrderDialog({
  order,
  onOpenChange,
}: {
  order: LabOrder | null;
  onOpenChange: (open: boolean) => void;
}) {
  const usersQ = useUsersList({ limit: 200 });
  const acceptMutation = useAcceptLabOrder();

  const [techId, setTechId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const labStaff = useMemo(
    () =>
      (usersQ.data?.data ?? []).filter((u) =>
        u.userRoles?.some((ur) => ['lab_technician', 'lab_supervisor'].includes(ur.role.name)),
      ),
    [usersQ.data],
  );

  const handle = async () => {
    if (!order) return;
    try {
      await acceptMutation.mutateAsync({
        id: order.id,
        assignedToId: techId || undefined,
        notes: notes || undefined,
      });
      toast.success('Lab order accepted');
      setTechId(''); setNotes('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to accept order');
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept Lab Order</DialogTitle>
          <DialogDescription>
            Assign this order to a technician to start processing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Patient</Label>
            <p className="text-sm">{order?.patient.firstName} {order?.patient.lastName}</p>
          </div>

          <div>
            <Label>Technician</Label>
            <select
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={techId}
              onChange={(e) => setTechId(e.target.value)}
            >
              <option value="">-- Select technician --</option>
              {labStaff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.userRoles?.map((r) => r.role.name).join(', ')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional intake note" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={acceptMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={acceptMutation.isPending || !techId}>
            {acceptMutation.isPending ? 'Accepting…' : 'Accept Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Sample Collection Dialog
// ============================================================
function SampleCollectionDialog({
  order,
  onOpenChange,
}: {
  order: LabOrder | null;
  onOpenChange: (open: boolean) => void;
}) {
  const collectMutation = useCollectSample();
  const [sampleType, setSampleType] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');

  const handle = async () => {
    if (!order) return;
    if (!sampleType.trim()) { toast.error('Sample type is required'); return; }
    try {
      await collectMutation.mutateAsync({
        orderId: order.id,
        sampleType: sampleType.trim(),
        barcode: barcode || undefined,
        notes: notes || undefined,
      });
      toast.success('Sample collected');
      setSampleType(''); setBarcode(''); setNotes('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to collect sample');
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collect Sample</DialogTitle>
          <DialogDescription>
            Record sample details. Status will move to <code>sample_collected → in_transit → received → processing</code> through subsequent steps.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Sample Type *</Label>
            <Input value={sampleType} onChange={(e) => setSampleType(e.target.value)} placeholder="e.g., blood, urine, swab" />
          </div>
          <div>
            <Label>Barcode</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or enter barcode" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={collectMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={collectMutation.isPending}>
            {collectMutation.isPending ? 'Saving…' : 'Mark Collected'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Order Detail Dialog — sample lifecycle + per-test two-mode result entry
// + order-level report panel (Generate → Sign → Publish).
//
// Two report-generation paths per SoW Week 6/7:
//   Mode A (Upload): upload a PDF/image per test → Mark Done. When every
//     item is done the backend auto-publishes the LabReport — the uploaded
//     files ARE the report.
//   Mode B (Add Details): enter structured parameter rows per test (value,
//     unit, normal range, abnormal flag). Generate creates a branded
//     LabReport draft; supervisor signs and publishes.
//
// Role gating: both technicians and supervisors can run either mode and
// generate a draft report. Sign / Publish / Verify-results stay supervisor-
// only (the backend permission `lab_reports.approve` enforces this; the UI
// just hides the controls).
// ============================================================
function OrderDetailDialog({
  order,
  onOpenChange,
}: {
  order: LabOrder | null;
  onOpenChange: (open: boolean) => void;
}) {
  const sampleStatus = useUpdateSampleStatus();
  // Re-fetch the order fresh inside the dialog so the report + entered
  // results refresh after Save Results / Generate / Sign / Publish without
  // forcing the parent table to reload.
  const liveOrderQ = useLabOrder(order?.id ?? '');
  const liveOrder = liveOrderQ.data ?? order;
  const { data: attachments } = useLabOrderAttachments(order?.id);

  if (!order || !liveOrder) return null;

  const advanceSample = async (
    sampleId: string,
    status: 'in_transit' | 'received' | 'processing' | 'completed',
  ) => {
    try {
      await sampleStatus.mutateAsync({ id: sampleId, status });
      toast.success(`Sample marked ${status.replace('_', ' ')}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update sample');
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Order #{liveOrder.id.slice(0, 8)} — {liveOrder.patient.firstName} {liveOrder.patient.lastName}
          </DialogTitle>
          <DialogDescription>
            <StatusBadge status={liveOrder.status} />
            <span className="ml-2 text-xs">{liveOrder.labOrderItems?.length ?? 0} test(s)</span>
          </DialogDescription>
        </DialogHeader>

        {/* Samples */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Samples</h3>
          {(liveOrder.labSamples?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No samples collected yet.</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {(liveOrder.labSamples ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{s.sampleType}</span>
                    <Badge className="ml-2">{s.status.replace('_', ' ')}</Badge>
                    {s.barcode && (
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        {s.barcode}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {s.status === 'collected' && <Button size="sm" variant="outline" onClick={() => advanceSample(s.id, 'in_transit')}>→ Transit</Button>}
                    {s.status === 'in_transit' && <Button size="sm" variant="outline" onClick={() => advanceSample(s.id, 'received')}>→ Received</Button>}
                    {s.status === 'received' && <Button size="sm" variant="outline" onClick={() => advanceSample(s.id, 'processing')}>→ Processing</Button>}
                    {s.status === 'processing' && <Button size="sm" variant="outline" onClick={() => advanceSample(s.id, 'completed')}>→ Done</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tests — two-mode result entry per test */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Tests</h3>
            <div className="text-[10px] text-muted-foreground">
              Choose per test: <span className="font-medium">Upload File</span> (file IS the report) or <span className="font-medium">Add Details</span> (generate a branded report).
            </div>
          </div>
          <div className="rounded-lg border divide-y">
            {(liveOrder.labOrderItems ?? []).map((it) => (
              <TestItemRow
                key={it.id}
                orderId={liveOrder.id}
                patientId={liveOrder.patientId}
                item={it}
                attachments={(attachments ?? []).filter((a) => a.labOrderItemId === it.id)}
              />
            ))}
          </div>
        </section>

        {/* Order-level report panel (Submit + Preview) */}
        <OrderReportPanel order={liveOrder} attachments={attachments ?? []} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Order-level Report Panel
//   - No report or draft/approved: "Submit Report" (one-shot generate +
//     sign + publish). Submit is enabled when ANY of these is present:
//     (1) at least one uploaded file on the order, (2) at least one
//     structured result entered, or (3) both. Backend route is gated by
//     `lab_reports.create` so technicians can submit without supervisor
//     sign-off — matches the upload+mark-done auto-publish trust model.
//   - Published: Preview / Print only.
// ============================================================
function OrderReportPanel({
  order,
  attachments,
}: {
  order: LabOrder;
  attachments: LabAttachment[];
}) {
  const submit = useSubmitLabReport();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const report = order.labReport;

  const hasAnyResult = (order.labOrderItems ?? []).some(
    (it) => (it.labResults?.length ?? 0) > 0,
  );
  const hasAnyAttachment = attachments.length > 0;
  // Any one of file / data / both is enough to submit.
  const canSubmit = hasAnyResult || hasAnyAttachment;

  const isPublished = report?.status === 'published';

  const onSubmit = async () => {
    try {
      await submit.mutateAsync({ orderId: order.id, notify: true });
      toast.success('Report submitted and published');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to submit report');
    }
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Report</h3>
      <div className="rounded-lg border p-3 bg-surface-container-low">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm min-w-0">
            {report ? (
              <>
                <span className="font-medium">Lab Report</span>
                <Badge className="ml-2 capitalize">{report.status}</Badge>
                <span className="ml-2 text-[10px] text-muted-foreground">v{report.version ?? 1}</span>
                {report.publishedAt && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    · published {formatDateTime(report.publishedAt)}
                  </span>
                )}
                {!report.publishedAt && report.signedAt && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    · signed {formatDateTime(report.signedAt)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">
                {canSubmit
                  ? hasAnyResult && hasAnyAttachment
                    ? 'Files and details captured. Submit to publish the branded report.'
                    : hasAnyResult
                      ? 'Details captured. Submit to publish the branded report.'
                      : 'Files uploaded. Submit to publish the report.'
                  : 'No report yet. Upload a file or enter parameter details for at least one test, then Submit.'}
              </span>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {report && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewId(report.id)}
                className="gap-1"
              >
                <Eye className="size-3.5" />
                Preview / Print
              </Button>
            )}
            {!isPublished && (
              <Button
                size="sm"
                onClick={onSubmit}
                disabled={!canSubmit || submit.isPending}
                className="gap-1"
                title={!canSubmit ? 'Upload a file or enter result details for at least one test' : undefined}
              >
                <Send className="size-3.5" />
                {submit.isPending ? 'Submitting…' : 'Submit Report'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <LabReportPrintDialog
        reportId={previewId}
        open={!!previewId}
        onOpenChange={(next) => !next && setPreviewId(null)}
      />
    </section>
  );
}

// Per-test row: hosts the two report-generation modes for this single test.
//   Tab "Upload File" — file picker + Mark Done. Mark Done is the fast path:
//     the backend treats the uploaded file as the report, and once every
//     item on the order is marked done it auto-publishes the LabReport.
//   Tab "Add Details" — structured parameter rows (auto-prefilled from the
//     test catalog's normalRange/unit). Save Results creates LabResult rows
//     which the order-level Generate Report button rolls up into a branded
//     LabReport snapshot.
function TestItemRow({
  orderId,
  patientId,
  item,
  attachments,
}: {
  orderId: string;
  patientId: string;
  item: NonNullable<LabOrder['labOrderItems']>[number];
  attachments: LabAttachment[];
}) {
  const { canApprove } = useLabRole();
  const upload = useUploadLabAttachment();
  const remove = useDeleteLabAttachment();
  const complete = useCompleteLabOrderItem();
  const enterResults = useEnterResults();
  const verifyResult = useVerifyResults();
  const fileRef = useRef<HTMLInputElement>(null);

  const isDone = item.status === 'completed';
  const isCancelled = item.status === 'cancelled';
  const canMarkDone = !isDone && !isCancelled && attachments.length > 0;

  // Existing LabResult rows for this item (eager-loaded by useLabOrder).
  const existingResults = item.labResults ?? [];

  // Default the active mode based on what's already captured for this item:
  // results already entered → start on "Add Details"; otherwise upload.
  const defaultMode: 'upload' | 'details' = existingResults.length > 0 ? 'details' : 'upload';
  const [mode, setMode] = useState<'upload' | 'details'>(defaultMode);

  // Structured parameter rows (drafted client-side, persisted via Save).
  type Row = {
    parameterName: string;
    value: string;
    unit: string;
    normalRange: string;
    isAbnormal: boolean;
    // When the catalog has a parameter schema, each row also carries the
    // input-type + option list so the render path can pick the right
    // control. Free-form rows leave these undefined.
    inputType?: 'number' | 'text' | 'select';
    options?: { value: string; label: string }[];
    group?: string | null;
    notes?: string | null;
    refLow?: number | null;
    refHigh?: number | null;
    decimals?: number | null;
  };

  // Catalog parameter schema (from the cloned platform template). When set,
  // we render one input row per parameter instead of free-form add/remove.
  const schemaParams = item.test.parameters && item.test.parameters.length > 0
    ? item.test.parameters
    : null;

  const formatRefRange = (
    p: NonNullable<NonNullable<typeof item.test.parameters>[number]>,
  ): string => {
    if (p.refLow != null && p.refHigh != null) return `${p.refLow}–${p.refHigh}`;
    if (p.refLow != null) return `≥ ${p.refLow}`;
    if (p.refHigh != null) return `≤ ${p.refHigh}`;
    return p.refRangeText ?? p.normalRange ?? '';
  };

  const blankRow = (): Row => ({
    parameterName: item.test.testName,
    value: '',
    unit: item.test.unit ?? '',
    normalRange: item.test.normalRange ?? '',
    isAbnormal: false,
  });

  // Build the initial structured rows from the catalog schema; one row per
  // parameter. Re-runs cheaply on test/parameters identity change.
  const initialRows = useMemo<Row[]>(() => {
    if (!schemaParams) return [blankRow()];
    return schemaParams.map((p) => ({
      parameterName: p.name,
      value: '',
      unit: p.unit ?? '',
      normalRange: formatRefRange(p),
      isAbnormal: false,
      inputType: p.inputType ?? 'number',
      options: p.options ?? undefined,
      group: p.group ?? null,
      notes: p.notes ?? null,
      refLow: p.refLow ?? null,
      refHigh: p.refHigh ?? null,
      decimals: p.decimals ?? null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, schemaParams]);

  const [rows, setRows] = useState<Row[]>(initialRows);

  // Re-sync local rows when the schema arrives async (catalog included on
  // first GET but parameters might land later if backend trims) OR when the
  // item identity changes.
  useEffect(() => {
    setRows(initialRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, schemaParams ? schemaParams.length : 0]);

  // After save, reset rows back to a blank set so the form is ready for
  // editing or re-entry. For structured mode we re-init from schema.
  useEffect(() => {
    if (existingResults.length > 0 && rows.every((r) => !r.value)) {
      setRows(initialRows);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingResults.length]);

  const onPick = async (file: File) => {
    try {
      await upload.mutateAsync({
        orderId,
        file,
        category: 'report_pdf',
        labOrderItemId: item.id,
      });
      toast.success(`Uploaded ${file.name}`);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Upload failed');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Remove this file? It will disappear from the patient and clinician views.')) return;
    try {
      await remove.mutateAsync(id);
      toast.success('File removed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Delete failed');
    }
  };

  const onDone = async () => {
    try {
      await complete.mutateAsync({ orderId, itemId: item.id });
      toast.success('Test marked done');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to mark done');
    }
  };

  const onSaveResults = async () => {
    const filled = rows
      .map((r) => ({ ...r, parameterName: r.parameterName.trim(), value: r.value.trim() }))
      .filter((r) => r.parameterName && r.value)
      .map((r) => {
        // Auto-flag abnormal for numeric rows with a ref range. The user
        // can still override by ticking the checkbox in free-form mode.
        if (
          (r.inputType === 'number' || r.inputType === undefined) &&
          (r.refLow != null || r.refHigh != null)
        ) {
          const n = Number(r.value);
          if (Number.isFinite(n)) {
            const lo = r.refLow ?? -Infinity;
            const hi = r.refHigh ?? Infinity;
            return { ...r, isAbnormal: r.isAbnormal || n < lo || n > hi };
          }
        }
        return r;
      });
    if (filled.length === 0) {
      toast.error('Enter at least one parameter with a value');
      return;
    }
    try {
      await enterResults.mutateAsync({
        labOrderItemId: item.id,
        labOrderId: orderId,
        patientId,
        results: filled.map((r) => ({
          parameterName: r.parameterName,
          value: r.value,
          unit: r.unit || undefined,
          normalRange: r.normalRange || undefined,
          isAbnormal: r.isAbnormal,
        })),
      });
      toast.success(`Saved ${filled.length} result${filled.length === 1 ? '' : 's'}`);
      setRows(initialRows);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save results');
    }
  };

  const onVerifyResult = async (
    id: string,
    action: 'approve' | 'request_correction',
  ) => {
    let notes: string | undefined;
    if (action === 'request_correction') {
      const input = window.prompt('Reason / requested correction?');
      if (input == null) return;
      notes = input.trim() || undefined;
    }
    try {
      await verifyResult.mutateAsync({ id, action, correctionNotes: notes });
      toast.success(action === 'approve' ? 'Result approved' : 'Correction requested');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  };

  const updateRow = (idx: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, blankRow()]);
  const removeRow = (idx: number) =>
    setRows((rs) => (rs.length === 1 ? [blankRow()] : rs.filter((_, i) => i !== idx)));

  return (
    <div className="px-3 py-3 text-sm space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium">{item.test.testName}</span>
          {item.test.testCode && (
            <span className="ml-1 text-[10px] text-muted-foreground">({item.test.testCode})</span>
          )}
          <Badge
            className={cn(
              'ml-2 capitalize',
              isDone && 'bg-emerald-100 text-emerald-800',
              isCancelled && 'bg-red-100 text-red-800',
            )}
          >
            {item.status.replace('_', ' ')}
          </Badge>
          {existingResults.length > 0 && !isDone && (
            <Badge className="ml-1 bg-cyan-100 text-cyan-800">
              {existingResults.length} result{existingResults.length === 1 ? '' : 's'} saved
            </Badge>
          )}
        </div>
        {isDone && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 shrink-0">
            <CheckCircle2 className="size-3.5" />
            Done
          </span>
        )}
      </div>

      {!isCancelled && !isDone && (
        <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="mt-1">
          <TabsList variant="line" className="h-8">
            <TabsTrigger value="upload" className="gap-1 text-xs">
              <Upload className="size-3" /> Upload File
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-1 text-xs">
              <ClipboardEdit className="size-3" /> Add Details
            </TabsTrigger>
          </TabsList>

          {/* Upload mode */}
          <TabsContent value="upload" className="pt-2 space-y-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPick(f);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
                className="gap-1"
              >
                <Upload className="size-3.5" />
                {upload.isPending ? 'Uploading…' : 'Upload File'}
              </Button>
              <Button
                size="sm"
                onClick={onDone}
                disabled={!canMarkDone || complete.isPending}
                className="gap-1"
                title={!canMarkDone ? 'Upload a report file first' : undefined}
              >
                <CheckCircle2 className="size-3.5" />
                {complete.isPending ? 'Saving…' : 'Mark Done'}
              </Button>
              <span className="text-[10px] text-muted-foreground ml-1">
                Auto-publishes the report when every test is marked done.
              </span>
            </div>
            <AttachmentList attachments={attachments} onDelete={onDelete} pending={remove.isPending} canDelete={!isDone} />
          </TabsContent>

          {/* Add Details mode */}
          <TabsContent value="details" className="pt-2 space-y-2">
            {existingResults.length > 0 && (
              <div className="rounded-md border bg-card">
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                  Saved results
                </div>
                <ul className="divide-y">
                  {existingResults.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{r.parameterName}</span>
                        <span className="ml-2">{r.value ?? '-'}</span>
                        {r.unit && <span className="ml-1 text-muted-foreground">{r.unit}</span>}
                        {r.normalRange && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            (range {r.normalRange})
                          </span>
                        )}
                        {r.isAbnormal && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                            <AlertTriangle className="size-3" /> Abnormal
                          </span>
                        )}
                        {r.status && r.status !== 'entered' && (
                          <Badge className="ml-2 capitalize">{r.status}</Badge>
                        )}
                        {r.correctionNotes && (
                          <div className="text-[10px] text-amber-700 mt-0.5">
                            Correction: {r.correctionNotes}
                          </div>
                        )}
                      </div>
                      {canApprove && r.status !== 'approved' && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            disabled={verifyResult.isPending}
                            onClick={() => onVerifyResult(r.id, 'approve')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            disabled={verifyResult.isPending}
                            onClick={() => onVerifyResult(r.id, 'request_correction')}
                          >
                            Request fix
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {schemaParams ? (
              // Structured mode — one input row per catalog parameter, grouped
              // by `group`. Free-form add/remove is disabled because the
              // schema defines the report shape.
              <SchemaParamGrid
                rows={rows}
                updateRow={updateRow}
              />
            ) : (
              <div className="rounded-md border bg-card">
                <div className="grid grid-cols-12 gap-1 px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                  <div className="col-span-3">Parameter</div>
                  <div className="col-span-2">Value</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-3">Normal range</div>
                  <div className="col-span-1 text-center">Abn</div>
                  <div className="col-span-1"></div>
                </div>
                {rows.map((r, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1 px-2 py-1.5 border-b last:border-b-0 items-center">
                    <Input
                      className="col-span-3 h-7 text-xs"
                      value={r.parameterName}
                      onChange={(e) => updateRow(idx, { parameterName: e.target.value })}
                      placeholder="e.g. Hemoglobin"
                    />
                    <Input
                      className="col-span-2 h-7 text-xs"
                      value={r.value}
                      onChange={(e) => updateRow(idx, { value: e.target.value })}
                      placeholder="value"
                    />
                    <Input
                      className="col-span-2 h-7 text-xs"
                      value={r.unit}
                      onChange={(e) => updateRow(idx, { unit: e.target.value })}
                      placeholder="g/dL"
                    />
                    <Input
                      className="col-span-3 h-7 text-xs"
                      value={r.normalRange}
                      onChange={(e) => updateRow(idx, { normalRange: e.target.value })}
                      placeholder="13.5-17.5"
                    />
                    <div className="col-span-1 flex justify-center">
                      <input
                        type="checkbox"
                        checked={r.isAbnormal}
                        onChange={(e) => updateRow(idx, { isAbnormal: e.target.checked })}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeRow(idx)}
                        className="h-6 w-6 text-muted-foreground"
                        title="Remove row"
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 px-2 py-2">
                  <Button size="sm" variant="ghost" onClick={addRow} className="gap-1 text-xs">
                    <Plus className="size-3" /> Add parameter
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 px-2 py-2">
              <div className="text-[10px] text-muted-foreground">
                {schemaParams ? (
                  <span>
                    Report uses <span className="font-medium">{schemaParams.length}</span> parameter
                    {schemaParams.length === 1 ? '' : 's'} from the catalog. Numeric values are auto-flagged when outside the reference range.
                  </span>
                ) : (
                  <span>No catalog parameters configured — using free-form rows.</span>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRows(initialRows)}
                  className="gap-1 text-xs"
                  title="Clear entered values"
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={onSaveResults}
                  disabled={enterResults.isPending}
                  className="gap-1"
                >
                  {enterResults.isPending ? 'Saving…' : 'Save Results'}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Saved parameters roll up into the order's branded report.
              Use the <span className="font-medium">Generate Report</span> button below once results
              are entered for the tests you want to publish.
            </p>
          </TabsContent>
        </Tabs>
      )}

      {/* When the test is already done OR cancelled, just show the file list read-only. */}
      {(isDone || isCancelled) && attachments.length > 0 && (
        <AttachmentList attachments={attachments} canDelete={false} />
      )}
    </div>
  );
}

// Renders structured-mode result entry: one input per catalog parameter
// row, grouped by `group` (RBC indices, WBC differential, etc.). The
// outer component owns `rows` state + the save handler; this only
// presents the inputs.
function SchemaParamGrid({
  rows,
  updateRow,
}: {
  rows: Array<{
    parameterName: string;
    value: string;
    unit: string;
    normalRange: string;
    isAbnormal: boolean;
    inputType?: 'number' | 'text' | 'select';
    options?: { value: string; label: string }[];
    group?: string | null;
    notes?: string | null;
    refLow?: number | null;
    refHigh?: number | null;
    decimals?: number | null;
  }>;
  updateRow: (idx: number, patch: Partial<(typeof rows)[number]>) => void;
}) {
  // Group rows by `group` field, preserving incoming order. Rows without a
  // group land in a single "Other" section at the end.
  const groups = useMemo(() => {
    const order: string[] = [];
    const buckets = new Map<string, number[]>();
    rows.forEach((r, idx) => {
      const k = r.group || '';
      if (!buckets.has(k)) {
        buckets.set(k, []);
        order.push(k);
      }
      buckets.get(k)!.push(idx);
    });
    return order.map((label) => ({ label, indices: buckets.get(label)! }));
  }, [rows]);

  // Compute live abnormal flag for numeric rows. Doesn't mutate state — just
  // tints the value cell red so the technician notices before saving. The
  // saved-row flag is computed authoritatively in onSaveResults.
  const isOutOfRange = (r: (typeof rows)[number]): boolean => {
    if (!r.value) return false;
    if (r.inputType === 'select' || r.inputType === 'text') return false;
    const n = Number(r.value);
    if (!Number.isFinite(n)) return false;
    if (r.refLow != null && n < r.refLow) return true;
    if (r.refHigh != null && n > r.refHigh) return true;
    return false;
  };

  return (
    <div className="rounded-md border bg-card">
      <div className="grid grid-cols-12 gap-1 px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
        <div className="col-span-4">Parameter</div>
        <div className="col-span-3">Result</div>
        <div className="col-span-2">Unit</div>
        <div className="col-span-2">Reference</div>
        <div className="col-span-1 text-center">Abn</div>
      </div>
      {groups.map((g) => (
        <div key={g.label || '_none'}>
          {g.label && (
            <div className="px-2 py-1.5 bg-surface-container-low text-[10px] uppercase tracking-wide font-semibold text-on-surface-variant border-b">
              {g.label}
            </div>
          )}
          {g.indices.map((idx) => {
            const r = rows[idx];
            const abn = isOutOfRange(r) || r.isAbnormal;
            return (
              <div
                key={idx}
                className="grid grid-cols-12 gap-1 px-2 py-1.5 border-b last:border-b-0 items-center"
              >
                <div className="col-span-4 min-w-0">
                  <div className="text-xs font-medium truncate">{r.parameterName}</div>
                  {r.notes && (
                    <div className="text-[10px] text-muted-foreground truncate">{r.notes}</div>
                  )}
                </div>
                <div className="col-span-3">
                  {r.inputType === 'select' && r.options ? (
                    <select
                      className="flex h-7 w-full rounded-lg border border-input bg-transparent px-2 text-xs focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                      value={r.value}
                      onChange={(e) => updateRow(idx, { value: e.target.value })}
                    >
                      <option value="">— select —</option>
                      {r.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      className={cn('h-7 text-xs', abn && 'border-error text-error focus-visible:border-error')}
                      type={r.inputType === 'number' ? 'number' : 'text'}
                      step={r.decimals != null ? Math.pow(10, -r.decimals).toString() : 'any'}
                      value={r.value}
                      onChange={(e) => updateRow(idx, { value: e.target.value })}
                      placeholder={r.inputType === 'number' ? '0' : 'enter result'}
                    />
                  )}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground truncate">{r.unit || '—'}</div>
                <div className="col-span-2 text-[11px] text-muted-foreground truncate">{r.normalRange || '—'}</div>
                <div className="col-span-1 flex justify-center">
                  <input
                    type="checkbox"
                    checked={r.isAbnormal || abn}
                    onChange={(e) => updateRow(idx, { isAbnormal: e.target.checked })}
                    title="Mark as abnormal"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Reusable attachment list (read or delete) — extracted so both modes can
// render uploaded files identically.
function AttachmentList({
  attachments,
  onDelete,
  pending,
  canDelete,
}: {
  attachments: LabAttachment[];
  onDelete?: (id: string) => void;
  pending?: boolean;
  canDelete?: boolean;
}) {
  if (attachments.length === 0) {
    return (
      <p className="text-[11px] italic text-muted-foreground">
        No file uploaded for this test yet.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {attachments.map((a) => {
        const url = resolveAttachmentUrl(a.fileUrl);
        const Icon = isImageMime(a.mimeType) ? FileImage : FileText;
        return (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-muted">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{a.fileName}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatFileSize(a.sizeBytes)}
                {a.uploader && ` · ${a.uploader.firstName} ${a.uploader.lastName ?? ''}`.trim()}
                {' · '}
                {formatDateTime(a.createdAt)}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              nativeButton={false}
              render={
                <a href={url} target="_blank" rel="noopener noreferrer" download={a.fileName} />
              }
              className="h-7 w-7"
              title="Open / download"
            >
              <Download className="size-3.5" />
            </Button>
            {canDelete && onDelete && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDelete(a.id)}
                disabled={pending}
                className="h-7 w-7 text-error"
                title="Remove"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ============================================================
// Helpers
// ============================================================
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
      {children}
    </th>
  );
}

function LoadingRow({ span }: { span: number }) {
  return (
    <tr>
      <td colSpan={span} className="px-4 py-8 text-center">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </td>
    </tr>
  );
}

function EmptyRow({ span, message }: { span: number; message: string }) {
  return (
    <tr>
      <td colSpan={span} className="px-4 py-8 text-center font-label text-on-surface-variant">{message}</td>
    </tr>
  );
}

function SpecimensCell({ samples }: { samples?: LabOrder['labSamples'] }) {
  const total = samples?.length ?? 0;
  if (total === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  // Tally by status so the Status tab surfaces sample lifecycle alongside the count
  const tally = new Map<string, number>();
  for (const s of samples ?? []) {
    tally.set(s.status, (tally.get(s.status) ?? 0) + 1);
  }
  const summary = Array.from(tally.entries())
    .map(([status, n]) => `${n} ${status.replace(/_/g, ' ')}`)
    .join(', ');
  return (
    <span className="text-xs" title={summary}>
      <span className="font-medium">{total}</span>
      <span className="ml-1 text-muted-foreground">({summary})</span>
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: string }) {
  return (
    <span className={cn(
      'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
      priority === 'routine' && 'bg-gray-100 text-gray-800',
      priority === 'urgent' && 'bg-amber-100 text-amber-800',
      priority === 'stat' && 'bg-red-100 text-red-800',
    )}>
      {priority ?? '-'}
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn(
      'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
      (status === 'pending' || status === 'ordered') && 'bg-amber-100 text-amber-800',
      status === 'sample_collected' && 'bg-blue-100 text-blue-800',
      status === 'in_transit' && 'bg-amber-100 text-amber-800',
      status === 'received' && 'bg-purple-100 text-purple-800',
      status === 'in_progress' && 'bg-indigo-100 text-indigo-800',
      status === 'completed' && 'bg-green-100 text-green-800',
      status === 'published' && 'bg-emerald-100 text-emerald-800',
      status === 'cancelled' && 'bg-red-100 text-red-800',
    )}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function PaginationBar({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
