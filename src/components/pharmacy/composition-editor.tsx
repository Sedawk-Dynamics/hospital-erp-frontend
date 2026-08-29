'use client';

/**
 * A composition, entered as data.
 *
 * It used to be one text box: "Paracetamol (500mg) + Caffeine (65mg)". That
 * reads well and stores badly — the server had to parse it back apart, and
 * every parse is a place a molecule or a strength can be lost. Two real faults
 * came from exactly that. So the molecule, the quantity and the unit are three
 * fields, which is how they are stored.
 *
 * Pasting still works, deliberately. Somebody with a hundred drugs to enter
 * has the text in front of them, and refusing it would make the structured
 * form slower than the box it replaced. A pasted string is split into rows on
 * the spot, where it can be seen and corrected, rather than on a server where
 * it cannot.
 */

import { useState } from 'react';
import { Plus, X, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** The units a strength may be expressed in — mirrors the server's enum. */
export const STRENGTH_UNITS = ['mg', 'mcg', 'g', 'ml', 'iu', '%'] as const;

export interface SaltRowInput {
  name: string;
  strengthValue: string;
  strengthUnit: string;
}

export const emptySaltRow = (): SaltRowInput => ({ name: '', strengthValue: '', strengthUnit: 'mg' });

/**
 * Split "Paracetamol (500mg) + Caffeine (65mg)" into rows.
 *
 * Kept deliberately forgiving: a molecule with no readable strength still
 * becomes a row rather than being dropped, because a row a person can see and
 * fix beats an ingredient that quietly vanished.
 */
export function parseCompositionText(text: string): SaltRowInput[] {
  return text
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*?)\s*\(?\s*([\d.]+)\s*(mg|mcg|g|ml|iu|%)\b/i);
      if (!m) return { name: part.replace(/\s*\(.*$/, '').trim(), strengthValue: '', strengthUnit: 'mg' };
      return {
        name: m[1].trim(),
        strengthValue: m[2],
        strengthUnit: m[3].toLowerCase(),
      };
    })
    .filter((r) => r.name);
}

/** Render rows back to the text form, for a preview and for legacy callers. */
export function compositionPreview(rows: SaltRowInput[]): string {
  return rows
    .filter((r) => r.name.trim())
    .map((r) =>
      r.strengthValue.trim()
        ? `${r.name.trim()} (${r.strengthValue.trim()}${r.strengthUnit})`
        : r.name.trim(),
    )
    .join(' + ');
}

export function CompositionEditor({
  rows,
  onChange,
  label = 'Composition',
  className,
}: {
  rows: SaltRowInput[];
  onChange: (rows: SaltRowInput[]) => void;
  label?: string;
  className?: string;
}) {
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const set = (i: number, patch: Partial<SaltRowInput>) =>
    onChange(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  const list = rows.length ? rows : [emptySaltRow()];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setPasting((v) => !v)}
        >
          <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
          Paste a composition
        </Button>
      </div>

      {pasting && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <Input
            autoFocus
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="e.g. Paracetamol (500mg) + Caffeine (65mg)"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const parsed = parseCompositionText(pasteText);
              if (parsed.length) onChange(parsed);
              setPasteText('');
              setPasting(false);
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            Split into rows below, where you can check it. Press Enter.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        {list.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              aria-label={`Molecule ${i + 1}`}
              value={r.name}
              onChange={(e) => set(i, { name: e.target.value })}
              placeholder="Molecule, e.g. Paracetamol"
              className="flex-1"
            />
            <Input
              aria-label={`Strength ${i + 1}`}
              value={r.strengthValue}
              onChange={(e) => set(i, { strengthValue: e.target.value.replace(/[^\d.]/g, '') })}
              placeholder="500"
              inputMode="decimal"
              className="w-20 text-right tabular-nums"
            />
            <Select
              value={r.strengthUnit}
              onValueChange={(v: string | null) => set(i, { strengthUnit: v ?? 'mg' })}
            >
              <SelectTrigger aria-label={`Unit ${i + 1}`} className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRENGTH_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove molecule ${i + 1}`}
              className="h-8 w-8 shrink-0"
              disabled={list.length === 1}
              onClick={() => onChange(list.filter((_, n) => n !== i))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange([...list, emptySaltRow()])}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add molecule
        </Button>
        {compositionPreview(list) && (
          // The stored text, shown as it will be written — so nobody has to
          // trust that the rows and the string agree.
          <span className="truncate text-[11px] text-muted-foreground" title={compositionPreview(list)}>
            {compositionPreview(list)}
          </span>
        )}
      </div>
    </div>
  );
}
