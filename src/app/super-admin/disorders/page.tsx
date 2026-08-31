'use client';

import { useState } from 'react';
import { Search, HeartPulse, Plus, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useDisorderList,
  useCreateDisorder,
  useDeleteDisorder,
  useRestoreDisorder,
} from '@/hooks/use-disorders';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getApiErrorMessage } from '@/lib/utils';

/**
 * The disorder list every hospital picks from.
 *
 * Seeded from the ICD-10 disease chapters and owned here. Kept separate from
 * the ICD catalogue on purpose: that is the WHO classification, 12,325 rows
 * including injuries, external causes and "factors influencing health status",
 * none of which is a condition somebody lives with.
 */
export default function SuperAdminDisordersPage() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [page, setPage] = useState(1);
  const [showRemoved, setShowRemoved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', icdCode: '', category: '' });
  const limit = 25;

  const { data, isLoading } = useDisorderList({
    page,
    limit,
    q: search || undefined,
    includeInactive: showRemoved,
  });
  const create = useCreateDisorder();
  const remove = useDeleteDisorder();
  const restore = useRestoreDisorder();

  const rows = data?.data ?? [];
  const meta = data?.meta as { total?: number; totalPages?: number } | undefined;

  const submit = () => {
    if (!draft.name.trim()) return;
    create.mutate(
      {
        name: draft.name.trim(),
        icdCode: draft.icdCode.trim() || undefined,
        category: draft.category.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`"${draft.name.trim()}" added`);
          setDraft({ name: '', icdCode: '', category: '' });
          setAdding(false);
        },
        onError: (err) => toast.error(getApiErrorMessage(err) || 'Could not add that disorder'),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            Disorders
          </h1>
          <p className="font-label text-sm text-on-surface-variant">
            The list of existing conditions patients and clinicians pick from. Seeded from the
            ICD-10 disease chapters — add anything missing, remove what you never use.
          </p>
        </div>
        <Button onClick={() => setAdding((v) => !v)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add disorder
        </Button>
      </div>

      {adding && (
        <div className="grid gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm ring-1 ring-foreground/5 md:grid-cols-[1fr_150px_1fr_auto]">
          <Input
            autoFocus
            placeholder="Name — e.g. Long COVID"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <Input
            placeholder="ICD code (optional)"
            value={draft.icdCode}
            onChange={(e) => setDraft((d) => ({ ...d, icdCode: e.target.value }))}
          />
          <Input
            placeholder="Category (optional)"
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          />
          <Button onClick={submit} disabled={!draft.name.trim() || create.isPending}>
            {create.isPending ? 'Adding…' : 'Add'}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or code…"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <input
            type="checkbox"
            checked={showRemoved}
            onChange={(e) => {
              setShowRemoved(e.target.checked);
              setPage(1);
            }}
            className="h-3.5 w-3.5 accent-primary"
          />
          Show removed
        </label>
        {meta?.total != null && (
          <span className="ml-auto text-xs text-on-surface-variant">{meta.total} disorders</span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm ring-1 ring-foreground/5">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-low text-left text-xs uppercase tracking-wider text-on-surface-variant">
            <tr>
              <th className="w-28 px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="w-24 px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {search ? `No disorder matching “${search}”.` : 'No disorders yet.'}
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr
                key={d.id}
                className={`border-t border-outline-variant/20 ${
                  d.isActive === false ? 'opacity-50' : ''
                }`}
              >
                <td className="px-4 py-2.5 font-mono text-xs text-primary">{d.icdCode ?? '—'}</td>
                <td className="px-4 py-2.5">
                  {d.name}
                  {d.isCustom && (
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      added here
                    </span>
                  )}
                  {d.isActive === false && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      removed
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-on-surface-variant">{d.category ?? '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  {d.isActive === false ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Put back on the list"
                      onClick={() =>
                        restore.mutate(d.id, {
                          onSuccess: () => toast.success(`"${d.name}" restored`),
                          onError: (err) =>
                            toast.error(getApiErrorMessage(err) || 'Could not restore'),
                        })
                      }
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Remove from the list"
                      className="text-muted-foreground hover:text-error"
                      onClick={() =>
                        remove.mutate(d.id, {
                          // A seeded disorder is switched off and can be put
                          // back; one added here is gone for good. Said plainly,
                          // because the two really are different.
                          onSuccess: (r) =>
                            toast.success(
                              r?.removed
                                ? `"${d.name}" deleted`
                                : `"${d.name}" removed — tick “Show removed” to restore it`,
                            ),
                          onError: (err) =>
                            toast.error(getApiErrorMessage(err) || 'Could not remove'),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(meta?.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-on-surface-variant">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ‹
          </Button>
          <span>
            Page {page} of {meta?.totalPages ?? 1}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={page >= (meta?.totalPages ?? 1)}
            onClick={() => setPage(page + 1)}
          >
            ›
          </Button>
        </div>
      )}
    </div>
  );
}
