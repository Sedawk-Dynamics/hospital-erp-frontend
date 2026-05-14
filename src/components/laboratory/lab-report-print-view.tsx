'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useLabReport, type LabReport } from '@/hooks/use-lab';
import { formatDate, formatDateTime } from '@/lib/date-utils';

interface StructuredPayload {
  branding?: {
    name?: string;
    logoUrl?: string | null;
    address?: string | null;
    phone?: string | null;
    accreditation?: string | null;
  };
  patient?: {
    id?: string;
    mrn?: string;
    name?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  items?: Array<{
    testName: string;
    testCode?: string;
    sampleType?: string;
    results?: Array<{
      parameter: string;
      value: string | null;
      unit: string | null;
      normalRange: string | null;
      isAbnormal: boolean;
    }>;
  }>;
  notes?: string | null;
  generatedAt?: string;
}

function parseStructured(report: LabReport | undefined): StructuredPayload {
  if (!report?.reportContent) return {};
  try {
    const parsed = JSON.parse(report.reportContent);
    if (parsed && typeof parsed === 'object') return parsed as StructuredPayload;
  } catch {
    return {};
  }
  return {};
}

export function LabReportPrintDialog({
  reportId,
  open,
  onOpenChange,
}: {
  reportId: string | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { data: report, isLoading } = useLabReport(reportId ?? '');
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Lab Report</title>${printStyles}</head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between border-b bg-surface-container-low px-4 py-2 sticky top-0 z-10">
          <p className="text-sm font-medium">Lab Report Preview</p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} disabled={!report || isLoading}>
              <Printer className="size-3.5" /> Print / Save PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {isLoading || !report ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div ref={printRef} className="bg-white">
            <LabReportPaper report={report} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function LabReportPaper({ report }: { report: LabReport }) {
  const payload = useMemo(() => parseStructured(report), [report]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = report.qrCodeUrl;
    if (!url) { setQrDataUrl(null); return; }
    QRCode.toDataURL(url, { width: 144, margin: 1, errorCorrectionLevel: 'M' })
      .then((data) => { if (!cancelled) setQrDataUrl(data); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [report.qrCodeUrl]);

  const branding = payload.branding ?? {};
  const patient = payload.patient ?? {
    mrn: report.patient?.mrn ?? report.order?.patient?.mrn,
    name: report.patient
      ? `${report.patient.firstName} ${report.patient.lastName ?? ''}`.trim()
      : undefined,
  };
  const items = payload.items ?? [];

  const issuedDate = report.publishedAt ?? report.signedAt ?? report.generatedAt ?? report.createdAt;

  return (
    <article className="lab-report-paper text-[13px] text-gray-800">
      {/* Branding header */}
      <header className="flex items-start justify-between gap-4 border-b-2 border-primary px-8 pt-8 pb-4">
        <div className="flex items-start gap-3">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-14 w-14 object-contain" />
          ) : (
            <div className="h-14 w-14 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold">
              LAB
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold leading-tight">
              {branding.name ?? 'Hospital'}
            </h1>
            {branding.address && (
              <p className="text-[11px] text-gray-600 max-w-xs leading-snug">{branding.address}</p>
            )}
            {branding.phone && (
              <p className="text-[11px] text-gray-600">Tel: {branding.phone}</p>
            )}
            {branding.accreditation && (
              <p className="text-[11px] font-medium text-primary mt-0.5">{branding.accreditation}</p>
            )}
          </div>
        </div>
        <div className="text-right text-[11px] text-gray-700">
          <p className="font-bold text-base text-gray-900">LABORATORY REPORT</p>
          <p>Report ID: <span className="font-mono">{report.id.slice(0, 8).toUpperCase()}</span></p>
          <p>Version: v{report.version ?? 1}</p>
          {report.status === 'corrected' && (
            <p className="mt-1 inline-block bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
              CORRECTED COPY
            </p>
          )}
        </div>
      </header>

      {/* Patient + report block */}
      <section className="grid grid-cols-3 gap-6 px-8 py-4 border-b border-gray-200 text-[11.5px]">
        <div>
          <p className="text-gray-500 uppercase tracking-wide text-[10px]">Patient</p>
          <p className="font-semibold">{patient.name ?? '—'}</p>
          <p className="text-gray-700">
            MRN: <span className="font-mono">{patient.mrn ?? '—'}</span>
          </p>
          {patient.gender && (
            <p className="text-gray-700 capitalize">Gender: {patient.gender}</p>
          )}
          {patient.dateOfBirth && (
            <p className="text-gray-700">DOB: {formatDate(patient.dateOfBirth)}</p>
          )}
        </div>
        <div>
          <p className="text-gray-500 uppercase tracking-wide text-[10px]">Referring Physician</p>
          <p className="font-semibold">
            {report.order?.orderer || report.labOrder?.orderer
              ? `Dr. ${(report.order?.orderer ?? report.labOrder?.orderer)?.firstName ?? ''} ${(report.order?.orderer ?? report.labOrder?.orderer)?.lastName ?? ''}`.trim()
              : '—'}
          </p>
          <p className="text-gray-700">Order #: <span className="font-mono">{(report.orderId ?? report.labOrderId ?? '').slice(0, 8).toUpperCase()}</span></p>
        </div>
        <div>
          <p className="text-gray-500 uppercase tracking-wide text-[10px]">Report Issued</p>
          <p className="font-semibold">{formatDateTime(issuedDate)}</p>
          <p className="text-gray-700">Status: <span className="capitalize">{report.status}</span></p>
        </div>
      </section>

      {/* Results */}
      <section className="px-8 py-4">
        {items.length === 0 ? (
          <p className="text-center text-gray-500 italic">No structured results in this report.</p>
        ) : (
          items.map((item, idx) => (
            <div key={`${item.testCode ?? item.testName}-${idx}`} className="mb-4 break-inside-avoid">
              <div className="flex items-baseline justify-between border-b border-gray-300 pb-1 mb-2">
                <h3 className="text-sm font-bold uppercase tracking-wide">{item.testName}</h3>
                <span className="text-[11px] text-gray-600">
                  {item.testCode && <span className="font-mono mr-2">{item.testCode}</span>}
                  {item.sampleType && <span>Sample: {item.sampleType}</span>}
                </span>
              </div>
              {item.results && item.results.length > 0 ? (
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-600">
                      <th className="text-left px-2 py-1 border border-gray-200">Parameter</th>
                      <th className="text-right px-2 py-1 border border-gray-200">Result</th>
                      <th className="text-left px-2 py-1 border border-gray-200">Unit</th>
                      <th className="text-left px-2 py-1 border border-gray-200">Reference Range</th>
                      <th className="text-center px-2 py-1 border border-gray-200">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.results.map((r, i) => (
                      <tr key={`${r.parameter}-${i}`} className={r.isAbnormal ? 'bg-red-50' : ''}>
                        <td className="px-2 py-1 border border-gray-200">{r.parameter}</td>
                        <td className={`px-2 py-1 border border-gray-200 text-right font-mono ${r.isAbnormal ? 'font-bold text-red-700' : ''}`}>
                          {r.value ?? '—'}
                        </td>
                        <td className="px-2 py-1 border border-gray-200 text-gray-700">{r.unit ?? '—'}</td>
                        <td className="px-2 py-1 border border-gray-200 text-gray-700">{r.normalRange ?? '—'}</td>
                        <td className="px-2 py-1 border border-gray-200 text-center">
                          {r.isAbnormal ? (
                            <span className="font-bold text-red-700">H/L</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[11px] italic text-gray-500">No parameters entered for this test.</p>
              )}
            </div>
          ))
        )}

        {payload.notes && (
          <div className="mt-4 rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Notes</p>
            <p className="text-[12px] whitespace-pre-wrap">{payload.notes}</p>
          </div>
        )}

        {report.status === 'corrected' && report.correctionNotes && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-amber-800 mb-1">Correction Notes</p>
            <p className="text-[12px] whitespace-pre-wrap">{report.correctionNotes}</p>
          </div>
        )}
      </section>

      {/* Signatures + QR */}
      <footer className="grid grid-cols-3 gap-6 px-8 pt-4 pb-8 border-t border-gray-200">
        <div className="col-span-2 grid grid-cols-2 gap-6">
          <div>
            <div className="border-t border-gray-400 pt-1 text-[11px]">
              <p className="font-semibold">Verified by</p>
              <p className="text-gray-700">
                {report.signedAt && report.approvedBy
                  ? '—'
                  : ''}
                {(report as any).signer
                  ? `${(report as any).signer.firstName} ${(report as any).signer.lastName ?? ''}`.trim()
                  : '—'}
              </p>
              {report.signedAt && (
                <p className="text-[10px] text-gray-500">{formatDateTime(report.signedAt)}</p>
              )}
            </div>
          </div>
          <div>
            <div className="border-t border-gray-400 pt-1 text-[11px]">
              <p className="font-semibold">Pathologist Sign</p>
              <p className="text-gray-700">
                {(report as any).approver
                  ? `${(report as any).approver.firstName} ${(report as any).approver.lastName ?? ''}`.trim()
                  : (report as any).signer
                    ? `${(report as any).signer.firstName} ${(report as any).signer.lastName ?? ''}`.trim()
                    : '—'}
              </p>
              {report.approvedAt && (
                <p className="text-[10px] text-gray-500">{formatDateTime(report.approvedAt)}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end text-right">
          {qrDataUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Verification QR" className="h-24 w-24" />
              <p className="text-[9px] text-gray-500 mt-1 max-w-[140px]">
                Scan to verify authenticity at {(report.qrCodeUrl ?? '').replace(/^https?:\/\//, '')}
              </p>
            </>
          ) : (
            <div className="h-24 w-24 border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400">
              QR
            </div>
          )}
        </div>
      </footer>

      <div className="text-center text-[9px] text-gray-400 pb-4 px-8">
        This is a computer-generated report.
        {report.status === 'published' && ' Authorised for clinical use.'}
        {report.status === 'corrected' && ' This corrected copy supersedes any prior version.'}
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
  .lab-report-paper { max-width: 800px; margin: 0 auto; }
  table { width: 100%; border-collapse: collapse; }
  table th, table td { border: 1px solid #e5e7eb; padding: 4px 8px; font-size: 12px; }
  table thead th { background: #f9fafb; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563; text-align: left; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .border-primary { border-color: #00BFA5; }
  .bg-primary\\/10 { background: rgba(0,191,165,0.1); color: #00897B; }
  .bg-red-50 { background: #fef2f2; }
  .text-red-700 { color: #b91c1c; }
  .bg-amber-50 { background: #fffbeb; }
  .text-amber-800 { color: #92400e; }
  .bg-amber-100 { background: #fef3c7; }
  .border-amber-300 { border-color: #fcd34d; }
  .bg-gray-50 { background: #f9fafb; }
  .font-mono { font-family: 'Courier New', monospace; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .uppercase { text-transform: uppercase; }
  .capitalize { text-transform: capitalize; }
  .tracking-wide { letter-spacing: 0.025em; }
  .text-gray-500 { color: #6b7280; }
  .text-gray-600 { color: #4b5563; }
  .text-gray-700 { color: #374151; }
  .text-gray-400 { color: #9ca3af; }
  .text-primary { color: #00897B; }
  .break-inside-avoid { break-inside: avoid; }
  h1 { font-size: 20px; margin: 0; }
  h3 { margin: 0 0 4px 0; font-size: 14px; }
  p { margin: 0 0 2px 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #00BFA5; padding: 24px 28px 14px; }
  section { padding: 14px 28px; border-bottom: 1px solid #e5e7eb; }
  section.grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 24px; }
  footer { display: grid; grid-template-columns: repeat(3,1fr); gap: 24px; padding: 14px 28px 24px; border-top: 1px solid #e5e7eb; }
  img { display: inline-block; }
</style>`;
