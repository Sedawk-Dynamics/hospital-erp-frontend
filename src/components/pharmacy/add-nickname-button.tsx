'use client';

// Reusable "set a nickname" control. Drop it anywhere you have a formulary drug
// (formulary list, stock-entry result, …). Opens a small dialog to add a personal
// nickname for that medicine, and shows the ones you already have for it. The
// real medicine name is always displayed — the nickname is only a shortcut.

import { useState } from 'react';
import { toast } from 'sonner';
import { Tag, Plus, X, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useNicknames, useCreateNickname, useDeleteNickname } from '@/hooks/use-pharmacy';

export function AddNicknameButton({
  drugId,
  drugName,
  variant = 'icon',
  className,
}: {
  drugId: string;
  drugName: string;
  variant?: 'icon' | 'labelled';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState('');

  const { data: all = [] } = useNicknames();
  const createNickname = useCreateNickname();
  const deleteNickname = useDeleteNickname();
  const mine = all.filter((n) => n.drugFormularyId === drugId);

  const dup = nickname.trim() !== '' &&
    all.some((n) => n.nickname.trim().toLowerCase() === nickname.trim().toLowerCase());

  async function add() {
    if (!nickname.trim()) return;
    try {
      await createNickname.mutateAsync({ drugFormularyId: drugId, nickname: nickname.trim() });
      toast.success(`"${nickname.trim()}" → ${drugName}`);
      setNickname('');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add nickname';
      toast.error(msg);
    }
  }

  return (
    <>
      {variant === 'icon' ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn('h-8 w-8 p-0 text-muted-foreground hover:text-primary', className)}
          title="Add a nickname for this medicine"
        >
          <Tag className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn('h-7 gap-1 text-xs', className)}
        >
          <Tag className="h-3.5 w-3.5" /> Nickname{mine.length ? ` (${mine.length})` : ''}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base">
              <Tag className="h-4 w-4 text-primary" /> Nickname
            </DialogTitle>
            <DialogDescription>
              A personal shortcut for <span className="font-semibold text-foreground">{drugName}</span>.
              Typing it in a drug search brings this medicine up first. Only you see it.
            </DialogDescription>
          </DialogHeader>

          {/* Existing nicknames for this drug */}
          {mine.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mine.map((n) => (
                <span
                  key={n.id}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  <Tag className="h-3 w-3" /> {n.nickname}
                  <button
                    onClick={() => deleteNickname.mutate(n.id)}
                    className="ml-0.5 rounded-full hover:bg-primary/20"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                autoFocus
                placeholder='e.g. "para", "bp med"'
                value={nickname}
                maxLength={60}
                className={cn(dup && 'border-destructive')}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !dup && add()}
              />
              {dup && <p className="mt-0.5 text-[10px] text-destructive">You already use this nickname.</p>}
            </div>
            <Button onClick={add} disabled={!nickname.trim() || dup || createNickname.isPending} className="gap-1">
              {createNickname.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
