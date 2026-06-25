'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePatientSearch } from '@/hooks/use-doctor';
import { useAiStatus } from '@/hooks/use-ai';
import { PatientAiAssistant } from '@/components/doctor/patient-ai-assistant';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DoctorAiAssistantPage() {
  const searchParams = useSearchParams();
  const { data: status } = useAiStatus();

  const [selected, setSelected] = useState<{ id: string; name: string; mrn?: string } | null>(null);
  const [query, setQuery] = useState('');
  const { data: results, isFetching } = usePatientSearch(query);

  // Deep-link support: /doctor/ai-assistant?patientId=…&name=…
  useEffect(() => {
    const pid = searchParams.get('patientId');
    if (pid && !selected) {
      setSelected({ id: pid, name: searchParams.get('name') ?? 'Patient', mrn: undefined });
    }
  }, [searchParams, selected]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="font-headline text-xl font-bold">Patient AI Assistant</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Pick a patient and ask the AI to reason over their record (diagnoses, labs, medications,
        history). Decision support only — radiology images are not interpreted.
      </p>

      {status && !status.enabled && (
        <div className="rounded-lg border border-amber-300/40 bg-amber-50/50 px-4 py-3 text-sm text-amber-800">
          AI is not configured on this server yet. Ask a super-admin to enable it under AI Settings.
        </div>
      )}

      {!selected ? (
        <Card>
          <CardContent className="pt-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search patient by name or MRN…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="mt-3 divide-y divide-foreground/5">
              {query.length < 2 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters to search.
                </p>
              ) : isFetching ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>
              ) : (results ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No patients found.</p>
              ) : (
                (results ?? []).map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelected({
                        id: p.id,
                        name: `${p.firstName} ${p.lastName ?? ''}`.trim(),
                        mrn: p.mrn,
                      })
                    }
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-container-low rounded-lg px-2 transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {`${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{`${p.firstName} ${p.lastName ?? ''}`.trim()}</p>
                      <p className="text-xs text-muted-foreground">MRN {p.mrn}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-foreground/5 bg-surface-container-low px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {selected.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{selected.name}</p>
                {selected.mrn && <p className="text-xs text-muted-foreground">MRN {selected.mrn}</p>}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Change patient
            </Button>
          </div>
          <CardContent className="p-4">
            <PatientAiAssistant
              patientId={selected.id}
              patientName={selected.name}
              scrollClassName="h-[calc(100vh-26rem)] min-h-[320px]"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
