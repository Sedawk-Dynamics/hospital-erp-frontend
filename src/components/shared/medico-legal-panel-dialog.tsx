'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X } from 'lucide-react';

const NATURE_OPTIONS = [
  'Abrasion',
  'Laceration',
  'Contusion',
  'Incised Wound',
  'Stab Wound',
  'Burn',
  'Fracture Deformity',
];

interface Injury {
  bodySite: string;
  nature: string;
  length: string;
  width: string;
}

const EMPTY_INJURY: Injury = { bodySite: '', nature: '', length: '', width: '' };

const INJURY_FIELDS: {
  key: keyof Injury;
  label: string;
  kind: 'text' | 'number' | 'select';
  placeholder?: string;
  colSpan?: string;
  options?: string[];
}[] = [
  { key: 'bodySite', label: 'Anatomical Body Site *', kind: 'text', placeholder: 'e.g. Left forearm, dorsal', colSpan: 'sm:col-span-2' },
  { key: 'nature', label: 'Nature of Injury', kind: 'select', placeholder: 'Select', options: NATURE_OPTIONS },
  { key: 'length', label: 'Length (cm)', kind: 'number' },
  { key: 'width', label: 'Width (cm)', kind: 'number' },
];

interface MedicoLegalPanelDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave?: (values: any) => void;
}

const MLC_FIELDS: { id: string; label: string; placeholder?: string; type?: string }[] = [
  { id: 'ml-serial', label: 'Unique MLC Serial Number', placeholder: 'e.g. MLC/2026/0142' },
  { id: 'ml-station', label: 'Police Station Jurisdiction', placeholder: 'e.g. Sector 20 PS' },
  { id: 'ml-io', label: 'Investigating Officer (IO) Name & Buckle', placeholder: 'e.g. SI R. Sharma · Buckle 4471' },
  { id: 'ml-receipt', label: 'Signed Receipt Acknowledgment No.', placeholder: 'e.g. ACK-8831' },
  { id: 'ml-intimation', label: 'Police Intimation Dispatched Time', type: 'datetime-local' },
  { id: 'ml-arrival', label: 'IO Arrival at Casualty Time', type: 'datetime-local' },
];

export default function MedicoLegalPanelDialog({ open, setOpen, onSave }: MedicoLegalPanelDialogProps) {
    const [isMLC,setIsMlc]=useState<boolean>(false);
  const [itemText, setItemText] = useState('');
  const [items, setItems] = useState<string[]>([]);

  const addItem = () => {
    const value = itemText.trim();
    if (!value) return;
    setItems((prev) => [...prev, value]);
    setItemText('');
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const [injuryDraft, setInjuryDraft] = useState<Injury>(EMPTY_INJURY);
  const [injuries, setInjuries] = useState<Injury[]>([]);

  const setDraft = (patch: Partial<Injury>) => setInjuryDraft((prev) => ({ ...prev, ...patch }));

  const addInjury = () => {
    if (!injuryDraft.bodySite.trim()) return; // body site is required
    setInjuries((prev) => [...prev, { ...injuryDraft, bodySite: injuryDraft.bodySite.trim() }]);
    setInjuryDraft(EMPTY_INJURY);
  };

  const removeInjury = (index: number) => {
    setInjuries((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Medico-Legal (MLC) & Injury Canvas</DialogTitle>
          <DialogDescription>
            Flag this case as medico-legal and record the police intimation details.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4">
          {/* Master toggle */}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2">
            <input
              type="checkbox"
              onClick={()=>setIsMlc(!isMLC)}
              className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
            <span className="text-sm font-medium text-on-surface">Flag as Medico-Legal (MLC)</span>
          </label>

          {isMLC && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {MLC_FIELDS.map((f) => (
                <div key={f.id} className="space-y-1.5">
                  <Label htmlFor={f.id}>{f.label}</Label>
                  <Input id={f.id} type={f.type ?? 'text'} placeholder={f.placeholder} />
                </div>
              ))}
            </div>
          )}

          {/* Add-item list */}
          <div className="space-y-2">
            <Label>Belongings / Items</Label>
            <div className="flex flex-row gap-2">
              <Input
                placeholder="Enter an item"
                value={itemText}
                onChange={(e) => setItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
              <Button type="button" variant="outline" className="gap-1.5 shrink-0" onClick={addItem}>
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>

            {items.length > 0 && (
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-1.5"
                  >
                    <span className="text-sm text-on-surface">{item}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="text-on-surface-variant hover:text-destructive"
                      aria-label="Remove item"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add-injury list */}
          <div className="space-y-2">
            <Label>Injuries</Label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 sm:items-center ">
              {INJURY_FIELDS.map((f) => (
                <div key={f.key} className={`space-y-1.5 ${f.colSpan ?? ''}`}>
                  <Label htmlFor={`inj-${f.key}`}>{f.label}</Label>
                  {f.kind === 'select' ? (
                    <Select
                      value={injuryDraft[f.key]}
                      onValueChange={(v) => setDraft({ [f.key]: v ?? '' })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={f.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {(f.options ?? []).map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`inj-${f.key}`}
                      type={f.kind === 'number' ? 'number' : 'text'}
                      {...(f.kind === 'number' ? { min: 0, step: '0.1' } : {})}
                      placeholder={f.placeholder}
                      value={injuryDraft[f.key]}
                      onChange={(e) => setDraft({ [f.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" className="gap-1.5" onClick={addInjury}>
              <Plus className="h-4 w-4" />
              Add Injury
            </Button>

            {injuries.length > 0 && (
              <ul className="space-y-1.5">
                {injuries.map((inj, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-1.5"
                  >
                    <span className="text-sm text-on-surface">
                      <span className="font-medium">{inj.bodySite}</span>
                      {inj.nature ? ` · ${inj.nature}` : ''}
                      {inj.length ? ` · L ${inj.length}cm` : ''}
                      {inj.width ? ` · W ${inj.width}cm` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeInjury(i)}
                      className="text-on-surface-variant hover:text-destructive"
                      aria-label="Remove injury"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
