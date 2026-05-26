'use client';

// Chip-style multi-value text input used for lab test aliases + tags.
//
// Two surfaces use it:
//   • super-admin Lab Templates builder — author the canonical alias /
//     tag lists that ship with the master template
//   • hospital admin Lab Test Catalog edit dialog — extend the canonical
//     lists with hospital-specific synonyms (their cloned row owns its
//     own arrays so this doesn't touch the master template)
//
// Both surfaces now expose a SINGLE "synonyms" field; aliases (case-preserved
// max 25) and tags (lowercased max 40) are still two columns in the DB so
// search semantics stay identical. mergeSynonyms / splitSynonyms / SYNONYMS_MAX
// below handle the load/save conversion.
//
// Inputs are accepted on Enter, Tab, comma or paste. Duplicates collapse
// case-insensitively. The component is fully controlled — parent owns
// the array. Caller passes `valueMode = 'tag'` for lower-cased keywords
// or `'alias'` for case-preserving alternative names.

import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface LabTagsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  // 'alias' preserves the user's casing (e.g. "FBC", "Hemogram").
  // 'tag' lowercases on commit (e.g. "hemoglobin", "wbc").
  valueMode?: 'alias' | 'tag';
  placeholder?: string;
  className?: string;
  // Cap mirrors the backend validator (aliases: 25, tags: 40). UI hides
  // the input when reached and surfaces the cap so the admin understands.
  max?: number;
}

function uniqueAdd(list: string[], v: string): string[] {
  const lower = v.toLowerCase();
  if (list.some((x) => x.toLowerCase() === lower)) return list;
  return [...list, v];
}

// Backend caps: aliases max 25, tags max 40 — combined cap = 65.
export const SYNONYMS_MAX = 65;
const ALIAS_BUCKET = 25;

// Merge stored `aliases` + `tags` into a single deduped list (case-insensitive).
// Aliases come first to preserve casing in the UI for canonical synonyms.
export function mergeSynonyms(
  aliases?: string[] | null,
  tags?: string[] | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [...(aliases ?? []), ...(tags ?? [])]) {
    const trimmed = String(v ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

// Split a unified synonyms list back into the two backend columns. The first
// 25 entries land in `aliases` (case-preserved), the rest in `tags` (the
// backend lowercases them on persist).
export function splitSynonyms(synonyms: string[]): { aliases: string[]; tags: string[] } {
  return {
    aliases: synonyms.slice(0, ALIAS_BUCKET),
    tags: synonyms.slice(ALIAS_BUCKET),
  };
}

export function LabTagsInput({
  value,
  onChange,
  valueMode = 'alias',
  placeholder = 'Add and press Enter',
  className,
  max,
}: LabTagsInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const normalised = valueMode === 'tag' ? trimmed.toLowerCase() : trimmed;
    if (max != null && value.length >= max) return;
    onChange(uniqueAdd(value, normalised));
    setDraft('');
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
    inputRef.current?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      if (draft.trim()) {
        e.preventDefault();
        commit(draft);
      }
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      remove(value.length - 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData('text');
    if (!txt.includes(',') && !txt.includes('\n')) return; // single token, normal paste
    e.preventDefault();
    const parts = txt.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
    let next = [...value];
    for (const p of parts) {
      if (max != null && next.length >= max) break;
      const normalised = valueMode === 'tag' ? p.toLowerCase() : p;
      next = uniqueAdd(next, normalised);
    }
    onChange(next);
    setDraft('');
  };

  const atCap = max != null && value.length >= max;

  return (
    <div
      className={cn(
        'min-h-9 rounded-lg border border-input bg-transparent px-2 py-1.5 flex flex-wrap items-center gap-1',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((v, idx) => (
        <span
          key={`${v}-${idx}`}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium px-2 py-0.5"
        >
          {v}
          <button
            type="button"
            className="hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              remove(idx);
            }}
            aria-label={`Remove ${v}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {!atCap && (
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onPaste={handlePaste}
          onBlur={() => draft.trim() && commit(draft)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="!border-0 !shadow-none !p-0 !bg-transparent flex-1 min-w-[120px] h-6 text-xs focus-visible:ring-0"
        />
      )}
      {atCap && (
        <span className="text-[10px] text-muted-foreground italic">
          Max {max} reached. Remove one to add another.
        </span>
      )}
    </div>
  );
}
