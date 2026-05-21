'use client';

// Shared parameter-grid editor used by:
//   • super-admin Lab Templates builder (full edit)
//   • hospital admin Lab Test edit dialog (full edit when admin role)
//
// Each row in the grid is one ParameterSpec — the schema mirrors
// backend lab.validation.parameterSpecSchema. Validation is light here
// (server re-validates on save); the UI just keeps the shape consistent
// so e.g. a select param always has at least one option.

import { useState } from 'react';
import { GripVertical, Plus, Trash2, ChevronUp, ChevronDown, X as XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  LabParameterSpec,
  LabParameterInputType,
  LabParameterOption,
} from '@/hooks/use-lab-templates';

interface LabParameterBuilderProps {
  value: LabParameterSpec[];
  onChange: (next: LabParameterSpec[]) => void;
}

let _localId = 0;
function newId(): string {
  _localId += 1;
  return `p_local_${_localId}`;
}

function blankParam(): LabParameterSpec {
  return {
    id: newId(),
    name: '',
    code: null,
    unit: null,
    refLow: null,
    refHigh: null,
    refRangeText: null,
    decimals: 2,
    group: null,
    inputType: 'number',
    options: null,
    notes: null,
  };
}

export function LabParameterBuilder({ value, onChange }: LabParameterBuilderProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const update = (idx: number, patch: Partial<LabParameterSpec>) => {
    onChange(value.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next.length ? next : [blankParam()]);
    if (expandedIdx === idx) setExpandedIdx(null);
  };

  const add = () => {
    onChange([...value, blankParam()]);
    setExpandedIdx(value.length);
  };

  const setInputType = (idx: number, t: LabParameterInputType) => {
    const patch: Partial<LabParameterSpec> = { inputType: t };
    if (t === 'select' && !value[idx].options?.length) {
      patch.options = [{ value: '', label: '' }];
    }
    if (t === 'number' && value[idx].decimals == null) {
      patch.decimals = 2;
    }
    update(idx, patch);
  };

  const setOptions = (idx: number, options: LabParameterOption[]) => {
    update(idx, { options });
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-surface-container-low border-b text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
        <div className="col-span-1"></div>
        <div className="col-span-3">Parameter name</div>
        <div className="col-span-2">Group</div>
        <div className="col-span-1">Unit</div>
        <div className="col-span-2">Reference range</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-1 text-right">Actions</div>
      </div>

      {value.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
          No parameters yet. Add one to start building this report.
        </div>
      ) : (
        value.map((p, idx) => {
          const expanded = expandedIdx === idx;
          return (
            <div key={p.id} className={cn('border-b last:border-b-0', expanded && 'bg-surface-container-lowest')}>
              <div className="grid grid-cols-12 gap-1 px-3 py-2 items-center">
                <div className="col-span-1 flex items-center gap-0.5 text-muted-foreground">
                  <span className="text-[10px] font-mono tabular-nums">{idx + 1}.</span>
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
                <Input
                  className="col-span-3 h-7 text-xs"
                  placeholder="e.g. Hemoglobin"
                  value={p.name}
                  onChange={(e) => update(idx, { name: e.target.value })}
                />
                <Input
                  className="col-span-2 h-7 text-xs"
                  placeholder="e.g. RBC Indices"
                  value={p.group ?? ''}
                  onChange={(e) => update(idx, { group: e.target.value || null })}
                />
                <Input
                  className="col-span-1 h-7 text-xs"
                  placeholder="g/dL"
                  value={p.unit ?? ''}
                  onChange={(e) => update(idx, { unit: e.target.value || null })}
                />
                <div className="col-span-2 flex items-center gap-1">
                  {p.inputType === 'number' ? (
                    <>
                      <Input
                        className="h-7 text-xs"
                        placeholder="Low"
                        type="number"
                        step="any"
                        value={p.refLow ?? ''}
                        onChange={(e) => update(idx, { refLow: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                      <span className="text-muted-foreground text-xs">–</span>
                      <Input
                        className="h-7 text-xs"
                        placeholder="High"
                        type="number"
                        step="any"
                        value={p.refHigh ?? ''}
                        onChange={(e) => update(idx, { refHigh: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </>
                  ) : (
                    <Input
                      className="h-7 text-xs"
                      placeholder='e.g. "Negative", "<1:80"'
                      value={p.refRangeText ?? ''}
                      onChange={(e) => update(idx, { refRangeText: e.target.value || null })}
                    />
                  )}
                </div>
                <select
                  className="col-span-2 h-7 rounded-lg border border-input bg-transparent px-2 text-xs"
                  value={p.inputType}
                  onChange={(e) => setInputType(idx, e.target.value as LabParameterInputType)}
                >
                  <option value="number">Number</option>
                  <option value="text">Text</option>
                  <option value="select">Select (categorical)</option>
                </select>
                <div className="col-span-1 flex items-center justify-end gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="h-6 w-6 text-muted-foreground"
                    title="Move up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => move(idx, 1)}
                    disabled={idx === value.length - 1}
                    className="h-6 w-6 text-muted-foreground"
                    title="Move down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setExpandedIdx(expanded ? null : idx)}
                    className="h-6 w-6 text-muted-foreground"
                    title={expanded ? 'Collapse' : 'More'}
                  >
                    <span className="text-[10px] font-bold">{expanded ? '−' : '⋯'}</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(idx)}
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    title="Remove parameter"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="px-3 pb-3 pt-1 grid grid-cols-12 gap-2 text-xs">
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">Code</label>
                    <Input
                      className="h-7 text-xs"
                      placeholder="HGB"
                      value={p.code ?? ''}
                      onChange={(e) => update(idx, { code: e.target.value || null })}
                    />
                  </div>
                  {p.inputType === 'number' && (
                    <div className="col-span-1">
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground">Decimals</label>
                      <Input
                        className="h-7 text-xs"
                        type="number"
                        min={0}
                        max={4}
                        value={p.decimals ?? 2}
                        onChange={(e) => update(idx, { decimals: Number(e.target.value) || 0 })}
                      />
                    </div>
                  )}
                  <div className="col-span-9">
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">Notes / footnote (printed below the parameter on the report)</label>
                    <Input
                      className="h-7 text-xs"
                      placeholder="e.g. Male 13.0-17.0, Female 12.0-15.5"
                      value={p.notes ?? ''}
                      onChange={(e) => update(idx, { notes: e.target.value || null })}
                    />
                  </div>

                  {p.inputType === 'select' && (
                    <div className="col-span-12">
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground">Allowed options</label>
                      <div className="space-y-1">
                        {(p.options ?? []).map((o, oi) => (
                          <div key={oi} className="grid grid-cols-12 gap-1">
                            <Input
                              className="col-span-3 h-7 text-xs"
                              placeholder="value (snake_case)"
                              value={o.value}
                              onChange={(e) => {
                                const next = [...(p.options ?? [])];
                                next[oi] = { ...o, value: e.target.value };
                                setOptions(idx, next);
                              }}
                            />
                            <Input
                              className="col-span-8 h-7 text-xs"
                              placeholder='display label (e.g. "Non-reactive")'
                              value={o.label}
                              onChange={(e) => {
                                const next = [...(p.options ?? [])];
                                next[oi] = { ...o, label: e.target.value };
                                setOptions(idx, next);
                              }}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="col-span-1 h-7 w-7 text-muted-foreground"
                              onClick={() => setOptions(idx, (p.options ?? []).filter((_, i) => i !== oi))}
                              title="Remove option"
                            >
                              <XIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs h-7"
                          onClick={() => setOptions(idx, [...(p.options ?? []), { value: '', label: '' }])}
                        >
                          <Plus className="h-3 w-3" />
                          Add option
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      <div className="px-3 py-2 border-t bg-surface-container-low">
        <Button size="sm" variant="ghost" onClick={add} className="gap-1 text-xs">
          <Plus className="h-3 w-3" />
          Add parameter
        </Button>
      </div>
    </div>
  );
}

export { blankParam as createBlankLabParameter };
