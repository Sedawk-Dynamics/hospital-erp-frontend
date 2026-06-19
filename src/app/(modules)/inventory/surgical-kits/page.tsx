'use client';

import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';
import { useState } from 'react';
import { Boxes, Plus, Trash2, PackageCheck, Search, X, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/date-utils';
import { useFormulary, type FormularyItem } from '@/hooks/use-pharmacy';
import { usePatientSearch } from '@/hooks/use-hospital';
import {
  useKitTemplates, useKitIssues, useCreateKitTemplate, useDeleteKitTemplate,
  useIssueKit, useReconcileKit, useCancelKit, type KitTemplate, type KitIssue,
} from '@/hooks/use-ot-kits';

const STATUS_BADGE: Record<string, string> = {
  issued: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  reconciled: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-700 border-red-500/20',
};

// Reusable drug-line builder (template items / custom issue lines).
function DrugLineEditor({ lines, setLines }: { lines: { drugFormularyId: string; quantity: number; label: string }[]; setLines: (l: { drugFormularyId: string; quantity: number; label: string }[]) => void }) {
  const [search, setSearch] = useState('');
  const { data } = useFormulary({ search: search || undefined, limit: 20, isActive: true });
  const results = data?.data ?? [];
  const add = (d: FormularyItem) => {
    if (lines.some((l) => l.drugFormularyId === d.id)) return;
    setLines([...lines, { drugFormularyId: d.id, quantity: 1, label: `${d.drugName}${d.strength ? ` ${d.strength}` : ''}` }]);
    setSearch('');
  };
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a drug / consumable to add" />
        {search.length >= 2 && results.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border bg-popover shadow">
            {results.map((d) => (
              <button key={d.id} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => add(d)}>
                {d.drugName} {d.strength ?? ''}
              </button>
            ))}
          </div>
        )}
      </div>
      {lines.map((l, i) => (
        <div key={l.drugFormularyId} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
          <span className="flex-1 truncate">{l.label}</span>
          <Input type="number" min={1} value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: parseInt(e.target.value, 10) || 1 } : x)))} className="h-7 w-20" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines(lines.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  );
}

function TemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateKitTemplate();
  const [name, setName] = useState('');
  const [surgeryType, setSurgeryType] = useState('');
  const [lines, setLines] = useState<{ drugFormularyId: string; quantity: number; label: string }[]>([]);
  const submit = async () => {
    if (!name.trim() || lines.length === 0) return toast.error('Name and at least one item are required');
    try {
      await create.mutateAsync({ name: name.trim(), surgeryType: surgeryType.trim() || undefined, items: lines.map((l) => ({ drugFormularyId: l.drugFormularyId, quantity: l.quantity })) });
      toast.success('Kit template created');
      onOpenChange(false); setName(''); setSurgeryType(''); setLines([]);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New surgical kit template</DialogTitle><DialogDescription>A doctor-preference bundle issued together for a procedure.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Kit name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr Sharma's Hernia Kit" /></div>
          <div className="space-y-1"><Label>Surgery type</Label><Input value={surgeryType} onChange={(e) => setSurgeryType(e.target.value)} placeholder="e.g. Laparoscopic Cholecystectomy" /></div>
          <div className="space-y-1"><Label>Items *</Label><DrugLineEditor lines={lines} setLines={setLines} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={create.isPending}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({ open, onOpenChange, templates }: { open: boolean; onOpenChange: (o: boolean) => void; templates: KitTemplate[] }) {
  const issue = useIssueKit();
  const [patientSearch, setPatientSearch] = useState('');
  const { data: patients } = usePatientSearch(patientSearch);
  const [patient, setPatient] = useState<{ id: string; label: string } | null>(null);
  const [surgeryName, setSurgeryName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const submit = async () => {
    if (!patient || !surgeryName.trim() || !templateId) return toast.error('Patient, surgery name and a kit template are required');
    try {
      await issue.mutateAsync({ patientId: patient.id, surgeryName: surgeryName.trim(), templateId });
      toast.success('Kit issued to the Virtual OT Ledger');
      onOpenChange(false); setPatient(null); setPatientSearch(''); setSurgeryName(''); setTemplateId('');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Issue a surgical kit</DialogTitle><DialogDescription>Bulk-issues the kit into the Virtual OT Ledger — stock leaves the pool but isn&apos;t billed until reconciliation.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Patient *</Label>
            {patient ? (
              <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm"><span>{patient.label}</span><Button variant="ghost" size="sm" onClick={() => setPatient(null)}>Change</Button></div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Search patient by name / MRN" />
                {patientSearch.length >= 2 && (patients ?? []).length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border bg-popover shadow">
                    {(patients ?? []).map((p: { id: string; firstName: string; lastName?: string; mrn: string }) => (
                      <button key={p.id} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => setPatient({ id: p.id, label: `${p.firstName} ${p.lastName ?? ''} (${p.mrn})` })}>{p.firstName} {p.lastName ?? ''} · {p.mrn}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1"><Label>Surgery *</Label><Input value={surgeryName} onChange={(e) => setSurgeryName(e.target.value)} placeholder="e.g. Hernia repair" /></div>
          <div className="space-y-1">
            <Label>Kit template *</Label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
              <option value="">Select kit</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.items.length} items)</option>)}
            </select>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={issue.isPending}>Issue kit</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReconcileDialog({ issue, onOpenChange }: { issue: KitIssue | null; onOpenChange: (o: boolean) => void }) {
  const reconcile = useReconcileKit();
  const [returns, setReturns] = useState<Record<string, number>>({});
  const submit = async () => {
    if (!issue) return;
    try {
      const res = await reconcile.mutateAsync({ id: issue.id, returns: issue.items.map((i) => ({ itemId: i.id, returnedQty: returns[i.id] ?? 0 })) });
      toast.success(`Reconciled — billed ₹${(res as { consumedTotal: number }).consumedTotal.toFixed(2)}`);
      onOpenChange(false); setReturns({});
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <Dialog open={!!issue} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Post-op reconciliation</DialogTitle><DialogDescription>Scan / enter the sealed leftovers returned. Consumed = issued − returned is billed; leftovers go back to stock.</DialogDescription></DialogHeader>
        <div className="space-y-2">
          {issue?.items.map((it) => {
            const returned = Math.min(returns[it.id] ?? 0, it.issuedQty);
            return (
              <div key={it.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{it.drugName} {it.strength ?? ''}</div>
                  <div className="text-xs text-muted-foreground">Issued {it.issuedQty} · batch {it.batchNumber ?? '-'}</div>
                </div>
                <div className="text-right">
                  <Label className="text-[10px] text-muted-foreground">Returned</Label>
                  <Input type="number" min={0} max={it.issuedQty} value={returns[it.id] ?? ''} onChange={(e) => setReturns({ ...returns, [it.id]: parseInt(e.target.value, 10) || 0 })} className="h-7 w-20" placeholder="0" />
                </div>
                <Badge variant="outline" className="w-20 justify-center">use {it.issuedQty - returned}</Badge>
              </div>
            );
          })}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={reconcile.isPending}>Reconcile &amp; bill</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssuesTab({ templates }: { templates: KitTemplate[] }) {
  const [status, setStatus] = useState('issued');
  const { data, isLoading } = useKitIssues({ status: status || undefined });
  const cancel = useCancelKit();
  const [issueOpen, setIssueOpen] = useState(false);
  const [reconciling, setReconciling] = useState<KitIssue | null>(null);
  const rows = data?.items ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value="issued">Active (issued)</option>
          <option value="reconciled">Reconciled</option>
          <option value="cancelled">Cancelled</option>
          <option value="">All</option>
        </select>
        <Button size="sm" onClick={() => setIssueOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Issue kit</Button>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : rows.length === 0 ? (
        <EmptyState icon={Boxes} title="No kit issues" description="Issue a surgical kit to a patient's OT session." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Surgery</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.surgeryName}</TableCell>
                <TableCell className="text-sm">{r.patient ? `${r.patient.name} (${r.patient.mrn})` : '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.items.slice(0, 3).map((i) => `${i.drugName}×${r.status === 'issued' ? i.issuedQty : i.consumedQty}`).join(', ')}
                  {r.items.length > 3 ? ` +${r.items.length - 3}` : ''}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(r.issuedAt)}</TableCell>
                <TableCell className="text-center"><Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge></TableCell>
                <TableCell className="text-right">
                  {r.status === 'issued' && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" onClick={() => setReconciling(r)}><PackageCheck className="mr-1 h-3.5 w-3.5" /> Reconcile</Button>
                      <Button size="sm" variant="ghost" onClick={async () => { if (window.confirm('Cancel and return all stock?')) { try { await cancel.mutateAsync(r.id); toast.success('Cancelled'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } } }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <IssueDialog open={issueOpen} onOpenChange={setIssueOpen} templates={templates} />
      <ReconcileDialog issue={reconciling} onOpenChange={(o) => !o && setReconciling(null)} />
    </div>
  );
}

function TemplatesTab() {
  const { data, isLoading } = useKitTemplates();
  const del = useDeleteKitTemplate();
  const [open, setOpen] = useState(false);
  const templates = data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> New template</Button></div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : templates.length === 0 ? (
        <EmptyState icon={Stethoscope} title="No kit templates" description="Create a doctor-preference surgical kit bundle." />
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{t.name}</span>
                  {t.surgeryType && <span className="ml-2 text-xs text-muted-foreground">{t.surgeryType}</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => { if (window.confirm(`Remove "${t.name}"?`)) { try { await del.mutateAsync(t.id); toast.success('Removed'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } } }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {t.items.map((i) => <Badge key={i.id} variant="outline">{i.drug?.drugName ?? '-'} ×{i.quantity}</Badge>)}
              </div>
            </div>
          ))}
        </div>
      )}
      <TemplateDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function SurgicalKitsInner() {
  const { data: templates } = useKitTemplates();
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /> Surgical Kits (OT)</h1>
        <p className="text-xs text-muted-foreground">Issue bulk, reconcile net — only consumed items are billed; sealed leftovers return to stock.</p>
      </div>
      <Tabs defaultValue="issues">
        <TabsList variant="line">
          <TabsTrigger value="issues">OT Issues</TabsTrigger>
          <TabsTrigger value="templates">Kit Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="issues"><IssuesTab templates={templates ?? []} /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function SurgicalKitsPage() {
  return (
    <PharmacyAdminGuard>
      <SurgicalKitsInner />
    </PharmacyAdminGuard>
  );
}
