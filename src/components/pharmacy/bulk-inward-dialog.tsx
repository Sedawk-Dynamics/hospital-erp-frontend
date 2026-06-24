'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  PackageCheck,
  ClipboardPaste,
  Sparkles,
  CircleCheck,
  CircleX,
  Camera,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useMatchInward,
  useCommitInward,
  useOcrInward,
  useInwardScan,
  type InwardMatchedLine,
  type CommitInwardLine,
  type CommitInwardResult,
  type FormularyMatch,
  type OcrInvoiceLine,
} from '@/hooks/use-pharmacy';
import { useSuppliers } from '@/hooks/use-inventory';
import { VendorFormDialog } from '@/components/inventory/vendor-form-dialog';
import { BarcodeScanner } from '@/components/shared/barcode-scanner';

// ============================================================
// G1 — Bulk Stock Inward (CSV / OCR / manual multi-row)
// ============================================================
// A distributor invoice arrives with many lines whose names drift from the
// formulary ("Telmac 40 Tab" vs the on-file "Telmac 40"). Keyed in / pasted /
// CSV-imported, each mismatch silently splits stock into two part-counts. This
// wizard runs every incoming line through the fuzzy matcher, then forces a
// side-by-side "existing vs incoming" review so the user maps to the existing
// drug (no split) or knowingly creates a new one — before any stock is posted.

interface DraftLine {
  id: string;
  // 'drug' (medicine — matched to formulary, batch/expiry required) or 'item'
  // (any other supply — matched to inventory items, batch/expiry optional).
  kind: string;
  category: string;
  drugName: string;
  genericName: string;
  manufacturer: string;
  strength: string;
  // Product Resolution Engine: GTIN off the invoice/scan + HSN for compliance.
  gtin: string;
  hsnCode: string;
  // Department / rack / cold-chain bin this batch is shelved in (mandatory).
  storageLocation: string;
  batchNumber: string;
  expiryDate: string; // yyyy-MM-dd
  manufacturingDate: string;
  quantityReceived: string; // paid units
  freeQuantity: string;
  mrp: string;
  purchasePrice: string;
  purchaseDiscountPercent: string;
  gstPercent: string;
  sellingPrice: string;
}

interface Decision {
  action: 'map' | 'create';
  targetId: string | null;
}

type Step = 'entry' | 'review' | 'done';

let rowSeq = 0;
const nextId = () => `row-${++rowSeq}`;

// Per-line type. "Medicine" → drug (formulary + batches); anything else → a plain
// inventory item of that category (stock-count only).
const TYPE_OPTIONS = [
  { value: 'drug', label: 'Medicine' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'surgical_supply', label: 'Surgical' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

function emptyLine(): DraftLine {
  return {
    id: nextId(),
    kind: 'drug',
    category: '',
    drugName: '',
    genericName: '',
    manufacturer: '',
    strength: '',
    gtin: '',
    hsnCode: '',
    storageLocation: '',
    batchNumber: '',
    expiryDate: '',
    manufacturingDate: '',
    quantityReceived: '',
    freeQuantity: '',
    mrp: '',
    purchasePrice: '',
    purchaseDiscountPercent: '',
    gstPercent: '',
    sellingPrice: '',
  };
}

// ── CSV / paste parsing ─────────────────────────────────────
// Header synonyms a distributor CSV might use → our canonical field.
const HEADER_MAP: Record<string, keyof DraftLine> = {
  name: 'drugName', drug: 'drugName', product: 'drugName', item: 'drugName',
  description: 'drugName', medicine: 'drugName', particulars: 'drugName',
  generic: 'genericName', composition: 'genericName', salt: 'genericName',
  manufacturer: 'manufacturer', mfr: 'manufacturer', company: 'manufacturer', mfg_company: 'manufacturer',
  strength: 'strength', dose: 'strength', dosage: 'strength',
  gtin: 'gtin', barcode: 'gtin', ean: 'gtin', upc: 'gtin', gs1: 'gtin',
  hsn: 'hsnCode', hsn_code: 'hsnCode', hsncode: 'hsnCode',
  storage: 'storageLocation', storage_location: 'storageLocation', location: 'storageLocation',
  rack: 'storageLocation', shelf: 'storageLocation', bin: 'storageLocation', store: 'storageLocation',
  batch: 'batchNumber', batchno: 'batchNumber', batch_no: 'batchNumber', lot: 'batchNumber', bno: 'batchNumber',
  expiry: 'expiryDate', exp: 'expiryDate', exp_date: 'expiryDate', expiry_date: 'expiryDate', expdate: 'expiryDate',
  mfgdate: 'manufacturingDate', mfg_date: 'manufacturingDate', manufacturing_date: 'manufacturingDate',
  qty: 'quantityReceived', quantity: 'quantityReceived', units: 'quantityReceived', received: 'quantityReceived',
  free: 'freeQuantity', free_qty: 'freeQuantity', freeqty: 'freeQuantity',
  mrp: 'mrp',
  rate: 'purchasePrice', ptr: 'purchasePrice', purchase: 'purchasePrice', purchase_rate: 'purchasePrice', cost: 'purchasePrice', price: 'purchasePrice',
  disc: 'purchaseDiscountPercent', discount: 'purchaseDiscountPercent', disc_percent: 'purchaseDiscountPercent',
  gst: 'gstPercent', tax: 'gstPercent', gst_percent: 'gstPercent',
  sell: 'sellingPrice', selling: 'sellingPrice', sale: 'sellingPrice', sale_rate: 'sellingPrice', mrp_sale: 'sellingPrice',
};

// Default positional order when the pasted text has no recognisable header row.
const DEFAULT_ORDER: (keyof DraftLine)[] = [
  'drugName', 'batchNumber', 'expiryDate', 'quantityReceived', 'mrp', 'purchasePrice', 'gstPercent', 'sellingPrice',
];

const normHeader = (s: string) => s.trim().toLowerCase().replace(/[\s.]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

// Split a CSV/TSV line, honouring "quoted, fields".
function splitRow(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ;
    } else if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// Best-effort distributor expiry → yyyy-MM-dd. Handles MM/YY, MM/YYYY (→ end of
// month), dd/MM/yyyy, dd-MM-yyyy and yyyy-MM-dd. Unparseable → '' (user fixes it).
function parseExpiry(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
  let m = s.match(/^(\d{1,2})[/\-](\d{2,4})$/); // MM/YY or MM/YYYY
  if (m) {
    const mon = Math.min(12, Math.max(1, parseInt(m[1], 10)));
    let yr = parseInt(m[2], 10);
    if (yr < 100) yr += 2000;
    return `${yr}-${String(mon).padStart(2, '0')}-${String(lastDay(yr, mon)).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/); // dd/MM/yyyy
  if (m) {
    const d = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10);
    let yr = parseInt(m[3], 10);
    if (yr < 100) yr += 2000;
    return `${yr}-${String(mon).padStart(2, '0')}-${String(Math.min(d, lastDay(yr, mon))).padStart(2, '0')}`;
  }
  return '';
}

function parseTabular(text: string): DraftLine[] {
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  if (!rows.length) return [];
  const first = splitRow(rows[0]).map(normHeader);
  const hasHeader = first.some((h) => h in HEADER_MAP);
  const order: (keyof DraftLine | null)[] = hasHeader
    ? first.map((h) => HEADER_MAP[h] ?? null)
    : DEFAULT_ORDER;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const out: DraftLine[] = [];
  for (const r of dataRows) {
    const cells = splitRow(r);
    if (!cells.some((c) => c)) continue;
    const line = emptyLine();
    cells.forEach((cell, i) => {
      const field = order[i];
      if (!field || !cell) return;
      line[field] = field === 'expiryDate' || field === 'manufacturingDate' ? parseExpiry(cell) : cell;
    });
    if (line.drugName) out.push(line);
  }
  return out;
}

// Mapping target fields the user can assign each spreadsheet column to.
const MAP_FIELDS: { value: keyof DraftLine | 'ignore'; label: string }[] = [
  { value: 'drugName', label: 'Name' },
  { value: 'category', label: 'Type / Category' },
  { value: 'genericName', label: 'Generic' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'strength', label: 'Strength' },
  { value: 'batchNumber', label: 'Batch' },
  { value: 'expiryDate', label: 'Expiry' },
  { value: 'manufacturingDate', label: 'Mfg date' },
  { value: 'storageLocation', label: 'Storage' },
  { value: 'quantityReceived', label: 'Qty' },
  { value: 'freeQuantity', label: 'Free qty' },
  { value: 'mrp', label: 'MRP' },
  { value: 'purchasePrice', label: 'Purchase rate' },
  { value: 'purchaseDiscountPercent', label: 'Discount %' },
  { value: 'gstPercent', label: 'GST %' },
  { value: 'sellingPrice', label: 'Selling price' },
  { value: 'gtin', label: 'GTIN / barcode' },
  { value: 'hsnCode', label: 'HSN code' },
  { value: 'ignore', label: '— Ignore —' },
];

// Split a CSV/paste blob into a raw grid (no header interpretation yet).
function rowsFromText(text: string): string[][] {
  return text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean).map(splitRow);
}

// Read the first sheet of an .xlsx/.xls workbook into a raw grid.
async function rowsFromXlsx(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
  return grid.map((row) => (row ?? []).map((c) => (c == null ? '' : String(c).trim())));
}

// Guess a field for each column from its header text (when a header row exists).
function guessMapping(headerCells: string[]): (keyof DraftLine | 'ignore')[] {
  return headerCells.map((h) => HEADER_MAP[normHeader(h)] ?? 'ignore');
}

// Does a row look like a header (any cell maps to a known field)?
function looksLikeHeader(cells: string[]): boolean {
  return cells.some((h) => normHeader(h) in HEADER_MAP);
}

// Normalise a free-text type/category cell → { kind, category }.
function parseTypeCell(raw: string): { kind: string; category: string } {
  const v = raw.trim().toLowerCase();
  if (!v || ['drug', 'medicine', 'med', 'medicines', 'rx'].includes(v)) return { kind: 'drug', category: '' };
  if (v.startsWith('consum')) return { kind: 'item', category: 'consumable' };
  if (v.startsWith('surg')) return { kind: 'item', category: 'surgical_supply' };
  if (v.startsWith('equip')) return { kind: 'item', category: 'equipment' };
  return { kind: 'item', category: 'other' };
}

// Build draft lines from a raw grid + an explicit column→field mapping.
function buildLinesFromRows(
  rows: string[][],
  mapping: (keyof DraftLine | 'ignore')[],
  hasHeader: boolean,
): DraftLine[] {
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const out: DraftLine[] = [];
  for (const cells of dataRows) {
    if (!cells.some((c) => c && c.trim())) continue;
    const line = emptyLine();
    cells.forEach((cell, i) => {
      const field = mapping[i];
      if (!field || field === 'ignore' || !cell) return;
      if (field === 'category') {
        const t = parseTypeCell(cell);
        line.kind = t.kind;
        line.category = t.category;
      } else if (field === 'expiryDate' || field === 'manufacturingDate') {
        line[field] = parseExpiry(cell);
      } else {
        line[field] = cell;
      }
    });
    if (line.drugName.trim()) out.push(line);
  }
  return out;
}

export interface LineIssues {
  errors: string[];
  warnings: string[];
}

// Per-line pre-commit validation. Errors block the Match step; warnings are
// advisory (shown inline) so the user can proceed knowingly.
function validateLine(l: DraftLine, all: DraftLine[], defaultStorage: string): LineIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!l.drugName.trim()) return { errors, warnings }; // blank row — ignored
  const isItem = l.kind === 'item';

  const qty = parseInt(l.quantityReceived, 10);
  if (!l.quantityReceived.trim() || isNaN(qty) || qty <= 0) errors.push('Quantity must be greater than 0');

  if (!isItem) {
    if (!l.batchNumber.trim()) errors.push('Batch number is required');
    if (!l.expiryDate) errors.push('Expiry date is required');
    if (!l.storageLocation.trim() && !defaultStorage.trim()) errors.push('Storage location is required');
  }

  if (l.expiryDate) {
    const exp = new Date(l.expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!isNaN(exp.getTime())) {
      if (exp < today) warnings.push('Expiry date is in the past');
      else {
        const days = Math.floor((exp.getTime() - today.getTime()) / 86_400_000);
        if (days <= 90) warnings.push(`Expires in ${days} day${days === 1 ? '' : 's'}`);
      }
    }
    if (l.manufacturingDate && l.expiryDate < l.manufacturingDate) {
      errors.push('Expiry is before the manufacturing date');
    }
  }

  const rate = parseFloat(l.purchasePrice);
  const sell = parseFloat(l.sellingPrice);
  const mrp = parseFloat(l.mrp);
  if (!isNaN(sell) && !isNaN(rate) && sell < rate) warnings.push('Selling price is below the purchase rate');
  if (!isNaN(sell) && !isNaN(mrp) && sell > mrp) warnings.push('Selling price is above the MRP');

  // Duplicate batch within this import (same medicine + batch number).
  if (!isItem && l.batchNumber.trim()) {
    const key = (x: DraftLine) => `${x.drugName.trim().toLowerCase()}|${x.batchNumber.trim().toLowerCase()}`;
    if (all.some((o) => o.id !== l.id && o.kind !== 'item' && o.drugName.trim() && key(o) === key(l))) {
      warnings.push('Duplicate batch already in this list');
    }
  }

  return { errors, warnings };
}

const num = (s: string): number | undefined => {
  const n = parseFloat(s);
  return s.trim() !== '' && !isNaN(n) ? n : undefined;
};
const int = (s: string): number | undefined => {
  const n = parseInt(s, 10);
  return s.trim() !== '' && !isNaN(n) ? n : undefined;
};

// Product Resolution Engine badge — prefer how the line resolved (GTIN / learned
// distributor map) over the raw recommendation, so the user can see why a line
// auto-mapped without review.
function recBadge(line: Pick<InwardMatchedLine, 'recommendation' | 'resolvedVia' | 'confidence'>) {
  if (line.resolvedVia === 'gtin')
    return <Badge className="bg-teal-500/10 text-teal-700 border-teal-500/20">GTIN match</Badge>;
  if (line.resolvedVia === 'distributor_map')
    return <Badge className="bg-violet-500/10 text-violet-700 border-violet-500/20">Auto (learned)</Badge>;
  if (line.recommendation === 'map')
    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">Likely duplicate{line.confidence ? ` · ${line.confidence}%` : ''}</Badge>;
  if (line.recommendation === 'review')
    return <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">Possible match{line.confidence ? ` · ${line.confidence}%` : ''}</Badge>;
  return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">New</Badge>;
}

// The full Bulk Stock Inward wizard body (no dialog chrome) — usable on a page or
// inside a dialog. `onClose` is called by Cancel / Done to leave the flow.
export function BulkInwardPanel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('entry');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  // G2: whole-invoice (total-bill) purchase discount, on top of per-line discounts.
  const [invoiceDiscPct, setInvoiceDiscPct] = useState('');
  const [invoiceDiscAmt, setInvoiceDiscAmt] = useState('');
  const [addToExisting, setAddToExisting] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  const [matched, setMatched] = useState<InwardMatchedLine[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [result, setResult] = useState<CommitInwardResult | null>(null);

  // Mandatory storage location applied to any line that doesn't set its own.
  const [defaultStorage, setDefaultStorage] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const ocrRef = useRef<HTMLInputElement>(null);
  // Raw grid awaiting column mapping (from a CSV or Excel upload).
  const [mapRows, setMapRows] = useState<string[][] | null>(null);
  const { data: suppliersData } = useSuppliers({ limit: 100 });
  const suppliers = suppliersData?.data ?? [];
  const matchInward = useMatchInward();
  const commitInward = useCommitInward();
  const ocrInward = useOcrInward();
  const inwardScan = useInwardScan();

  const reset = () => {
    setStep('entry');
    setSupplierId('');
    setInvoiceNumber('');
    setInvoiceDate('');
    setInvoiceDiscPct('');
    setInvoiceDiscAmt('');
    setAddToExisting(false);
    setDefaultStorage('');
    setLines([emptyLine()]);
    setPasteText('');
    setShowPaste(false);
    setMatched([]);
    setDecisions([]);
    setResult(null);
  };

  const close = () => onClose();

  const updateLine = (id: string, field: keyof DraftLine, value: string) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (id: string) =>
    setLines((prev) => (prev.length === 1 ? [emptyLine()] : prev.filter((l) => l.id !== id)));

  const ingest = (text: string) => {
    const parsed = parseTabular(text);
    if (!parsed.length) {
      toast.error('No rows found. Check the format — one medicine per line.');
      return;
    }
    setLines((prev) => {
      const existing = prev.filter((l) => l.drugName.trim());
      return [...existing, ...parsed];
    });
    setPasteText('');
    setShowPaste(false);
    toast.success(`Loaded ${parsed.length} line${parsed.length === 1 ? '' : 's'}`);
  };

  // CSV upload → raw grid → column-mapping step (so any distributor layout maps).
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = rowsFromText(String(reader.result ?? ''));
      if (!rows.length) {
        toast.error('No rows found in the file.');
        return;
      }
      setMapRows(rows);
    };
    reader.readAsText(file);
  };

  // Excel (.xlsx/.xls) upload → first sheet → raw grid → column-mapping step.
  const onXlsxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const rows = await rowsFromXlsx(file);
      if (!rows.length) {
        toast.error('No rows found in the spreadsheet.');
        return;
      }
      setMapRows(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read the spreadsheet');
    }
  };

  // Confirmed column mapping → append the built draft lines to the grid.
  const applyMappedLines = (drafts: DraftLine[]) => {
    if (!drafts.length) {
      toast.error('No usable rows — check the column mapping (Name is required).');
      return;
    }
    setLines((prev) => {
      const existing = prev.filter((l) => l.drugName.trim());
      return [...existing, ...drafts];
    });
    setMapRows(null);
    toast.success(`Loaded ${drafts.length} line${drafts.length === 1 ? '' : 's'}`);
  };

  const s = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
  const ocrToDraft = (o: OcrInvoiceLine): DraftLine => ({
    id: nextId(),
    kind: 'drug',
    category: '',
    drugName: o.drugName ?? '',
    genericName: o.genericName ?? '',
    manufacturer: o.manufacturer ?? '',
    strength: o.strength ?? '',
    gtin: o.gtin ?? '',
    hsnCode: o.hsnCode ?? '',
    storageLocation: '',
    batchNumber: o.batchNumber ?? '',
    expiryDate: o.expiryDate ?? '',
    manufacturingDate: o.manufacturingDate ?? '',
    quantityReceived: s(o.quantityReceived),
    freeQuantity: s(o.freeQuantity),
    mrp: s(o.mrp),
    purchasePrice: s(o.purchasePrice),
    purchaseDiscountPercent: s(o.purchaseDiscountPercent),
    gstPercent: s(o.gstPercent),
    sellingPrice: s(o.sellingPrice),
  });

  // OCR: upload an invoice photo/PDF, seed the grid with the read lines, and let
  // the user verify + fill storage before matching. Matching is skipped here
  // (match=false) since the user reviews/edits the lines first.
  const onOcrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const res = await ocrInward.mutateAsync({ file, supplierId: supplierId || undefined, match: false });
      if (!res.lines.length) {
        toast.error(res.warnings[0] ?? 'No medicine lines could be read from this invoice.');
        return;
      }
      const drafts = res.lines.map(ocrToDraft);
      setLines((prev) => {
        const existing = prev.filter((l) => l.drugName.trim());
        return [...existing, ...drafts];
      });
      if (res.header.invoiceNumber) setInvoiceNumber(res.header.invoiceNumber);
      if (res.header.invoiceDate) setInvoiceDate(res.header.invoiceDate);
      if (!supplierId && res.header.supplierName) {
        const norm = res.header.supplierName.trim().toLowerCase();
        const m = suppliers.find(
          (sp) => sp.name.toLowerCase().includes(norm) || norm.includes(sp.name.toLowerCase()),
        );
        if (m) setSupplierId(m.id);
      }
      toast.success(`OCR read ${drafts.length} line${drafts.length === 1 ? '' : 's'} — verify and add storage before matching.`);
      res.warnings.slice(0, 4).forEach((w) => toast.warning(w));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read the invoice');
    }
  };

  // Scan a pack barcode / GS1 at stock entry → fill the last empty line (or add a
  // new one) with the resolved drug identity + batch/expiry read off the pack.
  const handleScan = async (code: string) => {
    const c = code.trim();
    if (!c) return;
    try {
      const res = await inwardScan.mutateAsync(c);
      const L = res.line;
      const seed: Omit<DraftLine, 'id'> = {
        kind: 'drug',
        category: '',
        drugName: L.drugName || '',
        genericName: L.genericName || '',
        manufacturer: L.manufacturer || '',
        strength: L.strength || '',
        gtin: L.gtin || res.gtin || '',
        hsnCode: L.hsnCode || '',
        storageLocation: '',
        batchNumber: L.batchNumber || '',
        expiryDate: L.expiryDate || '',
        manufacturingDate: L.manufacturingDate || '',
        quantityReceived: '',
        freeQuantity: '',
        mrp: '',
        purchasePrice: '',
        purchaseDiscountPercent: '',
        gstPercent: '',
        sellingPrice: '',
      };
      setLines((prev) => {
        const idx = prev.map((l) => l.drugName.trim()).lastIndexOf('');
        if (idx >= 0) return prev.map((l, i) => (i === idx ? { ...seed, id: l.id } : l));
        return [...prev, { ...seed, id: nextId() }];
      });
      if (res.resolvedVia === 'none' && !L.drugName) {
        toast.warning('Barcode not recognised — batch/expiry filled where possible; complete the line manually.');
      } else {
        const via =
          res.resolvedVia === 'formulary_gtin' ? 'in formulary'
            : res.resolvedVia === 'drugmaster_gtin' ? 'from catalog'
              : 'GS1 parsed';
        toast.success(
          `Scanned ${L.drugName || 'pack'} · ${via}${L.batchNumber ? ` · batch ${L.batchNumber}` : ''}`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed');
    }
  };

  // Validate + score the entered lines, then move to the review step.
  const handleMatch = async () => {
    const filled = lines.filter((l) => l.drugName.trim());
    if (!filled.length) return toast.error('Add at least one line');
    // Inline validation already flags each issue; block here as a safety net.
    if (blockingErrors > 0) return toast.error('Fix the highlighted issues before continuing');
    try {
      const res = await matchInward.mutateAsync({
        // Header supplier threads through so learned distributor mappings resolve.
        supplierId: supplierId || undefined,
        lines: filled.map((l) => ({
          drugName: l.drugName.trim(),
          genericName: l.genericName.trim() || undefined,
          manufacturer: l.manufacturer.trim() || undefined,
          strength: l.strength.trim() || undefined,
          gtin: l.gtin.trim() || undefined,
          kind: (l.kind === 'item' ? 'item' : 'drug') as 'drug' | 'item',
          category: l.kind === 'item' ? l.category || 'other' : undefined,
        })),
      });
      // Keep only the filled lines, in the matched order.
      setLines(filled);
      setMatched(res);
      setDecisions(
        res.map((m) => ({
          action: m.recommendation === 'create' ? 'create' : 'map',
          targetId: m.suggestedFormularyId,
        })),
      );
      setStep('review');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to match lines');
    }
  };

  const setDecision = (i: number, patch: Partial<Decision>) =>
    setDecisions((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const summary = useMemo(() => {
    let map = 0, create = 0;
    for (const d of decisions) {
      if (d.action === 'map') map++;
      else create++;
    }
    return { map, create };
  }, [decisions]);

  // G2: live purchase economics — gross → −per-line discount → −total-bill
  // discount → net (+GST = landing). Mirrors the backend fold so the user sees
  // both discounts applied before committing. Free units carry no purchase value.
  const purchaseTotals = useMemo(() => {
    let gross = 0, afterLine = 0;
    for (const l of lines) {
      const rate = parseFloat(l.purchasePrice) || 0;
      const paid = parseInt(l.quantityReceived, 10) || 0;
      const disc = parseFloat(l.purchaseDiscountPercent) || 0;
      gross += rate * paid;
      afterLine += rate * (1 - disc / 100) * paid;
    }
    const invPct = parseFloat(invoiceDiscPct) || 0;
    const invAmt = parseFloat(invoiceDiscAmt) || 0;
    const billPct = Math.min(100, invPct + (afterLine > 0 ? (invAmt / afterLine) * 100 : 0));
    const invoiceDisc = afterLine * (billPct / 100);
    const net = afterLine - invoiceDisc;
    let gst = 0;
    for (const l of lines) {
      const rate = parseFloat(l.purchasePrice) || 0;
      const paid = parseInt(l.quantityReceived, 10) || 0;
      const disc = parseFloat(l.purchaseDiscountPercent) || 0;
      const g = parseFloat(l.gstPercent) || 0;
      gst += rate * (1 - disc / 100) * (1 - billPct / 100) * paid * (g / 100);
    }
    return { gross, lineDisc: gross - afterLine, billPct, invoiceDisc, net, gst, landing: net + gst };
  }, [lines, invoiceDiscPct, invoiceDiscAmt]);

  // Per-line validation — errors block Match, warnings are advisory (shown inline).
  const lineIssues = useMemo(
    () => lines.map((l) => validateLine(l, lines, defaultStorage)),
    [lines, defaultStorage],
  );
  const blockingErrors = lineIssues.reduce((n, x) => n + x.errors.length, 0);

  const handleCommit = async () => {
    // Build the reviewed payload from each draft line + its decision.
    const payloadLines: CommitInwardLine[] = lines.map((l, i) => {
      const d = decisions[i];
      const paid = int(l.quantityReceived) ?? 0;
      const free = int(l.freeQuantity) ?? 0;
      const isItem = l.kind === 'item';
      return {
        action: d.action,
        kind: isItem ? 'item' : 'drug',
        category: isItem ? l.category || 'other' : undefined,
        // Map target routes by kind: a medicine maps to a formulary drug, an item
        // maps to an existing inventory item.
        targetFormularyId: !isItem && d.action === 'map' ? d.targetId ?? undefined : undefined,
        targetInventoryItemId: isItem && d.action === 'map' ? d.targetId ?? undefined : undefined,
        // Raw line text is the learned-mapping key; GTIN/HSN carry onto a new drug.
        externalName: l.drugName.trim(),
        drugName: l.drugName.trim(),
        genericName: l.genericName.trim() || undefined,
        manufacturer: l.manufacturer.trim() || undefined,
        strength: l.strength.trim() || undefined,
        gtin: l.gtin.trim() || undefined,
        hsnCode: l.hsnCode.trim() || undefined,
        // Storage applies to medicine batches only (items have no batch entity).
        storageLocation: isItem ? undefined : l.storageLocation.trim() || defaultStorage.trim() || undefined,
        batchNumber: l.batchNumber.trim() || undefined,
        expiryDate: l.expiryDate || undefined,
        manufacturingDate: l.manufacturingDate || undefined,
        // Total received = paid + free; the free portion is recorded separately.
        quantityReceived: paid + free,
        freeQuantity: free || undefined,
        mrp: num(l.mrp),
        purchasePrice: num(l.purchasePrice),
        purchaseDiscountPercent: num(l.purchaseDiscountPercent),
        gstPercent: num(l.gstPercent),
        sellingPrice: num(l.sellingPrice),
      };
    });

    // A map decision with no chosen target can't be honoured — block early.
    const orphan = payloadLines.findIndex(
      (l) => l.action === 'map' && !l.targetFormularyId && !l.targetInventoryItemId,
    );
    if (orphan >= 0) {
      return toast.error(`Pick an existing record to map "${payloadLines[orphan].drugName}" to, or switch it to "Create new".`);
    }

    try {
      const res = await commitInward.mutateAsync({
        supplierId: supplierId || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        invoiceDate: invoiceDate || undefined,
        invoiceDiscountPercent: num(invoiceDiscPct),
        invoiceDiscountAmount: num(invoiceDiscAmt),
        addToExisting,
        lines: payloadLines,
      });
      setResult(res);
      setStep('done');
      if (res.failed > 0) {
        toast.warning(`${res.batchesIn} line(s) posted, ${res.failed} failed`);
      } else {
        toast.success(`Stock inward complete — ${res.batchesIn} line(s) posted`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to commit inward');
    }
  };

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  return (
    <div className="flex flex-col gap-3">
      {mapRows && (
        <ColumnMappingDialog rows={mapRows} onClose={() => setMapRows(null)} onConfirm={applyMappedLines} />
      )}

      <p className="text-sm text-muted-foreground">
        {step === 'entry' &&
          'Key in, paste, or upload (CSV / Excel) a distributor invoice — medicines and other supplies alike. Each line is checked for an existing match before stock is posted, so the count never splits across near-duplicate names.'}
        {step === 'review' &&
          'Review each line. Map to an existing record to keep stock together, or create a new one. Compare incoming vs. existing side by side.'}
        {step === 'done' && 'Inward posted. Here is what happened to each line.'}
      </p>

      {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          {(['entry', 'review', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : (['entry', 'review', 'done'].indexOf(step) > i)
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
              <span className={cn('capitalize', step === s ? 'font-medium' : 'text-muted-foreground')}>
                {s === 'entry' ? 'Enter lines' : s}
              </span>
              {i < 2 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div>
          {step === 'entry' && (
            <EntryStep
              suppliers={suppliers}
              supplierId={supplierId}
              setSupplierId={setSupplierId}
              selectedSupplier={selectedSupplier}
              invoiceNumber={invoiceNumber}
              setInvoiceNumber={setInvoiceNumber}
              invoiceDate={invoiceDate}
              setInvoiceDate={setInvoiceDate}
              invoiceDiscPct={invoiceDiscPct}
              setInvoiceDiscPct={setInvoiceDiscPct}
              invoiceDiscAmt={invoiceDiscAmt}
              setInvoiceDiscAmt={setInvoiceDiscAmt}
              defaultStorage={defaultStorage}
              setDefaultStorage={setDefaultStorage}
              purchaseTotals={purchaseTotals}
              lines={lines}
              updateLine={updateLine}
              addLine={addLine}
              removeLine={removeLine}
              showPaste={showPaste}
              setShowPaste={setShowPaste}
              pasteText={pasteText}
              setPasteText={setPasteText}
              ingest={ingest}
              fileRef={fileRef}
              onFile={onFile}
              xlsxRef={xlsxRef}
              onXlsxFile={onXlsxFile}
              ocrRef={ocrRef}
              onOcrFile={onOcrFile}
              ocrPending={ocrInward.isPending}
              onScan={handleScan}
              scanPending={inwardScan.isPending}
              lineIssues={lineIssues}
            />
          )}

          {step === 'review' && (
            <ReviewStep lines={lines} matched={matched} decisions={decisions} setDecision={setDecision} />
          )}

          {step === 'done' && result && <DoneStep lines={lines} result={result} />}
        </div>

        <div className="flex items-center justify-end gap-2 border-t pt-3">
          {step === 'entry' && (
            <>
              {blockingErrors > 0 && (
                <span className="mr-auto text-xs font-medium text-red-600">
                  {blockingErrors} issue{blockingErrors === 1 ? '' : 's'} to fix
                </span>
              )}
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button onClick={handleMatch} disabled={matchInward.isPending || blockingErrors > 0}>
                {matchInward.isPending ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Checking…</>
                ) : (
                  <><Sparkles className="mr-1.5 h-4 w-4" /> Match &amp; Review</>
                )}
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
                <span>{summary.map} mapping to existing</span>·<span>{summary.create} new</span>
                <label className="ml-3 flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={addToExisting}
                    onChange={(e) => setAddToExisting(e.target.checked)}
                  />
                  If batch exists, add to it
                </label>
              </div>
              <Button variant="outline" onClick={() => setStep('entry')}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleCommit} disabled={commitInward.isPending}>
                {commitInward.isPending ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Posting…</>
                ) : (
                  <><PackageCheck className="mr-1.5 h-4 w-4" /> Commit Inward</>
                )}
              </Button>
            </>
          )}
          {step === 'done' && (
            <>
              <Button variant="outline" onClick={reset}>Receive more</Button>
              <Button onClick={close}>Done</Button>
            </>
          )}
        </div>
    </div>
  );
}

// Dialog wrapper around the bulk-inward wizard (kept for any popup callers).
export function BulkInwardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" /> Bulk Stock Inward
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
          {open && <BulkInwardPanel onClose={() => onOpenChange(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Step 1: enter / paste / upload lines ────────────────────
function EntryStep(props: {
  suppliers: { id: string; name: string }[];
  supplierId: string;
  setSupplierId: (v: string) => void;
  selectedSupplier: { gstNumber: string | null; licenseNumber: string | null; phone: string | null } | undefined;
  invoiceNumber: string;
  setInvoiceNumber: (v: string) => void;
  invoiceDate: string;
  setInvoiceDate: (v: string) => void;
  invoiceDiscPct: string;
  setInvoiceDiscPct: (v: string) => void;
  invoiceDiscAmt: string;
  setInvoiceDiscAmt: (v: string) => void;
  defaultStorage: string;
  setDefaultStorage: (v: string) => void;
  purchaseTotals: { gross: number; lineDisc: number; billPct: number; invoiceDisc: number; net: number; gst: number; landing: number };
  lines: DraftLine[];
  updateLine: (id: string, field: keyof DraftLine, value: string) => void;
  addLine: () => void;
  removeLine: (id: string) => void;
  showPaste: boolean;
  setShowPaste: (v: boolean) => void;
  pasteText: string;
  setPasteText: (v: string) => void;
  ingest: (text: string) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  xlsxRef: React.RefObject<HTMLInputElement | null>;
  onXlsxFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  ocrRef: React.RefObject<HTMLInputElement | null>;
  onOcrFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  ocrPending: boolean;
  onScan: (code: string) => void;
  scanPending: boolean;
  lineIssues: LineIssues[];
}) {
  const {
    suppliers, supplierId, setSupplierId, selectedSupplier, invoiceNumber, setInvoiceNumber,
    invoiceDate, setInvoiceDate, invoiceDiscPct, setInvoiceDiscPct, invoiceDiscAmt, setInvoiceDiscAmt,
    defaultStorage, setDefaultStorage,
    purchaseTotals, lines, updateLine, addLine, removeLine, showPaste, setShowPaste,
    pasteText, setPasteText, ingest, fileRef, onFile, xlsxRef, onXlsxFile,
    ocrRef, onOcrFile, ocrPending, onScan, lineIssues,
  } = props;
  const money = (n: number) => `₹${n.toFixed(2)}`;

  const cell = 'h-8 text-xs';
  const [addVendorOpen, setAddVendorOpen] = useState(false);

  return (
    <div className="space-y-4">
      <VendorFormDialog
        open={addVendorOpen}
        onOpenChange={setAddVendorOpen}
        onSaved={(v) => setSupplierId(v.id)}
      />
      {/* Header: vendor (G10 auto-fill) + invoice */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Supplier</Label>
            <button
              type="button"
              onClick={() => setAddVendorOpen(true)}
              className="text-[11px] text-primary hover:underline"
            >
              + New vendor
            </button>
          </div>
          <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? '')}>
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="Select supplier">
                {(value) => suppliers.find((s) => s.id === value)?.name ?? 'Select supplier'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s: { id: string; name: string }) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSupplier && (
            <p className="text-[11px] text-muted-foreground">
              {[selectedSupplier.gstNumber ? `GSTIN ${selectedSupplier.gstNumber}` : null,
                selectedSupplier.licenseNumber ? `DL ${selectedSupplier.licenseNumber}` : null,
                selectedSupplier.phone || null]
                .filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Invoice No.</Label>
          <Input className="h-9" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Supplier invoice no." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Invoice Date</Label>
          <Input className="h-9" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Default storage location *</Label>
          <Input
            className="h-9"
            value={defaultStorage}
            onChange={(e) => setDefaultStorage(e.target.value)}
            placeholder="e.g. Main store · Rack A3"
          />
          <p className="text-[11px] text-muted-foreground">Applied to every line that has no storage of its own.</p>
        </div>
      </div>

      {/* G2: total-bill purchase discount (whole invoice, on top of per-line) */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Bill discount %</Label>
          <Input
            className="h-9 w-28"
            type="number"
            step="0.01"
            min={0}
            max={100}
            value={invoiceDiscPct}
            onChange={(e) => setInvoiceDiscPct(e.target.value)}
            placeholder="0"
          />
        </div>
        <span className="pb-2 text-xs text-muted-foreground">or</span>
        <div className="space-y-1.5">
          <Label className="text-xs">Bill discount ₹</Label>
          <Input
            className="h-9 w-28"
            type="number"
            step="0.01"
            min={0}
            value={invoiceDiscAmt}
            onChange={(e) => setInvoiceDiscAmt(e.target.value)}
            placeholder="0.00"
          />
        </div>
        {purchaseTotals.gross > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>Gross: <span className="font-medium text-foreground">{money(purchaseTotals.gross)}</span></span>
            {purchaseTotals.lineDisc > 0 && (
              <span>− Line disc: <span className="font-medium text-foreground">{money(purchaseTotals.lineDisc)}</span></span>
            )}
            {purchaseTotals.invoiceDisc > 0 && (
              <span>− Bill disc: <span className="font-medium text-amber-700">{money(purchaseTotals.invoiceDisc)}</span></span>
            )}
            <span>Net: <span className="font-semibold text-foreground">{money(purchaseTotals.net)}</span></span>
            {purchaseTotals.gst > 0 && (
              <span>+ GST: <span className="font-medium text-foreground">{money(purchaseTotals.gst)}</span> = <span className="font-semibold text-foreground">{money(purchaseTotals.landing)}</span></span>
            )}
          </div>
        )}
      </div>

      {/* Import controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* OCR — read a photo/PDF of the supplier invoice into lines (Gemini). */}
        <Button size="sm" variant="outline" onClick={() => ocrRef.current?.click()} disabled={ocrPending}>
          {ocrPending ? (
            <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Reading invoice…</>
          ) : (
            <><Camera className="mr-1.5 h-4 w-4" /> Scan invoice (OCR)</>
          )}
        </Button>
        <input
          ref={ocrRef}
          type="file"
          accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={onOcrFile}
        />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> Upload CSV
        </Button>
        <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={onFile} />
        <Button size="sm" variant="outline" onClick={() => xlsxRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> Upload Excel
        </Button>
        <input
          ref={xlsxRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={onXlsxFile}
        />
        <Button size="sm" variant="outline" onClick={() => setShowPaste(!showPaste)}>
          <ClipboardPaste className="mr-1.5 h-4 w-4" /> Paste rows
        </Button>
        {/* Barcode / GS1 scan (USB scanner or phone camera) → fills a line with the
            resolved drug + batch + expiry in one scan. Keep scanning to add more. */}
        <div className="w-60">
          <BarcodeScanner onScan={onScan} placeholder="Scan barcode / GS1…" />
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-muted-foreground">
        Columns: name, batch, expiry, qty, mrp, rate, gst, sell, storage (a header row is auto-detected). Scan a pack to auto-fill a line.
      </p>

      {showPaste && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <Textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'Telmac 40 Tab, B23A01, 12/2026, 100, 85, 75, 12, 8.5\nPantop 40, P5512, 06/2027, 50, 120, 100, 12, 11'}
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => ingest(pasteText)} disabled={!pasteText.trim()}>
              <Plus className="mr-1.5 h-4 w-4" /> Add to table
            </Button>
          </div>
        </div>
      )}

      {/* Editable line table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1320px] text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th className="w-8">#</th>
              <th className="min-w-[150px]">Name *</th>
              <th className="min-w-[110px]">Type</th>
              <th>Strength</th>
              <th>Batch</th>
              <th>Expiry</th>
              <th className="min-w-[120px]">Storage</th>
              <th className="w-16">Qty *</th>
              <th className="w-14">Free</th>
              <th className="w-16">MRP</th>
              <th className="w-16">Rate</th>
              <th className="w-14">Disc%</th>
              <th className="w-16 text-right">Net</th>
              <th className="w-14">GST%</th>
              <th className="w-16">Sell</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const issue = lineIssues[i];
              const err = issue?.errors ?? [];
              const warn = issue?.warnings ?? [];
              return (
              <tr key={l.id} className="border-t [&>td]:px-1.5 [&>td]:py-1 align-top">
                <td className="px-2 py-2 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span>{i + 1}</span>
                    {err.length > 0 ? (
                      <span title={err.join('\n')} className="inline-flex">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      </span>
                    ) : warn.length > 0 ? (
                      <span title={warn.join('\n')} className="inline-flex">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <Input className={cell} value={l.drugName} onChange={(e) => updateLine(l.id, 'drugName', e.target.value)} placeholder="e.g. Telmac 40 Tab" />
                  <Input className={cn(cell, 'mt-1 text-muted-foreground')} value={l.genericName} onChange={(e) => updateLine(l.id, 'genericName', e.target.value)} placeholder="composition (optional)" />
                  {/* GTIN / barcode — auto-resolves the drug on the next import (Product Resolution Engine). */}
                  <Input className={cn(cell, 'mt-1 font-mono text-muted-foreground')} value={l.gtin} onChange={(e) => updateLine(l.id, 'gtin', e.target.value)} placeholder="GTIN / barcode (optional)" />
                </td>
                <td>
                  <Select
                    value={l.kind === 'item' ? (l.category || 'consumable') : 'drug'}
                    onValueChange={(v) => {
                      const val = v ?? 'drug';
                      if (val === 'drug') {
                        updateLine(l.id, 'kind', 'drug');
                        updateLine(l.id, 'category', '');
                      } else {
                        updateLine(l.id, 'kind', 'item');
                        updateLine(l.id, 'category', val);
                      }
                    }}
                  >
                    <SelectTrigger className={cn(cell, 'min-w-[104px]')}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td><Input className={cell} value={l.strength} onChange={(e) => updateLine(l.id, 'strength', e.target.value)} placeholder="40mg" /></td>
                <td><Input className={cell} value={l.batchNumber} onChange={(e) => updateLine(l.id, 'batchNumber', e.target.value)} placeholder={l.kind === 'item' ? 'optional' : 'B23A01'} /></td>
                <td><Input className={cn(cell, 'w-[130px]')} type="date" value={l.expiryDate} onChange={(e) => updateLine(l.id, 'expiryDate', e.target.value)} /></td>
                <td><Input className={cn(cell, 'min-w-[110px]')} value={l.storageLocation} onChange={(e) => updateLine(l.id, 'storageLocation', e.target.value)} placeholder={defaultStorage || 'Rack / Dept'} /></td>
                <td><Input className={cell} type="number" min={1} value={l.quantityReceived} onChange={(e) => updateLine(l.id, 'quantityReceived', e.target.value)} /></td>
                <td><Input className={cell} type="number" min={0} value={l.freeQuantity} onChange={(e) => updateLine(l.id, 'freeQuantity', e.target.value)} /></td>
                <td><Input className={cell} type="number" step="0.01" value={l.mrp} onChange={(e) => updateLine(l.id, 'mrp', e.target.value)} /></td>
                <td><Input className={cell} type="number" step="0.01" value={l.purchasePrice} onChange={(e) => updateLine(l.id, 'purchasePrice', e.target.value)} /></td>
                <td><Input className={cell} type="number" step="0.01" value={l.purchaseDiscountPercent} onChange={(e) => updateLine(l.id, 'purchaseDiscountPercent', e.target.value)} /></td>
                {/* G2: net purchase price (rate − line discount), per line */}
                <td className="px-2 text-right tabular-nums text-muted-foreground">
                  {(() => {
                    const r = parseFloat(l.purchasePrice);
                    if (!r || isNaN(r)) return '—';
                    const d = parseFloat(l.purchaseDiscountPercent) || 0;
                    return (r * (1 - d / 100)).toFixed(2);
                  })()}
                </td>
                <td><Input className={cell} type="number" step="0.01" value={l.gstPercent} onChange={(e) => updateLine(l.id, 'gstPercent', e.target.value)} /></td>
                <td><Input className={cell} type="number" step="0.01" value={l.sellingPrice} onChange={(e) => updateLine(l.id, 'sellingPrice', e.target.value)} /></td>
                <td className="text-center">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" onClick={() => removeLine(l.id)} title="Remove line">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button size="sm" variant="outline" onClick={addLine}>
        <Plus className="mr-1.5 h-4 w-4" /> Add line
      </Button>
    </div>
  );
}

// ── Step 2: side-by-side duplicate review ───────────────────
function ReviewStep({
  lines, matched, decisions, setDecision,
}: {
  lines: DraftLine[];
  matched: InwardMatchedLine[];
  decisions: Decision[];
  setDecision: (i: number, patch: Partial<Decision>) => void;
}) {
  return (
    <div className="space-y-3">
      {matched.map((m, i) => {
        const line = lines[i];
        const decision = decisions[i];
        const target = m.matches.find((x) => x.id === decision.targetId) ?? null;
        const hasMatches = m.matches.length > 0;
        return (
          <div key={i} className="rounded-lg border bg-surface-container-lowest p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground">#{i + 1}</span>
                <span className="truncate font-medium">{line.drugName}</span>
                {recBadge(m)}
              </div>
              {/* Map / Create toggle */}
              <div className="flex items-center gap-1 rounded-md border p-0.5">
                <button
                  type="button"
                  disabled={!hasMatches}
                  onClick={() => setDecision(i, { action: 'map', targetId: decision.targetId ?? m.matches[0]?.id ?? null })}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40',
                    decision.action === 'map' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  Map to existing
                </button>
                <button
                  type="button"
                  onClick={() => setDecision(i, { action: 'create' })}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    decision.action === 'create' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  Create new
                </button>
              </div>
            </div>

            {decision.action === 'map' ? (
              <div className="mt-3 space-y-2">
                {/* Candidate picker when >1 */}
                {m.matches.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.matches.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDecision(i, { targetId: c.id })}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                          decision.targetId === c.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted',
                        )}
                      >
                        {decision.targetId === c.id && <Check className="h-3 w-3 text-primary" />}
                        <span className="truncate max-w-[180px]">{c.drugName}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{c.score}%</Badge>
                      </button>
                    ))}
                  </div>
                )}
                {/* Side-by-side: incoming (invoice) vs existing (system) */}
                <CompareCards line={line} target={target} />
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Will be added as a new {line.kind === 'item' ? 'inventory item' : 'drug'}, then stocked.
                {hasMatches && ' (A similar record exists — switch to “Map to existing” to avoid splitting stock.)'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || '—'}</span>
    </div>
  );
}

function CompareCards({ line, target }: { line: DraftLine; target: FormularyMatch | null }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="rounded-md border border-dashed bg-muted/20 p-2.5 text-xs">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Incoming (invoice)</p>
        <div className="space-y-0.5">
          <Field label="Name" value={line.drugName} />
          <Field label="Composition" value={line.genericName} />
          <Field label="Manufacturer" value={line.manufacturer} />
          <Field label="Strength" value={line.strength} />
          <Field label="Receiving" value={`${(parseInt(line.quantityReceived, 10) || 0) + (parseInt(line.freeQuantity, 10) || 0)} units`} />
          <Field label="Storage" value={line.storageLocation} />
        </div>
      </div>
      <div className={cn('rounded-md border p-2.5 text-xs', target ? 'border-primary/40 bg-primary/5' : 'border-dashed')}>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Existing (in system)</p>
          {target && <Badge variant="outline" className="font-mono text-[10px]">{target.score}% match</Badge>}
        </div>
        {target ? (
          <div className="space-y-0.5">
            <Field label="Name" value={target.drugName} />
            <Field label="Composition" value={target.genericName} />
            <Field label="Manufacturer" value={target.manufacturer} />
            <Field label="Strength" value={target.strength} />
            <Field label="Current stock" value={<span className="text-emerald-700">{target.totalStock} units</span>} />
          </div>
        ) : (
          <p className="text-muted-foreground">No drug selected.</p>
        )}
      </div>
    </div>
  );
}

// ── Step 3: result summary ──────────────────────────────────
function DoneStep({ lines, result }: { lines: DraftLine[]; result: CommitInwardResult }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Lines" value={result.total} />
        <Stat label="Mapped" value={result.mappedDrugs} tone="primary" />
        <Stat label="New" value={result.createdDrugs} tone="emerald" />
        <Stat label="Failed" value={result.failed} tone={result.failed ? 'red' : undefined} />
      </div>
      {result.purchaseSummary && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          <span>Gross: <span className="font-medium text-foreground">₹{result.purchaseSummary.grossValue.toFixed(2)}</span></span>
          {result.purchaseSummary.lineDiscount > 0 && (
            <span>− Line disc: <span className="font-medium text-foreground">₹{result.purchaseSummary.lineDiscount.toFixed(2)}</span></span>
          )}
          {result.purchaseSummary.invoiceDiscount > 0 && (
            <span>− Bill disc ({result.purchaseSummary.invoiceDiscountPercent}%): <span className="font-medium text-amber-700">₹{result.purchaseSummary.invoiceDiscount.toFixed(2)}</span></span>
          )}
          <span>Net purchase: <span className="font-semibold text-foreground">₹{result.purchaseSummary.netValue.toFixed(2)}</span></span>
        </div>
      )}
      <div className="space-y-1.5">
        {result.results.map((r) => (
          <div
            key={r.index}
            className={cn(
              'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm',
              r.status === 'error' ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/20 bg-emerald-500/5',
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {r.status === 'ok' ? (
                <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <CircleX className="h-4 w-4 shrink-0 text-red-600" />
              )}
              <span className="truncate font-medium">{r.drugName || lines[r.index]?.drugName}</span>
              <Badge variant="outline" className="text-[10px] capitalize">{r.action}</Badge>
            </div>
            <span className={cn('text-xs', r.status === 'error' ? 'text-red-600' : 'text-muted-foreground')}>
              {r.status === 'ok' ? 'Stock posted' : r.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'primary' | 'emerald' | 'red' }) {
  return (
    <div className="rounded-lg bg-surface-container-lowest p-3 shadow-sanctuary">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn(
        'mt-0.5 text-2xl font-bold',
        tone === 'primary' && 'text-primary',
        tone === 'emerald' && 'text-emerald-700',
        tone === 'red' && 'text-red-700',
      )}>{value}</p>
    </div>
  );
}

// ── Column mapping — map an uploaded CSV/Excel sheet's columns to inward fields,
// preview the result, then add the lines. Handles any distributor layout. ──────
function ColumnMappingDialog({
  rows,
  onClose,
  onConfirm,
}: {
  rows: string[][];
  onClose: () => void;
  onConfirm: (lines: DraftLine[]) => void;
}) {
  const colCount = Math.max(0, ...rows.map((r) => r.length));
  const [hasHeader, setHasHeader] = useState(() => looksLikeHeader(rows[0] ?? []));
  const [mapping, setMapping] = useState<(keyof DraftLine | 'ignore')[]>(() => {
    const base = looksLikeHeader(rows[0] ?? [])
      ? guessMapping(rows[0] ?? [])
      : (DEFAULT_ORDER as (keyof DraftLine | 'ignore')[]);
    return Array.from({ length: colCount }, (_, i) => base[i] ?? 'ignore');
  });

  const setCol = (i: number, v: keyof DraftLine | 'ignore') =>
    setMapping((prev) => prev.map((m, idx) => (idx === i ? v : m)));

  const headerRow = rows[0] ?? [];
  const previewData = (hasHeader ? rows.slice(1) : rows).slice(0, 5);
  const built = useMemo(() => buildLinesFromRows(rows, mapping, hasHeader), [rows, mapping, hasHeader]);
  const hasName = mapping.includes('drugName');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Map columns</DialogTitle>
          <DialogDescription>
            Match each column to a field — we auto-detected what we could. Adjust anything that looks off, then add the rows. Use “Type / Category” to mark a column that says whether a row is a medicine or another supply.
          </DialogDescription>
        </DialogHeader>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-primary"
            checked={hasHeader}
            onChange={(e) => setHasHeader(e.target.checked)}
          />
          First row is a header
        </label>

        <div className="flex-1 overflow-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/70">
              <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:align-top">
                {Array.from({ length: colCount }).map((_, i) => (
                  <th key={i} className="min-w-[150px]">
                    <Select
                      value={mapping[i] ?? 'ignore'}
                      onValueChange={(v) => setCol(i, (v ?? 'ignore') as keyof DraftLine | 'ignore')}
                    >
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MAP_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hasHeader && headerRow[i] && (
                      <div className="mt-1 truncate text-[10px] font-normal text-muted-foreground" title={headerRow[i]}>
                        {headerRow[i]}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.map((r, ri) => (
                <tr key={ri} className="border-t [&>td]:px-2 [&>td]:py-1">
                  {Array.from({ length: colCount }).map((_, ci) => (
                    <td
                      key={ci}
                      className={cn('max-w-[170px] truncate', mapping[ci] === 'ignore' && 'text-muted-foreground/40')}
                    >
                      {r[ci] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="items-center gap-2">
          <span className="mr-auto text-xs text-muted-foreground">
            {built.length} line{built.length === 1 ? '' : 's'} ready
            {!hasName && ' · map a “Name” column to continue'}
          </span>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(built)} disabled={!hasName || built.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" /> Add {built.length} line{built.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
