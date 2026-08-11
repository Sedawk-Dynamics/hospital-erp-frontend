'use client';

// Super-admin Lab Test Template builder. Edits a single LabTestTemplate:
// metadata (name, code, sample type, price, TAT) + parameter
// grid (delegated to <LabParameterBuilder/>) + clinical interpretation
// notes that print at the foot of the branded report.

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Beaker,
  CheckCircle2,
  Eye,
  Loader2,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useLabTemplate,
  useUpdateLabTemplate,
  type LabParameterSpec,
} from '@/hooks/use-lab-templates';
import { LabParameterBuilder } from '@/components/laboratory/lab-parameter-builder';
import { LabReportPreviewDialog } from '@/components/laboratory/lab-report-preview';
import {
  LabTagsInput,
  mergeSynonyms,
  splitSynonyms,
  SYNONYMS_MAX,
} from '@/components/laboratory/lab-tags-input';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';

interface LabTemplateBuilderPageProps {
  params: Promise<{ id: string }>;
}

export default function LabTemplateBuilderPage({ params }: LabTemplateBuilderPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: template, isLoading } = useLabTemplate(id);
  const update = useUpdateLabTemplate();

  // Local-state copy of the template so the builder is editable. We sync on
  // first load; the user clicks Save to persist.
  const [meta, setMeta] = useState({
    name: '',
    code: '',
    sampleType: '',
    specimen: '',
    instructions: '',
    description: '',
    interpretation: '',
    defaultPrice: '' as string | number,
    turnaroundHours: '' as string | number,
    isPublished: true,
  });
  const [parameters, setParameters] = useState<LabParameterSpec[]>([]);
  // Single unified "search & synonyms" list. Backend still keeps aliases
  // (case-preserved, max 25) and tags (lowercased, max 40) as separate
  // columns so search semantics stay identical; we merge on load and split
  // on save (first 25 → aliases, remainder → tags).
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Seed once per template. This also clears `dirty`, so re-running it on a
  // refetch threw away unsaved parameter edits without any warning.
  useSeedOnChange(template?.id ?? null, () => {
    if (!template) return;
    setMeta({
      name: template.name,
      code: template.code ?? '',
      sampleType: template.sampleType ?? '',
      specimen: template.specimen ?? '',
      instructions: template.instructions ?? '',
      description: template.description ?? '',
      interpretation: template.interpretation ?? '',
      defaultPrice: template.defaultPrice == null ? '' : Number(template.defaultPrice),
      turnaroundHours: template.turnaroundHours ?? '',
      isPublished: template.isPublished,
    });
    setParameters(template.parameters ?? []);
    setSynonyms(mergeSynonyms(template.aliases, template.tags));
    setDirty(false);
  });

  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of parameters) {
      const k = p.group || '(no group)';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries());
  }, [parameters]);

  function onMetaChange<K extends keyof typeof meta>(key: K, value: (typeof meta)[K]) {
    setMeta((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }

  function onParametersChange(next: LabParameterSpec[]) {
    setParameters(next);
    setDirty(true);
  }

  function onSynonymsChange(next: string[]) {
    setSynonyms(next);
    setDirty(true);
  }

  async function handleSave(opts: { publish?: boolean } = {}) {
    if (!meta.name.trim()) {
      toast.error('Name is required');
      return;
    }
    // Validate parameter rows: every row needs a name; select rows need ≥1
    // option with a value+label.
    for (const [i, p] of parameters.entries()) {
      if (!p.name.trim()) {
        toast.error(`Parameter row ${i + 1} is missing a name`);
        return;
      }
      if (p.inputType === 'select' && (!p.options || p.options.filter((o) => o.value && o.label).length === 0)) {
        toast.error(`Parameter "${p.name}" needs at least one option`);
        return;
      }
    }

    const { aliases, tags } = splitSynonyms(synonyms);
    try {
      await update.mutateAsync({
        id,
        name: meta.name.trim(),
        code: meta.code.trim() || null,
        sampleType: meta.sampleType.trim() || null,
        specimen: meta.specimen.trim() || null,
        instructions: meta.instructions.trim() || null,
        description: meta.description.trim() || null,
        interpretation: meta.interpretation.trim() || null,
        defaultPrice: meta.defaultPrice === '' ? null : Number(meta.defaultPrice),
        turnaroundHours: meta.turnaroundHours === '' ? null : Number(meta.turnaroundHours),
        parameters,
        aliases,
        tags,
        isPublished: opts.publish ?? meta.isPublished,
      });
      toast.success(opts.publish ? 'Saved and published' : 'Saved');
      setDirty(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save';
      toast.error(msg);
    }
  }

  if (isLoading || !template) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/super-admin/lab-templates"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="h-3 w-3" />
            All templates
          </Link>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2 truncate">
            <Beaker className="h-5 w-5 text-primary shrink-0" />
            {meta.name || 'Untitled template'}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            v{template.version} · {parameters.length} parameter{parameters.length === 1 ? '' : 's'}
            {grouped.length > 1 && ` across ${grouped.length} groups`}
            {template._count?.catalogs ? ` · ${template._count.catalogs} hospital clone(s)` : ''}
            {' · '}
            <span className={meta.isPublished ? 'text-primary font-medium' : 'text-amber-700 font-medium'}>
              {meta.isPublished ? 'Published' : 'Draft'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirty && <span className="text-[10px] text-amber-600 font-medium">Unsaved changes</span>}
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-1">
            <Eye className="h-3.5 w-3.5" />
            Preview report
          </Button>
          {!meta.isPublished && (
            <Button onClick={() => handleSave({ publish: true })} disabled={update.isPending} className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Save & publish
            </Button>
          )}
          <Button
            variant={meta.isPublished ? 'default' : 'outline'}
            onClick={() => handleSave({})}
            disabled={update.isPending}
            className="gap-1"
          >
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <section className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Test details</h2>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-8">
            <Label htmlFor="t-name">Test name *</Label>
            <Input id="t-name" value={meta.name} onChange={(e) => onMetaChange('name', e.target.value)} placeholder="Complete Blood Count" />
          </div>
          <div className="col-span-4">
            <Label htmlFor="t-code">Code</Label>
            <Input id="t-code" value={meta.code} onChange={(e) => onMetaChange('code', e.target.value)} placeholder="CBC" />
          </div>

          <div className="col-span-3">
            <Label htmlFor="t-sample">Sample type</Label>
            <Input id="t-sample" value={meta.sampleType} onChange={(e) => onMetaChange('sampleType', e.target.value)} placeholder="Blood" />
          </div>
          <div className="col-span-3">
            <Label htmlFor="t-price">Default price (₹)</Label>
            <Input
              id="t-price"
              type="number"
              min={0}
              step="0.01"
              value={meta.defaultPrice}
              onChange={(e) => onMetaChange('defaultPrice', e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="350"
            />
          </div>
          <div className="col-span-3">
            <Label htmlFor="t-tat">Turnaround (hours)</Label>
            <Input
              id="t-tat"
              type="number"
              min={0}
              value={meta.turnaroundHours}
              onChange={(e) => onMetaChange('turnaroundHours', e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="4"
            />
          </div>
          <div className="col-span-3 flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={meta.isPublished}
                onChange={(e) => onMetaChange('isPublished', e.target.checked)}
              />
              Published (visible to hospitals)
            </label>
          </div>

          <div className="col-span-12">
            <Label htmlFor="t-specimen">Specimen / collection notes</Label>
            <Input id="t-specimen" value={meta.specimen} onChange={(e) => onMetaChange('specimen', e.target.value)} placeholder="3 mL EDTA whole blood (purple top)" />
          </div>
          <div className="col-span-12">
            <Label htmlFor="t-instr">Patient instructions</Label>
            <Textarea
              id="t-instr"
              value={meta.instructions}
              onChange={(e) => onMetaChange('instructions', e.target.value)}
              rows={2}
              placeholder="Fasting for 8-12 hours. Water permitted."
            />
          </div>
          <div className="col-span-12">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
              value={meta.description}
              onChange={(e) => onMetaChange('description', e.target.value)}
              rows={2}
              placeholder="Brief description of what this test measures and when it's used."
            />
          </div>
        </div>
      </section>

      {/* Search & synonyms (dynamic search layer — single combined list) */}
      <section className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Search & synonyms
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Add alternative names and keywords that should surface this test in search — e.g. &quot;FBC&quot;,
          &quot;Hemogram&quot;, &quot;hemoglobin&quot;, &quot;anemia&quot;. Out-of-range numeric values are still auto-flagged on
          the result entry form. Part of the dynamic-search layer agreed in the 2026-05-23 meeting.
        </p>
        <div className="space-y-1">
          <Label>Synonyms</Label>
          <LabTagsInput
            value={synonyms}
            onChange={onSynonymsChange}
            valueMode="alias"
            max={SYNONYMS_MAX}
            placeholder='e.g. "FBC", "Hemogram", "hemoglobin"'
          />
        </div>
      </section>

      {/* Parameters */}
      <section className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Parameters ({parameters.length})
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Each row becomes one input field when a lab technician enters results. Group rows with the same
              &quot;Group&quot; label render together on the printed report.
            </p>
          </div>
        </div>
        <LabParameterBuilder value={parameters} onChange={onParametersChange} />
      </section>

      {/* Interpretation */}
      <section className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clinical interpretation</h2>
        <p className="text-[11px] text-muted-foreground">
          Free-text notes printed at the bottom of the branded report. Use this to explain the clinical significance
          of each finding (e.g. &quot;Microcytic hypochromic picture suggests iron-deficiency anaemia&quot;).
        </p>
        <Textarea
          rows={5}
          value={meta.interpretation}
          onChange={(e) => onMetaChange('interpretation', e.target.value)}
          placeholder="Microcytic hypochromic picture suggests iron-deficiency anaemia. Neutrophilia with band forms favours bacterial infection."
        />
      </section>

      {/* Footer save bar */}
      <div className="sticky bottom-2 flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push('/super-admin/lab-templates')}>Back to list</Button>
        <Button onClick={() => handleSave({})} disabled={update.isPending} className="gap-1">
          {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>

      <LabReportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        source={{
          name: meta.name || 'Untitled template',
          code: meta.code || null,
          sampleType: meta.sampleType,
          specimen: meta.specimen,
          instructions: meta.instructions,
          description: meta.description,
          interpretation: meta.interpretation,
          turnaroundHours: meta.turnaroundHours === '' ? null : Number(meta.turnaroundHours),
          parameters,
        }}
      />
    </div>
  );
}
