'use client';

// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import { useMemo, useState } from 'react';
import {
  useLabOrders,
  type LabOrder
} from '@/hooks/use-lab';
import { useUsersList } from '@/hooks/use-users';
import { cn } from '@/lib/utils';
import { AcceptOrderDialog } from '@/components/laboratory/home/accept-order-dialog';
import { EmptyRow, LoadingRow, PaginationBar, StatusBadge, Th } from '@/components/laboratory/home/lab-table-bits';
import { OrderTable } from '@/components/laboratory/home/order-table';


// ============================================================
// Technicians Tab — workload per technician
// ============================================================
export function TechniciansTab() {
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
export function OutsourceTab() {
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
                  <td className="px-4 py-3"><StatusBadge status={o.status} reportStatus={o.labReport?.status} /></td>
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
export function IncomingOrderTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useLabOrders({ accepted: false, status: 'ordered', page, limit: 20 });
  const orders = data?.data ?? [];

  const [acceptFor, setAcceptFor] = useState<LabOrder | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-900">
        These orders are waiting on the lab. Accepting takes the payment at this counter (or posts
        it to the patient&apos;s stay ledger) and hands the work to a technician.
      </div>

      <OrderTable
        orders={orders}
        loading={isLoading}
        emptyMsg="No incoming orders."
        onAccept={setAcceptFor}
        showBill
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
