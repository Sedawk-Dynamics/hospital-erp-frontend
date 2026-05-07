'use client';

// Read-only preview dialog used from the super-admin Form Templates list
// and the hospital admin Patient Forms list, so admins can sanity-check
// what nurses will see without opening the full builder. Reuses
// `FormRenderer` in `readOnly` mode — no submission, no validation pop.
//
// Layout: fixed-height card with sticky header + footer; only the form
// body scrolls so the title and "Close" button stay visible while the
// admin scrolls through long forms.

import { Eye, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Button } from '@/components/ui/button';
import { FormRenderer } from './form-renderer';
import { FORM_CATEGORIES, type FormCategory, type FormSchema } from '@/hooks/use-forms';

interface FormPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description?: string | null;
  category: FormCategory;
  version?: number;
  schema: FormSchema | undefined;
}

function categoryLabel(c: FormCategory): string {
  return FORM_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export function FormPreviewDialog({
  open,
  onOpenChange,
  name,
  description,
  category,
  version,
  schema,
}: FormPreviewDialogProps) {
  const fields = schema?.fields ?? [];
  const dataFieldCount = fields.filter(
    (f) => f.type !== 'section' && f.type !== 'divider',
  ).length;
  const hasFields = dataFieldCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[88vh] w-[min(calc(100vw-2rem),56rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        {/* Header — sticky, never scrolls */}
        <div className="flex items-start justify-between gap-3 border-b bg-surface-container-lowest px-5 py-4">
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Eye className="h-4 w-4 text-primary" />
              <span className="truncate">{name || 'Form preview'}</span>
            </DialogTitle>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                {categoryLabel(category)}
              </span>
              {version != null && (
                <span className="rounded-full border bg-surface-container-low px-2 py-0.5 font-medium">
                  v{version}
                </span>
              )}
              <span className="rounded-full border bg-surface-container-low px-2 py-0.5 font-medium">
                {dataFieldCount} field{dataFieldCount === 1 ? '' : 's'}
              </span>
              {description && (
                <span className="truncate text-muted-foreground/80">· {description}</span>
              )}
            </div>
          </div>
          <DialogPrimitive.Close
            render={
              <Button variant="ghost" size="icon-sm" className="-mr-1 shrink-0" />
            }
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>

        {/* Body — only this scrolls */}
        <div className="flex-1 overflow-y-auto bg-muted/30 px-5 py-5">
          {!schema || !hasFields ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-sm text-muted-foreground">
                <p className="font-medium">No fields yet</p>
                <p className="text-[11px]">Open the builder to add fields to this form.</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl rounded-xl border bg-surface-container-lowest p-5 shadow-sm">
              <FormRenderer schema={schema} onSubmit={() => undefined} readOnly />
            </div>
          )}
        </div>

        {/* Footer — sticky */}
        <div className="flex items-center justify-between gap-3 border-t bg-surface-container-lowest px-5 py-3">
          <p className="text-[11px] text-muted-foreground">
            Read-only preview. No data is saved.
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
