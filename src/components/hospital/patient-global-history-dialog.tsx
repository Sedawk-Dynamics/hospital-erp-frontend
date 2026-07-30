'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Building2, Stethoscope, BedDouble, Pill, FlaskConical, Scan, Receipt } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';

interface HistoryRowHospital { hospital: string }
interface GlobalHistory {
  person: { firstName: string; lastName: string | null; dateOfBirth: string | null; gender: string | null };
  hospitals: { tenantId: string; name: string; mrn: string; isCurrent: boolean }[];
  visits: (HistoryRowHospital & { date: string; type: string | null; status: string | null; chiefComplaint: string | null; doctor: string | null })[];
  admissions: (HistoryRowHospital & { admittedAt: string; dischargedAt: string | null; status: string | null; ward: string | null; bed: string | null; doctor: string | null })[];
  prescriptions: (HistoryRowHospital & { date: string; status: string | null; doctor: string | null; items: number })[];
  labOrders: (HistoryRowHospital & { date: string; status: string | null; tests: string[] })[];
  imaging: (HistoryRowHospital & { date: string; modality: string | null; bodyPart: string | null; status: string | null })[];
  bills: (HistoryRowHospital & { billNumber: string; date: string; status: string | null; total: number; paid: number; balance: number })[];
}

const money = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const d = (v?: string | null) => { if (!v) return '—'; try { return formatDate(v); } catch { return '—'; } };

function HospitalTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      <Building2 className="h-2.5 w-2.5" />{name}
    </span>
  );
}

function Section({ icon: Icon, title, count, children }: { icon: typeof Stethoscope; title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />{title}
        <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{count}</span>
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

const rowCls = 'flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border bg-card px-2.5 py-1.5 text-xs';

export function PatientGlobalHistoryDialog({
  patientId, patientName, open, onOpenChange,
}: {
  patientId: string | null;
  patientName?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'global-history', patientId],
    queryFn: async () => (await apiGet<GlobalHistory>(`/patients/${patientId}/global-history`)).data,
    enabled: open && !!patientId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Patient history — across all hospitals</DialogTitle>
          <DialogDescription>
            {patientName ? <>Everything recorded for <strong>{patientName}</strong> at every hospital on the ERP.</> : 'Unified record across every hospital this person has visited.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Hospitals this person is registered at */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-2">
              <span className="text-[11px] font-medium text-muted-foreground">Registered at:</span>
              {data.hospitals.map((h) => (
                <span key={h.tenantId} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${h.isCurrent ? 'bg-primary text-on-primary' : 'bg-card border'}`}>
                  {h.name} <span className="opacity-70">· {h.mrn}</span>{h.isCurrent && ' · here'}
                </span>
              ))}
            </div>

            {data.visits.length + data.admissions.length + data.prescriptions.length + data.labOrders.length + data.imaging.length + data.bills.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No clinical records found yet.</p>
            )}

            <Section icon={BedDouble} title="Admissions (IP)" count={data.admissions.length}>
              {data.admissions.map((a, i) => (
                <div key={i} className={rowCls}>
                  <HospitalTag name={a.hospital} />
                  <span className="font-medium">{d(a.admittedAt)}{a.dischargedAt ? ` → ${d(a.dischargedAt)}` : ''}</span>
                  {a.ward && <span className="text-muted-foreground">{a.ward}{a.bed ? ` / ${a.bed}` : ''}</span>}
                  {a.doctor && <span className="text-muted-foreground">{a.doctor}</span>}
                  {a.status && <Badge variant="outline" className="ml-auto text-[10px] capitalize">{a.status}</Badge>}
                </div>
              ))}
            </Section>

            <Section icon={Stethoscope} title="Consultations (OP)" count={data.visits.length}>
              {data.visits.map((v, i) => (
                <div key={i} className={rowCls}>
                  <HospitalTag name={v.hospital} />
                  <span className="font-medium">{d(v.date)}</span>
                  {v.doctor && <span className="text-muted-foreground">{v.doctor}</span>}
                  {v.chiefComplaint && <span className="truncate text-muted-foreground">· {v.chiefComplaint}</span>}
                  {v.status && <Badge variant="outline" className="ml-auto text-[10px] capitalize">{v.status}</Badge>}
                </div>
              ))}
            </Section>

            <Section icon={Pill} title="Prescriptions" count={data.prescriptions.length}>
              {data.prescriptions.map((p, i) => (
                <div key={i} className={rowCls}>
                  <HospitalTag name={p.hospital} />
                  <span className="font-medium">{d(p.date)}</span>
                  {p.doctor && <span className="text-muted-foreground">{p.doctor}</span>}
                  <span className="text-muted-foreground">· {p.items} item{p.items === 1 ? '' : 's'}</span>
                  {p.status && <Badge variant="outline" className="ml-auto text-[10px] capitalize">{p.status}</Badge>}
                </div>
              ))}
            </Section>

            <Section icon={FlaskConical} title="Lab orders" count={data.labOrders.length}>
              {data.labOrders.map((o, i) => (
                <div key={i} className={rowCls}>
                  <HospitalTag name={o.hospital} />
                  <span className="font-medium">{d(o.date)}</span>
                  <span className="truncate text-muted-foreground">{o.tests.slice(0, 4).join(', ')}{o.tests.length > 4 ? ` +${o.tests.length - 4}` : ''}</span>
                  {o.status && <Badge variant="outline" className="ml-auto text-[10px] capitalize">{o.status}</Badge>}
                </div>
              ))}
            </Section>

            <Section icon={Scan} title="Imaging" count={data.imaging.length}>
              {data.imaging.map((r, i) => (
                <div key={i} className={rowCls}>
                  <HospitalTag name={r.hospital} />
                  <span className="font-medium">{d(r.date)}</span>
                  <span className="text-muted-foreground capitalize">{r.modality ?? ''}{r.bodyPart ? ` · ${r.bodyPart}` : ''}</span>
                  {r.status && <Badge variant="outline" className="ml-auto text-[10px] capitalize">{r.status}</Badge>}
                </div>
              ))}
            </Section>

            <Section icon={Receipt} title="Bills" count={data.bills.length}>
              {data.bills.map((b, i) => (
                <div key={i} className={rowCls}>
                  <HospitalTag name={b.hospital} />
                  <span className="font-mono text-[11px]">{b.billNumber}</span>
                  <span className="text-muted-foreground">{d(b.date)}</span>
                  <span className="ml-auto font-medium">{money(b.total)}</span>
                  {b.balance > 0 ? <span className="text-error">{money(b.balance)} due</span> : <span className="text-emerald-600">paid</span>}
                </div>
              ))}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
