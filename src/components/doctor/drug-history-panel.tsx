'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pill, History } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DrugEntry {
  itemId: string;
  prescriptionId: string;
  prescriptionType: 'op' | 'ip';
  drugName: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  route?: string | null;
  instructions?: string | null;
  isPrn: boolean;
  prescribedAt: string;
  doctorName: string;
}

type Tab = 'current' | 'past';

export function DrugHistoryPanel({ patientId }: { patientId: string }) {
  const [tab, setTab] = useState<Tab>('current');

  const { data, isLoading } = useQuery({
    queryKey: ['doctor', 'drug-history', patientId],
    queryFn: async () => {
      const res = await apiGet<{ current: DrugEntry[]; past: DrugEntry[] }>(
        `/prescriptions/drug-history/${patientId}`,
      );
      return res.data ?? { current: [], past: [] };
    },
    enabled: !!patientId,
  });

  const current = data?.current ?? [];
  const past = data?.past ?? [];
  const entries = tab === 'current' ? current : past;

  return (
    <div>
      <div className="flex gap-2 pb-3">
        {(['current', 'past'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors capitalize',
              t === tab
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[9px] font-bold">
              {t === 'current' ? current.length : past.length}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-xs text-muted-foreground py-3">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            <Pill className="h-6 w-6 mx-auto mb-1 opacity-40" />
            No {tab} medications
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.itemId} className="rounded-md border px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-foreground">{e.drugName}</span>
                <Badge className="text-[9px] px-1 py-0 uppercase">{e.prescriptionType}</Badge>
                {e.isPrn && (
                  <Badge className="bg-secondary/10 text-secondary text-[9px] px-1 py-0">PRN</Badge>
                )}
              </div>
              <div className="text-foreground/70 mt-0.5">
                {[e.dosage, e.frequency, e.duration].filter(Boolean).join(' · ') || '—'}
              </div>
              <div className="text-muted-foreground text-[10px] mt-0.5">
                {e.doctorName} · {new Date(e.prescribedAt).toLocaleDateString('en-IN')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
