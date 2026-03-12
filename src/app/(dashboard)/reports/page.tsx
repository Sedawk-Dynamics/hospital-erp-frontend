'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter, Play, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';

interface SavedReport {
  id: string;
  name: string;
  description?: string;
  category: 'financial' | 'clinical' | 'operational' | 'hr' | 'inventory';
  reportType: 'table' | 'chart' | 'summary';
  query?: any;
  filters?: any;
  lastGeneratedAt?: string;
  createdById: string;
  createdBy?: { firstName: string; lastName: string };
  isScheduled: boolean;
  scheduleFrequency?: string;
  createdAt: string;
  updatedAt: string;
}

const categoryVariantMap: Record<string, string> = {
  financial: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  clinical: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  operational: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  hr: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  inventory: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

const typeVariantMap: Record<string, string> = {
  table: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  chart: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  summary: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/reports/saved', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
        },
      });
      setReports(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch reports');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, categoryFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async (reportId: string) => {
    setGeneratingId(reportId);
    try {
      await apiClient.post(`/reports/saved/${reportId}/generate`);
      toast.success('Report generated successfully');
      fetchReports();
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGeneratingId(null);
    }
  };

  const formatCategory = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const formatType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const columns: Column<SavedReport>[] = [
    {
      key: 'name',
      label: 'Report Name',
      sortable: true,
      render: (report) => (
        <button
          onClick={() => router.push(`/reports/${report.id}`)}
          className="font-medium text-primary hover:underline"
        >
          {report.name}
        </button>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (report) => (
        <Badge className={`font-medium border-0 ${categoryVariantMap[report.category] || ''}`}>
          {formatCategory(report.category)}
        </Badge>
      ),
    },
    {
      key: 'reportType',
      label: 'Type',
      render: (report) => (
        <Badge className={`font-medium border-0 ${typeVariantMap[report.reportType] || ''}`}>
          {formatType(report.reportType)}
        </Badge>
      ),
    },
    {
      key: 'lastGeneratedAt',
      label: 'Last Generated',
      sortable: true,
      render: (report) => {
        if (!report.lastGeneratedAt) return <span className="text-muted-foreground">Never</span>;
        try {
          return format(new Date(report.lastGeneratedAt), 'MMM dd, yyyy HH:mm');
        } catch {
          return <span className="text-muted-foreground">Never</span>;
        }
      },
    },
    {
      key: 'scheduleFrequency',
      label: 'Schedule',
      render: (report) => {
        if (!report.isScheduled) return <span className="text-muted-foreground">Manual</span>;
        const freq = report.scheduleFrequency || 'scheduled';
        return (
          <Badge variant="outline" className="font-medium capitalize">
            {freq}
          </Badge>
        );
      },
    },
    {
      key: 'createdBy',
      label: 'Created By',
      render: (report) =>
        report.createdBy
          ? `${report.createdBy.firstName} ${report.createdBy.lastName}`
          : '-',
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[160px]',
      render: (report) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={generatingId === report.id}
            onClick={() => handleGenerate(report.id)}
          >
            {generatingId === report.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Generate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/reports/${report.id}`)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="View analytics and generate reports"
        action={
          <Button onClick={() => router.push('/reports/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Report
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
              <SelectItem value="clinical">Clinical</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={reports as any}
        searchPlaceholder="Search reports by name..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No reports found."
      />
    </div>
  );
}
