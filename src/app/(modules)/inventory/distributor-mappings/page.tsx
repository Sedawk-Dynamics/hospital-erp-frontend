'use client';

import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';
import { useState } from 'react';
import { Search, Link2, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { formatDate } from '@/lib/date-utils';
import { useSuppliers } from '@/hooks/use-inventory';
import { useDistributorMappings, useDeleteDistributorMapping } from '@/hooks/use-pharmacy';

/**
 * Product Resolution Engine — admin view of the learned distributor → product
 * mappings. Each row is a distributor line text / GTIN that the system has
 * confirmed maps to a formulary drug, so repeat imports resolve automatically.
 * An admin can delete a mapping that was confirmed against the wrong drug.
 */
function DistributorMappingsInner() {
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const { data: suppliersData } = useSuppliers({ limit: 200 });
  const { data, isLoading } = useDistributorMappings({
    supplierId: supplierId || undefined,
    search: search.trim() || undefined,
  });
  const del = useDeleteDistributorMapping();

  const rows = data?.items ?? [];

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`Forget the learned mapping for "${name}"? The next import of this line will be re-matched.`)) return;
    try {
      await del.mutateAsync(id);
      toast.success('Mapping removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove mapping');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" /> Distributor Mappings
        </h1>
        <p className="text-xs text-muted-foreground">
          Learned distributor line / GTIN → drug links. Confirmed once at inward, then reused
          automatically so repeat imports never split your stock.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 w-64 pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search distributor name or GTIN"
          />
        </div>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">All distributors</option>
          {(suppliersData?.data ?? []).map((s: { id: string; name: string }) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No learned mappings yet"
          description="As you confirm distributor lines during stock inward, the system remembers each one here and resolves it automatically next time."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Distributor line</TableHead>
              <TableHead>GTIN</TableHead>
              <TableHead>Distributor</TableHead>
              <TableHead>Resolves to</TableHead>
              <TableHead className="text-right">Times used</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.externalName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{m.gtin ?? '—'}</TableCell>
                <TableCell className="text-sm">{m.supplier ?? <span className="text-muted-foreground">Any</span>}</TableCell>
                <TableCell>
                  <div className="text-sm">{m.drugName ?? '—'}</div>
                  {m.drugStrength && <div className="text-xs text-muted-foreground">{m.drugStrength}</div>}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline">{m.timesSeen}×</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(m.lastSeenAt)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(m.id, m.externalName)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function DistributorMappingsPage() {
  return (
    <PharmacyAdminGuard>
      <DistributorMappingsInner />
    </PharmacyAdminGuard>
  );
}
