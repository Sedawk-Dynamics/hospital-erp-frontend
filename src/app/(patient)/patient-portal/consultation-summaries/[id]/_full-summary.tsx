'use client';

import { Pill, Stethoscope, Activity, ClipboardList, Pin, CalendarClock, Clock3 } from 'lucide-react';
import { formatDate, formatDateTimeAmPm } from '@/lib/date-utils';

/**
 * The patient's own record of a consultation, in full.
 *
 * The portal previously rendered only the sections the doctor had explicitly
 * pinned, so an ordinary consultation — written up, signed, but nothing pinned
 * — showed the patient an empty page. This shows what actually happened: the
 * complaint, the doctor's note, the diagnosis, the vitals taken and the
 * medicines prescribed.
 */

interface PinEntry {
  id: string;
  dischargeSection: string;
  content: string;
}

interface PrescriptionItem {
  id: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration?: string | null;
  route: string;
  instructions?: string | null;
  isPrn?: boolean;
  quantity?: number | null;
}

interface VisitPrescription {
  id: string;
  status: string;
  notes?: string | null;
  followUpDate?: string | null;
  createdAt: string;
  prescriptionItems: PrescriptionItem[];
}

export interface FullConsultation {
  id: string;
  content?: string | null;
  impressions?: string | null;
  discussions?: string | null;
  conclusions?: string | null;
  signedAt?: string | null;
  createdAt: string;
  doctor?: { user?: { firstName: string; lastName?: string | null } } | null;
  signer?: { firstName: string; lastName?: string | null } | null;
  patient?: { mrn?: string | null; tenant?: { name?: string } | null } | null;
  pins?: PinEntry[];
  visit?: {
    visitDate?: string | null;
    chiefComplaint?: string | null;
    diagnoses?: { id: string; diagnosisName: string; icdCode?: string | null }[];
    vitals?: Record<string, unknown>[];
    prescriptions?: VisitPrescription[];
  } | null;
}

const SECTION_LABEL: Record<string, string> = {
  chief_complaint: 'Chief complaint',
  examination: 'Examination',
  investigation: 'Investigations',
  diagnosis: 'Diagnosis',
  impression: 'Impression',
  advice: 'Advice',
  follow_up: 'Follow-up',
};

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Pill;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-5">
      <h2 className="mb-3 flex items-center gap-2 font-headline text-sm font-bold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The note body is written as markdown-ish "**Heading:** text" blocks. */
function NoteBody({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        const m = b.match(/^\*\*(.+?):\*\*\s*([\s\S]*)$/);
        if (!m) {
          return (
            <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
              {b.trim()}
            </p>
          );
        }
        return (
          <div key={i}>
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-primary">
              {m[1].trim()}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{m[2].trim()}</p>
          </div>
        );
      })}
    </div>
  );
}

const VITAL_ROWS: { key: string; label: string; unit: string }[] = [
  { key: 'bloodPressureSystolic', label: 'BP (systolic)', unit: 'mmHg' },
  { key: 'bloodPressureDiastolic', label: 'BP (diastolic)', unit: 'mmHg' },
  { key: 'pulseRate', label: 'Pulse', unit: 'bpm' },
  { key: 'temperature', label: 'Temperature', unit: '°C' },
  { key: 'respiratoryRate', label: 'Respiratory rate', unit: '/min' },
  { key: 'oxygenSaturation', label: 'SpO₂', unit: '%' },
  { key: 'weightKg', label: 'Weight', unit: 'kg' },
  { key: 'heightCm', label: 'Height', unit: 'cm' },
  { key: 'bloodSugar', label: 'Blood sugar', unit: 'mg/dL' },
];

export function FullConsultationSummary({ note }: { note: FullConsultation }) {
  const doctorName = note.doctor?.user
    ? `Dr. ${note.doctor.user.firstName} ${note.doctor.user.lastName ?? ''}`.trim()
    : 'Your doctor';
  const when = note.signedAt ?? note.visit?.visitDate ?? note.createdAt;
  const diagnoses = note.visit?.diagnoses ?? [];
  const vitals = note.visit?.vitals?.[0];
  const prescriptions = note.visit?.prescriptions ?? [];
  const pins = note.pins ?? [];
  const narrative = [
    note.content,
    note.impressions && `**Impression:** ${note.impressions}`,
    note.discussions && `**Discussion:** ${note.discussions}`,
    note.conclusions && `**Conclusion:** ${note.conclusions}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const shownVitals = vitals
    ? VITAL_ROWS.filter((r) => vitals[r.key] !== null && vitals[r.key] !== undefined)
    : [];

  return (
    <div className="space-y-4">
      {/* Who, when, where */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
        <p className="font-display text-lg font-bold">{doctorName}</p>
        <p className="font-label text-xs text-on-surface-variant">
          {formatDate(when)}
          {note.patient?.tenant?.name ? ` · ${note.patient.tenant.name}` : ''}
          {note.patient?.mrn ? ` · MRN ${note.patient.mrn}` : ''}
        </p>
        {note.signedAt ? (
          <p className="mt-1 font-label text-[11px] text-primary">
            Signed by{' '}
            {note.signer
              ? `Dr. ${note.signer.firstName} ${note.signer.lastName ?? ''}`.trim()
              : doctorName}{' '}
            on {formatDateTimeAmPm(note.signedAt)}
          </p>
        ) : (
          // Shown at the top, before any of the content it qualifies. A patient
          // reading their diagnosis and medicines needs to know the doctor has
          // not signed this off yet — underneath, it would be read afterwards
          // or not at all.
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
            <p className="font-label text-[11px] leading-relaxed text-amber-900">
              <span className="font-bold">Awaiting doctor sign-off.</span> This is what was
              recorded at your consultation, shared with you now so you are not left waiting.
              {' '}{doctorName} may still add to it or correct it before signing.
            </p>
          </div>
        )}
      </div>

      {note.visit?.chiefComplaint && (
        <Section title="Why you came in" icon={Stethoscope}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {note.visit.chiefComplaint}
          </p>
        </Section>
      )}

      {narrative.trim() && (
        <Section title="Consultation notes" icon={ClipboardList}>
          <NoteBody text={narrative} />
        </Section>
      )}

      {diagnoses.length > 0 && (
        <Section title="Diagnosis" icon={Stethoscope}>
          <ul className="space-y-1.5">
            {diagnoses.map((d) => (
              <li key={d.id} className="text-sm">
                {d.diagnosisName}
                {d.icdCode && (
                  <span className="ml-1.5 font-label text-[11px] text-on-surface-variant">
                    ({d.icdCode})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {shownVitals.length > 0 && (
        <Section title="Vitals recorded" icon={Activity}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {shownVitals.map((r) => (
              <div key={r.key} className="rounded-lg bg-surface-container-low px-3 py-2">
                <p className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                  {r.label}
                </p>
                <p className="font-display text-sm font-bold">
                  {String(vitals?.[r.key])}{' '}
                  <span className="font-label text-[10px] font-normal text-on-surface-variant">
                    {r.unit}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {prescriptions.map((rx) => (
        <Section key={rx.id} title="Medicines prescribed" icon={Pill}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <th className="pb-2 pr-3">Medicine</th>
                  <th className="pb-2 pr-3">Dose</th>
                  <th className="pb-2 pr-3">How often</th>
                  <th className="pb-2 pr-3">For</th>
                  <th className="pb-2">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {rx.prescriptionItems.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2 pr-3 font-medium">
                      {it.drugName}
                      {it.isPrn && (
                        <span className="ml-1.5 rounded-full bg-secondary/10 px-1.5 py-0.5 font-label text-[9px] font-bold uppercase text-secondary">
                          as needed
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{it.dosage}</td>
                    <td className="py-2 pr-3">{it.frequency}</td>
                    <td className="py-2 pr-3">{it.duration ?? 'ongoing'}</td>
                    <td className="py-2 text-on-surface-variant">
                      {[it.route, it.instructions].filter(Boolean).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rx.notes && (
            <p className="mt-3 rounded-lg bg-surface-container-low px-3 py-2 text-sm">{rx.notes}</p>
          )}
          {rx.followUpDate && (
            <p className="mt-2 flex items-center gap-1.5 font-label text-xs text-primary">
              <CalendarClock className="h-3.5 w-3.5" />
              Follow-up on {formatDate(rx.followUpDate)}
            </p>
          )}
        </Section>
      ))}

      {/* Anything the doctor explicitly highlighted for the patient. Shown
          after the record itself, since it repeats parts of it. */}
      {pins.length > 0 && (
        <Section title="Highlighted for you" icon={Pin}>
          <ul className="space-y-2.5">
            {pins.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-outline-variant/30 bg-background/60 p-3"
              >
                <p className="font-label text-[10px] font-bold uppercase tracking-widest text-primary">
                  {SECTION_LABEL[p.dischargeSection] ?? p.dischargeSection.replace(/_/g, ' ')}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!narrative.trim() &&
        diagnoses.length === 0 &&
        prescriptions.length === 0 &&
        pins.length === 0 && (
          <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
            <p className="font-label text-sm text-on-surface-variant">
              Your doctor signed this consultation but did not record any notes against it.
            </p>
          </div>
        )}
    </div>
  );
}
