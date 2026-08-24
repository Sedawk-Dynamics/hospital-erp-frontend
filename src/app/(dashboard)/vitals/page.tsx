'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import { formatTemperature } from '@/lib/vitals-temperature';
import { useTemperatureUnit } from '@/stores/temperature-unit-store';

interface VitalRecord {
  id: string;
  patientId: string;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  visitId?: string;
  /** Always Celsius — the display unit is the reader's preference. */
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  painLevel?: number;
  bloodGlucose?: number;
  notes?: string;
  recordedById: string;
  recordedBy?: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export default function VitalsPage() {
  const [tempUnit] = useTemperatureUnit();
  const router = useRouter();
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchVitals = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/clinical/vitals', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
        },
      });
      setVitals(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch vitals');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchVitals();
  }, [fetchVitals]);

  const getBPStatus = (systolic?: number, diastolic?: number) => {
    if (!systolic || !diastolic) return null;
    if (systolic >= 180 || diastolic >= 120) return 'danger';
    if (systolic >= 140 || diastolic >= 90) return 'warning';
    if (systolic >= 120 || diastolic >= 80) return 'info';
    return 'success';
  };

  const columns: Column<VitalRecord>[] = [
    {
      key: 'patient',
      label: 'Patient',
      sortable: true,
      render: (vital) => (
        <button
          onClick={() => router.push(`/patients/${vital.patientId}`)}
          className="text-primary hover:underline font-medium"
        >
          {vital.patient?.firstName} {vital.patient?.lastName}
        </button>
      ),
    },
    {
      key: 'createdAt',
      label: 'Recorded At',
      sortable: true,
      render: (vital) => {
        try {
          return formatDateTime(vital.createdAt);
        } catch {
          return vital.createdAt;
        }
      },
    },
    {
      key: 'temperature',
      label: 'Temp',
      // There is no `temperatureUnit` column on the record — the stored value
      // is always Celsius — so the old branch never matched and every reading
      // was labelled °F. Converted to whichever unit the reader prefers.
      render: (vital) => formatTemperature(vital.temperature, tempUnit, '-'),
    },
    {
      key: 'bloodPressure',
      label: 'BP (mmHg)',
      render: (vital) => {
        if (!vital.bloodPressureSystolic) return '-';
        const status = getBPStatus(vital.bloodPressureSystolic, vital.bloodPressureDiastolic);
        return (
          <span className={status === 'danger' ? 'text-red-600 font-semibold' : status === 'warning' ? 'text-amber-600 font-medium' : ''}>
            {vital.bloodPressureSystolic}/{vital.bloodPressureDiastolic}
          </span>
        );
      },
    },
    {
      key: 'heartRate',
      label: 'HR (bpm)',
      render: (vital) => vital.heartRate ? (
        <span className={vital.heartRate > 100 || vital.heartRate < 60 ? 'text-amber-600 font-medium' : ''}>
          {vital.heartRate}
        </span>
      ) : '-',
    },
    {
      key: 'oxygenSaturation',
      label: 'SpO2 (%)',
      render: (vital) => vital.oxygenSaturation ? (
        <span className={vital.oxygenSaturation < 95 ? 'text-red-600 font-semibold' : vital.oxygenSaturation < 98 ? 'text-amber-600' : ''}>
          {vital.oxygenSaturation}%
        </span>
      ) : '-',
    },
    {
      key: 'respiratoryRate',
      label: 'RR',
      render: (vital) => vital.respiratoryRate || '-',
    },
    {
      key: 'painLevel',
      label: 'Pain',
      render: (vital) => {
        if (vital.painLevel === undefined || vital.painLevel === null) return '-';
        const variant = vital.painLevel >= 7 ? 'danger' : vital.painLevel >= 4 ? 'warning' : 'success';
        return <StatusBadge status={`${vital.painLevel}/10`} variant={variant} />;
      },
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (vital) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/patients/${vital.patientId}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vitals"
        description="Record and monitor patient vital signs"
        action={
          <Button onClick={() => router.push('/vitals/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Record Vitals
          </Button>
        }
      />

      <DataTable
        columns={columns as any}
        data={vitals as any}
        searchPlaceholder="Search by patient name or MRN..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No vital records found."
      />
    </div>
  );
}
