'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FullConsultationSummary, type FullConsultation } from './_full-summary';

export default function ConsultationSummaryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['patient', 'consultation-summaries', id],
    queryFn: async () => {
      const res = await apiGet<FullConsultation>(`/patient-portal/consultation-summaries/${id}`);
      return res.data;
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/patient-portal/consultation-summaries"
          className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to consultation summaries
        </Link>
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
          Consultation Summary
        </h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : isError || !data ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
          <p className="font-label text-sm text-on-surface-variant">
            We couldn&apos;t load this consultation summary.
          </p>
          <Link href="/patient-portal/consultation-summaries" className="mt-4 inline-block">
            <Button size="sm" variant="outline">
              Back
            </Button>
          </Link>
        </div>
      ) : (
        <FullConsultationSummary note={data} />
      )}
    </div>
  );
}
