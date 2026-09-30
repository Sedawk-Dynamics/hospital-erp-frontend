/**
 * The statutory NDPS surfaces: Form 3C receipt, Form 3E consumption, disposal,
 * sub-store custody points, stock by location and the Form 3H daily account.
 *
 * These used to live on their own page at /inventory/ndps, beside a transfer
 * dialog. That page is gone: transfers belong on the stock-transfer board with
 * every other medicine — one place to move stock, whatever its schedule — and
 * these six are not transfers at all. They are the records a drug inspector
 * asks for, so they live with the register, which is the inspector's view.
 *
 * Nothing here changed in the move except where it is mounted.
 */

'use client';

import { NdpsGuard } from '@/components/pharmacy/ndps-guard';
import { useState, useRef } from 'react';
import { ShieldCheck, PackagePlus, ArrowLeftRight, Syringe, Trash2, CalendarClock, Download, FileText, Search, Upload, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { formatDate, formatDateTime, toInputDateStr } from '@/lib/date-utils';
import { downloadCsv } from '@/lib/csv';
import { useFormulary } from '@/hooks/use-pharmacy';
import { DrugStockLabel } from '@/components/shared/drug-stock-label';
import { useUsersList } from '@/hooks/use-users';
import { useAuthStore } from '@/stores/auth-store';
import { WitnessCosignDialog } from '@/components/pharmacy/witness-cosign-dialog';
import { usePatientSearch } from '@/hooks/use-hospital';
import {
  useNdpsLocations, useNdpsStockByLocation, useNdpsRegister, useNdpsDailyBalances,
  useNdpsReceiveConsignment, useNdpsConsumption, useNdpsDisposal,
  useNdpsRunDailyClose, useNdpsVerifyDaily, useNdpsUploadEvidence, useNdpsCreateLocation,
  useNdpsPatientResiduals, useDestroyNdpsPatientResidual, type NdpsPatientResidual,
} from '@/hooks/use-ndps';

type DrugOpt = { id: string; label: string };
type UserOpt = { id: string; label: string };

// Searchable narcotic-drug picker (autocomplete). The dropdown stays hidden until
// the field is focused / typed into (it does NOT show by default), then floats
// over the form and filters server-side by isNarcotic + the typed text. Only
// drugs flagged "NDPS narcotic" in Inventory → Storage appear here.
function NarcoticDrugPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState('');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useFormulary({ isNarcotic: true, isActive: true, search: search.trim() || undefined, limit: 50 });
  const drugs = (data?.data ?? []).filter((d) => (d as { isNarcotic?: boolean }).isNarcotic);

  if (value && label) {
    return (
      <div className="flex h-9 items-center justify-between rounded-md border border-border bg-background px-2">
        <span className="truncate text-sm">{label}</span>
        <button
          type="button"
          className="ml-2 shrink-0 text-xs font-medium text-primary hover:underline"
          onClick={() => { onChange(''); setLabel(''); setSearch(''); setOpen(false); }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder="Search narcotic drug by name / generic…"
          className="h-9 pl-8"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {isLoading ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">Searching…</div>
          ) : drugs.length ? (
            drugs.map((d) => (
              <button
                key={d.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(d.id); setLabel(`${d.drugName}${d.strength ? ` ${d.strength}` : ''}`); setSearch(''); setOpen(false); }}
                className="block w-full border-b border-border/60 px-2 py-1.5 text-left text-sm last:border-b-0 hover:bg-muted"
              >
                <span className="font-medium">{d.drugName}{d.strength ? ` ${d.strength}` : ''}</span>
                <DrugStockLabel stock={d.totalStock} className="ml-1.5 align-middle" />
                {(d as { genericName?: string | null }).genericName ? (
                  <span className="ml-1 text-xs text-muted-foreground">· {(d as { genericName?: string | null }).genericName}</span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              {search.trim()
                ? 'No matching narcotic drugs.'
                : 'No narcotic drugs found. Flag a drug as “NDPS narcotic” in Inventory → Storage first (edit the drug).'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function useUserOpts(): UserOpt[] {
  const { data } = useUsersList({ limit: 200 });
  return (data?.data ?? []).map((u: { id: string; firstName: string; lastName?: string }) => ({
    id: u.id, label: `${u.firstName} ${u.lastName ?? ''}`.trim(),
  }));
}

// Fetch a statutory register PDF (blob) and trigger a browser download.
async function downloadPdf(url: string, params: Record<string, string | undefined>, filename: string) {
  const { apiClient } = await import('@/lib/api');
  const res = await apiClient.get(url, { params, responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; placeholder: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

// Live "available at this location" hint for the deducting dialogs (transfer /
// consume / dispose): shows the current balance of the chosen narcotic at the
// chosen location so the user sees, before submitting, whether there is stock —
// avoiding the "Insufficient narcotic stock" error. NDPS flow: receive (Form 3C)
// into the vault → transfer to a sub-store → consume/dispose from there.
function LocationBalanceHint({ drugFormularyId, locationId, requestedQty }: { drugFormularyId: string; locationId: string; requestedQty?: number }) {
  const { data } = useNdpsStockByLocation(drugFormularyId || undefined);
  const drug = (data?.items ?? []).find((d) => d.drugId === drugFormularyId);
  const available = drug?.locations.find((l) => l.locationId === locationId)?.quantity ?? 0;
  const short = requestedQty != null && requestedQty > 0 && requestedQty > available;
  const tone = available === 0 || short ? 'text-amber-600' : 'text-emerald-600';
  return (
    <p className={`col-span-2 -mt-1 text-xs ${tone}`}>
      Available at this location: <b>{available}</b> unit(s)
      {available === 0 && ' — receive a Form 3C consignment into the vault and transfer stock here first.'}
      {available > 0 && short ? ` — not enough for ${requestedQty}.` : ''}
    </p>
  );
}

// ── New NDPS location (sub-store cart) dialog ───────────────
// Sub-stores (ICU/OT carts) are where vault stock is transferred to and then
// dispensed from (Form 3E). Without one, the Transfer "To" and the Consume
// "Sub-store" dropdowns are empty — so this lets the pharmacy admin create them.
export function LocationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useNdpsCreateLocation();
  const [f, setF] = useState({ name: '', type: 'sub_store' });
  const submit = async () => {
    if (!f.name.trim()) return toast.error('Enter a location name (e.g. ICU Cart A).');
    try {
      await create.mutateAsync({ name: f.name.trim(), type: f.type });
      toast.success('NDPS location created');
      onOpenChange(false);
      setF({ name: '', type: 'sub_store' });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New NDPS location</DialogTitle>
          <DialogDescription>Create a sub-store cart (e.g. ICU Cart, OT Cart) to transfer vault stock into and dispense from.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label>Name *</Label><Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. ICU Cart A" /></div>
          <div className="col-span-2 space-y-1"><Label>Type</Label><Select value={f.type} onChange={(v) => setF((p) => ({ ...p, type: v }))} options={[{ id: 'sub_store', label: 'Sub-store (cart)' }, { id: 'main_vault', label: 'Main vault' }]} placeholder="Type" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>Create location</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Form 3C inward dialog ───────────────────────────────────
export function ReceiveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const recv = useNdpsReceiveConsignment();
  const [f, setF] = useState({ drugFormularyId: '', quantity: '', ndpsLicenseNumber: '', form3cNumber: '', transportDetails: '', grossWeight: '', batchNumber: '', expiryDate: '' });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!f.drugFormularyId || !f.quantity || !f.ndpsLicenseNumber || !f.form3cNumber) return toast.error('Drug, quantity, NDPS licence and Form 3C number are required');
    try {
      await recv.mutateAsync({ ...f, quantity: parseInt(f.quantity, 10), expiryDate: f.expiryDate || undefined });
      toast.success('Consignment received into the vault (Form 3C)');
      onOpenChange(false);
      setF({ drugFormularyId: '', quantity: '', ndpsLicenseNumber: '', form3cNumber: '', transportDetails: '', grossWeight: '', batchNumber: '', expiryDate: '' });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive NDPS consignment (Form 3C)</DialogTitle>
          <DialogDescription>Records the consignment into the Central Vault with its statutory provenance.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label>Narcotic drug *</Label><NarcoticDrugPicker value={f.drugFormularyId} onChange={(v) => set('drugFormularyId', v)} /></div>
          <div className="space-y-1"><Label>Quantity *</Label><Input type="number" min={1} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
          <div className="space-y-1"><Label>Gross weight</Label><Input value={f.grossWeight} onChange={(e) => set('grossWeight', e.target.value)} placeholder="e.g. 1.2 kg" /></div>
          <div className="space-y-1"><Label>NDPS licence no. *</Label><Input value={f.ndpsLicenseNumber} onChange={(e) => set('ndpsLicenseNumber', e.target.value)} /></div>
          <div className="space-y-1"><Label>Form 3C consignment no. *</Label><Input value={f.form3cNumber} onChange={(e) => set('form3cNumber', e.target.value)} /></div>
          <div className="space-y-1"><Label>Batch no.</Label><Input value={f.batchNumber} onChange={(e) => set('batchNumber', e.target.value)} /></div>
          <div className="space-y-1"><Label>Expiry</Label><Input type="date" value={f.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} /></div>
          <div className="col-span-2 space-y-1"><Label>Transport details</Label><Input value={f.transportDetails} onChange={(e) => set('transportDetails', e.target.value)} placeholder="Vehicle / courier" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={recv.isPending}>Receive</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Form 3E consumption dialog ──────────────────────────────
export function ConsumptionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: locations } = useNdpsLocations();
  const subStores = (locations ?? []).filter((l) => l.type === 'sub_store').map((l) => ({ id: l.id, label: l.name }));
  const consume = useNdpsConsumption();
  const [patientSearch, setPatientSearch] = useState('');
  const { data: patients } = usePatientSearch(patientSearch);
  const [f, setF] = useState({ drugFormularyId: '', fromLocationId: '', quantity: '', patientId: '', patientLabel: '', doctorRegNo: '', bedNumber: '', diagnosis: '' });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    // Per-field validation so the pharmacist knows exactly what's missing.
    if (!f.drugFormularyId) return toast.error('Select a narcotic drug.');
    if (!f.fromLocationId) return toast.error('Select the sub-store to dispense from — click “New Sub-store” if the list is empty.');
    if (!f.quantity || parseInt(f.quantity, 10) <= 0) return toast.error('Enter a valid dose quantity.');
    if (!f.patientId) return toast.error('Select the patient.');
    if (!f.doctorRegNo.trim()) return toast.error("Enter the prescriber's registration number (NMC).");
    if (!f.bedNumber.trim()) return toast.error("Enter the patient's bed number.");
    if (!f.diagnosis.trim()) return toast.error('Enter the diagnosis / justification.');
    try {
      const res = await consume.mutateAsync({ drugFormularyId: f.drugFormularyId, fromLocationId: f.fromLocationId, quantity: parseInt(f.quantity, 10), patientId: f.patientId, doctorRegNo: f.doctorRegNo, bedNumber: f.bedNumber, diagnosis: f.diagnosis });
      const charged = (res as { billing?: { charged?: number } } | undefined)?.billing?.charged;
      toast.success(typeof charged === 'number' ? `Consumption recorded (Form 3E) · ₹${charged.toLocaleString('en-IN')} billed to patient` : 'Consumption recorded (Form 3E)');
      onOpenChange(false);
      setF({ drugFormularyId: '', fromLocationId: '', quantity: '', patientId: '', patientLabel: '', doctorRegNo: '', bedNumber: '', diagnosis: '' });
      setPatientSearch('');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record patient consumption (Form 3E)</DialogTitle>
          <DialogDescription>Bedside administration — the prescriber reg no, bed and diagnosis are mandatory for the statutory record.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label>Narcotic drug *</Label><NarcoticDrugPicker value={f.drugFormularyId} onChange={(v) => set('drugFormularyId', v)} /></div>
          <div className="space-y-1"><Label>Sub-store *</Label><Select value={f.fromLocationId} onChange={(v) => set('fromLocationId', v)} options={subStores} placeholder={subStores.length ? 'Select sub-store' : 'No sub-store yet'} /></div>
          <div className="space-y-1"><Label>Dose qty *</Label><Input type="number" min={1} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
          {subStores.length === 0 && <p className="col-span-2 -mt-1 text-xs text-amber-600">No sub-store cart exists yet — close this, click “New Sub-store”, then Transfer vault stock into it.</p>}
          {f.drugFormularyId && f.fromLocationId && <LocationBalanceHint drugFormularyId={f.drugFormularyId} locationId={f.fromLocationId} requestedQty={parseInt(f.quantity, 10) || undefined} />}
          <div className="col-span-2 space-y-1">
            <Label>Patient *</Label>
            {f.patientId ? (
              <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm">
                <span>{f.patientLabel}</span>
                <Button variant="ghost" size="sm" onClick={() => { set('patientId', ''); set('patientLabel', ''); }}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Search patient by name / MRN" />
                {patientSearch.length >= 2 && (patients ?? []).length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border bg-popover shadow">
                    {(patients ?? []).map((p: { id: string; firstName: string; lastName?: string; mrn: string }) => (
                      <button key={p.id} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { set('patientId', p.id); set('patientLabel', `${p.firstName} ${p.lastName ?? ''} (${p.mrn})`); }}>
                        {p.firstName} {p.lastName ?? ''} · {p.mrn}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1"><Label>Doctor reg no (NMC) *</Label><Input value={f.doctorRegNo} onChange={(e) => set('doctorRegNo', e.target.value)} /></div>
          <div className="space-y-1"><Label>Bed no *</Label><Input value={f.bedNumber} onChange={(e) => set('bedNumber', e.target.value)} /></div>
          <div className="col-span-2 space-y-1"><Label>Diagnosis / justification *</Label><Input value={f.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={consume.isPending}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Disposal dialog ─────────────────────────────────────────
export function DisposalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const users = useUserOpts();
  const { data: locations } = useNdpsLocations();
  const locOpts = (locations ?? []).map((l) => ({ id: l.id, label: l.name }));
  const dispose = useNdpsDisposal();
  const uploadEvidence = useNdpsUploadEvidence();
  const fileRef = useRef<HTMLInputElement>(null);
  const [evidenceName, setEvidenceName] = useState('');
  const [f, setF] = useState({ drugFormularyId: '', locationId: '', quantity: '', reasonCode: 'breakage', referenceNumber: '', coSignById: '', attachmentUrl: '' });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!f.drugFormularyId || !f.locationId || !f.quantity || !f.referenceNumber || !f.coSignById) return toast.error('Drug, location, qty, reference and medical-director co-sign are required');
    try {
      await dispose.mutateAsync({ ...f, quantity: parseInt(f.quantity, 10), attachmentUrl: f.attachmentUrl || undefined });
      toast.success('Disposal logged');
      onOpenChange(false);
      setF({ drugFormularyId: '', locationId: '', quantity: '', reasonCode: 'breakage', referenceNumber: '', coSignById: '', attachmentUrl: '' });
      setEvidenceName('');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };
  const onPickFile = async (file: File) => {
    try {
      const r = await uploadEvidence.mutateAsync(file);
      set('attachmentUrl', r.fileUrl);
      setEvidenceName(r.fileName);
      toast.success('Evidence photo uploaded');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed'); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log broken / spoiled disposal</DialogTitle>
          <DialogDescription>Non-clinical loss — requires a reference number and the medical director&apos;s co-sign.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label>Narcotic drug *</Label><NarcoticDrugPicker value={f.drugFormularyId} onChange={(v) => set('drugFormularyId', v)} /></div>
          <div className="space-y-1"><Label>Location *</Label><Select value={f.locationId} onChange={(v) => set('locationId', v)} options={locOpts} placeholder="Location" /></div>
          <div className="space-y-1"><Label>Quantity *</Label><Input type="number" min={1} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
          {f.drugFormularyId && f.locationId && <LocationBalanceHint drugFormularyId={f.drugFormularyId} locationId={f.locationId} requestedQty={parseInt(f.quantity, 10) || undefined} />}
          <div className="space-y-1"><Label>Reason *</Label><Select value={f.reasonCode} onChange={(v) => set('reasonCode', v)} options={[{ id: 'breakage', label: 'Breakage' }, { id: 'contamination', label: 'Contamination' }, { id: 'expiry', label: 'Expiry' }, { id: 'other', label: 'Other' }]} placeholder="Reason" /></div>
          <div className="space-y-1"><Label>Reference no *</Label><Input value={f.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} placeholder="FIR / destruction memo" /></div>
          <div className="space-y-1"><Label>Medical director co-sign *</Label><Select value={f.coSignById} onChange={(v) => set('coSignById', v)} options={users} placeholder="Co-signing director" /></div>
          <div className="space-y-1">
            <Label>Evidence photo</Label>
            {f.attachmentUrl ? (
              <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm">
                <span className="truncate text-xs">{evidenceName || 'Uploaded'}</span>
                <Button variant="ghost" size="sm" onClick={() => { set('attachmentUrl', ''); setEvidenceName(''); }}>Remove</Button>
              </div>
            ) : (
              <>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) onPickFile(file); }} />
                <Button variant="outline" size="sm" className="w-full" disabled={uploadEvidence.isPending} onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1.5 h-4 w-4" /> {uploadEvidence.isPending ? 'Uploading…' : 'Upload photo'}
                </Button>
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={dispose.isPending}>Log disposal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Patient residual worklist ───────────────────────────────
// Opened residuals are not stock and never return to a sellable balance. A
// bedside quarantine lands here until pharmacy completes witnessed disposal.
export function PatientResidualsPanel() {
  const [showHistory, setShowHistory] = useState(false);
  const residualsQ = useNdpsPatientResiduals({ status: showHistory ? 'all' : 'quarantined' });
  const destroy = useDestroyNdpsPatientResidual();
  const [selected, setSelected] = useState<NdpsPatientResidual | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [witnessOpen, setWitnessOpen] = useState(false);
  const [form, setForm] = useState({ disposalMethod: '', referenceNumber: '', notes: '' });
  const { data: users } = useUsersList({ isActive: 'true', limit: 200 });
  const currentUserId = useAuthStore((state) => state.user?.id) ?? null;
  const witnessOptions = (users?.data ?? [])
    .filter((user) => user.id !== currentUserId)
    .map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName ?? ''}`.trim(),
      role: user.userRoles?.[0]?.role?.name ?? null,
    }));
  const rows = residualsQ.data?.items ?? [];

  const begin = (row: NdpsPatientResidual) => {
    setSelected(row);
    setForm({ disposalMethod: '', referenceNumber: '', notes: '' });
    setDetailsOpen(true);
  };
  const requestWitness = () => {
    if (!form.disposalMethod.trim()) return toast.error('Enter the destruction method.');
    if (!form.referenceNumber.trim()) return toast.error('Enter the destruction memo/reference number.');
    setDetailsOpen(false);
    setWitnessOpen(true);
  };
  const confirm = async (witnessedById: string, witnessPassword: string) => {
    if (!selected) return;
    try {
      await destroy.mutateAsync({
        id: selected.id,
        disposalMethod: form.disposalMethod.trim(),
        referenceNumber: form.referenceNumber.trim(),
        witnessedById,
        witnessPassword,
        notes: form.notes.trim() || undefined,
      });
      toast.success(`${selected.drug.name} residual destroyed and reconciled`);
      setWitnessOpen(false);
      setSelected(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Residual destruction failed');
    }
  };

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Archive className="mt-0.5 h-4 w-4 text-amber-700" />
          <div>
            <h3 className="text-sm font-semibold">Patient residual disposal</h3>
            <p className="text-xs text-muted-foreground">Sealed remnants recorded during eMAR administration, awaiting witnessed destruction.</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowHistory((current) => !current)}>
          {showHistory ? 'Pending only' : 'Show history'}
        </Button>
      </div>

      {residualsQ.isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
          {showHistory ? 'No patient residual records.' : 'No quarantined patient residuals are awaiting destruction.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Drug / batch</TableHead>
                <TableHead>Given</TableHead>
                <TableHead>Residual</TableHead>
                <TableHead>Instruction</TableHead>
                <TableHead>Custody</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="block text-sm font-medium">{row.patient.name}</span>
                    <span className="text-xs text-muted-foreground">{row.patient.mrn}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block text-sm font-medium">{row.drug.name} {row.drug.strength ?? ''}</span>
                    <span className="text-xs text-muted-foreground">Batch {row.batch.number}</span>
                  </TableCell>
                  <TableCell>{Number(row.administeredQuantity)} {row.quantityUnit}</TableCell>
                  <TableCell className="font-semibold text-red-700">{Number(row.residualQuantity)} {row.quantityUnit}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={row.residualHandling === 'pending_destruction' ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-700'}>
                      {row.residualHandling === 'pending_destruction' ? 'Destroy requested' : 'Sealed quarantine'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="block text-xs">{row.quarantineLocation ?? row.location.name}</span>
                    <span className="text-[10px] text-muted-foreground">since {formatDateTime(row.quarantinedAt ?? row.administeredAt)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={row.status === 'destroyed' ? 'border-emerald-200 text-emerald-700' : 'border-amber-200 text-amber-700'}>
                      {row.status === 'destroyed' ? 'Destroyed' : row.status === 'fully_administered' ? 'No residual' : 'Quarantined'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {row.status === 'quarantined' ? (
                      <Button size="sm" variant="destructive" onClick={() => begin(row)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Destroy
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">{row.destroyedAt ? formatDateTime(row.destroyedAt) : 'Complete'}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Prepare patient residual destruction</DialogTitle>
            <DialogDescription>
              {selected ? `${selected.patient.name} · ${selected.drug.name} · ${Number(selected.residualQuantity)} ${selected.quantityUnit}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Approved destruction method *</Label><Input value={form.disposalMethod} onChange={(event) => setForm((current) => ({ ...current, disposalMethod: event.target.value }))} placeholder="Method used after rendering contents irretrievable" /></div>
            <div className="space-y-1"><Label>Destruction memo / reference *</Label><Input value={form.referenceNumber} onChange={(event) => setForm((current) => ({ ...current, referenceNumber: event.target.value }))} placeholder="Committee memo / register reference" /></div>
            <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></div>
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              The opened container already left usable stock at administration. This action records destruction of its remaining contents and will not deduct another container.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={requestWitness}>Continue to witness</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WitnessCosignDialog
        open={witnessOpen}
        onOpenChange={setWitnessOpen}
        title="Witness final destruction"
        description="The witness must observe destruction of the sealed patient residual and enter their own password."
        witnessOptions={witnessOptions}
        busy={destroy.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}

// ── Inspector: stock by location ────────────────────────────
export function StockTab() {
  const { data, isLoading } = useNdpsStockByLocation();
  const items = data?.items ?? [];
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Live system balance of every narcotic across the facility — count the physical vials against these numbers.</p>
      {isLoading ? <Skeleton className="h-40 w-full" /> : items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No narcotic stock" description="Receive a Form 3C consignment to populate the vault." />
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <div key={d.drugId} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{d.drugName} {d.strength ?? ''}</span>
                <Badge variant="outline">Total: {d.total}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {d.locations.map((l) => (
                  <Badge key={l.locationId} className={l.type === 'main_vault' ? 'bg-blue-500/10 text-blue-700 border-blue-500/20' : 'bg-muted'}>
                    {l.name}: {l.quantity}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Form 3H daily accounts ──────────────────────────────────
export function DailyTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, isLoading } = useNdpsDailyBalances({ fromDate: from || undefined, toDate: to || undefined });
  const runClose = useNdpsRunDailyClose();
  const verify = useNdpsVerifyDaily();
  const rows = data?.items ?? [];

  const onVerify = async (id: string) => {
    const v = window.prompt('Enter the physical count for this drug:');
    if (v == null) return;
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 0) return toast.error('Enter a valid count');
    try { await verify.mutateAsync({ id, physicalCount: n }); toast.success('Signed off'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={async () => {
            try { await downloadPdf('/ndps/daily-balances/pdf', { fromDate: from || undefined, toDate: to || undefined }, 'ndps-form-3H.pdf'); }
            catch (e) { toast.error(e instanceof Error ? e.message : 'PDF export failed'); }
          }}>
            <FileText className="mr-1.5 h-4 w-4" /> Export PDF (3H)
          </Button>
          <Button variant="outline" size="sm" disabled={runClose.isPending} onClick={async () => { await runClose.mutateAsync(toInputDateStr()); toast.success('Form 3H closed for today'); }}>
            <CalendarClock className="mr-1.5 h-4 w-4" /> Run today&apos;s close
          </Button>
        </div>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No daily accounts yet" description="Run the close to write today's Form 3H." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Drug</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">Recd</TableHead>
              <TableHead className="text-right">Disp</TableHead>
              <TableHead className="text-right">Spoilt</TableHead>
              <TableHead className="text-right">Close</TableHead>
              <TableHead className="text-right">Physical</TableHead>
              <TableHead className="text-center">Sign-off</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap">{formatDate(r.date)}</TableCell>
                <TableCell className="font-medium">{r.drugName}</TableCell>
                <TableCell className="text-right">{r.openingBalance}</TableCell>
                <TableCell className="text-right text-emerald-600">{r.received}</TableCell>
                <TableCell className="text-right text-amber-600">{r.dispensed}</TableCell>
                <TableCell className="text-right text-red-600">{r.disposed}</TableCell>
                <TableCell className="text-right font-semibold">{r.closingBalance}</TableCell>
                <TableCell className="text-right">
                  {r.physicalCount ?? '—'}
                  {r.variance != null && r.variance !== 0 && <span className="ml-1 text-red-600">({r.variance > 0 ? '+' : ''}{r.variance})</span>}
                </TableCell>
                <TableCell className="text-center">
                  {r.isVerified ? <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Verified</Badge> : (
                    <Button variant="outline" size="sm" onClick={() => onVerify(r.id)}>Sign off</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
