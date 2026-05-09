'use client';

import { useState, useCallback } from 'react';
import {
  ClipboardList,
  FlaskConical,
  BedDouble,
  ArrowRightLeft,
  Package,
  ShoppingCart,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Loader2,
  Filter,
} from 'lucide-react';
import { formatDateTime } from '@/lib/date-utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useClinicalOrders,
  useAcknowledgeClinicalOrder,
  useLabSamples,
  useUpdateSampleStatus,
  useWardBeds,
  useRequestTransfer,
  useNurseAdmissions,
  useWardInventory,
  useSupplyRequests,
  useCreateSupplyRequest,
} from '@/hooks/use-nurse';
import type { BedInfo, SupplyRequest, InventoryItem, NurseClinicalOrder } from '@/hooks/use-nurse';
import { useWards } from '@/hooks/use-clinical';
import { LabOrderDetailDialog } from '@/components/shared/lab-order-detail-dialog';

// ============================================================
// Types
// ============================================================

interface LabSample {
  id: string;
  sampleId?: string;
  patientId?: string;
  patient?: { firstName: string; lastName: string; mrn?: string };
  testName?: string;
  status: 'ordered' | 'collected' | 'in_transit' | 'received';
  collectedAt?: string;
  updatedAt: string;
  createdAt: string;
}

interface TransferRequest {
  id: string;
  admissionId: string;
  fromWardId: string;
  fromWard?: { name: string };
  toWardId: string;
  toWard?: { name: string };
  reason: string;
  notes?: string;
  status: string;
  createdAt: string;
}

// ============================================================
// Tab Config
// ============================================================

const tabs = [
  { key: 'orders', label: 'Doctor Orders', icon: ClipboardList },
  { key: 'samples', label: 'Samples', icon: FlaskConical },
  { key: 'beds', label: 'Bed Availability', icon: BedDouble },
  { key: 'transfers', label: 'Transfers', icon: ArrowRightLeft },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'supplies', label: 'Supply Request', icon: ShoppingCart },
] as const;

type TabKey = (typeof tabs)[number]['key'];

// ============================================================
// Main Page
// ============================================================

export default function NurseOrdersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('orders');

  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Orders & Ward Management</h1>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-surface-container-low p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        {activeTab === 'orders' && <DoctorOrdersTab />}
        {activeTab === 'samples' && <SampleCollectionTab />}
        {activeTab === 'beds' && <BedAvailabilityTab />}
        {activeTab === 'transfers' && <PatientTransferTab />}
        {activeTab === 'inventory' && <WardInventoryTab />}
        {activeTab === 'supplies' && <SupplyRequestTab />}
      </div>
    </div>
  );
}

// ============================================================
// 1. Doctor Orders Tab
// ============================================================

function DoctorOrdersTab() {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'cancelled' | 'all'>(
    'pending',
  );
  const [typeFilter, setTypeFilter] = useState<'all' | 'lab' | 'imaging'>('all');
  const [wardFilter, setWardFilter] = useState<string>('');
  const [ackedIds, setAckedIds] = useState<Set<string>>(new Set());
  const [openLabOrderId, setOpenLabOrderId] = useState<string | null>(null);

  const { data: wardsData } = useWards();
  const wards = (wardsData ?? []) as { id: string; name: string }[];

  const { data, isLoading } = useClinicalOrders({
    status: statusFilter,
    type: typeFilter,
    wardId: wardFilter || undefined,
  });

  const orders = (data?.data ?? []) as NurseClinicalOrder[];
  const acknowledge = useAcknowledgeClinicalOrder();

  const handleAcknowledge = useCallback(
    (order: NurseClinicalOrder) => {
      acknowledge.mutate(
        { orderType: order.orderType, orderId: order.id },
        {
          onSuccess: () => {
            toast.success(`${order.orderType === 'lab' ? 'Lab' : 'Imaging'} order acknowledged`);
            setAckedIds((prev) => {
              const next = new Set(prev);
              next.add(order.id);
              return next;
            });
          },
          onError: (err: unknown) => {
            toast.error((err as { message?: string })?.message ?? 'Failed to acknowledge order');
          },
        },
      );
    },
    [acknowledge],
  );

  const priorityColor: Record<string, string> = {
    stat: 'bg-red-100 text-red-700',
    urgent: 'bg-amber-100 text-amber-700',
    routine: 'bg-slate-100 text-slate-600',
  };

  const statusColor: Record<string, string> = {
    ordered: 'bg-amber-100 text-amber-700',
    requested: 'bg-amber-100 text-amber-700',
    sample_collected: 'bg-blue-100 text-blue-700',
    scheduled: 'bg-blue-100 text-blue-700',
    in_transit: 'bg-purple-100 text-purple-700',
    received: 'bg-purple-100 text-purple-700',
    in_progress: 'bg-purple-100 text-purple-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  const typeColor: Record<string, string> = {
    lab: 'bg-purple-100 text-purple-700',
    imaging: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="font-headline text-base font-semibold">Doctor Orders</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-on-surface-variant" />
          <Select
            value={wardFilter}
            onValueChange={(val) => setWardFilter((val === 'all' ? '' : val) ?? '')}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All wards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wards</SelectItem>
              {wards.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(val) => setTypeFilter((val ?? 'all') as 'all' | 'lab' | 'imaging')}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="lab">Lab</SelectItem>
              <SelectItem value="imaging">Imaging</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              if (val) setStatusFilter(val as 'pending' | 'completed' | 'cancelled' | 'all');
            }}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <LabOrderDetailDialog
        orderId={openLabOrderId}
        onOpenChange={(open) => !open && setOpenLabOrderId(null)}
      />

      <div className="overflow-x-auto rounded-lg border border-outline-variant">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low">
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Order #</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Patient</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Doctor</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Type</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Description</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Ward</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Priority</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Status</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Date</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-on-surface-variant">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-on-surface-variant text-sm">
                  No orders found
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const isAcked = ackedIds.has(order.id);
                return (
                  <tr
                    key={`${order.orderType}-${order.id}`}
                    className={cn(
                      'border-b border-outline-variant last:border-0 hover:bg-surface-container-low/50 transition-colors',
                      isAcked && 'bg-emerald-50/40',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{order.orderNumber}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">
                          {order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : '-'}
                        </p>
                        {order.patient?.mrn && (
                          <p className="text-xs text-on-surface-variant">{order.patient.mrn}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {order.doctor?.user
                        ? `Dr. ${order.doctor.user.firstName} ${order.doctor.user.lastName}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                          typeColor[order.orderType] ?? 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {order.orderType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[240px] truncate">{order.description}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {order.ward?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                          priorityColor[order.priority] ?? priorityColor.routine,
                        )}
                      >
                        {order.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                          statusColor[order.status] ?? 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {order.orderType === 'lab' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setOpenLabOrderId(order.id)}
                          >
                            View
                          </Button>
                        )}
                        {isAcked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Acknowledged
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={acknowledge.isPending}
                            onClick={() => handleAcknowledge(order)}
                          >
                            {acknowledge.isPending ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                            )}
                            Acknowledge
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
    </div>
  );
}

// ============================================================
// 2. Sample Collection Tab
// ============================================================

function SampleCollectionTab() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading } = useLabSamples({ status: statusFilter || undefined });
  const updateStatus = useUpdateSampleStatus();

  const samples = (data?.data ?? data ?? []) as LabSample[];

  const nextStatusMap: Record<string, string> = {
    ordered: 'collected',
    collected: 'in_transit',
    in_transit: 'received',
  };

  const nextStatusLabel: Record<string, string> = {
    ordered: 'Mark Collected',
    collected: 'Mark In Transit',
    in_transit: 'Mark Received',
  };

  const sampleStatusColor: Record<string, string> = {
    ordered: 'bg-amber-100 text-amber-700',
    collected: 'bg-blue-100 text-blue-700',
    in_transit: 'bg-purple-100 text-purple-700',
    received: 'bg-emerald-100 text-emerald-700',
  };

  const handleUpdateStatus = useCallback(
    (sampleId: string, currentStatus: string) => {
      const nextStatus = nextStatusMap[currentStatus];
      if (!nextStatus) return;

      updateStatus.mutate(
        { id: sampleId, status: nextStatus },
        {
          onSuccess: () => toast.success(`Sample status updated to ${nextStatus.replace('_', ' ')}`),
          onError: () => toast.error('Failed to update sample status'),
        }
      );
    },
    [updateStatus]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-headline text-base font-semibold">Lab Sample Collection</h2>
        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val ?? '')}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="ordered">Ordered</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-outline-variant">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low">
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Sample ID</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Patient</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Test</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Status</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Updated</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : samples.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-on-surface-variant text-sm">
                  No samples found
                </td>
              </tr>
            ) : (
              samples.map((sample) => (
                <tr key={sample.id} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-4 py-3 font-medium font-mono text-xs">{sample.sampleId || sample.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{sample.patient ? `${sample.patient.firstName} ${sample.patient.lastName}` : '-'}</p>
                      {sample.patient?.mrn && <p className="text-xs text-on-surface-variant">{sample.patient.mrn}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{sample.testName || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', sampleStatusColor[sample.status])}>
                      {sample.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">
                    {formatDateTime(sample.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {nextStatusMap[sample.status] && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={updateStatus.isPending}
                        onClick={() => handleUpdateStatus(sample.id, sample.status)}
                      >
                        {updateStatus.isPending ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        {nextStatusLabel[sample.status]}
                      </Button>
                    )}
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
// 3. Bed Availability Tab
// ============================================================

function BedAvailabilityTab() {
  const [selectedWard, setSelectedWard] = useState<string>('');
  const { data: wardsData } = useWards();
  const { data: bedsData, isLoading } = useWardBeds({ wardId: selectedWard || undefined });

  const wards = (wardsData ?? []) as { id: string; name: string }[];
  const beds = (bedsData?.data ?? bedsData ?? []) as BedInfo[];

  const bedStatusConfig: Record<string, { color: string; border: string; label: string }> = {
    available: { color: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-400', label: 'Available' },
    occupied: { color: 'bg-red-100 text-red-800', border: 'border-red-400', label: 'Occupied' },
    maintenance: { color: 'bg-amber-100 text-amber-800', border: 'border-amber-400', label: 'Maintenance' },
    reserved: { color: 'bg-blue-100 text-blue-800', border: 'border-blue-400', label: 'Reserved' },
  };

  const statusCounts = beds.reduce(
    (acc, bed) => {
      acc[bed.status] = (acc[bed.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-headline text-base font-semibold">Bed Availability</h2>
        <Select
          value={selectedWard}
          onValueChange={(val) => setSelectedWard(val ?? '')}
        >
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="Select ward" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Wards</SelectItem>
            {wards.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Legend + Summary */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(bedStatusConfig).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className={cn('inline-block h-3 w-3 rounded-sm border', cfg.color, cfg.border)} />
            <span className="text-on-surface-variant">
              {cfg.label}: <span className="font-semibold text-on-surface">{statusCounts[key] || 0}</span>
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs ml-auto">
          <span className="text-on-surface-variant font-semibold">Total: {beds.length}</span>
        </div>
      </div>

      {/* Bed Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-on-surface-variant">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </div>
      ) : beds.length === 0 ? (
        <div className="py-12 text-center text-on-surface-variant text-sm">
          {selectedWard ? 'No beds found for this ward' : 'Select a ward to view beds'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {beds.map((bed) => {
            const cfg = bedStatusConfig[bed.status] || bedStatusConfig.available;
            return (
              <div
                key={bed.id}
                className={cn(
                  'relative rounded-lg border-2 p-3 text-center transition-shadow hover:shadow-md',
                  cfg.color,
                  cfg.border
                )}
              >
                <BedDouble className="mx-auto mb-1 h-5 w-5 opacity-60" />
                <p className="text-xs font-bold">{bed.bedNumber}</p>
                {bed.ward?.name && (
                  <p className="text-[10px] opacity-70 truncate">{bed.ward.name}</p>
                )}
                {bed.status === 'occupied' && bed.currentPatient && (
                  <p className="mt-1 text-[10px] font-medium truncate">
                    {bed.currentPatient.firstName} {bed.currentPatient.lastName}
                  </p>
                )}
                <span className={cn('mt-1 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase', cfg.color)}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 4. Patient Transfer Tab
// ============================================================

function PatientTransferTab() {
  const { data: wardsData } = useWards();
  const { data: admissionsData } = useNurseAdmissions({ status: 'admitted' });
  const requestTransfer = useRequestTransfer();

  const wards = (wardsData ?? []) as { id: string; name: string }[];
  const admissions = (admissionsData?.data ?? admissionsData ?? []) as {
    id: string;
    ipNumber?: string;
    patient?: { firstName: string; lastName: string; mrn?: string };
    ward?: { id: string; name: string };
    bed?: { bedNumber: string };
  }[];

  const [selectedAdmission, setSelectedAdmission] = useState('');
  const [toWardId, setToWardId] = useState('');
  const [toBedId, setToBedId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [recentTransfers, setRecentTransfers] = useState<TransferRequest[]>([]);

  const selectedAdm = admissions.find((a) => a.id === selectedAdmission);
  const fromWardId = selectedAdm?.ward?.id || '';

  // Get beds for the target ward
  const { data: targetBedsData } = useWardBeds({ wardId: toWardId || undefined });
  const targetBeds = ((targetBedsData?.data ?? targetBedsData ?? []) as BedInfo[]).filter(
    (b) => b.status === 'available'
  );

  const handleSubmitTransfer = useCallback(() => {
    if (!selectedAdmission || !fromWardId || !toWardId || !reason.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (fromWardId === toWardId) {
      toast.error('Source and destination wards cannot be the same');
      return;
    }

    requestTransfer.mutate(
      {
        admissionId: selectedAdmission,
        fromWardId,
        toWardId,
        toBedId: toBedId || undefined,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          toast.success('Transfer request submitted');
          const newTransfer: TransferRequest = {
            id: (res as { data?: { id: string } })?.data?.id || Date.now().toString(),
            admissionId: selectedAdmission,
            fromWardId,
            fromWard: selectedAdm?.ward ? { name: selectedAdm.ward.name } : undefined,
            toWardId,
            toWard: { name: wards.find((w) => w.id === toWardId)?.name || toWardId },
            reason: reason.trim(),
            notes: notes.trim() || undefined,
            status: 'pending',
            createdAt: new Date().toISOString(),
          };
          setRecentTransfers((prev) => [newTransfer, ...prev]);
          setSelectedAdmission('');
          setToWardId('');
          setToBedId('');
          setReason('');
          setNotes('');
        },
        onError: () => toast.error('Failed to submit transfer request'),
      }
    );
  }, [selectedAdmission, fromWardId, toWardId, toBedId, reason, notes, requestTransfer, selectedAdm, wards]);

  const transferStatusColor: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-6">
      <h2 className="font-headline text-base font-semibold">Patient Transfer Request</h2>

      {/* Transfer Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-outline-variant p-4">
        {/* Patient / Admission */}
        <div className="space-y-1.5">
          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            Patient (Admission) *
          </label>
          <Select value={selectedAdmission} onValueChange={(val) => setSelectedAdmission(val ?? '')}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select admitted patient" />
            </SelectTrigger>
            <SelectContent>
              {admissions.map((adm) => (
                <SelectItem key={adm.id} value={adm.id}>
                  {adm.patient ? `${adm.patient.firstName} ${adm.patient.lastName}` : adm.ipNumber || adm.id.slice(0, 8)}
                  {adm.ipNumber ? ` (${adm.ipNumber})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* From Ward (auto-filled) */}
        <div className="space-y-1.5">
          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            From Ward
          </label>
          <Input
            value={selectedAdm?.ward?.name || ''}
            readOnly
            disabled
            className="h-9 text-xs bg-surface-container-low"
            placeholder="Auto-filled from admission"
          />
        </div>

        {/* To Ward */}
        <div className="space-y-1.5">
          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            To Ward *
          </label>
          <Select value={toWardId} onValueChange={(val) => { setToWardId(val ?? ''); setToBedId(''); }}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select destination ward" />
            </SelectTrigger>
            <SelectContent>
              {wards
                .filter((w) => w.id !== fromWardId)
                .map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* To Bed (optional) */}
        <div className="space-y-1.5">
          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            To Bed (Optional)
          </label>
          <Select value={toBedId} onValueChange={(val) => setToBedId(val ?? '')}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select bed" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {targetBeds.map((bed) => (
                <SelectItem key={bed.id} value={bed.id}>
                  Bed {bed.bedNumber} {bed.ward?.name ? `· ${bed.ward.name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            Reason *
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Step-down from ICU, closer to specialist"
            className="h-9 text-xs"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            className="text-xs min-h-[36px] resize-none"
            rows={1}
          />
        </div>

        {/* Submit */}
        <div className="md:col-span-2 flex justify-end pt-2">
          <Button
            onClick={handleSubmitTransfer}
            disabled={requestTransfer.isPending || !selectedAdmission || !toWardId || !reason.trim()}
            className="h-9"
          >
            {requestTransfer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Submit Transfer Request
          </Button>
        </div>
      </div>

      {/* Recent Transfers */}
      {recentTransfers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-on-surface-variant">Recent Transfer Requests</h3>
          <div className="overflow-x-auto rounded-lg border border-outline-variant">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">From</th>
                  <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">To</th>
                  <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Reason</th>
                  <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Status</th>
                  <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentTransfers.map((t) => (
                  <tr key={t.id} className="border-b border-outline-variant last:border-0">
                    <td className="px-4 py-3">{t.fromWard?.name || t.fromWardId}</td>
                    <td className="px-4 py-3">{t.toWard?.name || t.toWardId}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{t.reason}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', transferStatusColor[t.status] || 'bg-slate-100 text-slate-600')}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">{formatDateTime(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 5. Ward Inventory Tab
// ============================================================

function WardInventoryTab() {
  const [wardId, setWardId] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const { data: wardsData } = useWards();
  const wards = (wardsData ?? []) as { id: string; name: string }[];

  const { data, isLoading } = useWardInventory({
    wardId: wardId || undefined,
    search: search || undefined,
    category: category || undefined,
  });

  const items = (data?.data ?? data ?? []) as InventoryItem[];

  // Derive categories from data
  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[];

  function getStockStatus(item: InventoryItem): { label: string; className: string } {
    if (item.currentStock === 0) return { label: 'Out of Stock', className: 'bg-red-100 text-red-700' };
    if (item.reorderLevel && item.currentStock <= item.reorderLevel) return { label: 'Low Stock', className: 'bg-amber-100 text-amber-700' };
    return { label: 'In Stock', className: 'bg-emerald-100 text-emerald-700' };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="font-headline text-base font-semibold">Ward Inventory</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={wardId}
            onValueChange={(val) => setWardId((val === 'all' ? '' : val) ?? '')}
          >
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="All wards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wards</SelectItem>
              {wards.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="pl-8 h-8 text-xs w-[200px]"
            />
          </div>
          <Select
            value={category}
            onValueChange={(val) => setCategory((val === 'all' ? '' : val) ?? '')}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-outline-variant">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low">
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Item Name</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Category</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">SKU</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-right">Current Stock</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-right">Reorder Level</th>
              <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-on-surface-variant text-sm">
                  No inventory items found
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const stock = getStockStatus(item);
                const isLow = item.currentStock === 0 || (item.reorderLevel != null && item.currentStock <= item.reorderLevel);
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-b border-outline-variant last:border-0 transition-colors',
                      isLow ? 'bg-red-50/40' : 'hover:bg-surface-container-low/50'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isLow && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        <span className="font-medium">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{item.category || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{item.sku || '-'}</td>
                    <td className={cn('px-4 py-3 text-right font-medium', item.currentStock === 0 ? 'text-red-600' : '')}>
                      {item.currentStock} {item.unit || 'units'}
                    </td>
                    <td className="px-4 py-3 text-right text-on-surface-variant">
                      {item.reorderLevel != null ? `${item.reorderLevel} ${item.unit || 'units'}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', stock.className)}>
                        {stock.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 6. Supply Request Tab
// ============================================================

interface SupplyItem {
  inventoryItemId: string;
  itemName: string;
  quantity: number;
}

interface WardWithDept {
  id: string;
  name: string;
  departmentId?: string;
  department?: { id: string; name: string };
}

function SupplyRequestTab() {
  const [selectedWardId, setSelectedWardId] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [items, setItems] = useState<SupplyItem[]>([
    { inventoryItemId: '', itemName: '', quantity: 1 },
  ]);
  const [priority, setPriority] = useState<'routine' | 'urgent'>('routine');
  const [supplyNotes, setSupplyNotes] = useState('');

  const createRequest = useCreateSupplyRequest();
  const { data: requestsData, isLoading: requestsLoading } = useSupplyRequests({});
  const { data: wardsData } = useWards();
  // Fetch a list of inventory items the nurse can pick from. If a ward is
  // selected, scope to it; otherwise show everything (full formulary search).
  const { data: invData } = useWardInventory({
    wardId: selectedWardId || undefined,
    search: itemSearch || undefined,
    limit: 50,
  });

  const wards = (wardsData ?? []) as WardWithDept[];
  const selectedWard = wards.find((w) => w.id === selectedWardId);
  const resolvedDepartmentId =
    selectedWard?.departmentId ?? selectedWard?.department?.id ?? '';

  const inventoryOptions = (invData?.data ?? []) as InventoryItem[];
  const recentRequests = (requestsData?.data ?? requestsData ?? []) as SupplyRequest[];

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { inventoryItemId: '', itemName: '', quantity: 1 }]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const updateItem = useCallback(
    (index: number, patch: Partial<SupplyItem>) => {
      setItems((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;
          return { ...item, ...patch };
        }),
      );
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    if (!selectedWardId || !resolvedDepartmentId) {
      toast.error('Please select a ward (with a linked department) first.');
      return;
    }
    const validItems = items.filter((i) => i.inventoryItemId && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please pick at least one inventory item.');
      return;
    }

    // Backend creates one request per item. Submit sequentially and report
    // aggregate status at the end so the nurse sees a single toast.
    let completed = 0;
    let failed = 0;

    validItems.forEach((item) => {
      createRequest.mutate(
        {
          departmentId: resolvedDepartmentId,
          wardId: selectedWardId,
          inventoryItemId: item.inventoryItemId,
          quantityRequested: item.quantity,
          urgency: priority,
          notes: supplyNotes.trim() || undefined,
        },
        {
          onSuccess: () => {
            completed += 1;
            if (completed + failed === validItems.length) {
              toast.success(
                failed === 0
                  ? `Supply request submitted (${completed} item${completed !== 1 ? 's' : ''})`
                  : `Submitted ${completed}/${validItems.length} items. ${failed} failed.`,
              );
              setItems([{ inventoryItemId: '', itemName: '', quantity: 1 }]);
              setPriority('routine');
              setSupplyNotes('');
            }
          },
          onError: () => {
            failed += 1;
            if (completed + failed === validItems.length) {
              toast.error(
                completed === 0
                  ? 'Failed to submit supply request'
                  : `Submitted ${completed}/${validItems.length} items. ${failed} failed.`,
              );
            }
          },
        },
      );
    });
  }, [selectedWardId, resolvedDepartmentId, items, priority, supplyNotes, createRequest]);

  const requestStatusColor: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-blue-100 text-blue-700',
    fulfilled: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const priorityBadge: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-blue-100 text-blue-700',
    urgent: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <h2 className="font-headline text-base font-semibold">Request Supplies</h2>

      {/* Supply Request Form */}
      <div className="rounded-lg border border-outline-variant p-4 space-y-4">
        {/* Ward + Item search */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Ward *
            </label>
            <Select
              value={selectedWardId}
              onValueChange={(val) => setSelectedWardId(val ?? '')}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select ward" />
              </SelectTrigger>
              <SelectContent>
                {wards.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                    {w.department ? ` — ${w.department.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWardId && !resolvedDepartmentId && (
              <p className="text-[10px] text-amber-600">
                Selected ward has no linked department — cannot submit request.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Search Items
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant" />
              <Input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Type to filter inventory..."
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Item rows */}
        <div className="space-y-2">
          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            Items *
          </label>
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select
                value={item.inventoryItemId}
                onValueChange={(val) => {
                  if (!val) return;
                  const picked = inventoryOptions.find((o) => o.id === val);
                  updateItem(idx, {
                    inventoryItemId: val,
                    itemName: picked?.name ?? '',
                  });
                }}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Select inventory item" />
                </SelectTrigger>
                <SelectContent>
                  {inventoryOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-on-surface-variant">
                      No inventory items found
                    </div>
                  ) : (
                    inventoryOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                        {opt.unit ? ` (${opt.unit})` : ''}
                        {opt.currentStock != null ? ` — ${opt.currentStock} avail` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                min={1}
                className="h-8 text-xs w-20"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-on-surface-variant hover:text-red-600"
                onClick={() => removeItem(idx)}
                disabled={items.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
            <Plus className="mr-1 h-3 w-3" />
            Add Item
          </Button>
        </div>

        {/* Priority + Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Urgency
            </label>
            <Select
              value={priority}
              onValueChange={(val) => {
                if (val) setPriority(val as 'routine' | 'urgent');
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Notes
            </label>
            <Textarea
              value={supplyNotes}
              onChange={(e) => setSupplyNotes(e.target.value)}
              placeholder="Additional notes..."
              className="text-xs min-h-[36px] resize-none"
              rows={1}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={
              createRequest.isPending ||
              !selectedWardId ||
              !resolvedDepartmentId ||
              items.every((i) => !i.inventoryItemId)
            }
            className="h-9"
          >
            {createRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <ShoppingCart className="mr-2 h-4 w-4" />
            Submit Supply Request
          </Button>
        </div>
      </div>

      {/* Recent Supply Requests */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-on-surface-variant">Recent Supply Requests</h3>
        <div className="overflow-x-auto rounded-lg border border-outline-variant">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">ID</th>
                <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Items</th>
                <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Priority</th>
                <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Status</th>
                <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Requested By</th>
                <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {requestsLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant text-sm">
                    No supply requests found
                  </td>
                </tr>
              ) : (
                recentRequests.map((req) => (
                  <tr key={req.id} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{req.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {req.items.slice(0, 3).map((item, i) => (
                          <span key={i} className="text-[10px] bg-surface-container px-1.5 py-0.5 rounded">
                            {item.itemName} x{item.quantity}
                          </span>
                        ))}
                        {req.items.length > 3 && (
                          <span className="text-[10px] text-on-surface-variant">+{req.items.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', priorityBadge[req.priority])}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', requestStatusColor[req.status] || 'bg-slate-100 text-slate-600')}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {req.requestedBy ? `${req.requestedBy.firstName} ${req.requestedBy.lastName}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {formatDateTime(req.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
