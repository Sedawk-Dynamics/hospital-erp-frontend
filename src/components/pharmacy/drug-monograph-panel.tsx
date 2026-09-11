'use client';

// A catalogue product's label facts and monograph — the vendor's long texts —
// rendered from the structured blocks the API sends. Nothing here renders
// markup: every section arrives as paragraphs, lists or rows of plain text.
// Used by the super-admin catalogue and the hospital's "Import from Catalog".

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  useDrugMonograph,
  type DrugMonograph,
  type MonographBlock,
  type SafetyTopic,
} from '@/hooks/use-drug-master';

const SAFETY_TOPICS: Array<[SafetyTopic, string]> = [
  ['alcohol', 'Alcohol'],
  ['pregnancy', 'Pregnancy'],
  ['lactation', 'Breast feeding'],
  ['driving', 'Driving'],
  ['kidney', 'Kidney'],
  ['liver', 'Liver'],
];

const VERDICTS: Record<string, { label: string; className: string }> = {
  safe: { label: 'Safe', className: 'bg-emerald-100 text-emerald-800' },
  safe_if_prescribed: { label: 'Safe if prescribed', className: 'bg-teal-100 text-teal-800' },
  caution: { label: 'Caution', className: 'bg-amber-100 text-amber-800' },
  unsafe: { label: 'Unsafe', className: 'bg-rose-100 text-rose-700' },
  consult_doctor: { label: 'Consult doctor', className: 'bg-sky-100 text-sky-800' },
  not_relevant: { label: 'Not relevant', className: 'bg-muted text-muted-foreground' },
};

/** "CONSULT YOUR DOCTOR" (monograph text) and "consult_doctor" (row) → one key. */
function verdictKey(v: string | null | undefined): string {
  const k = (v ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  return k === 'consult_your_doctor' ? 'consult_doctor' : k;
}

function VerdictChip({ verdict }: { verdict: string | null | undefined }) {
  const v = VERDICTS[verdictKey(verdict)];
  if (!v) return null;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${v.className}`}>
      {v.label}
    </span>
  );
}

const SEVERITY: Record<string, string> = {
  'life-threatening': 'bg-rose-600 text-white',
  severe: 'bg-rose-100 text-rose-700',
  moderate: 'bg-amber-100 text-amber-800',
  mild: 'bg-muted text-muted-foreground',
};

function Interactions({ items }: { items: Extract<MonographBlock, { type: 'interactions' }>['items'] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 12);
  return (
    <div className="space-y-1.5">
      {shown.map((i, n) => (
        <div key={`${i.drug}-${n}`} className="rounded-md border px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{i.drug}</span>
            {i.route && <span className="text-[10px] text-muted-foreground">{i.route}</span>}
            {i.severity && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  SEVERITY[i.severity.toLowerCase()] ?? 'bg-muted text-muted-foreground'
                }`}
              >
                {i.severity}
              </span>
            )}
          </div>
          {i.advice && <p className="mt-0.5 text-muted-foreground">{i.advice}</p>}
        </div>
      ))}
      {items.length > 12 && (
        <button
          type="button"
          className="text-[11px] font-medium text-primary hover:underline"
          onClick={() => setAll((v) => !v)}
        >
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

function Block({ block }: { block: MonographBlock }) {
  switch (block.type) {
    case 'paragraphs':
      return (
        <div className="space-y-1.5">
          {block.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      );
    case 'list':
      return (
        <ul className="list-disc space-y-0.5 pl-4">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'faq':
      return (
        <dl className="space-y-2">
          {block.items.map((qa, i) => (
            <div key={i}>
              {qa.question && <dt className="font-medium">{qa.question}</dt>}
              <dd className="text-muted-foreground">{qa.answer}</dd>
            </div>
          ))}
        </dl>
      );
    case 'verdicts':
      return (
        <div className="space-y-1.5">
          {block.items.map((v, i) => (
            <div key={i}>
              <div className="flex items-center gap-1.5">
                {v.topic && <span className="font-medium">{v.topic}</span>}
                <VerdictChip verdict={v.verdict} />
              </div>
              {v.text && <p className="text-muted-foreground">{v.text}</p>}
            </div>
          ))}
        </div>
      );
    case 'interactions':
      return <Interactions items={block.items} />;
  }
}

function facts(d: DrugMonograph): Array<[string, string]> {
  const pack = [d.packageType, d.packQuantity].filter(Boolean).join(' · ');
  const rows: Array<[string, string | null | undefined]> = [
    ['Composition', d.saltComposition ?? d.genericName],
    ['Marketer', d.manufacturer],
    ['Form', d.productForm],
    ['Pack', d.packSizeLabel ?? (pack || null)],
    ['Label', d.kind === 'otc' ? 'Over the counter' : d.rxRequired ? 'Prescription required' : 'No prescription needed'],
    ['Habit forming', d.habitForming == null ? null : d.habitForming ? 'Yes' : 'No'],
    ['Therapeutic class', d.therapeuticClass],
    ['Chemical class', d.chemicalClass],
    ['Action class', d.actionClass],
    ['Category', d.categoryPath ?? d.productCategory],
    ['Storage', d.storage],
    ['Country of origin', d.countryOfOrigin],
    ['Uses', d.description],
    ['Side effects', d.sideEffects],
    ['Vendor ID', d.sourceId ? `${d.sourceId}${d.sourceRelease ? ` · release ${d.sourceRelease}` : ''}` : null],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

export function DrugMonographPanel({ drugId }: { drugId: string }) {
  const { data, isLoading, isError } = useDrugMonograph(drugId);

  if (isLoading) {
    return (
      <div className="py-4 text-center">
        <Loader2 className="mx-auto h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }
  if (isError || !data) {
    return <p className="text-xs text-muted-foreground">Product details could not be loaded.</p>;
  }

  const rows = facts(data);
  const safety = SAFETY_TOPICS.filter(([t]) => data.safetyAdvice?.[t]);

  return (
    <div className="space-y-3 text-xs">
      {rows.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {safety.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {safety.map(([topic, label]) => (
            <span key={topic} className="inline-flex items-center gap-1">
              <span className="text-muted-foreground">{label}</span>
              <VerdictChip verdict={data.safetyAdvice?.[topic]} />
            </span>
          ))}
        </div>
      )}

      {data.sections.length > 0 ? (
        <div className="divide-y rounded-lg border">
          {data.sections.map((s) => (
            <details key={s.key} className="group px-3 py-2">
              <summary className="cursor-pointer select-none font-semibold text-on-surface-variant">
                {s.title}
              </summary>
              <div className="mt-2 leading-relaxed">
                <Block block={s.block} />
              </div>
            </details>
          ))}
        </div>
      ) : (
        rows.length === 0 && <p className="text-muted-foreground">No catalogue details for this product.</p>
      )}
    </div>
  );
}
