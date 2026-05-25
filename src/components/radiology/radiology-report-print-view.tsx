'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useImagingResult, type ImagingResult } from '@/hooks/use-imaging';
import { formatDate, formatDateTime } from '@/lib/date-utils';

export function RadiologyReportPrintDialog({
  resultId,
  open,
  onOpenChange,
}: {
  resultId: string | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { data: result, isLoading } = useImagingResult(resultId ?? '');
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Radiology Report</title>${printStyles}</head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between border-b bg-surface-container-low px-4 py-2 sticky top-0 z-10">
          <p className="text-sm font-medium">Radiology Report Preview</p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} disabled={!result || isLoading}>
              <Printer className="size-3.5" /> Print / Save PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {isLoading || !result ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div ref={printRef} className="bg-white">
            <RadiologyReportPaper result={result} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RadiologyReportPaper({ result }: { result: ImagingResult }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Build a verification URL from the request id (mirrors the lab pattern)
  const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/r/imaging/${result.imagingRequestId}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(verifyUrl, { width: 144, margin: 1, errorCorrectionLevel: 'M' })
      .then((data) => { if (!cancelled) setQrDataUrl(data); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [verifyUrl]);

  const req = result.imagingRequest ?? result.request;
  const patient = (result as any).patient ?? (req as any)?.patient ?? null;
  const radiologist = result.radiologist ?? result.reportedBy;
  const signer = result.signer ?? result.verifiedBy;

  return (
    <article className="rad-report-paper text-[13px] text-gray-800">
      <header className="flex items-start justify-between gap-4 border-b-2 border-primary px-8 pt-8 pb-4">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold">
            RAD
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Radiology Report</h1>
            <p className="text-[11px] text-gray-600">
              Department of Radiology &amp; Imaging
            </p>
          </div>
        </div>
        <div className="text-right text-[11px] text-gray-700">
          <p className="font-bold text-base text-gray-900">IMAGING REPORT</p>
          <p>Study #: <span className="font-mono">{result.imagingRequestId.slice(0, 8).toUpperCase()}</span></p>
          <p>Result #: <span className="font-mono">{result.id.slice(0, 8).toUpperCase()}</span></p>
          {result.status === 'published' && (
            <p className="mt-1 inline-block bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
              PUBLISHED
            </p>
          )}
        </div>
      </header>

      <section className="grid grid-cols-3 gap-6 px-8 py-4 border-b border-gray-200 text-[11.5px]">
        <div>
          <p className="text-gray-500 uppercase tracking-wide text-[10px]">Patient</p>
          <p className="font-semibold">
            {patient ? `${patient.firstName} ${patient.lastName ?? ''}`.trim() : '—'}
          </p>
          {patient?.mrn && (
            <p className="text-gray-700">MRN: <span className="font-mono">{patient.mrn}</span></p>
          )}
          {patient?.gender && (
            <p className="text-gray-700 capitalize">Gender: {patient.gender}</p>
          )}
          {patient?.dateOfBirth && (
            <p className="text-gray-700">DOB: {formatDate(patient.dateOfBirth)}</p>
          )}
        </div>
        <div>
          <p className="text-gray-500 uppercase tracking-wide text-[10px]">Examination</p>
          <p className="font-semibold capitalize">
            {(req?.imagingType ?? '').replace(/_/g, ' ') || '—'}
          </p>
          {req?.bodyPart && <p className="text-gray-700">Body part: {req.bodyPart}</p>}
          {req?.urgency && (
            <p className="text-gray-700 capitalize">Urgency: {req.urgency}</p>
          )}
        </div>
        <div>
          <p className="text-gray-500 uppercase tracking-wide text-[10px]">Reported</p>
          <p className="font-semibold">
            {result.signedAt
              ? formatDateTime(result.signedAt)
              : formatDateTime(result.updatedAt ?? result.createdAt)}
          </p>
          <p className="text-gray-700">Status: <span className="capitalize">{result.status}</span></p>
        </div>
      </section>

      {req?.clinicalIndication && (
        <section className="px-8 py-3 border-b border-gray-200 text-[12px]">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Clinical Indication</p>
          <p className="whitespace-pre-wrap">{req.clinicalIndication}</p>
        </section>
      )}

      {result.impression && (
        <section className="px-8 py-4 border-b border-gray-200">
          <h3 className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Impression</h3>
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed font-medium">
            {result.impression}
          </p>
        </section>
      )}

      {result.imageUrls && result.imageUrls.length > 0 && (
        <section className="px-8 py-4 border-b border-gray-200">
          <h3 className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">Images</h3>
          <div className="grid grid-cols-3 gap-3">
            {result.imageUrls.map((url, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${url}-${idx}`}
                src={url}
                alt={`Image ${idx + 1}`}
                className="w-full h-32 object-cover rounded border border-gray-200"
              />
            ))}
          </div>
          {result.pacsReferenceId && (
            <p className="mt-2 text-[10px] text-gray-500 font-mono">
              PACS reference: {result.pacsReferenceId}
            </p>
          )}
        </section>
      )}

      <footer className="grid grid-cols-3 gap-6 px-8 pt-4 pb-8">
        <div className="col-span-2 grid grid-cols-2 gap-6">
          <div>
            <div className="border-t border-gray-400 pt-1 text-[11px]">
              <p className="font-semibold">Radiologist</p>
              <p className="text-gray-700">
                {radiologist
                  ? `Dr. ${radiologist.firstName} ${radiologist.lastName ?? ''}`.trim()
                  : '—'}
              </p>
            </div>
          </div>
          <div>
            <div className="border-t border-gray-400 pt-1 text-[11px]">
              <p className="font-semibold">Verified by</p>
              <p className="text-gray-700">
                {signer
                  ? `Dr. ${signer.firstName} ${signer.lastName ?? ''}`.trim()
                  : '—'}
              </p>
              {result.signedAt && (
                <p className="text-[10px] text-gray-500">{formatDateTime(result.signedAt)}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end text-right">
          {qrDataUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Verification QR" className="h-24 w-24" />
              <p className="text-[9px] text-gray-500 mt-1 max-w-[140px]">
                Scan to verify authenticity
              </p>
            </>
          )}
        </div>
      </footer>

      <div className="text-center text-[9px] text-gray-400 pb-4 px-8">
        This is a computer-generated radiology report.
        {result.status === 'published' && ' Authorised for clinical use.'}
      </div>
    </article>
  );
}

const printStyles = `<style>
  body { font-family: 'Inter', Arial, sans-serif; color: #1f2937; background: #fff; margin: 0; padding: 0; }
  @media print {
    @page { margin: 12mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  .rad-report-paper { max-width: 800px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0; }
  h3 { margin: 0 0 4px 0; font-size: 13px; }
  p { margin: 0 0 2px 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #00BFA5; padding: 24px 28px 14px; }
  section { padding: 14px 28px; border-bottom: 1px solid #e5e7eb; }
  section.grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 24px; }
  footer { display: grid; grid-template-columns: repeat(3,1fr); gap: 24px; padding: 14px 28px 24px; }
  .grid { display: grid; }
  .grid-cols-3 { grid-template-columns: repeat(3,1fr); }
  .grid-cols-2 { grid-template-columns: repeat(2,1fr); }
  .col-span-2 { grid-column: span 2; }
  .gap-3 { gap: 12px; }
  .gap-6 { gap: 24px; }
  .border-primary { border-color: #00BFA5; }
  .bg-primary\\/10 { background: rgba(0,191,165,0.1); color: #00897B; }
  .bg-emerald-100 { background: #d1fae5; }
  .text-emerald-800 { color: #065f46; }
  .font-mono { font-family: 'Courier New', monospace; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .uppercase { text-transform: uppercase; }
  .capitalize { text-transform: capitalize; }
  .text-gray-400 { color: #9ca3af; }
  .text-gray-500 { color: #6b7280; }
  .text-gray-600 { color: #4b5563; }
  .text-gray-700 { color: #374151; }
  .text-gray-800 { color: #1f2937; }
  .text-gray-900 { color: #111827; }
  .text-primary { color: #00897B; }
  .whitespace-pre-wrap { white-space: pre-wrap; }
  .border-t { border-top: 1px solid #9ca3af; }
  img { display: inline-block; }
  .object-cover { object-fit: cover; }
  .rounded { border-radius: 4px; }
  .border-gray-200 { border-color: #e5e7eb; }
</style>`;
