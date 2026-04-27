'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiPost } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import {
  useOrderAcknowledgements,
  type OrderAcknowledgement,
  type ListAcksQuery,
} from '@/hooks/use-order-acknowledgements';

interface Props {
  /** Filter to orders for this admission (via its visit). Optional — if absent, uses `scope`. */
  admissionId?: string;
  visitId?: string;
  scope?: ListAcksQuery['scope'];
  wardId?: string;
  /** When true, show the Acknowledge button for pending orders. */
  canAcknowledge?: boolean;
}

/**
 * Embeddable orders list with per-row Acknowledge action. Reused across the
 * nurse patient-detail page and the ward orders oversight view.
 */
export function OrdersPanel({
  admissionId,
  visitId,
  scope = 'mine',
  wardId,
  canAcknowledge = true,
}: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useOrderAcknowledgements({
    scope: admissionId || visitId ? 'all' : scope,
    wardId,
    status: 'all',
    orderType: 'all',
    limit: 200,
  });

  // Client-side filter when an admission/visit was provided.
  const orders = useMemo(() => {
    const list = data?.orders ?? [];
    if (!admissionId && !visitId) return list;
    return list.filter((o) => {
      if (visitId && (o as any).visit?.id === visitId) return true;
      if (visitId && (o as any).visitId === visitId) return true;
      return false;
    });
  }, [data, admissionId, visitId]);

  async function handleAcknowledge(order: OrderAcknowledgement) {
    try {
      await apiPost('/clinical/orders/acknowledge', {
        orderType: order.orderType,
        orderId: order.id,
      });
      toast.success('Order acknowledged');
      qc.invalidateQueries({ queryKey: ['order-acknowledgements'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to acknowledge';
      toast.error(msg);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Doctor orders</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No orders yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const ack = o.acknowledgement;
                return (
                  <TableRow key={`${o.orderType}-${o.id}`}>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {o.orderType === 'lab' ? 'Lab order' : 'Imaging request'}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {o.id.slice(0, 8)}…
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.createdAt ? format(parseISO(o.createdAt as string), 'dd/MM/yyyy HH:mm') : '—'}
                    </TableCell>
                    <TableCell>
                      {ack ? (
                        <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Ack {format(parseISO(ack.acknowledgedAt), 'dd/MM HH:mm')} by{' '}
                          {ack.acknowledgedBy.firstName}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
                          <Circle className="h-3.5 w-3.5" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canAcknowledge && !ack ? (
                        <Button size="sm" variant="outline" onClick={() => handleAcknowledge(o)}>
                          Acknowledge
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
