'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSmartSuggestions, type SmartSuggestionsInput } from '@/hooks/use-doctor';
import { toast } from 'sonner';

export interface SmartSuggestionsCardProps {
  /** Called lazily — returns the current SOAP-ish payload to send to the model. */
  buildInput: () => SmartSuggestionsInput;
  /** Called when the doctor clicks "Add to advice" on a suggestion. */
  onAdopt: (suggestion: string) => void;
}

export function SmartSuggestionsCard({ buildInput, onAdopt }: SmartSuggestionsCardProps) {
  const mut = useSmartSuggestions();
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const fetchSuggestions = async () => {
    try {
      const res = await mut.mutateAsync(buildInput());
      setSuggestions(res?.suggestions ?? []);
      if (!res?.suggestions || res.suggestions.length === 0) {
        toast.info('AI returned no suggestions for this note.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to get AI suggestions');
    }
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-label text-[10px] uppercase tracking-widest text-primary font-semibold">
            AI Smart Suggestions
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={fetchSuggestions}
          disabled={mut.isPending}
        >
          {mut.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {suggestions.length > 0 ? 'Regenerate' : 'Suggest next steps'}
        </Button>
      </div>
      {suggestions.length > 0 ? (
        <ul className="space-y-1.5">
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-2 rounded-md bg-surface-container-lowest p-2"
            >
              <span className="text-xs flex-1">{s}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] shrink-0"
                onClick={() => onAdopt(s)}
              >
                Add to advice
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Uses the current consultation state to suggest 3 next steps (investigations, treatment
          tweaks, follow-up). Review before acting — the doctor stays in charge.
        </p>
      )}
    </div>
  );
}
