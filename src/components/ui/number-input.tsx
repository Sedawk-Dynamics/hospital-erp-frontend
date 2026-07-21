'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

// A number field you can actually clear.
//
// The usual `value={n} onChange={e => setN(Number(e.target.value) || 1)}` has two
// faults that compound: clearing the box yields '', which coerces to 0/NaN and
// the `||` snaps it straight back to 1 — so backspace appears to do nothing and
// the only way to change a "1" is to type another digit first and then delete
// the 1. Clamping with Math.max/min on every keystroke does the same thing:
// typing "10" when the min is 5 gets rewritten to 5 the moment "1" is entered.
//
// This keeps the typed text as-is while the field has focus, so it can be empty
// or mid-edit, and only normalises (and clamps) on blur. An empty box reads as
// `emptyValue`, which defaults to 0 rather than 1 — nothing should silently
// assume a quantity of one.

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? '' : String(v);

export interface NumberInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  /** What an empty box means. Defaults to 0. */
  emptyValue?: number;
  min?: number;
  max?: number;
  /** Round to whole numbers on blur (quantities, counts). */
  integer?: boolean;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    { value, onValueChange, emptyValue = 0, min, max, integer, onBlur, ...rest },
    ref,
  ) {
    const parse = (raw: string): number => {
      if (raw.trim() === '' || raw === '-') return emptyValue;
      const n = Number(raw);
      return Number.isNaN(n) ? emptyValue : n;
    };

    const [text, setText] = useState(() => fmt(value));
    const parseRef = useRef(parse);
    parseRef.current = parse;

    // Follow the value when it changes from outside, but never rewrite text that
    // already means the same number. That is what lets an empty box stay empty:
    // '' reads as emptyValue, so when the value is emptyValue there is nothing to
    // correct. Comparing meaning rather than tracking focus also keeps a
    // half-typed '3.' or a trailing zero from being clobbered by a re-render.
    useEffect(() => {
      setText((prev) => (parseRef.current(prev) === value ? prev : fmt(value)));
    }, [value]);

    return (
      <Input
        {...rest}
        ref={ref}
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          // Store the raw text so an empty or half-typed box survives, and report
          // the parsed value — unclamped, because clamping here is what makes
          // "10" impossible to type when the minimum is 5.
          setText(e.target.value);
          onValueChange(parse(e.target.value));
        }}
        onBlur={(e) => {
          let n = parse(e.target.value);
          if (integer) n = Math.round(n);
          if (min !== undefined) n = Math.max(min, n);
          if (max !== undefined) n = Math.min(max, n);
          setText(fmt(n));
          if (n !== value) onValueChange(n);
          onBlur?.(e);
        }}
      />
    );
  },
);
