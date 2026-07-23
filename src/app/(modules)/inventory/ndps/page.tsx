'use client';

import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';
import { useState, useRef } from 'react';
import { ShieldCheck, PackagePlus, ArrowLeftRight, Syringe, Trash2, CalendarClock, Download, FileText, Search, Upload } from 'lucide-react';
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
import { formatDate, formatDateTime, toInputDateStr } from '@/lib/date-utils';
import { downloadCsv } from '@/lib/csv';
import { useFormulary } from '@/hooks/use-pharmacy';
import { useUsersList } from '@/hooks/use-users';
import { usePatientSearch } from '@/hooks/use-hospital';
import {
  useNdpsLocations, useNdpsStockByLocation, useNdpsRegister, useNdpsDailyBalances,
  useNdpsReceiveConsignment, useNdpsTransfer, useNdpsConsumption, useNdpsDisposal,
  useNdpsRunDailyClose, useNdpsVerifyDaily, useNdpsUploadEvidence, useNdpsCreateLocation,
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
function LocationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
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
function ReceiveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
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

// ── Transfer (dual-auth challan) dialog ─────────────────────
function TransferDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const users = useUserOpts();
  const { data: locations } = useNdpsLocations();
  const locOpts = (locations ?? []).map((l) => ({ id: l.id, label: `${l.name} (${l.type === 'main_vault' ? 'Vault' : 'Sub-store'})` }));
  const transfer = useNdpsTransfer();
  const [f, setF] = useState({ drugFormularyId: '', fromLocationId: '', toLocationId: '', quantity: '', counterpartyId: '' });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!f.drugFormularyId || !f.fromLocationId || !f.toLocationId || !f.quantity || !f.counterpartyId) return toast.error('All fields including the receiving custodian are required');
    try {
      await transfer.mutateAsync({ ...f, quantity: parseInt(f.quantity, 10) });
      toast.success('Stock transferred (dual-auth challan)');
      onOpenChange(false);
      setF({ drugFormularyId: '', fromLocationId: '', toLocationId: '', quantity: '', counterpartyId: '' });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Internal NDPS delivery challan</DialogTitle>
          <DialogDescription>Move stock between locations. A second custodian must co-sign (dual-authentication).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label>Narcotic drug *</Label><NarcoticDrugPicker value={f.drugFormularyId} onChange={(v) => set('drugFormularyId', v)} /></div>
          <div className="space-y-1"><Label>From *</Label><Select value={f.fromLocationId} onChange={(v) => set('fromLocationId', v)} options={locOpts} placeholder="Source" /></div>
          <div className="space-y-1"><Label>To *</Label><Select value={f.toLocationId} onChange={(v) => set('toLocationId', v)} options={locOpts} placeholder="Destination" /></div>
          <div className="space-y-1"><Label>Quantity *</Label><Input type="number" min={1} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
          {f.drugFormularyId && f.fromLocationId && <LocationBalanceHint drugFormularyId={f.drugFormularyId} locationId={f.fromLocationId} requestedQty={parseInt(f.quantity, 10) || undefined} />}
          <div className="space-y-1"><Label>Receiving custodian *</Label><Select value={f.counterpartyId} onChange={(v) => set('counterpartyId', v)} options={users} placeholder="Co-signing person" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={transfer.isPending}>Transfer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Form 3E consumption dialog ──────────────────────────────
function ConsumptionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
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
function DisposalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
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

// ── Inspector: stock by location ────────────────────────────
function StockTab() {
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

// ── Inspector: statutory register ───────────────────────────
function RegisterTab() {
  const [formType, setFormType] = useState('3C');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, isLoading } = useNdpsRegister({ formType, fromDate: from || undefined, toDate: to || undefined });
  const rows = data?.items ?? [];
  const exportRows = rows.map((r) => ({
    date: formatDateTime(r.occurredAt), drug: r.drugName, qty: r.quantity, from: r.from ?? '', to: r.to ?? '',
    recordedBy: r.recordedBy ?? '', counterparty: r.counterparty ?? '', coSign: r.coSignBy ?? '',
    form3c: r.form3cNumber ?? '', ndpsLicence: r.ndpsLicenseNumber ?? '', patientMrn: r.patient?.mrn ?? '',
    doctorRegNo: r.doctorRegNo ?? '', bed: r.bedNumber ?? '', diagnosis: r.diagnosis ?? '', reason: r.reasonCode ?? '', reference: r.referenceNumber ?? '',
  }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Select value={formType} onChange={setFormType} options={[{ id: '3C', label: 'Form 3C — Inward' }, { id: '3E', label: 'Form 3E — Consumption' }, { id: 'transfer', label: 'Transfers' }, { id: 'disposal', label: 'Disposals' }, { id: 'all', label: 'All entries' }]} placeholder="Form" />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={() => downloadCsv(`ndps-register-${formType}.csv`, exportRows)}>
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={async () => {
            try { await downloadPdf('/ndps/register/pdf', { formType, fromDate: from || undefined, toDate: to || undefined }, `ndps-form-${formType}.pdf`); }
            catch (e) { toast.error(e instanceof Error ? e.message : 'PDF export failed'); }
          }}>
            <FileText className="mr-1.5 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No entries" description="Nothing recorded for this form in the selected range." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Drug</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Custody</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(r.occurredAt)}</TableCell>
                <TableCell className="font-medium">{r.drugName}</TableCell>
                <TableCell className="text-right">{r.quantity}</TableCell>
                <TableCell className="text-xs">
                  {r.form3cNumber && <div>3C: {r.form3cNumber} · {r.ndpsLicenseNumber}</div>}
                  {r.patient && <div>{r.patient.name} ({r.patient.mrn}) · Bed {r.bedNumber}</div>}
                  {r.doctorRegNo && <div className="text-muted-foreground">Dr {r.doctorRegNo} · {r.diagnosis}</div>}
                  {r.reasonCode && <div>{r.reasonCode} · ref {r.referenceNumber}</div>}
                  {(r.from || r.to) && <div className="text-muted-foreground">{r.from ?? '—'} → {r.to ?? '—'}</div>}
                </TableCell>
                <TableCell className="text-xs">
                  <div>{r.recordedBy}</div>
                  {r.counterparty && <div className="text-muted-foreground">↔ {r.counterparty}</div>}
                  {r.coSignBy && <div className="text-muted-foreground">✓ {r.coSignBy}</div>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Form 3H daily accounts ──────────────────────────────────
function DailyTab() {
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

function NdpsInner() {
  const [dialog, setDialog] = useState<null | 'receive' | 'transfer' | 'consume' | 'dispose' | 'location'>(null);
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Narcotics (NDPS)</h1>
          <p className="text-xs text-muted-foreground">Form 3C / 3E / 3H statutory accounting with vault-to-bedside chain of custody.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialog('location')}><PackagePlus className="mr-1.5 h-4 w-4 rotate-45" /> New Sub-store</Button>
          <Button size="sm" onClick={() => setDialog('receive')}><PackagePlus className="mr-1.5 h-4 w-4" /> Receive (3C)</Button>
          <Button size="sm" variant="outline" onClick={() => setDialog('transfer')}><ArrowLeftRight className="mr-1.5 h-4 w-4" /> Transfer</Button>
          <Button size="sm" variant="outline" onClick={() => setDialog('consume')}><Syringe className="mr-1.5 h-4 w-4" /> Consume (3E)</Button>
          <Button size="sm" variant="outline" onClick={() => setDialog('dispose')}><Trash2 className="mr-1.5 h-4 w-4" /> Disposal</Button>
        </div>
      </div>

      <Tabs defaultValue="stock">
        <TabsList variant="line">
          <TabsTrigger value="stock">Inspector — Stock</TabsTrigger>
          <TabsTrigger value="register">Register (3C/3E)</TabsTrigger>
          <TabsTrigger value="daily">Daily Accounts (3H)</TabsTrigger>
        </TabsList>
        <TabsContent value="stock"><StockTab /></TabsContent>
        <TabsContent value="register"><RegisterTab /></TabsContent>
        <TabsContent value="daily"><DailyTab /></TabsContent>
      </Tabs>

      <LocationDialog open={dialog === 'location'} onOpenChange={(o) => setDialog(o ? 'location' : null)} />
      <ReceiveDialog open={dialog === 'receive'} onOpenChange={(o) => setDialog(o ? 'receive' : null)} />
      <TransferDialog open={dialog === 'transfer'} onOpenChange={(o) => setDialog(o ? 'transfer' : null)} />
      <ConsumptionDialog open={dialog === 'consume'} onOpenChange={(o) => setDialog(o ? 'consume' : null)} />
      <DisposalDialog open={dialog === 'dispose'} onOpenChange={(o) => setDialog(o ? 'dispose' : null)} />
    </div>
  );
}

export default function NdpsPage() {
  return (
    <PharmacyAdminGuard>
      <NdpsInner />
    </PharmacyAdminGuard>
  );
}
