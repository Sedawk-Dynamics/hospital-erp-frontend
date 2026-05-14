'use client';

import { use, useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
import { formatDateTime } from '@/lib/date-utils';

interface PublicReportSummary {
  reportId: string;
  orderId: string;
  hospitalName: string;
  patientInitials: string;
  status: string;
  version: number;
  issuedAt?: string;
  isPublished: boolean;
  isCorrectedCopy: boolean;
}

export default function PublicLabReportVerifyPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const [data, setData] = useState<PublicReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    fetch(`${apiBase}/lab/public/verify/${orderId}`)
      .then(async (res) => {
        if (res.status === 404) {
          setError('No report found for this QR code. The link may be invalid or the report has been recalled.');
          return;
        }
        if (!res.ok) {
          setError('Unable to verify this report right now. Please try again later.');
          return;
        }
        const body = await res.json();
        setData(body.data as PublicReportSummary);
      })
      .catch(() => setError('Network error while verifying the report.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-white rounded-2xl shadow-md max-w-md w-full p-8 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <>
            <ShieldAlert className="size-12 text-red-500 mx-auto" />
            <h1 className="text-lg font-bold">Report Not Verified</h1>
            <p className="text-sm text-gray-600">{error}</p>
          </>
        ) : data ? (
          <>
            {data.isPublished ? (
              <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
            ) : data.isCorrectedCopy ? (
              <AlertTriangle className="size-12 text-amber-500 mx-auto" />
            ) : (
              <ShieldAlert className="size-12 text-amber-500 mx-auto" />
            )}

            <div>
              <h1 className="text-lg font-bold">
                {data.isPublished
                  ? 'Report Verified'
                  : data.isCorrectedCopy
                    ? 'Corrected Report'
                    : 'Report Found'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {data.isPublished
                  ? 'This report is authentic and authorised for clinical use.'
                  : data.isCorrectedCopy
                    ? 'A corrected version of this report has been issued. Please rely on the latest copy.'
                    : 'This report is on file but has not yet been published.'}
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-left text-xs">
              <Row label="Issued by" value={data.hospitalName} />
              <Row label="Patient" value={data.patientInitials} />
              <Row label="Order #" value={data.orderId.slice(0, 8).toUpperCase()} mono />
              <Row label="Version" value={`v${data.version}`} />
              <Row
                label="Status"
                value={data.status}
                className={
                  data.isPublished
                    ? 'capitalize text-emerald-700 font-semibold'
                    : 'capitalize text-amber-700 font-semibold'
                }
              />
              {data.issuedAt && (
                <Row label="Issued at" value={formatDateTime(data.issuedAt)} />
              )}
            </div>

            <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
              For privacy, this page only confirms authenticity and never displays
              clinical results. Patients can sign in to the portal to view the full report.
            </p>
          </>
        ) : null}
      </div>

      <p className="text-[10px] text-gray-400 mt-4">
        Lab report verification · {new Date().getFullYear()}
      </p>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <>
      <div className="text-gray-500">{label}</div>
      <div className={`${mono ? 'font-mono' : ''} ${className ?? ''} text-gray-900`}>
        {value}
      </div>
    </>
  );
}
