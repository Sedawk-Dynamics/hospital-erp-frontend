'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, BedDouble, Activity, Pill, Scissors,
  Receipt, FileCheck, ClipboardList, HeartPulse,
} from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface Vital {
  recordedAt?: string | null; bp?: string | null; pulse?: number | null; temp?: number | null;
  rr?: number | null; spo2?: number | null; weight?: number | null; height?: number | null; bmi?: number | null; sugar?: number | null;
}
interface MedItem { drug: string; dosage?: string | null; frequency?: string | null; duration?: string | null; route?: string | null; instructions?: string | null; isPrn?: boolean | null }
interface Medication { id: string; prescribedAt?: string | null; status?: string | null; notes?: string | null; doctor?: string | null; items: MedItem[] }
interface BillItem { description: string; quantity: number; amount: number }
interface Bill { id: string; billNumber: string; status: string; total: number; paid: number; balance: number; items: BillItem[] }
interface AdmissionDetail {
  id: string; status: string; hospital?: string | null; dischargeSummaryId?: string | null;
  patient: { name: string; mrn?: string | null; dateOfBirth?: string | null; gender?: string | null; bloodGroup?: string | null };
  admission: {
    admissionDate?: string | null; dischargeDate?: string | null; expectedDischargeDate?: string | null; lengthOfStayDays?: number | null;
    ward?: string | null; bed?: string | null; reason?: string | null; chiefComplaint?: string | null; doctor?: string | null; specialization?: string | null;
  };
  diagnoses: Array<{ name: string; type?: string | null; icdCode?: string | null }>;
  vitals: Vital[];
  medications: Medication[];
  procedures: Array<{ name: string; site?: string | null; at?: string | null; status?: string | null }>;
  billing: { deposit: number; total: number; paid: number; balance: number; bills: Bill[] };
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const rupee = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const ageOf = (dob?: string | null) => (dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 3.15576e10) : null);

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-5">
      <h2 className="mb-3 flex items-center gap-2 font-headline text-sm font-bold text-on-surface">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
      <span className="block text-[13px] font-medium text-on-surface break-words">{value || '—'}</span>
    </div>
  );
}

export default function AdmissionDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['patient', 'admission', id],
    queryFn: async () => (await apiGet<AdmissionDetail>(`/patient-portal/admissions/${id}`)).data,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center text-sm text-on-surface-variant">
          Could not load this hospitalization.
        </div>
      </div>
    );
  }

  const a = data;
  const age = ageOf(a.patient.dateOfBirth);

  return (
    <div className="space-y-4 pb-10">
      <BackLink />

      {/* Header */}
      <div className="rounded-xl bg-gradient-to-br from-primary/10 to-surface-container-lowest shadow-sanctuary p-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <BedDouble className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-headline text-xl font-extrabold text-on-surface">Hospitalization</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${a.status === 'admitted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                {a.status === 'admitted' ? 'Currently admitted' : a.status}
              </span>
            </div>
            <p className="text-[12px] text-on-surface-variant mt-1">
              {fmtDate(a.admission.admissionDate)}
              {a.status === 'discharged' && ` – ${fmtDate(a.admission.dischargeDate)}`}
              {a.admission.lengthOfStayDays != null && ` · ${a.admission.lengthOfStayDays} day(s)`}
              {a.hospital && ` · ${a.hospital}`}
            </p>
          </div>
          {a.dischargeSummaryId && (
            <Link href={`/patient-portal/discharge-summaries/${a.dischargeSummaryId}`}>
              <Button size="sm" className="gap-1.5"><FileCheck className="h-3.5 w-3.5" /> Discharge summary</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Admission + patient info */}
      <Section icon={ClipboardList} title="Admission details">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Field label="Patient" value={a.patient.name} />
          <Field label="MRN / UHID" value={a.patient.mrn} />
          <Field label="Age / Gender" value={`${age ?? '—'}${a.patient.gender ? ' / ' + a.patient.gender : ''}`} />
          <Field label="Blood Group" value={a.patient.bloodGroup} />
          <Field label="Attending Doctor" value={a.admission.doctor ? `${a.admission.doctor}${a.admission.specialization ? ' (' + a.admission.specialization + ')' : ''}` : null} />
          <Field label="Ward / Bed" value={[a.admission.ward, a.admission.bed].filter(Boolean).join(' · ') || null} />
          <Field label="Admitted" value={fmtDateTime(a.admission.admissionDate)} />
          <Field label={a.status === 'discharged' ? 'Discharged' : 'Expected discharge'} value={fmtDateTime(a.status === 'discharged' ? a.admission.dischargeDate : a.admission.expectedDischargeDate)} />
          <Field label="Length of Stay" value={a.admission.lengthOfStayDays != null ? `${a.admission.lengthOfStayDays} day(s)` : null} />
        </div>
        {(a.admission.reason || a.admission.chiefComplaint) && (
          <div className="mt-3 border-t border-outline-variant/50 pt-3">
            <Field label="Reason for admission / chief complaint" value={[a.admission.chiefComplaint, a.admission.reason].filter(Boolean).join(' — ')} />
          </div>
        )}
      </Section>

      {/* Diagnoses */}
      {a.diagnoses.length > 0 && (
        <Section icon={HeartPulse} title="Diagnoses">
          <div className="space-y-2">
            {a.diagnoses.map((d, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-lg bg-surface-container-low px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-on-surface">{d.name}</p>
                  {d.type && <p className="text-[11px] text-on-surface-variant capitalize">{d.type}</p>}
                </div>
                {d.icdCode && <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{d.icdCode}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Vitals timeline */}
      {a.vitals.length > 0 && (
        <Section icon={Activity} title="Vital signs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[12px]">
              <thead>
                <tr className="text-on-surface-variant">
                  {['Recorded', 'BP', 'Pulse', 'Temp', 'RR', 'SpO₂', 'Weight', 'Sugar'].map((h) => (
                    <th key={h} className="border-b border-outline-variant px-2 py-1.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.vitals.map((v, i) => (
                  <tr key={i} className={i % 2 ? 'bg-surface-container-low' : ''}>
                    <td className="px-2 py-1.5 text-on-surface-variant">{fmtDateTime(v.recordedAt)}</td>
                    <td className="px-2 py-1.5">{v.bp ?? '—'}</td>
                    <td className="px-2 py-1.5">{v.pulse ?? '—'}</td>
                    <td className="px-2 py-1.5">{v.temp != null ? `${v.temp}°C` : '—'}</td>
                    <td className="px-2 py-1.5">{v.rr ?? '—'}</td>
                    <td className="px-2 py-1.5">{v.spo2 != null ? `${v.spo2}%` : '—'}</td>
                    <td className="px-2 py-1.5">{v.weight != null ? `${v.weight} kg` : '—'}</td>
                    <td className="px-2 py-1.5">{v.sugar != null ? `${v.sugar}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Medications */}
      {a.medications.length > 0 && (
        <Section icon={Pill} title="Medications">
          <div className="space-y-4">
            {a.medications.map((rx) => (
              <div key={rx.id}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-on-surface">{fmtDate(rx.prescribedAt)}</span>
                  {rx.doctor && <span className="text-[11px] text-on-surface-variant">· {rx.doctor}</span>}
                  {rx.status && <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface-variant capitalize">{rx.status}</span>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] border-collapse text-[12px]">
                    <thead>
                      <tr className="text-on-surface-variant">
                        {['Medication', 'Dosage', 'Frequency', 'Duration', 'Route', 'Instructions'].map((h) => (
                          <th key={h} className="border-b border-outline-variant px-2 py-1.5 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rx.items.map((it, i) => (
                        <tr key={i} className={i % 2 ? 'bg-surface-container-low' : ''}>
                          <td className="px-2 py-1.5 font-medium text-on-surface">{it.drug}</td>
                          <td className="px-2 py-1.5">{it.dosage || '—'}</td>
                          <td className="px-2 py-1.5">{it.isPrn ? `${it.frequency || 'PRN'} (PRN)` : it.frequency || '—'}</td>
                          <td className="px-2 py-1.5">{it.duration || '—'}</td>
                          <td className="px-2 py-1.5">{it.route || '—'}</td>
                          <td className="px-2 py-1.5 text-on-surface-variant">{it.instructions || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rx.notes && <p className="mt-1 text-[11px] italic text-on-surface-variant">Advice: {rx.notes}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Procedures */}
      {a.procedures.length > 0 && (
        <Section icon={Scissors} title="Procedures">
          <div className="space-y-2">
            {a.procedures.map((p, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-lg bg-surface-container-low px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-on-surface">{p.name}{p.site ? ` · ${p.site}` : ''}</p>
                  <p className="text-[11px] text-on-surface-variant">{fmtDateTime(p.at)}</p>
                </div>
                {p.status && <span className="shrink-0 rounded bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface-variant capitalize">{p.status}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Billing */}
      <Section icon={Receipt} title="Bill">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total charges', value: rupee(a.billing.total) },
            { label: 'Deposit', value: rupee(a.billing.deposit) },
            { label: 'Paid', value: rupee(a.billing.paid) },
            { label: 'Balance due', value: rupee(a.billing.balance), accent: a.billing.balance > 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-surface-container-low px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{s.label}</p>
              <p className={`text-[15px] font-bold ${s.accent ? 'text-red-600' : 'text-on-surface'}`}>{s.value}</p>
            </div>
          ))}
        </div>
        {a.billing.bills.some((b) => b.items.length > 0) && (
          <div className="mt-3 space-y-3">
            {a.billing.bills.map((b) => (
              <div key={b.id}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-on-surface">{b.billNumber}</span>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface-variant capitalize">{b.status}</span>
                </div>
                {b.items.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] border-collapse text-[12px]">
                      <tbody>
                        {b.items.map((it, i) => (
                          <tr key={i} className={i % 2 ? 'bg-surface-container-low' : ''}>
                            <td className="px-2 py-1.5 text-on-surface">{it.description}</td>
                            <td className="px-2 py-1.5 text-right text-on-surface-variant">×{it.quantity}</td>
                            <td className="px-2 py-1.5 text-right font-medium text-on-surface">{rupee(it.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 border-t border-outline-variant/50 pt-2 text-right">
          <Link href="/patient-portal/billing" className="text-[12px] font-medium text-primary hover:underline">
            View all bills &amp; pay →
          </Link>
        </div>
      </Section>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/patient-portal/admissions" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-on-surface-variant hover:text-on-surface">
      <ArrowLeft className="h-4 w-4" /> Back to hospitalizations
    </Link>
  );
}
