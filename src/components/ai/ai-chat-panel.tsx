'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Sparkles, Cpu, ChevronDown } from 'lucide-react';
import { MarkdownMessage } from '@/components/ai/markdown-message';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export type AiModelId = 'gemini' | 'medgemma';

const AI_MODELS: { id: AiModelId; label: string; description: string }[] = [
  { id: 'gemini', label: 'Gemini', description: 'Google Gemini (cloud)' },
  { id: 'medgemma', label: 'MedGemma', description: 'MedGemma 4B (local)' },
];

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  extra?: ReactNode;
  excludeFromHistory?: boolean;
  kind?: 'summary' | 'blood-report' | 'imaging';
  version?: string;
  images?: string[];
  summary?: string;
}

export interface AiQuickAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

interface AiChatPanelProps {
  messages: AiChatMessage[];
  onSend: (text: string) => void;
  pending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyState?: ReactNode;
  quickActions?: AiQuickAction[];
  footerNote?: string;
  className?: string;
  scrollClassName?: string;
  aiModel?: string;
  onModelChange?: (model: AiModelId) => void;
}

export function AiChatPanel({
  messages,
  onSend,
  pending = false,
  disabled = false,
  placeholder = 'Ask a question…',
  emptyState,
  quickActions,
  footerNote,
  className,
  scrollClassName,
  aiModel,
  onModelChange,
}: AiChatPanelProps) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState<AiModelId>('gemini');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeModel = AI_MODELS.find((m) => m.id === model) ?? AI_MODELS[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  const submit = () => {
    const text = input.trim();
    if (!text || pending || disabled) return;
    onSend(text);
    setInput('');
  };

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      {/* Messages */}
      <div
        ref={scrollRef}
        className={cn('flex-1 overflow-y-auto sanctuary-scrollbar space-y-3 pr-1', scrollClassName)}
      >
        {messages.length === 0 && !pending ? (
          <div className="flex h-full items-center justify-center py-10 text-center">
            {emptyState ?? (
              <p className="text-sm text-muted-foreground">Ask me anything to get started.</p>
            )}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'rounded-2xl px-3.5 py-2 text-sm break-words',
                  m.role === 'user'
                    ? 'max-w-[85%] whitespace-pre-wrap bg-primary text-on-primary rounded-br-sm'
                    : 'max-w-[92%] bg-surface-container-high text-foreground rounded-bl-sm',
                )}
              >
                {m.role === 'assistant' ? <MarkdownMessage content={m.content} /> : m.content}
                {m.extra}
              </div>
            </div>
          ))
        )}

        {pending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-surface-container-high px-3.5 py-2.5 text-sm text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {quickActions && quickActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3">
          {quickActions.map((a, i) => (
            <Button
              key={i}
              variant="outline"
              size="xs"
              onClick={a.onClick}
              disabled={a.disabled || pending || disabled}
              title={a.title}
              className="gap-1 rounded-full text-xs"
            >
              {a.icon}
              {a.label}
            </Button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 pt-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || pending}
          className="min-h-[40px] max-h-32 resize-none"
        />

        <DropdownMenu open={modelMenuOpen} onOpenChange={setModelMenuOpen}>
          <DropdownMenuTrigger
            disabled={disabled || pending}
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-10 shrink-0 gap-1.5"
                aria-label="Select AI model"
                title={`Model: ${activeModel.label}`}
              >
                <Cpu className="h-4 w-4" />
                <span className="hidden sm:inline">{activeModel.label}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
              AI model
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={model}
              onValueChange={(v) => {
                setModel(v as AiModelId);
                onModelChange?.(v as AiModelId);
                setModelMenuOpen(false);
              }}
            >
              {AI_MODELS.map((m) => (
                <DropdownMenuRadioItem
                  key={m.id}
                  value={m.id}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="font-medium">{m.label}</span>
                  <span className="text-xs text-muted-foreground">{m.description}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          onClick={submit}
          disabled={disabled || pending || !input.trim()}
          size="icon"
          className="shrink-0"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {footerNote && (
        <p className="pt-1.5 text-[10px] leading-tight text-muted-foreground">{footerNote}</p>
      )}
    </div>
  );
}
