'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePlatformAiChat, useAiStatus, type AiChatTurn } from '@/hooks/use-ai';
import { AiChatPanel, type AiChatMessage } from '@/components/ai/ai-chat-panel';
import { Bot, X, MessageCircleQuestion } from 'lucide-react';

// UC3 (Level 1): floating platform-wide support assistant. Read-only — answers
// how-to questions and aggregate questions about the user's OWN organisation.
// Rendered globally in the modules layout; self-hides when the feature is off.
export function SupportAssistantWidget() {
  const { data: status } = useAiStatus();
  const chat = usePlatformAiChat();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);

  if (!status?.features.platformChat) return null;

  const history: AiChatTurn[] = messages
    .filter((m) => !m.extra)
    .map((m) => ({ role: m.role, content: m.content }));

  const send = async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    try {
      const res = await chat.mutateAsync({ message: text, history });
      const tag = res.mode === 'data' ? '📊 ' : '';
      setMessages((prev) => [...prev, { role: 'assistant', content: `${tag}${res.reply}` }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: err?.response?.data?.message ?? 'Sorry, something went wrong.' },
      ]);
    }
  };

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Support assistant"
        className={cn(
          'fixed bottom-5 right-5 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 print:hidden',
          'h-12 w-12',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex w-[min(92vw,380px)] flex-col rounded-2xl border border-foreground/10 bg-surface-container-lowest shadow-2xl print:hidden">
          <div className="flex items-center gap-2 border-b border-foreground/5 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircleQuestion className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Support Assistant</p>
              <p className="text-[10px] text-muted-foreground">How-to help & read-only data</p>
            </div>
          </div>

          <div className="p-3">
            <AiChatPanel
              messages={messages}
              onSend={send}
              pending={chat.isPending}
              placeholder="e.g. How do I add a patient?"
              scrollClassName="h-[46vh] min-h-[260px]"
              emptyState={
                <div className="px-3">
                  <Bot className="mx-auto h-7 w-7 text-primary" />
                  <p className="mt-2 text-sm font-medium">Hi! How can I help?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ask how to use the software, or about your hospital&apos;s numbers — e.g.
                    &ldquo;how many patients registered last month?&rdquo;
                  </p>
                </div>
              }
              quickActions={[
                { label: 'How do I add a patient?', onClick: () => send('How do I add a patient?') },
                { label: 'Patients this month', onClick: () => send('How many patients registered this month?') },
                { label: 'Beds available', onClick: () => send('How many beds are available right now?') },
              ]}
              footerNote="Read-only assistant — scoped to your organisation."
            />
          </div>
        </div>
      )}
    </>
  );
}
