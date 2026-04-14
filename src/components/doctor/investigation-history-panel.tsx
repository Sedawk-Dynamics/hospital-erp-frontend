'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface LabResult {
  id: string;
  parameterName: string;
  value?: string | null;
  unit?: string | null;
  normalRange?: string | null;
  isAbnormal: boolean;
  enteredAt: string;
}

interface LabOrderItem {
  id: string;
  status: string;
  test: { id: string; testName: string; testCode?: string; labDepartment?: { name?: string } | null } | null;
  labResults: LabResult[];
}

interface LabOrder {
  id: string;
  status: string;
  urgency: string;
  createdAt: string;
  orderer?: { firstName: string; lastName: string } | null;
  visit?: { visitType: string; visitDate: string } | null;
  labOrderItems: LabOrderItem[];
  labReport?: { id: string; status: string; signedAt?: string | null; publishedAt?: string | null } | null;
}

interface AbnormalFlat {
  orderId: string;
  testName: string;
  parameterName: string;
  value: string | null;
  unit: string | null;
  normalRange: string | null;
  enteredAt: string;
}

type Tab = 'recent' | 'abnormal';

export function InvestigationHistoryPanel({ patientId }: { patientId: string }) {
  const [tab, setTab] = useState<Tab>('recent');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['doctor', 'investigation-history', patientId],
    queryFn: async () => {
      const res = await apiGet<{ orders: LabOrder[]; abnormalFlat: AbnormalFlat[] }>(
        `/lab/investigation-history/${patientId}`,
      );
      return res.data ?? { orders: [], abnormalFlat: [] };
    },
    enabled: !!patientId,
  });

  const orders = data?.orders ?? [];
  const abnormal = data?.abnormalFlat ?? [];

  return (
    <div>
      {abnormal.length > 0 && (
        <div className="pb-2">
          <Badge className="bg-red-100 text-red-700 text-[10px]">
            {abnormal.length} abnormal
          </Badge>
        </div>
      )}
      <div className="flex gap-1 pb-3">
        {(['recent', 'abnormal'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium capitalize',
              t === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t}
            <span className="ml-1 rounded-full bg-black/10 px-1 text-[9px] font-bold">
              {t === 'recent' ? orders.length : abnormal.length}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-3">Loading...</p>
        ) : tab === 'recent' ? (
          orders.length === 0 ? (
            <Empty label="No lab orders yet" />
          ) : (
            orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                isExpanded={expanded === o.id}
                onToggle={() => setExpanded(expanded === o.id ? null : o.id)}
              />
            ))
          )
        ) : abnormal.length === 0 ? (
          <Empty label="No abnormal results" />
        ) : (
          <div className="space-y-1.5">
            {abnormal.map((a, i) => (
              <div key={i} className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <AlertCircle className="h-3 w-3 text-red-600 shrink-0" />
                  <span className="font-semibold text-foreground">{a.testName}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-foreground/80">{a.parameterName}</span>
                </div>
                <div className="mt-0.5 text-foreground/80">
                  <span className="font-semibold text-red-700">{a.value ?? '-'}</span>
                  {a.unit && <span> {a.unit}</span>}
                  {a.normalRange && <span className="text-muted-foreground"> (Ref: {a.normalRange})</span>}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(a.enteredAt).toLocaleDateString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  isExpanded,
  onToggle,
}: {
  order: LabOrder;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const date = new Date(order.createdAt).toLocaleDateString('en-IN');
  const tests = order.labOrderItems.map((i) => i.test?.testName || 'Test').join(', ');
  const hasReport = !!order.labReport;
  const reportPublished = order.labReport?.status === 'published';

  const statusIcon = order.status === 'completed'
    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
    : <Clock className="h-3.5 w-3.5 text-amber-600" />;

  return (
    <div className="rounded-md border text-xs overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 text-left"
      >
        {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        {statusIcon}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{tests}</p>
          <p className="text-[10px] text-muted-foreground">
            {date}
            {order.orderer && ` · Dr. ${order.orderer.firstName} ${order.orderer.lastName}`}
          </p>
        </div>
        <Badge className={cn('text-[9px] px-1 py-0', reportPublished ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground')}>
          {hasReport ? order.labReport!.status : order.status}
        </Badge>
      </button>

      {isExpanded && (
        <div className="border-t bg-muted/30 p-2 space-y-2">
          {order.labOrderItems.map((item) => (
            <div key={item.id}>
              <p className="font-semibold text-foreground/90">
                {item.test?.testName || 'Test'}
                {item.test?.labDepartment?.name && (
                  <span className="text-muted-foreground font-normal"> · {item.test.labDepartment.name}</span>
                )}
              </p>
              {item.labResults.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic pl-2">No results entered yet</p>
              ) : (
                <table className="w-full text-[11px] mt-1">
                  <tbody>
                    {item.labResults.map((r) => (
                      <tr key={r.id} className={cn(r.isAbnormal && 'text-red-700')}>
                        <td className="py-0.5 pr-2">{r.parameterName}</td>
                        <td className={cn('py-0.5 pr-2 font-semibold', r.isAbnormal && 'text-red-700')}>
                          {r.value ?? '-'} {r.unit}
                        </td>
                        <td className="py-0.5 text-muted-foreground">{r.normalRange || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="text-center py-6 text-xs text-muted-foreground">
      <FlaskConical className="h-6 w-6 mx-auto mb-1 opacity-40" />
      {label}
    </div>
  );
}
