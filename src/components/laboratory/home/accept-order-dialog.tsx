'use client';

// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useAcceptLabOrder,
  type LabOrder
} from '@/hooks/use-lab';
import { useUsersList } from '@/hooks/use-users';
import { getApiErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';


// ============================================================
// Accept Order Dialog
// ============================================================
export function AcceptOrderDialog({
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

  // Clear between orders. The dialog kept the previous order's technician and
  // note, so accepting several in a row silently reused the last choice.
  useSeedOnChange(order?.id ?? null, () => {
    setTechId('');
    setNotes('');
  });

  const labStaff = useMemo(
    () =>
      (usersQ.data?.data ?? []).filter((u) =>
        u.userRoles?.some((ur) => ['lab_technician', 'lab_supervisor'].includes(ur.role.name)),
      ),
    [usersQ.data],
  );

  // What is actually being admitted to the bench. Accepting used to show only
  // the patient's name — no tests, no urgency — so a supervisor was assigning
  // work without being shown what the work was.
  const items = order?.labOrderItems ?? [];
  const urgency = (order as { urgency?: string } | null)?.urgency;
  const isUrgent = urgency === 'stat' || urgency === 'urgent';

  const handle = async () => {
    if (!order) return;
    try {
      await acceptMutation.mutateAsync({
        id: order.id,
        assignedToId: techId || undefined,
        notes: notes || undefined,
      });
      toast.success(techId ? 'Order accepted and assigned' : 'Order accepted');
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to accept order'));
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Accept Lab Order</DialogTitle>
          <DialogDescription>
            Admits the order to the bench. Assign a technician now, or leave it in
            the unassigned queue for someone to pick up.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-surface-container-low px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {order?.patient.firstName} {order?.patient.lastName ?? ''}
              </span>
              {isUrgent && (
                <Badge className="bg-red-100 text-red-700 uppercase text-[10px]">
                  {urgency}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {order?.patient.mrn}
              {order?.orderNumber ? ` · ${order.orderNumber}` : ''}
              {order?.orderer ? ` · Dr. ${order.orderer.firstName} ${order.orderer.lastName}` : ''}
            </p>
          </div>

          <div>
            <Label>
              Tests ordered ({items.length})
            </Label>
            {items.length === 0 ? (
              <p className="mt-1 text-xs italic text-muted-foreground">
                No tests on this order.
              </p>
            ) : (
              <ul className="mt-1 max-h-32 divide-y overflow-y-auto rounded-lg border">
                {items.map((it) => (
                  <li key={it.id} className="px-3 py-1.5 text-xs">
                    {it.test?.testName ?? 'Test'}
                    {it.test?.testCode && (
                      <span className="ml-1.5 text-muted-foreground">{it.test.testCode}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <Label>Assign to</Label>
            <select
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={techId}
              onChange={(e) => setTechId(e.target.value)}
            >
              <option value="">Leave unassigned</option>
              {labStaff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Unassigned orders show under the Unassigned filter on the work queue.
            </p>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional intake note for the bench"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={acceptMutation.isPending}>
            Cancel
          </Button>
          {/* No longer requires a technician. Accepting and assigning are two
              decisions, and forcing them together meant an order could not be
              admitted at all until somebody was free to own it. */}
          <Button onClick={handle} disabled={acceptMutation.isPending}>
            {acceptMutation.isPending ? 'Accepting…' : techId ? 'Accept & Assign' : 'Accept'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
