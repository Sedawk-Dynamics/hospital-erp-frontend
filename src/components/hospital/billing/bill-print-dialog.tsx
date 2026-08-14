'use client';

import { useState } from 'react';
import { Loader2, Printer, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAdmissionBillDocument, openAdmissionBillPdf } from '@/hooks/use-ip-billing';
import { AdmissionBillDocumentView } from './admission-bill-document';
import { pageDimensions, DEFAULT_PDF_TEMPLATE } from '@/lib/pdf-theme';
import type { PdfTemplate } from '@/hooks/use-hospital-branding';

/** pt → px. Both are 1/72in vs 1/96in of the same inch. */
const PT_TO_PX = 96 / 72;
/** DialogContent's own `p-4`, left + right. */
const DIALOG_PADDING_PX = 32;
/** Room for the dialog's vertical scrollbar so the page is not shaved. */
const SCROLLBAR_PX = 24;

/**
 * How wide the dialog has to be to show this template's page at its true size.
 *
 * Exported so it can be tested directly: the previous fixed `max-w-4xl` was
 * silently doing nothing (see the call site), and a squeezed page is the kind
 * of thing that only shows up by eye.
 */
export function billDialogMaxWidth(template: PdfTemplate | null | undefined): string {
  const pageWidthPx = pageDimensions((template ?? DEFAULT_PDF_TEMPLATE).page).width * PT_TO_PX;
  const needed = Math.ceil(pageWidthPx) + DIALOG_PADDING_PX + SCROLLBAR_PX;
  // Never wider than the window, whatever page the hospital has chosen.
  return `min(calc(100vw - 2rem), ${needed}px)`;
}

// One place to print the bill for an IP / Emergency / Day Care stay, opened from
// the billing worklist and from the IP workspace ledger. Read-only: it never
// posts or finalises anything, so a settled bill can be reprinted any number of
// times and an in-progress stay can be shown as an interim bill.

export function BillPrintDialog({
  admissionId,
  open,
  onOpenChange,
}: {
  admissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: doc, isLoading, error } = useAdmissionBillDocument(admissionId, open);
  const [downloading, setDownloading] = useState(false);

  // Size the dialog to the paper it is previewing. The document renders at the
  // template's real page width (595.28pt for A4), so a fixed dialog width either
  // squeezed the page — no longer a true preview of what prints — or left a
  // margin of dead space for the smaller sizes. A hospital on A5, LETTER or a
  // landscape template gets a box that fits, without anyone tuning a constant.
  //
  // Set inline rather than as a class: DialogContent's base `sm:max-w-lg` is a
  // responsive variant, so it beats any plain `max-w-*` a caller passes and
  // twMerge cannot fold the two together (different variants, both kept). The
  // `max-w-4xl` that used to be here never applied at all — the box was stuck
  // at 512px while the bill overflowed it.
  const maxWidth = billDialogMaxWidth(doc?.template);

  const handleDownload = async () => {
    if (!admissionId) return;
    setDownloading(true);
    try {
      await openAdmissionBillPdf(admissionId);
    } catch {
      toast.error('Could not generate the bill PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" style={{ maxWidth }}>
        <DialogHeader className="no-print">
          <DialogTitle>
            {doc ? `${doc.admissionTypeLabel} · ${doc.documentTitle}` : 'Bill'}
          </DialogTitle>
          <DialogDescription>
            {doc
              ? doc.isDischarged
                ? 'Final bill for this stay — printable any time.'
                : 'Interim bill — the patient is still admitted, so charges may still be added.'
              : 'Assembling the bill…'}
          </DialogDescription>
        </DialogHeader>

        <div className="no-print flex items-center justify-end gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!doc || downloading}
            className="gap-1.5"
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            PDF
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={!doc} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Assembling the bill…</p>
          </div>
        ) : error || !doc ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="h-7 w-7 text-error" />
            <p className="mt-2 text-sm text-foreground">Could not load this bill.</p>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : 'Please try again.'}
            </p>
          </div>
        ) : (
          <AdmissionBillDocumentView doc={doc} />
        )}
      </DialogContent>
    </Dialog>
  );
}
