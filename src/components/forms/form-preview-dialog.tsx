'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormRenderer } from './form-renderer';
import type { FormSchema } from '@/types/forms';

// ─────────────────────────────────────────────────────────
// Shared, polished preview dialog used in:
//   • /super-admin/forms                (FormTemplate preview)
//   • /hospital/settings/forms Library  (published FormTemplate preview)
//   • /hospital/settings/forms My Forms (FormInstance preview)
//
// Two display modes inside the dialog:
//   1. "fill"      — interactive form, validates with Zod, no save
//   2. "submitted" — read-only display of the captured data, with a
//                    success banner explaining nothing was persisted
//
// "Submit (Preview)" runs the form's real validation and switches to
// the submitted-data view so the admin can verify what would be captured.
// ─────────────────────────────────────────────────────────

export interface FormPreviewMeta {
  /** Short label, e.g. "Status", "Category", "Trigger" */
  label: string;
  /** Display value */
  value: string;
  /** Optional Tailwind classes to render value as a colored pill */
  badgeClass?: string;
}

export interface FormPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  schema: FormSchema;
  title: string;
  description?: string | null;
  /** Meta strip shown beneath the title */
  meta?: FormPreviewMeta[];
  /** Optional primary footer action (e.g. "Open in Editor", "Use This Form") */
  primaryAction?: {
    label: string;
    icon?: React.ElementType;
    onClick: () => void;
    loading?: boolean;
  };
  /** Optional secondary footer action */
  secondaryAction?: {
    label: string;
    icon?: React.ElementType;
    onClick: () => void;
  };
}

export function FormPreviewDialog({
  open,
  onClose,
  schema,
  title,
  description,
  meta,
  primaryAction,
  secondaryAction,
}: FormPreviewDialogProps) {
  const [mode, setMode] = useState<'fill' | 'submitted'>('fill');
  const [submittedData, setSubmittedData] = useState<Record<string, unknown> | null>(null);

  // Reset on every open
  useEffect(() => {
    if (open) {
      setMode('fill');
      setSubmittedData(null);
    }
  }, [open]);

  const fieldCount = useMemo(
    () => schema.fields.filter((f) => f.type !== 'section_header').length,
    [schema],
  );

  const PrimaryIcon = primaryAction?.icon;
  const SecondaryIcon = secondaryAction?.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* ─── Header ─── */}
        <header className="px-6 pt-6 pb-4 border-b bg-card">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="font-headline text-lg font-bold leading-tight">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="text-xs mt-1 leading-relaxed">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>

          {/* Meta strip */}
          {meta && meta.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 ml-13 pl-0">
              {meta.map((m, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-muted-foreground/70 font-label uppercase tracking-wider">
                    {m.label}
                  </span>
                  <span
                    className={cn(
                      'font-semibold capitalize',
                      m.badgeClass
                        ? cn('rounded-full px-2 py-0.5', m.badgeClass)
                        : 'text-foreground',
                    )}
                  >
                    {m.value}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground/70 font-label uppercase tracking-wider">
                  Fields
                </span>
                <span className="font-semibold text-foreground">{fieldCount}</span>
              </div>
            </div>
          )}
        </header>

        {/* ─── Body (scrollable) ─── */}
        <div className="flex-1 overflow-y-auto bg-muted/20 px-6 py-5">
          {mode === 'fill' ? (
            <div className="rounded-xl border border-border/60 bg-card shadow-sm p-6">
              <div className="mb-4 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Live preview — fill the form below to see what data will be captured.</span>
              </div>
              <FormRenderer
                schema={schema}
                submitLabel="Submit (Preview)"
                onSubmit={(data) => {
                  setSubmittedData(data);
                  setMode('submitted');
                }}
              />
            </div>
          ) : (
            <SubmittedDataView schema={schema} data={submittedData ?? {}} />
          )}
        </div>

        {/* ─── Footer (sticky) ─── */}
        <footer className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-card">
          {mode === 'submitted' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMode('fill');
                setSubmittedData(null);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to form
            </Button>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              Nothing is saved — this is a preview of the form structure and validation.
            </p>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {secondaryAction && (
              <Button variant="outline" size="sm" onClick={secondaryAction.onClick}>
                {SecondaryIcon && <SecondaryIcon className="h-4 w-4 mr-1.5" />}
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                size="sm"
                onClick={primaryAction.onClick}
                disabled={primaryAction.loading}
              >
                {PrimaryIcon && <PrimaryIcon className="h-4 w-4 mr-1.5" />}
                {primaryAction.loading ? 'Working…' : primaryAction.label}
              </Button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────
// Submitted-data view — shown after the user clicks "Submit (Preview)".
// ─────────────────────────────────────────────────────────

function SubmittedDataView({
  schema,
  data,
}: {
  schema: FormSchema;
  data: Record<string, unknown>;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-4 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-900">Validation passed</p>
          <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
            This is exactly what would be saved to the database when a real user submits this form.
            No data was actually stored.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm p-6">
        <FormRenderer schema={schema} initialValues={data} readOnly />
      </div>
    </div>
  );
}
