'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';

export interface VoiceInputButtonProps {
  /** Current text value of the target field. */
  value: string;
  /** Called with the next full value (current + dictated text). */
  onChange: (next: string) => void;
  /** Optional className for the button itself. */
  className?: string;
  /** Optional label for screen readers / tooltip. */
  fieldLabel?: string;
  /**
   * If true, dictation replaces the current value instead of appending.
   * Default false — append mode is safer for long narrative fields.
   */
  replace?: boolean;
  /**
   * Size of the underlying Button. Defaults to "sm" for inline placement.
   */
  size?: 'sm' | 'icon';
}

/**
 * Small mic toggle that dictates into a controlled text field.
 *
 * - Hidden entirely on browsers that don't expose the Web Speech API
 *   (Firefox, old Safari). Return null instead of rendering a disabled
 *   button — it avoids misleading the user into thinking it'll work.
 * - Appends final transcript segments to the existing value with a
 *   single leading space; that way mid-sentence dictation joins naturally.
 * - Shows a subtle pulsing indicator while listening and echoes interim
 *   text in the tooltip so the user can tell it's picking them up.
 */
export function VoiceInputButton({
  value,
  onChange,
  className,
  fieldLabel,
  replace = false,
  size = 'sm',
}: VoiceInputButtonProps) {
  // Track the value via ref so the final-segment handler can read the
  // freshest snapshot without retriggering the speech-recognition effect.
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleFinal = useCallback(
    (segment: string) => {
      const base = replace ? '' : localValue;
      const joined = base ? `${base} ${segment}` : segment;
      setLocalValue(joined);
      onChange(joined);
    },
    [localValue, onChange, replace],
  );

  const { supported, listening, interim, error, toggle } = useSpeechRecognition({
    onFinal: handleFinal,
  });

  if (!supported) return null;

  const title = listening
    ? interim
      ? `Listening: "${interim}"`
      : 'Listening… click to stop'
    : fieldLabel
      ? `Dictate into ${fieldLabel}`
      : 'Dictate';

  return (
    <Button
      type="button"
      variant="ghost"
      size={size === 'icon' ? 'icon' : 'sm'}
      className={cn(
        size === 'icon' ? 'h-7 w-7' : 'h-6 px-1.5',
        listening && 'text-error hover:text-error',
        error && 'opacity-60',
        className,
      )}
      onClick={toggle}
      title={title}
      aria-label={title}
      aria-pressed={listening}
    >
      {listening ? (
        <span className="relative inline-flex">
          <Mic className="h-3 w-3" />
          <span className="absolute -inset-0.5 rounded-full bg-error/30 animate-ping" />
        </span>
      ) : (
        <Mic className="h-3 w-3" />
      )}
      {size !== 'icon' && (
        <span className="ml-1 text-[10px]">{listening ? 'Stop' : 'Voice'}</span>
      )}
      {/* Hidden for screen readers when error present */}
      {error && (
        <span className="sr-only" role="status">
          <MicOff className="h-3 w-3" /> microphone error
        </span>
      )}
    </Button>
  );
}
