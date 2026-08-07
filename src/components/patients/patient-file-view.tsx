'use client';

// ============================================================
// The centralized patient file.
//
// One page holding everything the hospital has on a patient — identity, safety,
// encounters, orders, money, documents. Before this, an admin answering "what
// has this patient had done here?" had to open six modules and hold the answer
// in their head.
//
// Shared by two routes because the content is the same and only the scope
// differs, which the backend decides and reports back in `access.scope`:
//   • /hospital/patients/[id]     — a hospital admin, their own patients only
//   • /super-admin/patients/[id]  — the platform view, any hospital
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  Building2,
  CalendarDays,
  FileText,
  FlaskConical,
  IndianRupee,
  Loader2,
  Pill,
  Scan,
  ShieldCheck,
  Stethoscope,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { usePatientFile, type PatientFile } from '@/hooks/use-patient-file';
import { resolveAttachmentUrl } from '@/hooks/use-lab-attachments';

const inr = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function age(dob: string | null): string {
  if (!dob) return '—';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return Number.isFinite(years) && years >= 0 ? `${years}y` : '—';
}

const SEVERITY_CLASS: Record<string, string> = {
  severe: 'bg-red-100 text-red-800 border-red-300',
  life_threatening: 'bg-red-100 text-red-800 border-red-300',
  moderate: 'bg-amber-100 text-amber-800 border-amber-300',
  mild: 'bg-yellow-50 text-yellow-800 border-yellow-300',
};

export function PatientFileView({ patientId, backHref }: { patientId: string; backHref: string }) {
  const { data, isLoading, isError, error } = usePatientFile(patientId);
  const [tab, setTab] = useState('overview');

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading patient file…
      </div>
    );
  }

  if (isError || !data) {
    // A patient registered at another hospital is reported as not found, not as
    // forbidden — so this message must not imply the record exists elsewhere.
    const message =
      (error as { response?: { status?: number } })?.response?.status === 404
        ? 'No patient file here. This patient is not registered at this hospital.'
        : 'Could not load this patient file.';
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" nativeButton={false} render={<Link href={backHref} />}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to patients
        </Button>
      </div>
    );
  }

  const p = data.patient;
  const name = `${p.firstName} ${p.lastName ?? ''}`.trim();

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="mt-0.5 h-8 w-8"
            nativeButton={false}
            render={<Link href={backHref} aria-label="Back to patients" />}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 font-headline text-xl font-bold">
              {name}
              {p.isTemporary && (
                <Badge variant="outline" className="border-amber-300 bg-amber-100 text-[10px] text-amber-800">
                  Temporary record
                </Badge>
              )}
              {!p.isActive && (
                <Badge variant="outline" className="text-[10px]">
                  Inactive
                </Badge>
              )}
              {data.status.currentlyAdmitted && (
                <Badge className="gap-1 bg-primary/10 text-[10px] text-primary">
                  <BedDouble className="h-3 w-3" /> Currently admitted
                </Badge>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              {p.mrn} · {age(p.dateOfBirth)} · {p.gender ?? '—'}
              {p.bloodGroup ? ` · ${p.bloodGroup}` : ''}
              {p.phone ? ` · ${p.phone}` : ''}
            </p>
          </div>
        </div>

        {/* Which view this is. Two people looking at the same patient should
            never have to guess why their lists differ. */}
        <Badge variant="outline" className="gap-1.5">
          <Building2 className="h-3 w-3" />
          {data.access.scope === 'platform'
            ? `Platform view · ${data.access.hospital.name}`
            : data.access.hospital.name}
        </Badge>
      </div>

      {/* ── Allergies first. This is the one thing that must never be a tab. ── */}
      {data.safety.allergies.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-red-800">
            <AlertTriangle className="h-3.5 w-3.5" /> Allergies
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {data.safety.allergies.map((a) => (
              <Badge
                key={a.id}
                variant="outline"
                className={cn('text-[10px]', SEVERITY_CLASS[a.severity ?? ''] ?? 'bg-white')}
              >
                {a.allergen}
                {a.severity ? ` · ${a.severity.replace(/_/g, ' ')}` : ''}
                {a.reaction ? ` — ${a.reaction}` : ''}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ── At a glance ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat icon={Stethoscope} label="OP visits" value={data.counts.visits} />
        <Stat icon={BedDouble} label="Admissions" value={data.counts.admissions} />
        <Stat icon={Pill} label="Prescriptions" value={data.counts.prescriptions} />
        <Stat icon={FlaskConical} label="Lab orders" value={data.counts.labOrders} />
        <Stat icon={Scan} label="Imaging" value={data.counts.imaging} />
        <Stat
          icon={IndianRupee}
          label="Outstanding"
          value={inr(data.billing.totals.outstanding)}
          tone={data.billing.totals.outstanding > 0 ? 'warn' : 'ok'}
        />
      </div>

      <Tabs value={tab} onValueChange={(v: string) => setTab(v)}>
        <TabsList variant="line" className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="encounters">Encounters ({data.counts.visits + data.counts.admissions})</TabsTrigger>
          <TabsTrigger value="clinical">Clinical</TabsTrigger>
          <TabsTrigger value="billing">Billing ({data.billing.totals.billCount})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({data.counts.documents})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab file={data} />
        </TabsContent>
        <TabsContent value="encounters">
          <EncountersTab file={data} />
        </TabsContent>
        <TabsContent value="clinical">
          <ClinicalTab file={data} />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab file={data} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab file={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function OverviewTab({ file }: { file: PatientFile }) {
  const p = file.patient;
  return (
    <div className="grid grid-cols-1 gap-4 pt-3 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-primary" /> Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Row label="MRN" value={p.mrn} />
          <Row label="ABHA" value={p.abhaNumber} />
          <Row label="Date of birth" value={p.dateOfBirth ? formatDate(p.dateOfBirth) : null} />
          <Row label="Gender" value={p.gender} />
          <Row label="Blood group" value={p.bloodGroup} />
          <Row label="Marital status" value={p.maritalStatus} />
          <Row label="Occupation" value={p.occupation} />
          <Row label="Nationality" value={p.nationality} />
          <Row label="ID proof" value={[p.idProofType, p.idProofNumber].filter(Boolean).join(' · ') || null} />
          <Row label="Referred by" value={p.referredBy} />
          <Row label="Registered on" value={formatDate(p.registeredOn)} />
          <Row label="Last updated" value={formatDate(p.updatedAt)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Row label="Phone" value={p.phone} />
            <Row label="Email" value={p.email} />
            <Row
              label="Address"
              value={
                [p.addressLine1, p.addressLine2, p.city, p.state, p.postalCode, p.country]
                  .filter(Boolean)
                  .join(', ') || null
              }
              span
            />
          </div>

          <div>
            <p className="mb-1 font-label text-[10px] uppercase tracking-widest text-muted-foreground">
              Emergency contacts
            </p>
            {file.emergencyContacts.length === 0 ? (
              <p className="text-xs text-muted-foreground">None on file.</p>
            ) : (
              <ul className="space-y-1">
                {file.emergencyContacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{c.name}</span>
                    {c.relationship && <span className="text-muted-foreground">({c.relationship})</span>}
                    <span className="text-muted-foreground">{c.phone}</span>
                    {c.isPrimary && <Badge className="text-[9px]">Primary</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-1 font-label text-[10px] uppercase tracking-widest text-muted-foreground">
              Patient portal
            </p>
            {file.portalAccount ? (
              <p className="text-xs">
                {file.portalAccount.email}
                <span className="ml-2 text-muted-foreground">
                  {file.portalAccount.isActive ? 'Active' : 'Disabled'}
                  {file.portalAccount.lastLoginAt
                    ? ` · last signed in ${formatDate(file.portalAccount.lastLoginAt)}`
                    : ' · never signed in'}
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No portal account linked.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {file.status.currentAdmission && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BedDouble className="h-4 w-4 text-primary" /> In hospital now
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Row label="Admitted" value={formatDateTime(file.status.currentAdmission.admittedOn)} />
            <Row label="Status" value={file.status.currentAdmission.status.replace(/_/g, ' ')} />
            <Row label="Ward / bed" value={[file.status.currentAdmission.ward, file.status.currentAdmission.bed].filter(Boolean).join(' / ') || null} />
            <Row label="Consultant" value={file.status.currentAdmission.doctor} />
          </CardContent>
        </Card>
      )}

      {/* Presence only — which hospitals know this person, never what they hold. */}
      {file.otherHospitals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-primary" /> Also known at
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {file.otherHospitals.map((h) => (
              <div key={h.patientId} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{h.name}</span>
                <span className="text-muted-foreground">
                  {h.mrn} · since {formatDate(h.firstSeen)}
                </span>
              </div>
            ))}
            <p className="pt-1 text-[10px] text-muted-foreground">
              Names and record numbers only. What those hospitals recorded stays with them.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EncountersTab({ file }: { file: PatientFile }) {
  return (
    <div className="space-y-4 pt-3">
      <Section title="Admissions" icon={BedDouble} empty={file.admissions.length === 0}>
        <Table
          head={['Admitted', 'Discharged', 'Ward / bed', 'Consultant', 'Status']}
          rows={file.admissions.map((a) => [
            formatDate(a.admittedOn),
            a.dischargedOn ? formatDate(a.dischargedOn) : '—',
            [a.ward, a.bed].filter(Boolean).join(' / ') || '—',
            a.doctor ?? '—',
            a.status.replace(/_/g, ' '),
          ])}
        />
      </Section>

      <Section title="OP visits" icon={Stethoscope} empty={file.visits.length === 0}>
        <Table
          head={['Date', 'Type', 'Chief complaint', 'Doctor', 'Diagnoses', 'Status']}
          rows={file.visits.map((v) => [
            formatDate(v.date),
            v.type ?? '—',
            v.chiefComplaint ?? '—',
            v.doctor ?? '—',
            String(v.diagnosisCount),
            v.status,
          ])}
        />
      </Section>

      <Section title="Appointments" icon={CalendarDays} empty={file.appointments.length === 0}>
        <Table
          head={['Date', 'Doctor', 'Type', 'Status']}
          rows={file.appointments.map((a) => [
            formatDate(a.date),
            a.doctor ?? '—',
            [a.type, a.visitType].filter(Boolean).join(' · ') || '—',
            a.status,
          ])}
        />
      </Section>
    </div>
  );
}

function ClinicalTab({ file }: { file: PatientFile }) {
  const ph = file.safety.personalHistory;
  return (
    <div className="space-y-4 pt-3">
      <Section title="Diagnoses" icon={ShieldCheck} empty={file.diagnoses.length === 0}>
        <Table
          head={['Recorded', 'Diagnosis', 'ICD', 'Type']}
          rows={file.diagnoses.map((d) => [formatDate(d.recordedOn), d.name, d.code ?? '—', d.type])}
        />
      </Section>

      <Section title="Prescriptions" icon={Pill} empty={file.prescriptions.length === 0}>
        <Table
          head={['Date', 'Doctor', 'Medicines', 'Type', 'Status']}
          rows={file.prescriptions.map((p) => [
            formatDate(p.date),
            p.doctor ?? '—',
            String(p.itemCount),
            p.type ?? '—',
            p.status,
          ])}
        />
      </Section>

      <Section title="Lab orders" icon={FlaskConical} empty={file.labOrders.length === 0}>
        <Table
          head={['Date', 'Tests', 'Order status', 'Report']}
          rows={file.labOrders.map((o) => [
            formatDate(o.date),
            o.tests.join(', ') || '—',
            o.status.replace(/_/g, ' '),
            o.reportStatus ?? 'Not issued',
          ])}
        />
      </Section>

      <Section title="Imaging" icon={Scan} empty={file.imaging.length === 0}>
        <Table
          head={['Date', 'Modality', 'Body part', 'Status']}
          rows={file.imaging.map((r) => [
            formatDate(r.date),
            r.modality ?? '—',
            r.bodyPart ?? '—',
            r.status.replace(/_/g, ' '),
          ])}
        />
      </Section>

      <Section title="Discharge summaries" icon={FileText} empty={file.dischargeSummaries.length === 0}>
        <Table
          head={['Created', 'Status']}
          rows={file.dischargeSummaries.map((s) => [formatDate(s.createdAt), s.status])}
        />
      </Section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Personal history</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2">
            {ph ? (
              <>
                <Row label="Smoking" value={ph.smokingStatus} />
                <Row label="Alcohol" value={ph.alcoholConsumption} />
                <Row label="Diet" value={ph.diet} />
                <Row label="Disorders" value={ph.disorders} span />
              </>
            ) : (
              <p className="col-span-2 text-xs text-muted-foreground">Nothing recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Family history</CardTitle>
          </CardHeader>
          <CardContent>
            {file.safety.familyHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing recorded.</p>
            ) : (
              <ul className="space-y-1">
                {file.safety.familyHistory.map((f) => (
                  <li key={f.id} className="text-xs">
                    <span className="font-medium">{f.conditionName}</span>
                    <span className="ml-2 text-muted-foreground">
                      {[f.relationSide, f.relationship].filter(Boolean).join(' / ') || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BillingTab({ file }: { file: PatientFile }) {
  const t = file.billing.totals;
  return (
    <div className="space-y-4 pt-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={IndianRupee} label="Billed" value={inr(t.billed)} />
        <Stat icon={IndianRupee} label="Paid" value={inr(t.paid)} tone="ok" />
        <Stat
          icon={IndianRupee}
          label="Outstanding"
          value={inr(t.outstanding)}
          tone={t.outstanding > 0 ? 'warn' : 'ok'}
        />
        <Stat icon={FileText} label="Bills" value={t.billCount} />
      </div>

      <Section title="Bills" icon={FileText} empty={file.billing.bills.length === 0}>
        <Table
          head={['Bill', 'Date', 'Total', 'Paid', 'Balance', 'Status']}
          rows={file.billing.bills.map((b) => [
            b.billNumber,
            formatDate(b.date),
            inr(b.total),
            inr(b.paid),
            inr(b.balance),
            b.status,
          ])}
        />
      </Section>

      <Section title="Payments" icon={IndianRupee} empty={file.billing.payments.length === 0}>
        <Table
          head={['Date', 'Amount', 'Method', 'Type', 'Status']}
          rows={file.billing.payments.map((p) => [
            formatDateTime(p.date),
            inr(p.amount),
            p.method.replace(/_/g, ' '),
            p.type,
            p.status,
          ])}
        />
      </Section>
    </div>
  );
}

function DocumentsTab({ file }: { file: PatientFile }) {
  if (file.documents.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No documents on file.</p>;
  }
  return (
    <ul className="space-y-1.5 pt-3">
      {file.documents.map((d) => (
        <li key={d.id} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{d.title}</p>
            <p className="text-[10px] text-muted-foreground">
              {d.documentType.replace(/_/g, ' ')} · {formatDate(d.uploadedAt)}
              {d.fromAnotherHospital && ' · filed at another hospital'}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            className="h-7 text-[11px]"
            render={
              <a
                href={resolveAttachmentUrl(d.fileUrl)}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Open
          </Button>
        </li>
      ))}
    </ul>
  );
}

// ── Small parts ────────────────────────────────────────────────────────────

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="flex items-center gap-1 font-label text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-base font-semibold',
          tone === 'warn' && 'text-error',
          tone === 'ok' && 'text-emerald-700',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value, span }: { label: string; value?: string | null; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : undefined}>
      <p className="font-label text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xs text-foreground">{value || '—'}</p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: React.ElementType;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {empty ? (
          <p className="px-4 pb-4 text-xs text-muted-foreground">Nothing recorded at this hospital.</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function Table({ head, rows }: { head: string[]; rows: Array<Array<string>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-2 text-left font-label text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-b-0 hover:bg-muted/30">
              {r.map((c, j) => (
                <td key={j} className="px-4 py-2 capitalize">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
