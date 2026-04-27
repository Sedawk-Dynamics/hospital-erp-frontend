'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNurseAdmissions } from '@/hooks/use-nurse';
import {
  useOrderAcknowledgements,
  type OrderAcknowledgement,
} from '@/hooks/use-order-acknowledgements';

export default function WardOrdersPage() {
  const [wardId, setWardId] = useState<string>('');
  const [status, setStatus] = useState<'pending' | 'acknowledged' | 'all'>('all');

  const { data: admissionsRes } = useNurseAdmissions({ status: 'admitted', limit: 200 });
  const admissions = extractList<any>(admissionsRes);
  const wards = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of admissions) {
      if (a.ward?.id && a.ward?.name) map.set(a.ward.id, a.ward.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [admissions]);

  // Default to the first ward once known.
  const effectiveWardId = wardId || wards[0]?.id || '';

  const { data, isLoading } = useOrderAcknowledgements(
    effectiveWardId
      ? { scope: 'ward', wardId: effectiveWardId, status, orderType: 'all', limit: 200 }
      : { scope: 'all', status, orderType: 'all', limit: 200 },
  );

  const orders = data?.orders ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ward Orders</h1>
        <p className="text-sm text-muted-foreground">
          Doctor-ordered lab tests and imaging for patients in your ward, with live acknowledgement
          status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Ward</label>
            <Select
              value={effectiveWardId}
              onValueChange={(value) => {
                if (value) setWardId(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a ward" />
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
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select
              value={status}
              onValueChange={(value) => {
                if (value) setStatus(value as typeof status);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading orders…
            </div>
          ) : orders.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No orders match the current filter.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead>Acknowledgement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <OrderRow key={`${o.orderType}-${o.id}`} order={o} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrderRow({ order }: { order: OrderAcknowledgement }) {
  const patient = order.patient;
  const patientName = `${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim() || 'Unknown';
  const ack = order.acknowledgement;
  return (
    <TableRow>
      <TableCell>
        <div className="text-sm font-medium">{patientName}</div>
        <div className="text-xs text-muted-foreground">{patient?.mrn ?? '—'}</div>
      </TableCell>
      <TableCell>
        <div className="text-sm">{order.orderType === 'lab' ? 'Lab order' : 'Imaging request'}</div>
        <div className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8)}…</div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {order.createdAt ? format(parseISO(order.createdAt as string), 'dd/MM/yyyy HH:mm') : '—'}
      </TableCell>
      <TableCell>
        {ack ? (
          <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ack by {ack.acknowledgedBy.firstName} {ack.acknowledgedBy.lastName ?? ''} ·{' '}
            {format(parseISO(ack.acknowledgedAt), 'dd/MM HH:mm')} IST
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
            <Circle className="h-3.5 w-3.5" />
            Pending
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

function extractList<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res?.data)) return res.data as T[];
  if (Array.isArray(res?.items)) return res.items as T[];
  return [];
}
