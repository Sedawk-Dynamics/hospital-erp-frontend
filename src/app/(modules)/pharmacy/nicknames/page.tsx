'use client';

// My Medicine Nicknames — a pharmacist's personal shorthand. Link a nickname
// ("para", "bp med") to a formulary drug; typing it in any drug search (POS,
// prescription pad) then surfaces the linked medicine first. Private to you.

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Tag, Search, Plus, Trash2, Loader2, Pill } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import {
  useNicknames,
  useCreateNickname,
  useDeleteNickname,
  useFormulary,
  type FormularyItem,
} from '@/hooks/use-pharmacy';

export default function MyNicknamesPage() {
  const { data: nicknames = [], isLoading } = useNicknames();
  const createNickname = useCreateNickname();
  const deleteNickname = useDeleteNickname();

  // Add form state
  const [drugSearch, setDrugSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<FormularyItem | null>(null);
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(drugSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [drugSearch]);

  const { data: formularyData, isFetching } = useFormulary({
    search: debounced || undefined,
    limit: 8,
    isActive: true,
  });
  // Only show the results dropdown while actively searching for a new drug.
  const results = !selected && debounced.length >= 2 ? formularyData?.data ?? [] : [];

  const takenNorm = useMemo(
    () => new Set(nicknames.map((n) => n.nickname.trim().toLowerCase())),
    [nicknames],
  );
  const dupNickname = nickname.trim() !== '' && takenNorm.has(nickname.trim().toLowerCase());

  async function handleAdd() {
    if (!selected) {
      toast.error('Pick a medicine first');
      return;
    }
    if (!nickname.trim()) {
      toast.error('Type a nickname');
      return;
    }
    try {
      await createNickname.mutateAsync({ drugFormularyId: selected.id, nickname: nickname.trim() });
      toast.success(`"${nickname.trim()}" → ${selected.drugName}`);
      setSelected(null);
      setNickname('');
      setDrugSearch('');
      setDebounced('');
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to add nickname';
      toast.error(msg);
    }
  }

  async function handleDelete(id: string, label: string) {
    try {
      await deleteNickname.mutateAsync(id);
      toast.success(`Removed "${label}"`);
    } catch {
      toast.error('Failed to remove nickname');
    }
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" /> My Medicine Nicknames
        </h1>
        <p className="text-xs text-muted-foreground">
          Your personal shorthand. Link a nickname to a medicine — typing it in any drug search
          brings that medicine up first. Only you see your nicknames.
        </p>
      </div>

      {/* Add a nickname */}
      <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Add a nickname
        </h3>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-start">
          {/* Medicine picker */}
          <div className="relative">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Medicine</label>
            {selected ? (
              <div className="flex h-9 items-center justify-between gap-2 rounded-md border bg-surface-container-low px-2.5">
                <span className="flex items-center gap-1.5 text-sm font-medium truncate">
                  <Pill className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {selected.drugName}
                </span>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setSelected(null); setDrugSearch(''); }}
                >
                  change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-8"
                  placeholder="Search your formulary…"
                  value={drugSearch}
                  onChange={(e) => setDrugSearch(e.target.value)}
                />
                {isFetching && (
                  <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-primary" />
                )}
                {results.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-surface-container-lowest shadow-lg">
                    {results.map((d) => (
                      <button
                        key={d.id}
                        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-surface-container-high"
                        onClick={() => { setSelected(d); setDrugSearch(''); }}
                      >
                        <span className="truncate">
                          <span className="font-medium">{d.drugName}</span>
                          {d.strength && <span className="text-muted-foreground"> · {d.strength}</span>}
                        </span>
                        {d.genericName && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">{d.genericName}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nickname */}
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nickname</label>
            <Input
              className={cn('h-9', dupNickname && 'border-destructive')}
              placeholder='e.g. "para", "bp med"'
              value={nickname}
              maxLength={60}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !dupNickname && handleAdd()}
            />
            {dupNickname && (
              <p className="mt-0.5 text-[10px] text-destructive">You already use this nickname.</p>
            )}
          </div>

          <div className="flex items-end">
            <Button
              className="h-9 gap-1.5"
              onClick={handleAdd}
              disabled={!selected || !nickname.trim() || dupNickname || createNickname.isPending}
            >
              {createNickname.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary">
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div>
        ) : nicknames.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No nicknames yet"
            description="Add your first shorthand above — it'll pull up the linked medicine whenever you type it."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nickname</TableHead>
                <TableHead>Linked medicine</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {nicknames.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>
                    <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                      <Tag className="h-3 w-3" /> {n.nickname}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{n.drug.drugName}</span>
                    {n.drug.strength && <span className="text-muted-foreground"> · {n.drug.strength}</span>}
                    {n.drug.genericName && (
                      <p className="text-[11px] text-muted-foreground">{n.drug.genericName}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDelete(n.id, n.nickname)}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
