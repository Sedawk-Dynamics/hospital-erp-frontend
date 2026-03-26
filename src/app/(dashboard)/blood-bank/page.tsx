'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';

interface BloodInventory {
  id: string;
  unitNumber: string;
  bloodGroup: string;
  componentType: string;
  donationId?: string;
  collectionDate: string;
  expiryDate: string;
  volume?: number;
  status: 'available' | 'reserved' | 'used' | 'discarded' | 'expired';
  location?: string;
  createdAt: string;
  updatedAt: string;
}

const bloodStatusVariant: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'muted'> = {
  available: 'success',
  reserved: 'warning',
  used: 'muted',
  discarded: 'danger',
  expired: 'muted',
};

const bloodGroupColors: Record<string, string> = {
  'A+': 'bg-red-100 text-red-800',
  'A-': 'bg-red-100 text-red-700',
  'B+': 'bg-blue-100 text-blue-800',
  'B-': 'bg-blue-100 text-blue-700',
  'AB+': 'bg-purple-100 text-purple-800',
  'AB-': 'bg-purple-100 text-purple-700',
  'O+': 'bg-emerald-100 text-emerald-800',
  'O-': 'bg-emerald-100 text-emerald-700',
};

const componentTypeLabels: Record<string, string> = {
  whole_blood: 'Whole Blood',
  packed_rbc: 'Packed RBC',
  platelets: 'Platelets',
  plasma: 'Plasma',
  cryoprecipitate: 'Cryoprecipitate',
};

export default function BloodBankPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<BloodInventory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/blood-bank/inventory', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          bloodGroup: bloodGroupFilter !== 'all' ? bloodGroupFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      setInventory(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch blood inventory');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, bloodGroupFilter, statusFilter]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const getExpiryDisplay = (expiryDate: string) => {
    try {
      const expiry = new Date(expiryDate);
      const today = new Date();
      const daysUntilExpiry = differenceInDays(expiry, today);
      const formatted = formatDate(expiry);

      if (daysUntilExpiry < 0) {
        return <span className="text-red-600 font-medium">{formatted} (Expired)</span>;
      }
      if (daysUntilExpiry <= 3) {
        return <span className="text-red-600 font-medium">{formatted} ({daysUntilExpiry}d left)</span>;
      }
      if (daysUntilExpiry <= 7) {
        return <span className="text-amber-600 font-medium">{formatted} ({daysUntilExpiry}d left)</span>;
      }
      return <span>{formatted}</span>;
    } catch {
      return expiryDate;
    }
  };

  const columns: Column<BloodInventory>[] = [
    {
      key: 'bloodGroup',
      label: 'Blood Group',
      sortable: true,
      render: (item) => (
        <Badge className={`font-bold border-0 ${bloodGroupColors[item.bloodGroup] || 'bg-secondary text-secondary-foreground'}`}>
          {item.bloodGroup}
        </Badge>
      ),
    },
    {
      key: 'componentType',
      label: 'Component Type',
      render: (item) => componentTypeLabels[item.componentType] || item.componentType,
    },
    {
      key: 'unitNumber',
      label: 'Unit Number',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm">{item.unitNumber}</span>
      ),
    },
    {
      key: 'collectionDate',
      label: 'Collection Date',
      sortable: true,
      render: (item) => {
        try {
          return formatDate(item.collectionDate);
        } catch {
          return item.collectionDate;
        }
      },
    },
    {
      key: 'expiryDate',
      label: 'Expiry Date',
      sortable: true,
      render: (item) => getExpiryDisplay(item.expiryDate),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => (
        <StatusBadge
          status={item.status}
          variant={bloodStatusVariant[item.status] || 'default'}
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/blood-bank/${item.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blood Bank"
        description="Manage blood bank inventory and donations"
        action={
          <Button onClick={() => router.push('/blood-bank/donations/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Donation
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={bloodGroupFilter} onValueChange={(val) => { setBloodGroupFilter(val ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Blood Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              <SelectItem value="A+">A+</SelectItem>
              <SelectItem value="A-">A-</SelectItem>
              <SelectItem value="B+">B+</SelectItem>
              <SelectItem value="B-">B-</SelectItem>
              <SelectItem value="AB+">AB+</SelectItem>
              <SelectItem value="AB-">AB-</SelectItem>
              <SelectItem value="O+">O+</SelectItem>
              <SelectItem value="O-">O-</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val ?? 'all'); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
            <SelectItem value="used">Used</SelectItem>
            <SelectItem value="discarded">Discarded</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns as any}
        data={inventory as any}
        searchPlaceholder="Search blood inventory..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No blood inventory records found."
      />
    </div>
  );
}
