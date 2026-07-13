'use client';

import { forwardRef } from 'react';
import type { DischargeDocument, DischargeVitalRow } from '@/hooks/use-doctor';
import { resolveLogoUrl } from '@/hooks/use-branding';
import { cn } from '@/lib/utils';

// A fully-detailed, print-ready IP discharge summary. Rendered on screen as a
// preview and printed as-is (the @media print block below isolates this node so
// the browser prints ONLY the document, not the app chrome). The server PDF at
// /mrd/discharge-summary/:id/pdf renders the same structure.

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const dash = (v?: string | number | null) => (v === null || v === undefined || v === '' ? '—' : String(v));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid">
      <h3 className="mb-1.5 flex items-center gap-2 border-b border-slate-200 pb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
        <span className="inline-block h-3 w-[3px] rounded" style={{ backgroundColor: 'var(--brand)' }} />
        {title}
      </h3>
      <div className="text-[12.5px] leading-relaxed text-[#1a2332]">{children}</div>
    </section>
  );
}

function Prose({ text }: { text?: string | null }) {
  if (!text || !text.trim()) return <p className="italic text-[#6b7280]">Not recorded.</p>;
  return <p className="whitespace-pre-wrap">{text.trim()}</p>;
}

function Table({ head, rows }: { head: string[]; rows: (string | number | null)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="text-white" style={{ backgroundColor: 'var(--brand)' }}>
            {head.map((h) => (
              <th key={h} className="border px-2 py-1 text-left font-semibold" style={{ borderColor: 'var(--brand)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? 'bg-[#eef2f5]' : 'bg-white'}>
              {r.map((c, j) => (
                <td key={j} className="border border-[#d3d8de] px-2 py-1 align-top">{c === null || c === '' ? '—' : c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const vitalCells = (v: DischargeVitalRow | null, label: string): (string | null)[] => [
  label,
  v?.bp ?? null,
  v?.pulse != null ? String(v.pulse) : null,
  v?.temp != null ? `${v.temp}°C` : null,
  v?.rr != null ? String(v.rr) : null,
  v?.spo2 != null ? `${v.spo2}%` : null,
  v?.weight != null ? `${v.weight} kg` : null,
];

export const DischargeSummaryDocument = forwardRef<HTMLDivElement, { doc: DischargeDocument }>(
  function DischargeSummaryDocument({ doc }, ref) {
    const p = doc.patient;
    const info: Array<[string, string]> = [
      ['Patient Name', p.name],
      ['MRN / UHID', dash(p.mrn)],
      ['Age / Gender', `${dash(p.age)}${p.gender ? ' / ' + p.gender : ''}`],
      ['Blood Group', dash(p.bloodGroup)],
      ['Phone', dash(p.phone)],
      ['Address', dash(p.address)],
      ['Admitted', fmtDateTime(doc.admission.admissionDate)],
      ['Discharged', fmtDateTime(doc.admission.dischargeDate)],
      ['Length of Stay', doc.admission.lengthOfStayDays != null ? `${doc.admission.lengthOfStayDays} day(s)` : '—'],
      ['Ward / Bed', `${dash(doc.admission.ward)} / ${dash(doc.admission.bed)}`],
      ['Attending Doctor', `${doc.admission.attendingDoctor}${doc.admission.specialization ? ' (' + doc.admission.specialization + ')' : ''}`],
      ['Emergency Contact', doc.emergencyContact ? `${doc.emergencyContact.name} (${doc.emergencyContact.relationship}) · ${doc.emergencyContact.phone}` : '—'],
    ];

    const h = doc.hospital;
    const sh = h.show;
    const accent = /^#[0-9a-fA-F]{6}$/.test(h.accentColor) ? h.accentColor : '#0f766e';
    const showTagline = sh.tagline && !!h.tagline;
    const addressLine = sh.address
      ? [h.addressLine1, h.addressLine2, [h.city, h.state].filter(Boolean).join(', '), h.pincode, h.country].filter(Boolean).join(', ')
      : '';
    const contact = [
      sh.phone ? h.phone : null, sh.phone ? h.altPhone : null,
      sh.email ? h.email : null, sh.website ? h.website : null,
    ].filter(Boolean).join('  •  ');
    const reg = [
      sh.registrationNo && h.registrationNo ? `Reg. No: ${h.registrationNo}` : '',
      sh.gstin && h.gstin ? `GSTIN: ${h.gstin}` : '',
      sh.accreditation ? h.accreditation || '' : '',
    ].filter(Boolean).join('  •  ');
    const logo = h.showLogo && h.logoUrl ? resolveLogoUrl(h.logoUrl) : null;
    const leftLayout = h.headerStyle === 'left';

    return (
      <div id="discharge-doc-print" ref={ref} style={{ ['--brand' as string]: accent }} className="mx-auto max-w-[820px] bg-white p-8 text-[#1a2332] shadow-sm ring-1 ring-black/5 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #discharge-doc-print, #discharge-doc-print * { visibility: visible !important; }
            #discharge-doc-print { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 13mm; }
          }
        `}</style>

        {/* Letterhead */}
        <header className={cn('flex gap-4', leftLayout ? 'items-center text-left' : 'flex-col items-center text-center')}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className={cn('object-contain', leftLayout ? 'h-16 w-16' : 'h-14')} />
          )}
          <div className={leftLayout ? 'min-w-0 flex-1' : ''}>
            <h1 className="text-[20px] font-bold tracking-tight text-[#132029]">{h.name}</h1>
            {showTagline && <p className="text-[11px] italic" style={{ color: accent }}>{h.tagline}</p>}
            {addressLine && <p className="text-[11px] text-[#5b6472]">{addressLine}</p>}
            {contact && <p className="text-[11px] text-[#5b6472]">{contact}</p>}
            {reg && <p className="text-[10px] text-[#5b6472]">{reg}</p>}
          </div>
        </header>

        <div className="mt-3 flex items-center justify-center rounded py-1.5" style={{ backgroundColor: accent }}>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-white">Discharge Summary</h2>
        </div>
        {doc.meta.status !== 'published' && (
          <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wider text-amber-600">
            {doc.meta.status} — preview
          </p>
        )}

        {/* Patient / admission info card */}
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-md border border-[#d3d8de] bg-[#f6f8fa] p-3">
          {info.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <span className="block text-[9px] font-bold uppercase tracking-wide text-[#6b7280]">{label}</span>
              <span className="block truncate text-[12px] font-medium text-[#1a2332]">{value}</span>
            </div>
          ))}
        </div>

        {/* Diagnoses */}
        <Section title="Diagnosis">
          {doc.sections.diagnosesText && doc.sections.diagnosesText.trim() ? (
            <Prose text={doc.sections.diagnosesText} />
          ) : doc.diagnoses.length ? (
            <Table head={['Diagnosis', 'Type', 'ICD-10']} rows={doc.diagnoses.map((d) => [d.name, d.type, d.icdCode])} />
          ) : (
            <p className="italic text-[#6b7280]">No diagnoses recorded.</p>
          )}
        </Section>

        {/* Allergies */}
        {doc.allergies.length > 0 && (
          <Section title="Allergies">
            <Table head={['Allergen', 'Reaction']} rows={doc.allergies.map((a) => [a.allergen, a.reaction])} />
          </Section>
        )}

        {/* Presenting complaint */}
        {(doc.admission.chiefComplaint || doc.admission.reason) && (
          <Section title="Presenting Complaint / Reason for Admission">
            <Prose text={[doc.admission.chiefComplaint, doc.admission.reason].filter(Boolean).join('\n')} />
          </Section>
        )}

        {/* Vitals */}
        {(doc.vitals.admission || doc.vitals.discharge) && (
          <Section title="Vital Signs">
            <Table
              head={['At', 'BP', 'Pulse', 'Temp', 'RR', 'SpO₂', 'Weight']}
              rows={[vitalCells(doc.vitals.admission, 'On admission'), vitalCells(doc.vitals.discharge, 'At discharge')]}
            />
          </Section>
        )}

        {/* Procedures */}
        {doc.procedures.length > 0 && (
          <Section title="Procedures / Surgeries">
            <Table
              head={['Procedure', 'Type', 'Surgeon', 'Date', 'Status']}
              rows={doc.procedures.map((pr) => [pr.name, pr.type, pr.surgeon, fmtDate(pr.date), pr.status])}
            />
          </Section>
        )}

        {/* Hospital course */}
        {doc.sections.hospitalCourse && (
          <Section title="Hospital Course & Treatment">
            <Prose text={doc.sections.hospitalCourse} />
          </Section>
        )}

        {/* Investigations */}
        {(doc.sections.keyLabs || doc.sections.labResults || doc.imaging.length > 0) && (
          <Section title="Investigations">
            {doc.sections.keyLabs && (
              <>
                <p className="mb-0.5 text-[11px] font-bold text-[#0f5049]">Significant / Abnormal Labs</p>
                <Prose text={doc.sections.keyLabs} />
              </>
            )}
            {doc.sections.labResults && (
              <>
                <p className="mb-0.5 mt-2 text-[11px] font-bold text-[#0f5049]">All Lab Results</p>
                <Prose text={doc.sections.labResults} />
              </>
            )}
            {doc.imaging.length > 0 && (
              <>
                <p className="mb-0.5 mt-2 text-[11px] font-bold text-[#0f5049]">Imaging</p>
                <Table
                  head={['Study', 'Indication', 'Impression', 'Date']}
                  rows={doc.imaging.map((im) => [im.study, im.indication, im.impression, fmtDate(im.date)])}
                />
              </>
            )}
          </Section>
        )}

        {/* Medications */}
        <Section title="Medications on Discharge">
          {doc.medications.length ? (
            <Table
              head={['Medication', 'Dose', 'Frequency', 'Duration', 'Route', 'Instructions']}
              rows={doc.medications.map((m) => [m.drug, m.dosage, m.frequency, m.duration ?? 'ongoing', m.route, m.instructions])}
            />
          ) : doc.sections.medicationsText ? (
            <Prose text={doc.sections.medicationsText} />
          ) : (
            <p className="italic text-[#6b7280]">No discharge medications prescribed.</p>
          )}
        </Section>

        {/* Discharge instructions */}
        {doc.sections.dischargeInstructions && (
          <Section title="Discharge Instructions / Advice">
            <Prose text={doc.sections.dischargeInstructions} />
          </Section>
        )}

        {/* Follow-up */}
        {(doc.sections.followUpDate || doc.sections.followUpInstructions) && (
          <Section title="Follow-up">
            {doc.sections.followUpDate && (
              <p className="mb-1 font-semibold">Next review: {fmtDate(doc.sections.followUpDate)}</p>
            )}
            <Prose text={doc.sections.followUpInstructions} />
          </Section>
        )}

        {/* Signature */}
        <div className="mt-10 flex justify-end break-inside-avoid">
          <div className="w-[260px] text-right">
            <div className="mb-1 border-t border-[#1a2332]" />
            <p className="text-[12px] font-bold">{doc.admission.attendingDoctor}</p>
            {doc.admission.specialization && <p className="text-[11px] text-[#5b6472]">{doc.admission.specialization}</p>}
            {doc.meta.signedAt && (
              <p className="text-[10px] text-[#5b6472]">Electronically signed on {fmtDateTime(doc.meta.signedAt)}</p>
            )}
            {doc.meta.attestation && (
              <p className="text-[10px] italic text-[#5b6472]">Attested as &ldquo;{doc.meta.attestation}&rdquo;</p>
            )}
          </div>
        </div>

        {sh.footer && (
          <p className="mt-6 border-t border-[#d3d8de] pt-2 text-center text-[9px] text-[#6b7280]">
            {h.footerText || 'This is a computer-generated discharge summary. In case of any emergency, contact the hospital immediately.'}
          </p>
        )}
      </div>
    );
  },
);
