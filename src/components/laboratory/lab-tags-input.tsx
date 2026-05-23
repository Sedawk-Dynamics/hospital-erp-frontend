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
