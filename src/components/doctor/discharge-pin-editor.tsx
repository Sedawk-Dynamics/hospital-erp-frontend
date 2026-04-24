'use client';

import { Pin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ProgressNotePinEntry } from '@/hooks/use-doctor';

export interface PinValue {
  dischargeSection: ProgressNotePinEntry['dischargeSection'];
  content: string;
}

export const DISCHARGE_SECTIONS: Array<{
  key: ProgressNotePinEntry['dischargeSection'];
  label: string;
}> = [
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'hospital_course', label: 'Hospital Course' },
  { key: 'procedure', label: 'Procedure' },
  { key: 'medication', label: 'Medication' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'advice', label: 'Advice' },
  { key: 'general', label: 'General' },
];

export interface DischargePinEditorProps {
  value: PinValue[];
  onChange: (next: PinValue[]) => void;
}

export function DischargePinEditor({ value, onChange }: DischargePinEditorProps) {
  const addPin = () => onChange([...value, { dischargeSection: 'general', content: '' }]);
  const removePin = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const updatePin = (idx: number, patch: Partial<PinValue>) => {
    onChange(value.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  return (
    <div className="space-y-2">
      {value.map((pin, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start">
          <select
            value={pin.dischargeSection}
            onChange={(e) =>
              updatePin(idx, {
                dischargeSection: e.target.value as ProgressNotePinEntry['dischargeSection'],
              })
            }
            className="h-8 rounded-md border bg-background px-2 text-xs shrink-0"
          >
            {DISCHARGE_SECTIONS.map((ds) => (
              <option key={ds.key} value={ds.key}>
                {ds.label}
              </option>
            ))}
          </select>
          <Textarea
            value={pin.content}
            onChange={(e) => updatePin(idx, { content: e.target.value })}
            placeholder="Text to carry into the discharge summary for this section…"
            className="flex-1 min-h-[48px] text-xs"
            rows={2}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => removePin(idx)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addPin}>
        <Pin className="h-3 w-3 mr-1" />
        Add discharge pin
      </Button>
      {value.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Pins feed the auto-built discharge summary. Add one per section you want this note to
          contribute to (IP only — OP notes ignore pins).
        </p>
      )}
    </div>
  );
}
