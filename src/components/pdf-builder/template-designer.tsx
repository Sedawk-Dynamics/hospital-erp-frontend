'use client';

// ============================================================
// PDF template designer — the "advanced" half of the PDF Builder.
//
// The letterhead tab is one identity for the whole hospital. This tab is how
// each DOCUMENT TYPE presents it: page size and orientation, margins, font,
// colours, what the header and footer show, a watermark, table style, a
// signature block, and custom text blocks the hospital wants on that document.
//
// The document list starts with "All documents", which carries the defaults
// every type inherits — so a hospital sets its house style once, then overrides
// only the types that genuinely differ (the NDPS register is landscape; a
// reprinted receipt is stamped DUPLICATE).
//
// The body of each document stays code-owned. A discharge summary's clinical
// content is not something an admin should be able to rearrange.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Save,
  Eye,
  ExternalLink,
  RotateCcw,
  Plus,
  Trash2,
  Layers,
  FileWarning,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, getApiErrorMessage } from '@/lib/utils';
import {
  ALL_DOCUMENTS_KEY,
  usePdfTemplates,
  useSavePdfTemplate,
  useResetPdfTemplate,
  fetchBrandingPreviewUrl,
  type HospitalBranding,
  type PdfTemplate,
  type PdfCustomBlock,
  type PdfDocumentType,
  type TemplateKey,
} from '@/hooks/use-hospital-branding';

const PAGE_SIZES = [
  { value: 'A4', label: 'A4 (210 × 297 mm)' },
  { value: 'A5', label: 'A5 (148 × 210 mm)' },
  { value: 'LETTER', label: 'Letter (8.5 × 11 in)' },
  { value: 'LEGAL', label: 'Legal (8.5 × 14 in)' },
] as const;

const FONTS = [
  { value: 'Helvetica', label: 'Helvetica — clean sans-serif' },
  { value: 'Times', label: 'Times — classic serif' },
  { value: 'Courier', label: 'Courier — monospaced' },
] as const;

const WATERMARK_PRESETS = ['COPY', 'DUPLICATE', 'DRAFT', 'ORIGINAL', 'CANCELLED', 'NOT FOR CLAIM'];

interface Props {
  /** The saved letterhead, so the preview shows the real thing. */
  branding: HospitalBranding | undefined;
}

export function TemplateDesigner({ branding }: Props) {
  const { data, isLoading } = usePdfTemplates();
  const save = useSavePdfTemplate();
  const reset = useResetPdfTemplate();

  const [selected, setSelected] = useState<TemplateKey>(ALL_DOCUMENTS_KEY);
  const [form, setForm] = useState<PdfTemplate | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the selected key's template into the form.
  useEffect(() => {
    if (!data) return;
    setForm(selected === ALL_DOCUMENTS_KEY ? data.all : (data.templates[selected] ?? data.defaults));
  }, [data, selected]);

  const registry = useMemo(() => data?.registry ?? [], [data]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof registry>();
    for (const r of registry) m.set(r.group, [...(m.get(r.group) ?? []), r]);
    return [...m.entries()];
  }, [registry]);

  const isCustomised = (key: string) => (data?.customised ?? []).includes(key);

  // `__all__` has no document body of its own — preview it as a prescription so
  // the admin still sees the settings land on a real page.
  const previewType: PdfDocumentType =
    selected === ALL_DOCUMENTS_KEY ? 'prescription' : (selected as PdfDocumentType);

  // Debounced live preview that reflects unsaved edits.
  const formKey = useMemo(() => JSON.stringify(form), [form]);
  useEffect(() => {
    if (!form || !branding) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPreviewing(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = await fetchBrandingPreviewUrl(branding, previewType, form);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        /* keep the last good preview */
      } finally {
        setPreviewing(false);
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, previewType, branding]);

  if (isLoading || !form || !data) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
      </div>
    );
  }

  // Typed section setters — each returns a new template so the preview effect fires.
  const setSection = <K extends keyof PdfTemplate>(k: K, patch: Partial<PdfTemplate[K]>) =>
    setForm((f) => (f ? { ...f, [k]: { ...(f[k] as object), ...patch } } : f));

  const onSave = async () => {
    try {
      await save.mutateAsync({ key: selected, template: form });
      toast.success(
        selected === ALL_DOCUMENTS_KEY
          ? 'Saved — this now applies to every document with no override of its own.'
          : 'Template saved. It applies from the next print.',
      );
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not save the template.'));
    }
  };

  const onReset = async () => {
    if (
      !confirm(
        selected === ALL_DOCUMENTS_KEY
          ? 'Reset the hospital-wide defaults? Documents with their own template keep it.'
          : 'Reset this document to the inherited defaults? Its own settings are discarded.',
      )
    )
      return;
    try {
      const fresh = await reset.mutateAsync(selected);
      if (fresh) setForm(fresh);
      toast.success('Reset to the inherited defaults.');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not reset.'));
    }
  };

  const addBlock = () =>
    setForm((f) =>
      f
        ? {
            ...f,
            blocks: [
              ...f.blocks,
              {
                id: `block-${f.blocks.length + 1}-${f.blocks.length}`,
                position: 'after_body',
                heading: '',
                text: '',
              },
            ],
          }
        : f,
    );
  const updateBlock = (i: number, patch: Partial<PdfCustomBlock>) =>
    setForm((f) =>
      f ? { ...f, blocks: f.blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) } : f,
    );
  const removeBlock = (i: number) =>
    setForm((f) => (f ? { ...f, blocks: f.blocks.filter((_, idx) => idx !== i) } : f));

  const selectedMeta = registry.find((r) => r.key === selected);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[210px_minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── Document list ── */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSelected(ALL_DOCUMENTS_KEY)}
          className={cn(
            'flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
            selected === ALL_DOCUMENTS_KEY
              ? 'border-primary bg-primary/10'
              : 'hover:bg-muted/50',
          )}
        >
          <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block text-xs font-semibold">All documents</span>
            <span className="block text-[10px] leading-tight text-muted-foreground">
              Defaults every type inherits
            </span>
          </span>
        </button>

        {groups.map(([group, items]) => (
          <div key={group} className="space-y-1">
            <p className="px-1 font-label text-[10px] uppercase tracking-widest text-muted-foreground">
              {group}
            </p>
            {items.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setSelected(r.key)}
                className={cn(
                  'flex w-full items-center justify-between gap-1 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors',
                  selected === r.key ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted/50',
                )}
              >
                <span className="truncate">{r.label}</span>
                {isCustomised(r.key) && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    title="This document has its own settings"
                  />
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* ── Settings ── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              {selectedMeta?.label ?? 'All documents'}
              {isCustomised(selected) && (
                <Badge variant="outline" className="text-[10px]">
                  Customised
                </Badge>
              )}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {selectedMeta?.description ??
                'Settings here apply to every document that has no template of its own.'}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={onReset}
              disabled={reset.isPending || !isCustomised(selected)}
              title="Discard this key's own settings"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button size="sm" className="gap-1.5" onClick={onSave} disabled={save.isPending}>
              {save.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Page */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Page</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Paper size">
              <Select
                value={form.page.size}
                onChange={(v) => setSection('page', { size: v as PdfTemplate['page']['size'] })}
                options={PAGE_SIZES}
              />
            </Field>
            <Field label="Orientation">
              <Select
                value={form.page.orientation}
                onChange={(v) =>
                  setSection('page', { orientation: v as PdfTemplate['page']['orientation'] })
                }
                options={[
                  { value: 'portrait', label: 'Portrait' },
                  { value: 'landscape', label: 'Landscape' },
                ]}
              />
            </Field>
            <Field label={`Margin — ${form.page.margin}pt`} className="col-span-2">
              <input
                type="range"
                min={18}
                max={90}
                step={2}
                value={form.page.margin}
                onChange={(e) => setSection('page', { margin: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Typography + colour */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Text &amp; colour</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Font" className="col-span-2">
              <Select
                value={form.typography.fontFamily}
                onChange={(v) =>
                  setSection('typography', {
                    fontFamily: v as PdfTemplate['typography']['fontFamily'],
                  })
                }
                options={FONTS}
              />
            </Field>
            <Field label={`Body size — ${form.typography.baseFontSize}pt`}>
              <input
                type="range"
                min={6}
                max={14}
                step={0.5}
                value={form.typography.baseFontSize}
                onChange={(e) =>
                  setSection('typography', { baseFontSize: Number(e.target.value) })
                }
                className="w-full accent-primary"
              />
            </Field>
            <Field label={`Line spacing — ${form.typography.lineGap}`}>
              <input
                type="range"
                min={0}
                max={8}
                step={0.5}
                value={form.typography.lineGap}
                onChange={(e) => setSection('typography', { lineGap: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </Field>
            <Field label="Accent colour" className="col-span-2">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.colors.accent ?? branding?.accentColor ?? '#0f766e'}
                  onChange={(e) => setSection('colors', { accent: e.target.value })}
                  className="h-9 w-11 cursor-pointer rounded border"
                />
                <Input
                  value={form.colors.accent ?? ''}
                  placeholder="Inherits the letterhead colour"
                  onChange={(e) => setSection('colors', { accent: e.target.value || null })}
                  className="h-9 flex-1"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 shrink-0 px-2 text-[11px]"
                  onClick={() => setSection('colors', { accent: null })}
                  disabled={form.colors.accent === null}
                  title="Fall back to the letterhead's accent colour"
                >
                  Inherit
                </Button>
              </div>
            </Field>
          </CardContent>
        </Card>

        {/* Header */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Header</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Toggle
              label="Print the letterhead"
              hint="Turn off when printing on pre-printed stationery that already carries it"
              checked={form.header.showLetterhead}
              onChange={(v) => setSection('header', { showLetterhead: v })}
            />
            <Toggle
              label="Title bar"
              checked={form.header.showTitleBar}
              onChange={(v) => setSection('header', { showTitleBar: v })}
            />
            <Toggle
              label="Meta strip (document number, date)"
              checked={form.header.showMetaStrip}
              onChange={(v) => setSection('header', { showMetaStrip: v })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Letterhead layout">
                <Select
                  value={form.header.headerStyle}
                  onChange={(v) =>
                    setSection('header', {
                      headerStyle: v as PdfTemplate['header']['headerStyle'],
                    })
                  }
                  options={[
                    { value: 'inherit', label: 'As set on the letterhead' },
                    { value: 'centered', label: 'Centered' },
                    { value: 'left', label: 'Left' },
                  ]}
                />
              </Field>
              <Field label="Rename this document">
                <Input
                  value={form.header.titleOverride ?? ''}
                  placeholder={selectedMeta?.defaultTitle ?? 'Default title'}
                  onChange={(e) =>
                    setSection('header', { titleOverride: e.target.value || null })
                  }
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tables</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Row density">
              <Select
                value={form.table.density}
                onChange={(v) =>
                  setSection('table', { density: v as PdfTemplate['table']['density'] })
                }
                options={[
                  { value: 'compact', label: 'Compact — fits more' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'comfortable', label: 'Comfortable' },
                ]}
              />
            </Field>
            <Field label="Header row">
              <Select
                value={form.table.headerFill}
                onChange={(v) =>
                  setSection('table', { headerFill: v as PdfTemplate['table']['headerFill'] })
                }
                options={[
                  { value: 'accent', label: 'Accent fill, white text' },
                  { value: 'muted', label: 'Light tint' },
                  { value: 'none', label: 'No fill' },
                ]}
              />
            </Field>
            <Field label="Grid lines">
              <Select
                value={form.table.gridLines}
                onChange={(v) =>
                  setSection('table', { gridLines: v as PdfTemplate['table']['gridLines'] })
                }
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'horizontal', label: 'Horizontal only' },
                  { value: 'all', label: 'Full grid' },
                ]}
              />
            </Field>
            <div className="flex items-end">
              <Toggle
                label="Striped rows"
                checked={form.table.zebraRows}
                onChange={(v) => setSection('table', { zebraRows: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Watermark */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">Watermark</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Toggle
              label="Stamp a watermark across every page"
              checked={form.watermark.enabled}
              onChange={(v) => setSection('watermark', { enabled: v })}
            />
            {form.watermark.enabled && (
              <>
                <div className="flex flex-wrap gap-1">
                  {WATERMARK_PRESETS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setSection('watermark', { text: w })}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] transition-colors',
                        form.watermark.text === w
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'hover:bg-muted',
                      )}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Text" className="col-span-2">
                    <Input
                      value={form.watermark.text}
                      onChange={(e) => setSection('watermark', { text: e.target.value })}
                      maxLength={40}
                    />
                  </Field>
                  <Field label={`Strength — ${Math.round(form.watermark.opacity * 100)}%`}>
                    <input
                      type="range"
                      min={2}
                      max={40}
                      value={Math.round(form.watermark.opacity * 100)}
                      onChange={(e) =>
                        setSection('watermark', { opacity: Number(e.target.value) / 100 })
                      }
                      className="w-full accent-primary"
                    />
                  </Field>
                  <Field label={`Angle — ${form.watermark.angle}°`}>
                    <input
                      type="range"
                      min={-90}
                      max={90}
                      value={form.watermark.angle}
                      onChange={(e) => setSection('watermark', { angle: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </Field>
                </div>
                <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                  <FileWarning className="mt-0.5 h-3 w-3 shrink-0" />
                  Strength is capped at 40% on purpose — a watermark heavy enough to obscure a
                  dose or an amount is a safety problem, not a design choice.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer + signature */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Footer &amp; signatures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Toggle
              label="Print the footer"
              checked={form.footer.showFooter}
              onChange={(v) => setSection('footer', { showFooter: v })}
            />
            <Toggle
              label="Page numbers"
              checked={form.footer.showPageNumbers}
              onChange={(v) => setSection('footer', { showPageNumbers: v })}
            />
            <Toggle
              label="Generated-at timestamp"
              checked={form.footer.showGeneratedAt}
              onChange={(v) => setSection('footer', { showGeneratedAt: v })}
            />
            <Field label="Footer note for this document only">
              <Textarea
                rows={2}
                className="resize-none"
                value={form.footer.footerTextOverride ?? ''}
                placeholder="Leave blank to use the letterhead's footer note"
                onChange={(e) =>
                  setSection('footer', { footerTextOverride: e.target.value || null })
                }
              />
            </Field>

            <Toggle
              label="Signature block"
              hint="Ruled signing lines at the end of the document"
              checked={form.signature.enabled}
              onChange={(v) => setSection('signature', { enabled: v })}
            />
            {form.signature.enabled && (
              <Field label="Signing lines (comma-separated, up to 4)">
                <Input
                  value={form.signature.labels.join(', ')}
                  onChange={(e) =>
                    setSection('signature', {
                      labels: e.target.value
                        .split(',')
                        .map((l) => l.trim())
                        .filter(Boolean)
                        .slice(0, 4),
                    })
                  }
                  placeholder="e.g. Prepared by, Authorised Signatory"
                />
              </Field>
            )}
          </CardContent>
        </Card>

        {/* Custom blocks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm">Your own text</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={addBlock}
              disabled={form.blocks.length >= 6}
            >
              <Plus className="h-3 w-3" /> Add block
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.blocks.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Nothing added. Use this for a consent line, terms of payment, a insurance-claim
                note, or anything else this document should always carry.
              </p>
            ) : (
              form.blocks.map((b, i) => (
                <div key={b.id} className="space-y-2 rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <Select
                      value={b.position}
                      onChange={(v) =>
                        updateBlock(i, { position: v as PdfCustomBlock['position'] })
                      }
                      options={[
                        { value: 'before_body', label: 'Before the body' },
                        { value: 'after_body', label: 'After the body' },
                      ]}
                    />
                    <Input
                      value={b.heading ?? ''}
                      placeholder="Heading (optional)"
                      onChange={(e) => updateBlock(i, { heading: e.target.value })}
                      className="h-9 flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0 text-destructive"
                      onClick={() => removeBlock(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    rows={3}
                    className="resize-none"
                    value={b.text}
                    placeholder="Text to print on this document"
                    onChange={(e) => updateBlock(i, { text: e.target.value })}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Live preview ── */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-primary" /> Live preview
              {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </CardTitle>
            <a
              href={previewUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'inline-flex items-center gap-1 text-[11px] text-primary hover:underline',
                !previewUrl && 'pointer-events-none opacity-40',
              )}
            >
              <ExternalLink className="h-3 w-3" /> Open full PDF
            </a>
          </CardHeader>
          <CardContent className="p-0">
            {previewUrl ? (
              <iframe
                title="Template preview"
                src={`${previewUrl}#toolbar=0`}
                className="h-[78vh] w-full border-0 bg-white"
              />
            ) : (
              <div className="flex h-[78vh] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering preview…
              </div>
            )}
          </CardContent>
        </Card>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {selected === ALL_DOCUMENTS_KEY
            ? 'Shown on a sample prescription — these settings reach every document that has no template of its own.'
            : 'Sample content in the shape of the real document. Nothing here is a real record.'}
        </p>
      </div>
    </div>
  );
}

// ── Small form parts ───────────────────────────────────────────────────────

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 accent-primary"
      />
      <span className="min-w-0">
        <span className={checked ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
        {hint && <span className="block text-[10px] leading-tight text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
