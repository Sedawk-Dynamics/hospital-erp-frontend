'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pill, Loader2, Search, BedDouble, Building2 } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { formatBaseQty } from '@/lib/pharmacy-units';

// "Medicines sent to IP" — every medicine dispensed to an admitted patient,
// billed onto the hospital IP bill (NOT the pharmacy counter).

interface IpDispensedRow {
  id: string;
  dispensedAt: string;
  drugName: string;
  dosageForm: string | null;
  looseUnitLabel: string | null;
  batchNumber: string;
  quantity: number;
  saleUnit: string;
  unitPrice: number;
  lineTotal: number;
  isTto: boolean;
  patient: { id: string; mrn: string | null; firstName: string; lastName: string };
  dispensedBy: string | null;
  bill: { id: string; billNumber: string; status: string };
  ward: string | null;
  bed: string | null;
}
interface IpDispensedResp { rows: IpDispensedRow[]; count: number; totalAmount: number }

const money = (n: number) => `₹${(n ?? 0).toFixed(2)}`;

export default function IpMedicinesPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pharmacy', 'ip-dispensed'],
    queryFn: async () => (await apiGet<IpDispensedResp>('/pharmacy/ip-dispensed', { params: { limit: 300 } })).data,
  });

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) =>
      r.drugName.toLowerCase().includes(q) ||
      `${r.patient.firstName} ${r.patient.lastName}`.toLowerCase().includes(q) ||
      (r.patient.mrn ?? '').toLowerCase().includes(q) ||
      (r.ward ?? '').toLowerCase().includes(q),
    );
  }, [data, search]);

  const shownTotal = rows.reduce((s, r) => s + r.lineTotal, 0);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 font-headline text-xl font-bold">
            <Pill className="h-5 w-5 text-primary" /> IP Medicines
          </h1>
          <p className="text-sm text-muted-foreground">All medicines dispensed to admitted patients — billed to the hospital IP bill, not the pharmacy counter.</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drug / patient / MRN / ward…" className="pl-8 h-9 text-sm" />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{rows.length} line{rows.length === 1 ? '' : 's'}</span>
            <span className="font-semibold">Total {money(shownTotal)}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No IP medicines dispensed yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Ward / Bed</th>
                  <th className="px-3 py-2">Medicine</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">IP Bill</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-[12px] text-muted-foreground">{formatDateTimeAmPm(r.dispensedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.patient.firstName} {r.patient.lastName}</div>
                      <div className="text-[11px] text-muted-foreground">{r.patient.mrn}</div>
                    </td>
                    <td className="px-3 py-2 text-[12px]">
                      <span className="inline-flex items-center gap-1"><BedDouble className="h-3 w-3 text-muted-foreground" />{[r.ward, r.bed].filter(Boolean).join(' · ') || '—'}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.drugName}
                        {r.isTto && <Badge variant="outline" className="ml-1.5 text-[9px]">TTO</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Batch {r.batchNumber}</div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatBaseQty(r.quantity, r.dosageForm, r.looseUnitLabel)}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(r.lineTotal)}</td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-1 text-[12px]">
                        <Building2 className="h-3 w-3 text-primary" />
                        <span className="font-mono text-[11px]">{r.bill.billNumber}</span>
                      </div>
                      <div className="text-[10px] uppercase text-muted-foreground">{r.bill.status.replace('_', ' ')}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          These charges are on the patient&apos;s <strong>hospital IP bill</strong> (settled in Hospital Billing). IP medicines are never billed at the pharmacy counter.
        </p>
      </div>
    </div>
  );
}
