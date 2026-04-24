'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal types to describe the parts of the Web Speech API we use.
// The DOM lib ships these types only in very recent TS releases, so we
// declare the narrow interface inline to keep the hook portable.
interface MinimalSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as SpeechRecognitionCtor) ||
    (w.webkitSpeechRecognition as SpeechRecognitionCtor) ||
    null;
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  /**
   * Called with the final transcript segment each time the API emits one.
   * For continuous dictation we append; for one-shot we replace.
   */
  onFinal?: (segment: string) => void;
  /** Called whenever the interim (unfinalised) transcript changes. */
  onInterim?: (segment: string) => void;
}

export interface SpeechRecognitionState {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

/**
 * Thin wrapper around the browser's Web Speech API.
 *
 * - Returns `supported=false` when the browser doesn't expose the API
 *   (Firefox, some older Safari). Callers should hide their UI in that case.
 * - Emits final segments via `onFinal` — callers are responsible for
 *   deciding whether to append or replace the target field's text.
 * - Microphone permission is requested by the browser on first `start()`.
 */
export function useSpeechRecognition(
  opts: UseSpeechRecognitionOptions = {},
): SpeechRecognitionState {
  const { lang = 'en-US', continuous = true, interimResults = true, onFinal, onInterim } = opts;

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  // Keep the latest callback refs so `start()` can use up-to-date handlers
  // without needing the effect to re-instantiate the recognition object.
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);
  onFinalRef.current = onFinal;
  onInterimRef.current = onInterim;

  useEffect(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const recognition = new Ctor();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };
    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };
    recognition.onerror = (event: any) => {
      setError(event?.error ?? 'speech_error');
      setListening(false);
    };
    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText) {
        onFinalRef.current?.(finalText.trim());
      }
      setInterim(interimText);
      onInterimRef.current?.(interimText);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [lang, continuous, interimResults]);

  const start = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.start();
    } catch {
      // `start()` throws if already started — swallow.
    }
  }, []);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, interim, error, start, stop, toggle };
}
