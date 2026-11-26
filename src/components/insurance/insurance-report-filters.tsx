'use client';

// Gap 290: one filter bar for the Insurance Dashboard and Insurance Reports.
// Both send the same { fromDate, toDate, insurerId, tpaId } to the backend,
// which runs them through the same claim filter and metric helpers — so for
// the same filters the two screens show the same figures.

import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInsurers, useTpas, type ReportFilters } from '@/hooks/use-insurance';

export function InsuranceReportFilters({
  filters,
  onChange,
  description,
}: {
  filters: ReportFilters;
  onChange: (next: ReportFilters) => void;
  description?: string;
}) {
  const { data: insurers } = useInsurers({ isActive: true, limit: 100 });
  const { data: tpas } = useTpas({ isActive: true, limit: 100 });
  const active = Boolean(filters.fromDate || filters.toDate || filters.insurerId || filters.tpaId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-4 text-primary" /> Filters
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {active && (
          <Button variant="ghost" size="sm" onClick={() => onChange({})}>
            <X className="size-4" /> Clear
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <Label>From (submitted)</Label>
          <Input
            type="date"
            value={filters.fromDate ?? ''}
            onChange={(e) => onChange({ ...filters, fromDate: e.target.value || undefined })}
          />
        </div>
        <div>
          <Label>To (submitted)</Label>
          <Input
            type="date"
            value={filters.toDate ?? ''}
            onChange={(e) => onChange({ ...filters, toDate: e.target.value || undefined })}
          />
        </div>
        <div>
          <Label>Insurer</Label>
          <Select
            value={filters.insurerId ?? null}
            onValueChange={(v) => onChange({ ...filters, insurerId: (v as string) || undefined })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All insurers" />
            </SelectTrigger>
            <SelectContent>
              {insurers?.data?.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>TPA</Label>
          <Select
            value={filters.tpaId ?? null}
            onValueChange={(v) => onChange({ ...filters, tpaId: (v as string) || undefined })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All TPAs" />
            </SelectTrigger>
            <SelectContent>
              {tpas?.data?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

/** "₹600.00 approved ÷ ₹2,000.00 claimed" — the amount rate's numerator and denominator. */
export function amountRateBasis(
  approved: number | null | undefined,
  claimed: number | null | undefined,
  fmt: (n: number | null | undefined) => string,
): string | undefined {
  if (approved == null || claimed == null) return undefined;
  return `${fmt(approved)} approved ÷ ${fmt(claimed)} claimed (decided claims)`;
}
