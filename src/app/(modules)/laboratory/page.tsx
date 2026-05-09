'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, ClipboardCheck, FlaskConical, FileSignature, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useLabOrders,
  useLabReports,
  useLabSamples,
  useAcceptLabOrder,
  useCollectSample,
  useUpdateSampleStatus,
  useEnterResults,
  useVerifyResults,
  useGenerateLabReport,
  useSignLabReport,
  usePublishLabReport,
  useLabDepartments,
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
import { LabAttachmentsViewer } from '@/components/shared/lab-attachments-viewer';
import { useLabOrderAttachments } from '@/hooks/use-lab-attachments';

export default function LaboratoryHomePage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Laboratory Home</h1>

      <Tabs defaultValue="status">
        <TabsList variant="line">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="test-report">Test Report</TabsTrigger>
          <TabsTrigger value="technicians">For Technicians</TabsTrigger>
          <TabsTrigger value="outsource">Outsource List</TabsTrigger>
          <TabsTrigger value="order">Order</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="pt-4">
          <LabStatusTab />
        </TabsContent>
        <TabsContent value="test-report" className="pt-4">
          <TestReportTab />
        </TabsContent>
        <TabsContent value="technicians" className="pt-4">
          <TechniciansTab />
        </TabsContent>
        <TabsContent value="outsource" className="pt-4">
          <OutsourceTab />
        </TabsContent>
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
        Orders shown here are awaiting acceptance from the lab. Assign a technician/department to start processing.
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
  const departmentsQ = useLabDepartments({ limit: 100 });
  const acceptMutation = useAcceptLabOrder();

  const [techId, setTechId] = useState<string>('');
  const [deptId, setDeptId] = useState<string>('');
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
        assignedDeptId: deptId || undefined,
        notes: notes || undefined,
      });
      toast.success('Lab order accepted');
      setTechId(''); setDeptId(''); setNotes('');
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
            Assign this order to a technician or department to start processing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Patient</Label>
            <p className="text-sm">{order?.patient.firstName} {order?.patient.lastName}</p>
          </div>

          <div>
            <Label>Department</Label>
            <select
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
            >
              <option value="">-- Select department (optional) --</option>
              {(departmentsQ.data?.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
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
          <Button onClick={handle} disabled={acceptMutation.isPending || (!techId && !deptId)}>
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
// Order Detail Dialog — sample lifecycle, result entry, sign/publish
// ============================================================
function OrderDetailDialog({
  order,
  onOpenChange,
}: {
  order: LabOrder | null;
  onOpenChange: (open: boolean) => void;
}) {
  const sampleStatus = useUpdateSampleStatus();
  const enterResults = useEnterResults();
  const verifyResults = useVerifyResults();
  const generateReport = useGenerateLabReport();
  const signReport = useSignLabReport();
  const publishReport = usePublishLabReport();

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [resultRows, setResultRows] = useState<
    Array<{ parameterName: string; value: string; unit: string; normalRange: string }>
  >([{ parameterName: '', value: '', unit: '', normalRange: '' }]);

  if (!order) return null;

  const activeItem = order.labOrderItems?.find((it) => it.id === activeItemId);

  const advanceSample = async (sampleId: string, status: 'in_transit' | 'received' | 'processing' | 'completed') => {
    try {
      await sampleStatus.mutateAsync({ id: sampleId, status });
      toast.success(`Sample marked ${status.replace('_', ' ')}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update sample');
    }
  };

  const submitResults = async () => {
    if (!activeItem) return;
    const cleaned = resultRows.filter((r) => r.parameterName.trim());
    if (cleaned.length === 0) { toast.error('Add at least one parameter'); return; }
    try {
      await enterResults.mutateAsync({
        labOrderItemId: activeItem.id,
        labOrderId: order.id,
        patientId: order.patientId,
        results: cleaned.map((r) => ({
          parameterName: r.parameterName.trim(),
          value: r.value || undefined,
          unit: r.unit || undefined,
          normalRange: r.normalRange || undefined,
        })),
      });
      toast.success('Results entered');
      setActiveItemId(null);
      setResultRows([{ parameterName: '', value: '', unit: '', normalRange: '' }]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save results');
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Order #{order.id.slice(0, 8)} — {order.patient.firstName} {order.patient.lastName}
          </DialogTitle>
          <DialogDescription>
            <StatusBadge status={order.status} />
            <span className="ml-2 text-xs">{order.labOrderItems?.length ?? 0} test(s)</span>
          </DialogDescription>
        </DialogHeader>

        {/* Samples */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Samples</h3>
          {(order.labSamples?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No samples collected yet.</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {(order.labSamples ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{s.sampleType}</span>
                    <Badge className="ml-2">{s.status.replace('_', ' ')}</Badge>
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

        {/* Test items */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Tests</h3>
          <div className="rounded-lg border divide-y">
            {(order.labOrderItems ?? []).map((it) => (
              <div key={it.id} className="px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{it.test.testName}</span>
                    <Badge className="ml-2">{it.status}</Badge>
                  </div>
                  <Button size="sm" onClick={() => setActiveItemId(it.id)} disabled={it.status === 'cancelled'}>
                    Enter Results
                  </Button>
                </div>

                {activeItemId === it.id && (
                  <div className="mt-3 space-y-2 rounded-md bg-surface-container-low p-3">
                    {resultRows.map((r, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2">
                        <Input
                          className="col-span-4"
                          placeholder="Parameter"
                          value={r.parameterName}
                          onChange={(e) => {
                            const next = [...resultRows]; next[idx].parameterName = e.target.value; setResultRows(next);
                          }}
                        />
                        <Input
                          className="col-span-3"
                          placeholder="Value"
                          value={r.value}
                          onChange={(e) => {
                            const next = [...resultRows]; next[idx].value = e.target.value; setResultRows(next);
                          }}
                        />
                        <Input
                          className="col-span-2"
                          placeholder="Unit"
                          value={r.unit}
                          onChange={(e) => {
                            const next = [...resultRows]; next[idx].unit = e.target.value; setResultRows(next);
                          }}
                        />
                        <Input
                          className="col-span-3"
                          placeholder='Range (e.g. "10-20")'
                          value={r.normalRange}
                          onChange={(e) => {
                            const next = [...resultRows]; next[idx].normalRange = e.target.value; setResultRows(next);
                          }}
                        />
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setResultRows([...resultRows, { parameterName: '', value: '', unit: '', normalRange: '' }])}
                      >
                        + Add parameter
                      </Button>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setActiveItemId(null)}>Cancel</Button>
                        <Button size="sm" onClick={submitResults} disabled={enterResults.isPending}>
                          {enterResults.isPending ? 'Saving…' : 'Save Results'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Result review (per-result approve / request correction) */}
        {(order.labOrderItems ?? []).some((it) => (it as any).labResults?.length) && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Result Review</h3>
            <div className="rounded-lg border divide-y">
              {(order.labOrderItems ?? []).flatMap((it) =>
                ((it as any).labResults ?? []).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{r.parameterName}</span>
                      <span className="ml-2 text-muted-foreground">
                        {r.value ?? '-'} {r.unit ?? ''} {r.normalRange ? `(ref ${r.normalRange})` : ''}
                      </span>
                      {r.isAbnormal && <Badge className="ml-2 bg-red-100 text-red-800">abnormal</Badge>}
                      <Badge className="ml-2">{r.status ?? 'entered'}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const note = prompt('Reason for correction?');
                          if (!note) return;
                          try {
                            await verifyResults.mutateAsync({ id: r.id, action: 'request_correction', correctionNotes: note });
                            toast.success('Sent back for correction');
                          } catch (err: any) {
                            toast.error(err?.response?.data?.message ?? 'Failed');
                          }
                        }}
                      >
                        <AlertCircle className="size-3.5" /> Request correction
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await verifyResults.mutateAsync({ id: r.id, action: 'approve' });
                            toast.success('Approved');
                          } catch (err: any) {
                            toast.error(err?.response?.data?.message ?? 'Failed');
                          }
                        }}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                )),
              )}
            </div>
          </section>
        )}

        {/* Attachments (PDFs, images, scans) */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Attachments
          </h3>
          <OrderAttachmentsSection orderId={order.id} />
        </section>

        {/* Report controls */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Report</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await generateReport.mutateAsync({ orderId: order.id });
                  toast.success('Draft report generated');
                } catch (err: any) {
                  toast.error(err?.response?.data?.message ?? 'Failed to generate');
                }
              }}
              disabled={generateReport.isPending}
            >
              <FileSignature className="size-3.5" /> Generate
            </Button>
            <ReportSignPublish orderId={order.id} />
          </div>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportSignPublish({ orderId }: { orderId: string }) {
  const reportsQ = useLabReports({ limit: 5 });
  const sign = useSignLabReport();
  const publish = usePublishLabReport();

  const report = (reportsQ.data?.data ?? []).find((r) => r.orderId === orderId);
  if (!report) return null;

  const status = (report as any).status as string;
  return (
    <>
      <Badge>{status}</Badge>
      {status !== 'approved' && status !== 'published' && (
        <Button
          size="sm"
          onClick={async () => {
            try {
              await sign.mutateAsync(report.id);
              toast.success('Report signed');
            } catch (err: any) {
              toast.error(err?.response?.data?.message ?? 'Failed to sign');
            }
          }}
          disabled={sign.isPending}
        >
          Sign
        </Button>
      )}
      {status === 'approved' && (
        <Button
          size="sm"
          onClick={async () => {
            try {
              await publish.mutateAsync({ id: report.id });
              toast.success('Report published');
            } catch (err: any) {
              toast.error(err?.response?.data?.message ?? 'Failed to publish');
            }
          }}
          disabled={publish.isPending}
        >
          Publish
        </Button>
      )}
    </>
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

// Loads + renders attachments tied to a single lab order. Lab roles can
// upload (report PDFs, microscopy images, raw output) and delete; the same
// list ships to doctors, nurses and patients via the order/report payload.
function OrderAttachmentsSection({ orderId }: { orderId: string }) {
  const { data, isLoading } = useLabOrderAttachments(orderId);
  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading attachments…</p>;
  }
  return (
    <LabAttachmentsViewer
      attachments={data ?? []}
      orderId={orderId}
      canUpload
      canDelete
    />
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
