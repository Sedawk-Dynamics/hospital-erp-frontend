'use client';

// A tiny inline nickname box, shown alongside a medicine's real name. Type your
// personal shorthand and it saves on blur / Enter; clear it to remove. One box
// manages this drug's nickname for the current user — no dialog, no separate
// page. The real name always stays the primary label; this is just a shortcut.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useNicknames, useCreateNickname, useUpdateNickname, useDeleteNickname } from '@/hooks/use-pharmacy';

export function NicknameBox({ drugId, className }: { drugId: string; className?: string }) {
  const { data: all = [] } = useNicknames();
  const existing = all.find((n) => n.drugFormularyId === drugId);
  const create = useCreateNickname();
  const update = useUpdateNickname();
  const del = useDeleteNickname();

  const [value, setValue] = useState(existing?.nickname ?? '');
  const [editing, setEditing] = useState(false);
  const busy = create.isPending || update.isPending || del.isPending;

  // Keep the box in sync with the stored nickname while not actively typing.
  useEffect(() => {
    if (!editing) setValue(existing?.nickname ?? '');
  }, [existing?.nickname, editing]);

  async function save() {
    setEditing(false);
    const v = value.trim();
    const prev = existing?.nickname ?? '';
    if (v === prev) return; // unchanged
    try {
      if (!v && existing) {
        await del.mutateAsync(existing.id);
      } else if (existing) {
        await update.mutateAsync({ id: existing.id, nickname: v });
        toast.success(`Nickname: ${v}`);
      } else if (v) {
        await create.mutateAsync({ drugFormularyId: drugId, nickname: v });
        toast.success(`Nickname: ${v}`);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save nickname';
      toast.error(msg);
      setValue(prev); // revert
    }
  }

  return (
    <span className={cn('inline-flex items-center gap-1', className)} title="Your personal nickname for this medicine">
      <Tag className={cn('h-3 w-3 shrink-0', existing ? 'text-primary' : 'text-muted-foreground/60')} />
      <Input
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          if (e.key === 'Escape') { setValue(existing?.nickname ?? ''); (e.currentTarget as HTMLInputElement).blur(); }
        }}
        placeholder="nickname"
        maxLength={60}
        className="h-6 w-24 rounded-md px-1.5 text-[11px]"
      />
    </span>
  );
}
