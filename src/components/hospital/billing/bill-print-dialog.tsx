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
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
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
