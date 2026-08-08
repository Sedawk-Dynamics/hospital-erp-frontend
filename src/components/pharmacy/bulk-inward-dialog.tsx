'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  Check,
  Loader2,
  PackageCheck,
  ClipboardPaste,
  Sparkles,
  CircleCheck,
  CircleX,
  Camera,
  ChevronDown,
  ChevronRight,
  Search,
  Undo2,
  FileCheck,
  X,
  Printer,
  Eye,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Barcode,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { downloadCsv } from '@/lib/csv';
import { BarcodeViewDialog } from '@/components/pharmacy/barcode-view-dialog';
import {
  useMatchInward,
  useCommitInward,
  useBatchLabels,
  useOcrInward,
  useInwardScan,
  useFormulary,
  type InwardMatchedLine,
  type CommitInwardLine,
  type CommitInwardResult,
  type FormularyMatch,
  type OcrInvoiceLine,
  type InwardScanResult,
} from '@/hooks/use-pharmacy';
import { useSuppliers, usePurchaseOrders, usePurchaseOrder, useReconcilePurchaseOrder, type PurchaseOrder } from '@/hooks/use-inventory';
import { useHospitalBranding } from '@/hooks/use-hospital-branding';
import { useAiStatus } from '@/hooks/use-ai';
import { useDrugMasterSearch, useHsnGstRates, matchHsnGstRate, type HsnGstRate } from '@/hooks/use-drug-master';
import { VendorFormDialog } from '@/components/inventory/vendor-form-dialog';
import { BarcodeScanner } from '@/components/shared/barcode-scanner';
import { apiGet } from '@/lib/api';

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
  // The ORIGINAL name the pharmacist typed / imported for this line, captured
  // once at first match and never mutated by a catalog pick or a re-match. This
  // is the learned-mapping key, so "lolo" → "Loloxy" is remembered under "lolo".
  rawName?: string;
  genericName: string;
  // Salt composition — a DIFFERENT field from genericName on the formulary.
  // Read-only and DB-sourced, like strength/GTIN: it is adopted from the
  // medicine the line resolves to, never typed or imported.
  composition: string;
  manufacturer: string;
  // Full product-definition fields ("New Item" parity), edited in the row's
  // expandable detail panel and carried onto a newly-created product.
  dosageForm: string;
  packSize: string;
  unit: string;
  minStock: string;
  description: string;
  strength: string;
  // Product Resolution Engine: GTIN off the invoice/scan + HSN for compliance.
  gtin: string;
  hsnCode: string;
  // Set when this line is LINKED to a DrugMaster catalog drug (create-from-catalog).
  // The boxes are NOT overwritten — the new formulary row is built from the master
  // at commit. `catalogPickName` is display-only (which catalog drug it will create).
  drugMasterId?: string;
  catalogPickName?: string;
  // The scanned/typed identity captured before a catalog pick overwrote it, so
  // the user can "Undo" back to the original scanned name. (Legacy — kept for
  // barcode/scan flows that still adopt catalog identity.)
  catalogBackup?: {
    drugName: string; genericName: string; manufacturer: string; strength: string;
    dosageForm: string; packSize: string; hsnCode: string; gtin: string;
  };
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

// Column-mappable text fields of a draft line — excludes the structured
// `catalogBackup` (a nested object), which is never set via CSV/column mapping.
type DraftCol = Exclude<keyof DraftLine, 'catalogBackup' | 'catalogPickName' | 'rawName'>;

// Normalised shape a catalog drug (auto-match chip OR free search result) is
// adopted onto a line as.
interface CatalogPick {
  drugMasterId: string;
  drugName: string;
  genericName?: string | null;
  composition?: string | null;
  manufacturer?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  packSize?: number | null;
  hsnCode?: string | null;
  gtin?: string | null;
}

// Entry + inline match happen on ONE screen; an imported file gets its own
// full-width review step (fix the sheet before it becomes lines), and the result
// is the last step.
type Step = 'entry' | 'map' | 'done';

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

const DOSAGE_FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other'];

// A flattened PO line used to CHECK an entered invoice line against the order
// (the user types what actually arrived; we only compare — never prefill).
interface PoLineRef {
  id: string;
  name: string;
  orderedQty: number;
  alreadyReceived: number;
  unitPrice?: number;
}
// Match an entered line to a PO line by name: exact (normalised) first, else a
// containment match so "Telma 40" ↔ "Telma 40 Tab" still line up.
function matchPoLine(lineName: string, poItems: PoLineRef[]): PoLineRef | null {
  const n = lineName.trim().toLowerCase();
  if (!n || poItems.length === 0) return null;
  return (
    poItems.find((p) => p.name.trim().toLowerCase() === n) ??
    poItems.find((p) => {
      const pn = p.name.trim().toLowerCase();
      return pn.length > 2 && (pn.includes(n) || n.includes(pn));
    }) ??
    null
  );
}

function emptyLine(): DraftLine {
  return {
    id: nextId(),
    kind: 'drug',
    category: '',
    dosageForm: '',
    packSize: '',
    unit: '',
    minStock: '',
    description: '',
    drugName: '',
    genericName: '',
    composition: '',
    manufacturer: '',
    strength: '',
    gtin: '',
    hsnCode: '',
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
const HEADER_MAP: Record<string, DraftCol> = {
  name: 'drugName', drug: 'drugName', product: 'drugName', item: 'drugName',
  description: 'drugName', medicine: 'drugName', particulars: 'drugName',
  // Medicine vs consumable/surgical/equipment. Routed through `parseTypeCell`,
  // which turns the text into { kind, category } — see buildLinesFromRows.
  type: 'category', category: 'category', kind: 'category', item_type: 'category',
  // NOTE: composition (generic), strength and GTIN are deliberately NOT imported
  // — they are properties of the mapped medicine in OUR database, filled from the
  // drug the line is mapped to, never from an invoice / sheet / OCR. See the
  // read-only fields in the entry grid.
  manufacturer: 'manufacturer', mfr: 'manufacturer', company: 'manufacturer', mfg_company: 'manufacturer',
  hsn: 'hsnCode', hsn_code: 'hsnCode', hsncode: 'hsnCode',
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
  form: 'dosageForm', dosage_form: 'dosageForm', dosageform: 'dosageForm',
  pack: 'packSize', packsize: 'packSize', pack_size: 'packSize',
  unit: 'unit', uom: 'unit', unit_of_measurement: 'unit',
  reorder: 'minStock', minstock: 'minStock', min_stock: 'minStock', reorder_level: 'minStock', reorderlevel: 'minStock',
};

// Default positional order when the pasted text has no recognisable header row.
const DEFAULT_ORDER: (DraftCol)[] = [
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
  const order: (DraftCol | null)[] = hasHeader
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

// Which rows the import-review filter is showing.
type RowFilter = 'all' | 'issues' | 'new' | 'review';

// Mapping target fields the user can assign each spreadsheet column to.
const MAP_FIELDS: { value: DraftCol | 'ignore'; label: string }[] = [
  { value: 'drugName', label: 'Name' },
  { value: 'category', label: 'Type / Category' },
  // Generic / Strength / GTIN are NOT mappable — they come from the mapped
  // medicine in our database, not from the imported sheet.
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'dosageForm', label: 'Dosage form' },
  { value: 'packSize', label: 'Pack size' },
  { value: 'unit', label: 'Unit' },
  { value: 'minStock', label: 'Reorder level' },
  { value: 'description', label: 'Description' },
  { value: 'batchNumber', label: 'Batch' },
  { value: 'expiryDate', label: 'Expiry' },
  { value: 'manufacturingDate', label: 'Mfg date' },
  { value: 'quantityReceived', label: 'Qty' },
  { value: 'freeQuantity', label: 'Free qty' },
  { value: 'mrp', label: 'MRP' },
  { value: 'purchasePrice', label: 'Purchase rate' },
  { value: 'purchaseDiscountPercent', label: 'Discount %' },
  { value: 'gstPercent', label: 'GST %' },
  { value: 'sellingPrice', label: 'Selling price' },
  { value: 'hsnCode', label: 'HSN code' },
  { value: 'ignore', label: '— Ignore —' },
];

// ── Vendor import template ──────────────────────────────────
// The sheet we hand a vendor to fill in and send back. Every header here is
// chosen so `normHeader` + HEADER_MAP resolve it automatically — a returned file
// maps itself with no manual column work. Two deliberate constraints:
//   • no "Description" column: distributors use that word for the product NAME,
//     and HEADER_MAP aliases it to drugName, so it would fight the Name column;
//   • no "%" or unit suffixes in headers ("Discount", not "Discount %") —
//     normHeader keeps '%', which would miss the alias.
// Keep this list and HEADER_MAP in step: every header must resolve.
interface TemplateCol {
  header: string;
  required?: boolean;
  hint: string;
  samples: [string, string];
}

const TEMPLATE_COLUMNS: TemplateCol[] = [
  { header: 'Type', hint: 'Medicine (default if blank), Consumable, Surgical or Equipment.', samples: ['Medicine', 'Consumable'] },
  { header: 'Name', required: true, hint: 'REQUIRED. Product name as printed on your invoice. A row with no Name is skipped.', samples: ['Telmac 40 Tab', 'Nitrile Gloves M'] },
  // Composition / Strength / GTIN are NOT imported — they come from the medicine
  // in our database once the line is mapped, so they are left out of the template.
  { header: 'Manufacturer', hint: 'Brand / manufacturing company.', samples: ['Cipla', 'Safeguard'] },
  { header: 'Dosage Form', hint: 'tablet, capsule, syrup, injection, cream, drops, inhaler, other.', samples: ['tablet', ''] },
  { header: 'Pack Size', hint: 'Units per pack, e.g. 10 for a strip of 10.', samples: ['10', '100'] },
  { header: 'Unit', hint: 'Loose unit label, e.g. tablet, ml, piece.', samples: ['tablet', 'piece'] },
  { header: 'HSN', hint: 'HSN code (tax classification).', samples: ['30049099', '40151900'] },
  { header: 'Batch', hint: 'Batch / lot number. Required for a medicine when Qty is filled.', samples: ['B23A01', ''] },
  { header: 'Expiry', hint: 'MM/YYYY or DD/MM/YYYY, e.g. 12/2026. Required for a medicine when Qty is filled.', samples: ['12/2026', ''] },
  { header: 'Mfg Date', hint: 'MM/YYYY or DD/MM/YYYY. Optional.', samples: ['01/2024', ''] },
  { header: 'Qty', hint: 'Units supplied (paid). Leave blank to only register the product without receiving stock.', samples: ['100', '50'] },
  { header: 'Free Qty', hint: 'Free units supplied on top of Qty.', samples: ['10', ''] },
  { header: 'MRP', hint: 'Maximum retail price per unit.', samples: ['85', ''] },
  { header: 'Rate', hint: 'Your purchase rate / PTR per unit.', samples: ['75', '4.5'] },
  { header: 'Discount', hint: 'Per-line discount PERCENT (number only, no % sign).', samples: ['5', ''] },
  { header: 'GST', hint: 'GST PERCENT (number only, no % sign).', samples: ['12', '18'] },
  { header: 'Selling', hint: 'Selling price per unit.', samples: ['82', ''] },
  { header: 'Reorder Level', hint: 'Alert us when stock falls below this.', samples: ['20', '200'] },
];

const TEMPLATE_FILE_BASE = 'stock-import-template';

/** Header row + two example rows (the vendor replaces the examples). */
function templateAoa(): string[][] {
  return [
    TEMPLATE_COLUMNS.map((c) => c.header),
    TEMPLATE_COLUMNS.map((c) => c.samples[0]),
    TEMPLATE_COLUMNS.map((c) => c.samples[1]),
  ];
}

function templateInstructionsAoa(): string[][] {
  return [
    ['How to fill this sheet'],
    [],
    ['1.', 'Enter one product per row on the "Stock" sheet.'],
    ['2.', 'Replace the two example rows — they are only there to show the format.'],
    ['3.', 'Only "Name" is mandatory. Leave anything you do not know blank.'],
    ['4.', 'Do not rename, reorder or delete the header row — it is what we read.'],
    ['5.', 'Leave "Qty" blank to just list a product without supplying stock.'],
    ['6.', 'Send the file back as .xlsx or .csv.'],
    [],
    ['Column', 'What to put in it'],
    ...TEMPLATE_COLUMNS.map((c) => [c.header + (c.required ? ' *' : ''), c.hint]),
  ];
}

/** Excel template. The data sheet MUST be first — the reader takes sheet 1. */
function downloadTemplateXlsx(): void {
  const wb = XLSX.utils.book_new();
  const data = XLSX.utils.aoa_to_sheet(templateAoa());
  data['!cols'] = TEMPLATE_COLUMNS.map((c) => ({ wch: Math.max(12, c.header.length + 3) }));
  XLSX.utils.book_append_sheet(wb, data, 'Stock');
  const notes = XLSX.utils.aoa_to_sheet(templateInstructionsAoa());
  notes['!cols'] = [{ wch: 16 }, { wch: 96 }];
  XLSX.utils.book_append_sheet(wb, notes, 'Instructions');
  XLSX.writeFile(wb, `${TEMPLATE_FILE_BASE}.xlsx`);
}

/** CSV template — same columns, so it round-trips through the same parser. */
function downloadTemplateCsv(): void {
  const [headers, ...sampleRows] = templateAoa();
  const rows = sampleRows.map((cells) =>
    Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])),
  );
  downloadCsv(`${TEMPLATE_FILE_BASE}.csv`, rows);
}

// Split a CSV/paste blob into a raw grid (no header interpretation yet).
function rowsFromText(text: string): string[][] {
  return text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean).map(splitRow);
}

// Read the first sheet of an .xlsx/.xls workbook into a raw grid.
// `cellDates` matters: without it a real date cell (a vendor typing 12/2026 into
// the template, which Excel silently converts to a date) arrives as a numeric
// serial like "45658", which parseExpiry can't read and would blank. With it we
// get a Date and hand parseExpiry the yyyy-MM-dd it understands.
async function rowsFromXlsx(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
  return grid.map((row) =>
    (row ?? []).map((c) => {
      if (c == null) return '';
      if (c instanceof Date) return isoDate(c);
      return String(c).trim();
    }),
  );
}

/** A Date → yyyy-MM-dd in local time (Excel dates carry no timezone). */
function isoDate(d: Date): string {
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Guess a field for each column from its header text (when a header row exists).
function guessMapping(headerCells: string[]): (DraftCol | 'ignore')[] {
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
  mapping: (DraftCol | 'ignore')[],
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

// Equipment has no shelf life. A batch row still needs an expiry, so we stamp a
// far-future one instead of forcing the user to make a date up.
const NO_EXPIRY = '2099-12-31';
const isEquipment = (l: Pick<DraftLine, 'kind' | 'category'>) =>
  l.kind === 'item' && l.category === 'equipment';

// Per-line pre-commit validation. Errors block the Match step; warnings are
// advisory (shown inline) so the user can proceed knowingly.
function validateLine(l: DraftLine, all: DraftLine[]): LineIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!l.drugName.trim()) return { errors, warnings }; // blank row — ignored
  const isItem = l.kind === 'item';

  // Quantity is optional — blank just registers the product (no stock received).
  // If given it must be a positive whole number.
  const qty = parseInt(l.quantityReceived, 10);
  const receiving = l.quantityReceived.trim() !== '' && !isNaN(qty) && qty > 0;
  if (l.quantityReceived.trim() !== '' && (isNaN(qty) || qty <= 0)) {
    errors.push('Quantity must be greater than 0 (or leave blank to just add the product)');
  }

  // Every type is stocked as a batch now (so it can be sold/tracked like a
  // medicine), so batch + expiry are required whenever stock is received.
  // Equipment is the exception — it doesn't expire, so rather than make the user
  // invent a date we default a far-future one at commit.
  if (receiving) {
    if (!l.batchNumber.trim()) errors.push('Batch number is required to receive stock');
    if (!l.expiryDate && !isEquipment(l)) errors.push('Expiry date is required to receive stock');
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
  if (line.resolvedVia === 'mapping')
    return <Badge className="bg-violet-500/10 text-violet-700 border-violet-500/20">Remembered</Badge>;
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

  const fileRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const ocrRef = useRef<HTMLInputElement>(null);
  // Raw grid awaiting column mapping (from a CSV or Excel upload).
  const [mapRows, setMapRows] = useState<string[][] | null>(null);
  const { data: suppliersData } = useSuppliers({ limit: 100 });
  const suppliers = suppliersData?.data ?? [];
  const { data: branding } = useHospitalBranding();

  // ── Purchase-Order CHECK (not prefill) ──────────────────────
  // The user enters the received invoice themselves (OCR / datasheet / manual);
  // picking a PO only lets us CHECK those lines against what was ordered — we
  // match entered lines to PO lines by name and show the variance. We never
  // overwrite what the user typed.
  const [poId, setPoId] = useState('');
  const { data: poListData } = usePurchaseOrders({ limit: 50 });
  // Only POs still awaiting delivery are worth checking against.
  const openPOs = useMemo(
    () => (poListData?.data ?? []).filter((p) => p.status === 'approved' || p.status === 'submitted' || p.status === 'partially_delivered'),
    [poListData],
  );
  const { data: poDetail } = usePurchaseOrder(poId || null);
  const poNumber = poDetail?.id === poId ? poDetail?.orderNumber ?? '' : '';
  // Flatten the loaded PO into comparable lines (name + ordered/received/price).
  const poItems: PoLineRef[] = useMemo(() => {
    if (!poDetail || poDetail.id !== poId) return [];
    return (poDetail.items ?? []).map((it) => ({
      id: it.id,
      name: it.drug?.drugName ?? it.inventoryItem?.itemName ?? '(item)',
      orderedQty: it.quantityOrdered,
      alreadyReceived: it.quantityReceived,
      unitPrice: it.unitPrice != null ? Number(it.unitPrice) : undefined,
    }));
  }, [poDetail, poId]);
  const reconcilePO = useReconcilePurchaseOrder();
  // The PO after it's been updated from this inward (shown on the Done step).
  const [reconciled, setReconciled] = useState<PurchaseOrder | null>(null);

  // "View PO" on the Done step — prefer the freshly reconciled order so the
  // user sees the updated received/outstanding figures.
  const [poViewDoneOpen, setPoViewDoneOpen] = useState(false);
  const donePo = reconciled ?? (poDetail?.id === poId ? poDetail : null);
  const donePoItems: PoLineRef[] = useMemo(
    () =>
      (donePo?.items ?? []).map((it) => ({
        id: it.id,
        name: it.drug?.drugName ?? it.inventoryItem?.itemName ?? '(item)',
        orderedQty: it.quantityOrdered,
        alreadyReceived: it.quantityReceived,
        unitPrice: it.unitPrice != null ? Number(it.unitPrice) : undefined,
      })),
    [donePo],
  );

  const clearPO = () => setPoId('');

  const matchInward = useMatchInward();
  const commitInward = useCommitInward();
  const ocrInward = useOcrInward();
  // Super-admin can disable invoice OCR per hospital; hide the affordance when off.
  const { data: aiStatus } = useAiStatus();
  const ocrEnabled = !aiStatus || aiStatus.features.ocrInvoice;
  const inwardScan = useInwardScan();

  const reset = () => {
    setStep('entry');
    setMapRows(null);
    setSupplierId('');
    setInvoiceNumber('');
    setInvoiceDate('');
    setInvoiceDiscPct('');
    setInvoiceDiscAmt('');
    setAddToExisting(false);
    setLines([emptyLine()]);
    setPoId('');
    setReconciled(null);
    setPasteText('');
    setShowPaste(false);
    setMatched([]);
    setDecisions([]);
    setResult(null);
  };

  const close = () => onClose();

  const updateLine = (id: string, field: DraftCol, value: string) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));

  // HSN → GST tax master. HSN legally determines the GST rate in India, so
  // changing a line's HSN keeps its GST in sync. Derives a rate for a line's
  // HSN too.
  const { data: hsnRates = [] } = useHsnGstRates();
  const gstForHsn = (code: string): string => {
    const hit = matchHsnGstRate(code, hsnRates);
    return hit ? String(hit.gstRate) : '';
  };
  const applyHsn = (id: string, value: string) =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, hsnCode: value };
        // HSN legally determines the GST rate, so whenever the entered HSN
        // resolves to a known rate, set GST to it. An unrecognised / half-typed
        // HSN resolves to nothing and leaves GST untouched, so a manually keyed
        // rate for an HSN not in the master survives.
        const newGst = gstForHsn(value);
        if (newGst) next.gstPercent = newGst;
        return next;
      }),
    );
  // Imported/pasted rows should behave like typed ones: fill a blank GST from
  // each line's HSN so the rate shows in the grid immediately (the backend also
  // derives it at commit, but this makes the auto-fill visible up front).
  const withDerivedGst = (drafts: DraftLine[]): DraftLine[] =>
    drafts.map((l) => {
      if (l.gstPercent.trim() || !l.hsnCode.trim()) return l;
      const gst = gstForHsn(l.hsnCode);
      return gst ? { ...l, gstPercent: gst } : l;
    });

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (id: string) =>
    setLines((prev) => (prev.length === 1 ? [emptyLine()] : prev.filter((l) => l.id !== id)));

  const ingest = async (text: string) => {
    const parsed = parseTabular(text);
    if (!parsed.length) {
      toast.error('No rows found. Check the format — one medicine per line.');
      return;
    }
    const combined = [...lines.filter((l) => l.drugName.trim()), ...withDerivedGst(await resolveGtinsForDrafts(parsed))];
    setLines(combined);
    setPasteText('');
    setShowPaste(false);
    toast.success(`Loaded ${parsed.length} line${parsed.length === 1 ? '' : 's'} — matching against your formulary…`);
    // Same as OCR: score the rows immediately so each shows its formulary
    // matches (or "not in your master data" + the catalog picker) inline.
    // `combined` is passed explicitly — React state hasn't settled yet.
    void handleMatch(combined);
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
      setStep('map');
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
      setStep('map');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read the spreadsheet');
    }
  };

  // Confirmed column mapping → append the built draft lines to the grid.
  const applyMappedLines = async (drafts: DraftLine[]) => {
    if (!drafts.length) {
      toast.error('No usable rows — check the column mapping (Name is required).');
      return;
    }
    const combined = [...lines.filter((l) => l.drugName.trim()), ...withDerivedGst(await resolveGtinsForDrafts(drafts))];
    setLines(combined);
    setMapRows(null);
    setStep('entry');
    toast.success(`Loaded ${drafts.length} line${drafts.length === 1 ? '' : 's'} — matching against your formulary…`);
    // Same as OCR: an imported file goes straight into the review, so every row
    // shows its formulary match (or "not in your master data" + catalog picker).
    void handleMatch(combined);
  };

  const s = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
  const ocrToDraft = (o: OcrInvoiceLine): DraftLine => ({
    id: nextId(),
    kind: 'drug',
    category: '',
    // Auto-filled from the scanned invoice (editable in the line's detail panel).
    dosageForm: o.dosageForm ?? '',
    packSize: s(o.packSize),
    unit: o.unit ?? '',
    minStock: '',
    description: '',
    drugName: o.drugName ?? '',
    // Composition / strength / GTIN are DB-sourced (filled from the mapped
    // medicine), never from the scanned invoice — leave blank here.
    genericName: '',
    composition: '',
    manufacturer: o.manufacturer ?? '',
    strength: '',
    gtin: '',
    hsnCode: o.hsnCode ?? '',
    batchNumber: o.batchNumber ?? '',
    expiryDate: o.expiryDate ?? '',
    manufacturingDate: o.manufacturingDate ?? '',
    quantityReceived: s(o.quantityReceived),
    freeQuantity: s(o.freeQuantity),
    mrp: s(o.mrp),
    purchasePrice: s(o.purchasePrice),
    purchaseDiscountPercent: s(o.purchaseDiscountPercent),
    // Prefer the GST printed on the invoice; else derive it from the read HSN.
    gstPercent: s(o.gstPercent) || gstForHsn(o.hsnCode ?? ''),
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
      const combined = [...lines.filter((l) => l.drugName.trim()), ...drafts];
      setLines(combined);
      if (res.header.invoiceNumber) setInvoiceNumber(res.header.invoiceNumber);
      if (res.header.invoiceDate) setInvoiceDate(res.header.invoiceDate);
      if (!supplierId && res.header.supplierName) {
        const norm = res.header.supplierName.trim().toLowerCase();
        const m = suppliers.find(
          (sp) => sp.name.toLowerCase().includes(norm) || norm.includes(sp.name.toLowerCase()),
        );
        if (m) setSupplierId(m.id);
      }
      toast.success(`OCR read ${drafts.length} line${drafts.length === 1 ? '' : 's'} — matching against your formulary…`);
      res.warnings.slice(0, 4).forEach((w) => toast.warning(w));
      // Combine step 1 + 2: immediately score the read lines so each shows its
      // related formulary drugs (with an add-new option) inline.
      void handleMatch(combined);
    } catch (err) {
      // Prefer the backend's actionable message (e.g. "AI quota exhausted")
      // over axios's generic "Request failed with status code 500".
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMsg || (err instanceof Error ? err.message : 'Could not read the invoice'));
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
        dosageForm: L.dosageForm || '',
        packSize: L.packSize ? String(L.packSize) : '',
        unit: '',
        minStock: '',
        description: '',
        drugName: L.drugName || '',
        genericName: L.genericName || '',
        composition: '',
        manufacturer: L.manufacturer || '',
        strength: L.strength || '',
        gtin: L.gtin || res.gtin || '',
        hsnCode: L.hsnCode || '',
        batchNumber: L.batchNumber || '',
        expiryDate: L.expiryDate || '',
        manufacturingDate: L.manufacturingDate || '',
        quantityReceived: '',
        freeQuantity: '',
        mrp: '',
        purchasePrice: '',
        purchaseDiscountPercent: '',
        // Auto-fill GST from the scanned pack's HSN when one was resolved.
        gstPercent: gstForHsn(L.hsnCode || ''),
        sellingPrice: '',
      };
      setLines((prev) => {
        const idx = prev.map((l) => l.drugName.trim()).lastIndexOf('');
        if (idx >= 0) return prev.map((l, i) => (i === idx ? { ...seed, id: l.id } : l));
        return [...prev, { ...seed, id: nextId() }];
      });
      // What the GS1 code carried — GTIN identifies the product; batch / expiry /
      // serial are the per-batch/per-pack data read from the DataMatrix.
      const decoded = [
        res.gtin && `GTIN ${res.gtin}`,
        res.parsed.batchNumber && `batch ${res.parsed.batchNumber}`,
        res.parsed.expiryDate && `exp ${res.parsed.expiryDate}`,
        res.parsed.serial && `serial ${res.parsed.serial}`,
      ].filter(Boolean).join(' · ');
      if (res.resolvedVia === 'none' && !L.drugName) {
        toast.warning(
          decoded
            ? `Barcode decoded (${decoded}) but not in your catalog — complete the line manually.`
            : 'Barcode not recognised — complete the line manually.',
        );
      } else {
        const via =
          res.resolvedVia === 'formulary_gtin' ? 'in formulary'
            : res.resolvedVia === 'drugmaster_gtin' ? 'from catalog'
              : 'GS1 parsed';
        toast.success(`Scanned ${L.drugName || 'pack'} · ${via}${decoded ? ` · ${decoded}` : ''}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed');
    }
  };

  // A GTIN is worth resolving once it's a full 8–14-digit code or a GS1 2D string.
  // Worth resolving: a plain GTIN/EAN, a GS1 element string (starts with the
  // (01) GTIN AI, optionally behind a ]d2/]C1/]Q3 symbology prefix, or carries an
  // FNC1/GS separator), or a GS1 Digital Link URL. The backend decodes all three.
  const gtinLooksComplete = (raw: string) => {
    const c = raw.replace(/^\](d2|C1|Q3|e0)/i, '');
    return (
      /^\d{8,14}$/.test(c) ||
      /^https?:\/\//i.test(c) ||
      c.includes(String.fromCharCode(29)) ||
      /^01\d{14}/.test(c)
    );
  };

  // Merge a resolved scan onto a line, filling ONLY empty fields (never clobbers
  // what the user/sheet already provided). Shared by manual entry and import.
  const mergeScanIntoLine = (l: DraftLine, res: InwardScanResult, code: string): DraftLine => {
    const L = res.line;
    const next = { ...l, gtin: res.gtin ?? code };
    if (!next.drugName.trim() && L.drugName) next.drugName = L.drugName;
    if (!next.genericName.trim() && L.genericName) next.genericName = L.genericName;
    if (!next.manufacturer.trim() && L.manufacturer) next.manufacturer = L.manufacturer;
    if (!next.strength.trim() && L.strength) next.strength = L.strength;
    if (!next.dosageForm.trim() && L.dosageForm) next.dosageForm = L.dosageForm;
    if (!next.packSize.trim() && L.packSize != null) next.packSize = String(L.packSize);
    if (!next.hsnCode.trim() && L.hsnCode) {
      next.hsnCode = L.hsnCode;
      if (!next.gstPercent.trim()) {
        const g = gstForHsn(L.hsnCode);
        if (g) next.gstPercent = g;
      }
    }
    // A GS1 2D pack also carries batch / expiry / mfg — fill if empty.
    if (!next.batchNumber.trim() && L.batchNumber) next.batchNumber = L.batchNumber;
    if (!next.expiryDate && L.expiryDate) next.expiryDate = L.expiryDate;
    if (!next.manufacturingDate && L.manufacturingDate) next.manufacturingDate = L.manufacturingDate;
    return next;
  };

  // Typing / pasting a GTIN into a line resolves it exactly like a camera scan:
  // one lookup fills the product identity (name, composition, manufacturer,
  // strength, form, pack), the HSN → GST, and — from a GS1 2D code — the batch /
  // expiry / mfg printed on the pack. Runs on blur, once the code looks complete.
  const resolveGtinForLine = async (id: string, code: string) => {
    const c = code.trim();
    if (!gtinLooksComplete(c)) return;
    try {
      const res = await inwardScan.mutateAsync(c);
      if (res.resolvedVia === 'none' && !res.line.drugName) {
        toast.info('GTIN not recognised — fill the details; it will be remembered on save.');
        return;
      }
      setLines((prev) => prev.map((l) => (l.id === id ? mergeScanIntoLine(l, res, c) : l)));
      const src =
        res.resolvedVia === 'formulary_gtin' ? 'from your stock'
          : res.resolvedVia === 'drugmaster_gtin' ? 'from the catalog'
            : 'from the barcode';
      const caseNote = res.caseMultiplier > 1 ? ` · outer case = ${res.caseMultiplier} units` : '';
      if (res.line.drugName) toast.success(`Resolved ${res.line.drugName} ${src}${caseNote}`);
    } catch {
      // Best-effort — leave the typed GTIN as-is for manual completion.
    }
  };

  // Typing a medicine NAME that already exists in our formulary auto-fills the
  // three DB-sourced read-only fields (composition / strength / GTIN) + HSN→GST,
  // without waiting for the "Find matches" step. Runs on blur; a confident match
  // = an exact (case-insensitive) name, else a name that starts with what was
  // typed. Never overwrites a line already linked to a catalog drug or GTIN.
  const resolveNameForLine = async (id: string, rawName: string) => {
    const name = rawName.trim();
    if (name.length < 2) return;
    const cur = lines.find((l) => l.id === id);
    if (!cur || cur.drugMasterId || cur.gtin.trim()) return; // catalog/GTIN already set identity
    if (cur.genericName.trim() || cur.strength.trim()) return; // already identified
    try {
      const res = await apiGet<Array<{ drugName: string; genericName: string | null; composition: string | null; strength: string | null; gtin: string | null; hsnCode: string | null }>>(
        '/pharmacy/formulary',
        { params: { search: name, limit: 5, isActive: true } },
      );
      const items = res.data ?? [];
      const norm = name.toLowerCase();
      const pick =
        items.find((d) => d.drugName.trim().toLowerCase() === norm) ??
        items.find((d) => d.drugName.trim().toLowerCase().startsWith(norm)) ??
        null;
      if (!pick) return;
      setLines((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                genericName: pick.genericName ?? '',
                composition: pick.composition ?? '',
                strength: pick.strength ?? '',
                gtin: pick.gtin ?? '',
                hsnCode: pick.hsnCode ?? l.hsnCode,
              }
            : l,
        ),
      );
      if (pick.hsnCode) applyHsn(id, pick.hsnCode);
    } catch {
      // Best-effort — leave the line as typed.
    }
  };

  // Import parity: resolve each imported line's GTIN (parallel, capped) so a
  // vendor sheet that carries only Name + GTIN comes in with identity + HSN/GST
  // filled. Capped so a huge sheet doesn't flood the lookup API.
  const resolveGtinsForDrafts = async (drafts: DraftLine[]): Promise<DraftLine[]> => {
    const CAP = 40;
    const targets = drafts.filter((l) => gtinLooksComplete(l.gtin.trim())).slice(0, CAP);
    if (!targets.length) return drafts;
    const resolved = await Promise.all(
      targets.map(async (l) => {
        try {
          const res = await inwardScan.mutateAsync(l.gtin.trim());
          if (res.resolvedVia === 'none' && !res.line.drugName) return null;
          return { id: l.id, line: mergeScanIntoLine(l, res, l.gtin.trim()) };
        } catch {
          return null;
        }
      }),
    );
    const byId = new Map(resolved.filter(Boolean).map((r) => [r!.id, r!.line]));
    if (byId.size) toast.success(`Auto-filled ${byId.size} item(s) from their GTIN`);
    return drafts.map((l) => byId.get(l.id) ?? l);
  };

  // Score the entered lines against the formulary and show inline matches on the
  // SAME screen — each line gets its related drugs + map/add-new (no separate
  // step). Matching only needs the product name; batch/expiry are validated later
  // at "Receive stock". `srcLines` lets the OCR handler match freshly-read lines
  // without waiting for React state to settle.
  const handleMatch = async (srcLines: DraftLine[] = lines) => {
    const filled = srcLines.filter((l) => l.drugName.trim());
    if (!filled.length) {
      toast.error('Add at least one line');
      return;
    }
    try {
      const res = await matchInward.mutateAsync({
        // Header supplier threads through so it can be recorded on each batch.
        supplierId: supplierId || undefined,
        lines: filled.map((l) => ({
          drugName: l.drugName.trim(),
          genericName: l.genericName.trim() || undefined,
          composition: l.composition.trim() || undefined,
          manufacturer: l.manufacturer.trim() || undefined,
          strength: l.strength.trim() || undefined,
          gtin: l.gtin.trim() || undefined,
          kind: (l.kind === 'item' ? 'item' : 'drug') as 'drug' | 'item',
          category: l.kind === 'item' ? l.category || 'other' : undefined,
        })),
      });
      // Keep only the filled lines so matched[i]/decisions[i] align with lines[i].
      // Capture each line's original name ONCE (sticky) as the learned-mapping key
      // so it survives a later catalog pick / connect that rewrites drugName.
      setLines(filled.map((l) => ({ ...l, rawName: l.rawName ?? l.drugName.trim() })));
      setMatched(res);
      setDecisions(
        res.map((m) => ({
          action: m.recommendation === 'create' ? 'create' : 'map',
          targetId: m.suggestedFormularyId,
        })),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to match lines');
    }
  };

  const setDecision = (i: number, patch: Partial<Decision>) =>
    setDecisions((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  // User picked a DrugMaster catalog drug for line i. We DON'T overwrite the
  // editable boxes — the line just gets LINKED to the catalog drug (drugMasterId)
  // and marked "create". On commit the new formulary row is built from the
  // catalog master's identity, so the boxes stay as the pharmacist left them.
  // `catalogPickName` is display-only (which catalog drug this line will create).
  const pickCatalog = (i: number, c: CatalogPick) => {
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i
          ? {
              ...l,
              // Keep the typed name as the learned-mapping key.
              rawName: l.rawName ?? l.drugName.trim(),
              drugMasterId: c.drugMasterId,
              catalogPickName: c.drugName,
              // Composition / strength / GTIN are DB-sourced — adopt them from the
              // picked catalog drug so the read-only fields reflect our data.
              genericName: c.genericName ?? '',
              composition: c.composition ?? '',
              strength: c.strength ?? '',
              gtin: c.gtin ?? '',
            }
          : l,
      ),
    );
    setDecision(i, { action: 'create', targetId: null });
  };

  // Sync a line's DB-sourced identity (composition / strength / GTIN) from the
  // medicine it is mapped to. These fields are read-only and never typed or
  // imported, so this is their only writer (besides a catalog pick / scan).
  const setLineIdentity = (
    i: number,
    idn: { genericName: string; composition: string; strength: string; gtin: string },
  ) => {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        if (
          l.genericName === idn.genericName &&
          l.composition === idn.composition &&
          l.strength === idn.strength &&
          l.gtin === idn.gtin
        ) {
          return l; // unchanged — avoid a needless re-render
        }
        return {
          ...l,
          genericName: idn.genericName,
          composition: idn.composition,
          strength: idn.strength,
          gtin: idn.gtin,
        };
      }),
    );
  };

  // Undo a catalog pick — restore the scanned/typed identity and unlink.
  // Unlink a catalog pick. Restores any legacy catalog-adopted identity, and in
  // the new link-only flow just clears the catalog link (boxes were untouched).
  const undoCatalog = (i: number) => {
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i
          ? {
              ...l,
              ...(l.catalogBackup ?? {}),
              drugMasterId: undefined,
              catalogPickName: undefined,
              catalogBackup: undefined,
            }
          : l,
      ),
    );
  };

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
    () => lines.map((l) => validateLine(l, lines)),
    [lines],
  );
  const blockingErrors = lineIssues.reduce((n, x) => n + x.errors.length, 0);

  // Matches are "current" only while their count lines up with the rows — adding
  // or removing a row (or a fresh OCR/CSV load) drops this to false so the user
  // re-runs "Find matches". Editing a cell keeps the per-index alignment intact.
  const reviewing = matched.length > 0 && matched.length === lines.length;

  const handleCommit = async () => {
    // Receiving stock needs batch/expiry per line — block on those here (matching
    // earlier did not require them).
    if (blockingErrors > 0) {
      toast.error('Fix the highlighted issues before receiving stock');
      return;
    }
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
        // Every type is stocked in the formulary now (the type rides along as
        // `category`), so a mapped line always targets a formulary product.
        targetFormularyId: d.action === 'map' ? d.targetId ?? undefined : undefined,
        // A 'create' seeded from the catalog links the new formulary row to the master.
        drugMasterId: d.action === 'create' ? l.drugMasterId || undefined : undefined,
        // Raw line text is the learned-mapping key — the ORIGINAL typed name.
        // Prefer the sticky rawName; else the pre-catalog-pick name (catalogBackup);
        // else the current name. So connecting "lolo" → "Loloxy" (by match OR by
        // catalog pick) is always remembered under "lolo".
        externalName: (l.rawName || l.catalogBackup?.drugName || l.drugName).trim(),
        drugName: l.drugName.trim(),
        genericName: l.genericName.trim() || undefined,
        // The salt. Sent at match time but not here, so a product created at
        // inward was stored with an empty composition — which is also what the
        // matcher scores, so the next invoice for the same drug could not
        // recognise it.
        composition: l.composition.trim() || undefined,
        manufacturer: l.manufacturer.trim() || undefined,
        strength: l.strength.trim() || undefined,
        // Full product-definition fields carried onto a newly-created product.
        dosageForm: l.dosageForm || undefined,
        packSize: int(l.packSize),
        looseUnitLabel: l.unit.trim() || undefined,
        minStock: int(l.minStock),
        description: l.description.trim() || undefined,
        gtin: l.gtin.trim() || undefined,
        hsnCode: l.hsnCode.trim() || undefined,
        batchNumber: l.batchNumber.trim() || undefined,
        // Equipment doesn't expire — a batch still needs a date, so stamp one.
        expiryDate: l.expiryDate || (isEquipment(l) ? NO_EXPIRY : undefined),
        manufacturingDate: l.manufacturingDate || undefined,
        // Total received = paid + free (0 = just register the product, no stock).
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

      // PO update is now a deliberate action on the done step ("Update PO &
      // mark delivered") — not automatic — so the user can verify first.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to commit inward');
    }
  };

  // Aggregate the posted lines that match a PO line (by name) into reconcile
  // items — used by the "Update PO" button on the done step.
  const buildReconcileItems = () => {
    if (!poId || !poItems.length || !result) return [] as { purchaseOrderItemId: string; quantityReceived: number; unitPrice?: number }[];
    const agg = new Map<string, { qty: number; rate?: number }>();
    lines.forEach((l, i) => {
      const r = result.results?.find((rr) => rr.index === i);
      if (r && r.status !== 'ok') return;
      const paid = parseInt(l.quantityReceived, 10) || 0;
      if (paid <= 0) return;
      const m = matchPoLine(l.drugName, poItems);
      if (!m) return;
      const rate = parseFloat(l.purchasePrice);
      const cur = agg.get(m.id) ?? { qty: 0, rate: undefined };
      cur.qty += paid;
      if (!isNaN(rate)) cur.rate = rate;
      agg.set(m.id, cur);
    });
    return Array.from(agg, ([purchaseOrderItemId, v]) => ({ purchaseOrderItemId, quantityReceived: v.qty, unitPrice: v.rate }));
  };

  const updatePO = async (markDelivered: boolean) => {
    const items = buildReconcileItems();
    if (!items.length) { toast.error('No received lines match this purchase order.'); return; }
    try {
      const po = await reconcilePO.mutateAsync({ id: poId, items, markDelivered });
      setReconciled(po);
      toast.success(`PO ${po.orderNumber} updated → ${po.status.replace(/_/g, ' ')}`);
    } catch {
      toast.warning('Could not update the purchase order.');
    }
  };

  // Print a Goods-Receipt / Purchase Invoice for what was just received.
  const printReceivedInvoice = () => {
    if (!result) return;
    const supplier = suppliers.find((s) => s.id === supplierId);
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const money = (n: number) => `₹${(n || 0).toFixed(2)}`;
    const rows = lines
      .map((l, i) => ({ l, ok: (result.results?.find((rr) => rr.index === i)?.status ?? 'ok') === 'ok' }))
      .filter(({ l, ok }) => ok && (parseInt(l.quantityReceived, 10) || 0) > 0);
    const bodyRows = rows.map(({ l }, idx) => {
      const qty = parseInt(l.quantityReceived, 10) || 0;
      const free = parseInt(l.freeQuantity, 10) || 0;
      const rate = parseFloat(l.purchasePrice) || 0;
      const disc = parseFloat(l.purchaseDiscountPercent) || 0;
      const gst = parseFloat(l.gstPercent) || 0;
      const net = rate * (1 - disc / 100) * qty;
      const amount = net * (1 + gst / 100);
      return `<tr>
        <td>${idx + 1}</td>
        <td>${esc(l.drugName)}${l.strength ? ' ' + esc(l.strength) : ''}</td>
        <td>${esc(l.batchNumber) || '-'}</td>
        <td>${esc(l.expiryDate) || '-'}</td>
        <td class="r">${qty}${free ? ` + ${free}` : ''}</td>
        <td class="r">${money(rate)}</td>
        <td class="r">${disc ? disc + '%' : '-'}</td>
        <td class="r">${gst ? gst + '%' : '-'}</td>
        <td class="r">${money(amount)}</td>
      </tr>`;
    }).join('');
    const t = purchaseTotals;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Goods Receipt${invoiceNumber ? ' - ' + esc(invoiceNumber) : ''}</title>
      <style>
        *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1a2332;margin:28px;font-size:12px}
        h1{font-size:18px;margin:0} .muted{color:#5b6472} .r{text-align:right}
        .head{display:flex;justify-content:space-between;border-bottom:2px solid #0f766e;padding-bottom:8px;margin-bottom:12px}
        .meta{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;margin-bottom:12px}
        table{width:100%;border-collapse:collapse;margin-top:6px} th,td{border:1px solid #c9ced6;padding:5px 6px;text-align:left}
        th{background:#0f766e;color:#fff;font-size:10px;text-transform:uppercase}
        tfoot td{font-weight:bold} .totals{margin-top:10px;margin-left:auto;width:280px}
        .totals div{display:flex;justify-content:space-between;padding:2px 0} .totals .grand{border-top:1px solid #1a2332;font-weight:bold;margin-top:4px;padding-top:4px}
        @media print{body{margin:12mm}}
      </style></head><body>
      <div class="head">
        <div><h1>${esc(branding?.name || 'Goods Receipt')}</h1><div class="muted">Goods Receipt / Purchase Invoice</div></div>
        <div class="r muted">Printed: ${esc(new Date().toLocaleString('en-IN'))}</div>
      </div>
      <div class="meta">
        <div><b>Supplier:</b> ${esc(supplier?.name || '-')}</div>
        <div><b>Invoice No:</b> ${esc(invoiceNumber || '-')}</div>
        <div><b>Invoice Date:</b> ${esc(invoiceDate || '-')}</div>
        <div><b>Against PO:</b> ${esc(reconciled?.orderNumber || poNumber || '-')}</div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Item</th><th>Batch</th><th>Expiry</th><th class="r">Qty (+free)</th><th class="r">Rate</th><th class="r">Disc</th><th class="r">GST</th><th class="r">Amount</th></tr></thead>
        <tbody>${bodyRows || '<tr><td colspan="9" class="muted">No received lines.</td></tr>'}</tbody>
      </table>
      <div class="totals">
        <div><span>Gross</span><span>${money(t.gross)}</span></div>
        <div><span>Discount</span><span>- ${money(t.lineDisc + t.invoiceDisc)}</span></div>
        <div><span>GST</span><span>${money(t.gst)}</span></div>
        <div class="grand"><span>Landing / Net</span><span>${money(t.landing)}</span></div>
      </div>
      <p class="muted" style="margin-top:20px">This is a computer-generated goods-receipt document.</p>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Allow pop-ups to print.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  // The imported sheet takes over the page — it is reviewed and fixed there
  // before it becomes lines, so the rest of the panel steps aside.
  if (step === 'map' && mapRows) {
    return (
      <ImportStep
        rows={mapRows}
        onRowsChange={setMapRows}
        onCancel={() => {
          setMapRows(null);
          setStep('entry');
        }}
        onConfirm={applyMappedLines}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {step === 'entry' &&
          'Key in, paste, scan or OCR a distributor invoice. Hit "Find matches" (auto-run after OCR) and each line shows its related formulary drugs inline — map to an existing one to keep stock together, or add it as new. Then receive the stock.'}
        {step === 'done' && 'Inward posted. Here is what happened to each line.'}
      </p>

        <div>
          {step === 'entry' && (
            <EntryStep
              suppliers={suppliers}
              supplierId={supplierId}
              setSupplierId={setSupplierId}
              selectedSupplier={selectedSupplier}
              openPOs={openPOs}
              poId={poId}
              poNumber={poNumber}
              poItems={poItems}
              poDetail={poDetail?.id === poId ? poDetail : null}
              onSelectPO={setPoId}
              onClearPO={clearPO}
              invoiceNumber={invoiceNumber}
              setInvoiceNumber={setInvoiceNumber}
              invoiceDate={invoiceDate}
              setInvoiceDate={setInvoiceDate}
              invoiceDiscPct={invoiceDiscPct}
              setInvoiceDiscPct={setInvoiceDiscPct}
              invoiceDiscAmt={invoiceDiscAmt}
              setInvoiceDiscAmt={setInvoiceDiscAmt}
              purchaseTotals={purchaseTotals}
              lines={lines}
              updateLine={updateLine}
              applyHsn={applyHsn}
              hsnRates={hsnRates}
              onResolveGtin={resolveGtinForLine}
              onResolveName={resolveNameForLine}
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
              ocrEnabled={ocrEnabled}
              ocrPending={ocrInward.isPending}
              onScan={handleScan}
              scanPending={inwardScan.isPending}
              lineIssues={lineIssues}
              matched={matched}
              decisions={decisions}
              setDecision={setDecision}
              onPickCatalog={pickCatalog}
              onUndoCatalog={undoCatalog}
              onLineIdentity={setLineIdentity}
              reviewing={reviewing}
            />
          )}

          {step === 'done' && result && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {poId && (
                <Button onClick={() => updatePO(true)} disabled={reconcilePO.isPending} className="gap-1.5">
                  {reconcilePO.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
                  Update PO &amp; mark delivered
                </Button>
              )}
              {poId && (
                <Button
                  variant="outline"
                  onClick={() => setPoViewDoneOpen(true)}
                  className="gap-1.5"
                  disabled={!donePo}
                >
                  <Eye className="h-4 w-4" /> View PO
                </Button>
              )}
              <Button variant="outline" onClick={printReceivedInvoice} className="gap-1.5">
                <Printer className="h-4 w-4" /> Print received invoice
              </Button>
            </div>
          )}
          {step === 'done' && reconciled && (() => {
            const items = reconciled.items ?? [];
            const ordered = items.reduce((s, it) => s + it.quantityOrdered, 0);
            const received = items.reduce((s, it) => s + it.quantityReceived, 0);
            const remaining = Math.max(0, ordered - received);
            const done = reconciled.status === 'delivered';
            return (
              <div className={cn('mb-3 rounded-lg border p-3', done ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50')}>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <FileCheck className="h-4 w-4 text-primary" />
                  PO <span className="font-mono">{reconciled.orderNumber}</span> updated → <span className="capitalize">{reconciled.status.replace(/_/g, ' ')}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Received <b className="text-foreground">{received}</b> of <b className="text-foreground">{ordered}</b> ordered
                  {remaining > 0 ? <> · <b className="text-amber-700">{remaining} still remaining</b> on this PO</> : <> · <b className="text-emerald-700">fully received</b></>}
                </p>
              </div>
            );
          })()}
          {step === 'done' && result && <DoneStep lines={lines} result={result} />}
        </div>

        <div className="flex items-center justify-end gap-2 border-t pt-3">
          {step === 'entry' && (
            <>
              {reviewing ? (
                <div className="mr-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{summary.map} mapping to existing</span>·<span>{summary.create} new</span>
                  <label className="ml-1 flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={addToExisting}
                      onChange={(e) => setAddToExisting(e.target.checked)}
                    />
                    If batch exists, add to it
                  </label>
                  {blockingErrors > 0 && (
                    <span className="font-medium text-red-600">{blockingErrors} issue{blockingErrors === 1 ? '' : 's'} to fix</span>
                  )}
                </div>
              ) : (
                blockingErrors > 0 && (
                  <span className="mr-auto text-xs font-medium text-red-600">
                    {blockingErrors} issue{blockingErrors === 1 ? '' : 's'} to fix
                  </span>
                )
              )}
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button variant={reviewing ? 'outline' : 'default'} onClick={() => handleMatch()} disabled={matchInward.isPending}>
                {matchInward.isPending ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Matching…</>
                ) : (
                  <><Sparkles className="mr-1.5 h-4 w-4" /> {reviewing ? 'Re-match' : 'Find matches'}</>
                )}
              </Button>
              {reviewing && (
                <Button onClick={handleCommit} disabled={commitInward.isPending || blockingErrors > 0}>
                  {commitInward.isPending ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Posting…</>
                  ) : (
                    <><PackageCheck className="mr-1.5 h-4 w-4" /> Receive stock</>
                  )}
                </Button>
              )}
            </>
          )}
          {step === 'done' && (
            <>
              <Button variant="outline" onClick={reset}>Receive more</Button>
              <Button onClick={close}>Done</Button>
            </>
          )}
        </div>

        {/* Read-only PO view from the Done step (shows the updated order) */}
        <PoViewDialog
          open={poViewDoneOpen}
          onOpenChange={setPoViewDoneOpen}
          po={donePo}
          poItems={donePoItems}
          lines={lines}
        />
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

// A compact labelled field used inside an entry card.
function LineField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0 space-y-0.5', className)}>
      <span className="block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

// Small section heading used to break the line-entry card into readable
// clusters (a short accent bar + label) — divided by hairlines, not boxes.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <span className="h-1 w-3 rounded-full bg-primary/50" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>
    </div>
  );
}

// ── Read-only view of the purchase order being checked against ──────────────
// Shows the order as raised, side by side with what has actually been entered on
// this invoice, so the user can see the PO itself (not just the summary chips).
function PoViewDialog({
  open,
  onOpenChange,
  po,
  poItems,
  lines,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PurchaseOrder | null | undefined;
  poItems: PoLineRef[];
  lines: DraftLine[];
}) {
  // Qty entered on this invoice against each PO line (by the same name match).
  const enteredByPoLine = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lines) {
      const m = matchPoLine(l.drugName, poItems);
      if (!m) continue;
      const qty = parseInt(l.quantityReceived || '', 10) || 0;
      map.set(m.id, (map.get(m.id) ?? 0) + qty);
    }
    return map;
  }, [lines, poItems]);

  if (!po) return null;
  const money = (n: number) => `₹${n.toFixed(2)}`;
  const orderedTotal = poItems.reduce((s, p) => s + p.orderedQty, 0);
  const receivedTotal = poItems.reduce((s, p) => s + p.alreadyReceived, 0);
  const enteredTotal = poItems.reduce((s, p) => s + (enteredByPoLine.get(p.id) ?? 0), 0);

  const info: { label: string; value: string }[] = [
    { label: 'Vendor', value: po.supplier?.name ?? '—' },
    { label: 'Order date', value: po.orderDate ? formatDate(po.orderDate) : '—' },
    { label: 'Expected', value: po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '—' },
    { label: 'PO value', value: po.totalAmount != null ? money(Number(po.totalAmount)) : '—' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[96vw] max-w-none flex-col overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <FileCheck className="h-4 w-4 text-primary" />
            Purchase Order <span className="font-mono">{po.orderNumber}</span>
            <Badge variant="outline" className="capitalize">{po.status.replace(/_/g, ' ')}</Badge>
          </DialogTitle>
          <DialogDescription>
            The order as raised, next to what you have entered on this invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {info.map((i) => (
              <div key={i.label} className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{i.label}</p>
                <p className="text-sm font-medium">{i.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">Item</th>
                  <th className="px-3 py-2 text-right font-semibold">Ordered</th>
                  <th className="px-3 py-2 text-right font-semibold">Already received</th>
                  <th className="px-3 py-2 text-right font-semibold">Outstanding</th>
                  <th className="px-3 py-2 text-right font-semibold">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold">Entered here</th>
                  <th className="px-3 py-2 text-left font-semibold">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {poItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      This purchase order has no lines.
                    </td>
                  </tr>
                ) : (
                  poItems.map((p) => {
                    const outstanding = Math.max(0, p.orderedQty - p.alreadyReceived);
                    const entered = enteredByPoLine.get(p.id);
                    const chip =
                      entered == null
                        ? { label: 'not on this invoice', cls: 'bg-slate-200 text-slate-700' }
                        : entered === outstanding
                          ? { label: 'matches', cls: 'bg-emerald-100 text-emerald-800' }
                          : entered < outstanding
                            ? { label: `short by ${outstanding - entered}`, cls: 'bg-amber-100 text-amber-800' }
                            : { label: `excess by ${entered - outstanding}`, cls: 'bg-sky-100 text-sky-800' };
                    return (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.orderedQty}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.alreadyReceived}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{outstanding}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {p.unitPrice != null ? money(p.unitPrice) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {entered == null ? <span className="text-muted-foreground">—</span> : entered}
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', chip.cls)}>
                            {chip.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {poItems.length > 0 && (
                <tfoot className="border-t bg-muted/30 font-semibold">
                  <tr>
                    <td className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{orderedTotal}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{receivedTotal}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Math.max(0, orderedTotal - receivedTotal)}</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right tabular-nums">{enteredTotal}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {po.notes && (
            <p className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Notes:</span> {po.notes}
            </p>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
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
  openPOs: PurchaseOrder[];
  poId: string;
  poNumber: string;
  poItems: PoLineRef[];
  /** The loaded order behind `poId` — powers the read-only "View PO" sheet. */
  poDetail?: PurchaseOrder | null;
  onSelectPO: (id: string) => void;
  onClearPO: () => void;
  invoiceNumber: string;
  setInvoiceNumber: (v: string) => void;
  invoiceDate: string;
  setInvoiceDate: (v: string) => void;
  invoiceDiscPct: string;
  setInvoiceDiscPct: (v: string) => void;
  invoiceDiscAmt: string;
  setInvoiceDiscAmt: (v: string) => void;
  purchaseTotals: { gross: number; lineDisc: number; billPct: number; invoiceDisc: number; net: number; gst: number; landing: number };
  lines: DraftLine[];
  updateLine: (id: string, field: DraftCol, value: string) => void;
  // Setting a line's HSN also auto-fills its GST from the tax master.
  applyHsn: (id: string, value: string) => void;
  hsnRates: HsnGstRate[];
  // Resolve a typed/pasted GTIN → fill the line's identity + HSN/GST + batch.
  onResolveGtin: (id: string, code: string) => void;
  // Resolve a typed NAME → fill the line's identity (composition/strength/GTIN) + HSN/GST.
  onResolveName: (id: string, name: string) => void;
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
  ocrEnabled: boolean;
  ocrPending: boolean;
  onScan: (code: string) => void;
  scanPending: boolean;
  lineIssues: LineIssues[];
  // Inline formulary match per line (combined entry + review).
  matched: InwardMatchedLine[];
  decisions: Decision[];
  setDecision: (i: number, patch: Partial<Decision>) => void;
  onPickCatalog: (i: number, c: CatalogPick) => void;
  onUndoCatalog: (i: number) => void;
  // Sync a line's DB-sourced identity (composition / strength / GTIN) from the
  // medicine it maps to.
  onLineIdentity: (
    i: number,
    idn: { genericName: string; composition: string; strength: string; gtin: string },
  ) => void;
  reviewing: boolean;
}) {
  const {
    suppliers, supplierId, setSupplierId, selectedSupplier, invoiceNumber, setInvoiceNumber,
    openPOs, poId, poNumber, poItems, poDetail, onSelectPO, onClearPO,
    invoiceDate, setInvoiceDate, invoiceDiscPct, setInvoiceDiscPct, invoiceDiscAmt, setInvoiceDiscAmt,
    purchaseTotals, lines, updateLine, applyHsn, hsnRates, onResolveGtin, onResolveName, addLine, removeLine, showPaste, setShowPaste,
    pasteText, setPasteText, ingest, fileRef, onFile, xlsxRef, onXlsxFile,
    ocrRef, onOcrFile, ocrEnabled, ocrPending, onScan, lineIssues,
    matched, decisions, setDecision, onPickCatalog, onUndoCatalog, onLineIdentity, reviewing,
  } = props;
  const money = (n: number) => `₹${n.toFixed(2)}`;

  const cell = 'h-8 text-xs';
  // CHECK each entered line against the PO (match by name) — never prefill.
  const poMatchByLine = useMemo(() => lines.map((l) => matchPoLine(l.drugName, poItems)), [lines, poItems]);
  const poCompare = useMemo(() => {
    const matchedIds = new Set<string>();
    let match = 0, short = 0, excess = 0;
    poMatchByLine.forEach((m, i) => {
      if (!m) return;
      matchedIds.add(m.id);
      const rec = parseInt(lines[i]?.quantityReceived ?? '', 10) || 0;
      const remaining = Math.max(0, m.orderedQty - m.alreadyReceived);
      if (rec === remaining) match++;
      else if (rec < remaining) short++;
      else excess++;
    });
    // PO lines that no entered invoice line matched — still outstanding / missing.
    const missing = poItems.filter((p) => !matchedIds.has(p.id));
    return { matchedCount: matchedIds.size, match, short, excess, missing };
  }, [poMatchByLine, lines, poItems]);
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  // Read-only look at the purchase order being checked against.
  const [poViewOpen, setPoViewOpen] = useState(false);

  // ── Import review ──────────────────────────────────────────
  // Bulk files land as dozens of rows, so classify each one and let the user
  // jump straight to the ones that need a decision instead of hunting for red
  // borders. All four sources are index-aligned: lines / lineIssues / matched /
  // decisions.
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  const rowFlags = useMemo(
    () =>
      lines.map((l, i) => {
        const iss = lineIssues[i] ?? { errors: [], warnings: [] };
        const m = reviewing ? matched[i] : undefined;
        const inFormulary = (m?.matches ?? []).some((c) => c.source !== 'catalog');
        return {
          blank: !l.drugName.trim(),
          hasError: iss.errors.length > 0,
          hasWarning: iss.warnings.length > 0,
          // Nothing like it in this hospital's formulary → it has to be added.
          notInFormulary: !!m && !inFormulary,
          // Nothing found anywhere (formulary or platform catalog).
          unknown: !!m && m.matches.length === 0,
          // Scored as a *possible* match and silently pre-set to "map" — the
          // bucket most worth a human look.
          needsReview: m?.recommendation === 'review',
        };
      }),
    [lines, lineIssues, matched, decisions, reviewing],
  );
  const reviewCounts = useMemo(() => {
    const rows = rowFlags.filter((f) => !f.blank);
    return {
      total: rows.length,
      issues: rows.filter((f) => f.hasError).length,
      notInFormulary: rows.filter((f) => f.notInFormulary).length,
      needsReview: rows.filter((f) => f.needsReview).length,
      ready: rows.filter((f) => !f.hasError && !f.notInFormulary && !f.needsReview).length,
    };
  }, [rowFlags]);
  // Which rows the current filter shows (indices, so numbering stays stable).
  const visibleRows = useMemo(
    () =>
      lines
        .map((_, i) => i)
        .filter((i) => {
          const f = rowFlags[i];
          if (!f) return true;
          if (rowFilter === 'issues') return f.hasError;
          if (rowFilter === 'new') return f.notInFormulary;
          if (rowFilter === 'review') return f.needsReview;
          return true;
        }),
    [lines, rowFlags, rowFilter],
  );
  // Rows whose "more details" panel (full product fields) is open.
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <VendorFormDialog
        open={addVendorOpen}
        onOpenChange={setAddVendorOpen}
        onSaved={(v) => setSupplierId(v.id)}
      />
      {/* Read-only look at the PO being checked against */}
      <PoViewDialog
        open={poViewOpen}
        onOpenChange={setPoViewOpen}
        po={poDetail}
        poItems={poItems}
        lines={lines}
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
      </div>

      {/* Check the entered invoice against a Purchase Order (compare, never fill) */}
      <div className="rounded-lg border bg-primary/[0.03] p-3">
        {poId ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <FileCheck className="h-4 w-4 text-primary" /> Checking against PO <span className="font-mono">{poNumber || '…'}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">{poCompare.match} match</span>
                  {poCompare.short > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">{poCompare.short} short</span>}
                  {poCompare.excess > 0 && <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-800">{poCompare.excess} excess</span>}
                  {poCompare.missing.length > 0 && <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700">{poCompare.missing.length} not on this invoice</span>}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setPoViewOpen(true)}
                  disabled={!poDetail}
                >
                  <Eye className="h-3.5 w-3.5" /> View PO
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onClearPO}>
                  <X className="h-3.5 w-3.5" /> Clear PO
                </Button>
              </div>
            </div>
            {poCompare.missing.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                On the PO but not entered here: {poCompare.missing.map((m) => `${m.name} (${Math.max(0, m.orderedQty - m.alreadyReceived)} left)`).join(', ')}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileCheck className="h-3.5 w-3.5" /> Enter the received invoice above, then check it against a purchase order:
            </span>
            <Select value={poId} onValueChange={(v) => onSelectPO(v ?? '')}>
              <SelectTrigger className="h-8 w-auto min-w-[240px] text-xs">
                <SelectValue placeholder="Check against a purchase order…" />
              </SelectTrigger>
              <SelectContent>
                {openPOs.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No open purchase orders</div>
                ) : (
                  openPOs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.orderNumber}
                      {p.supplier?.name ? ` · ${p.supplier.name}` : ''}
                      {p._count?.items != null ? ` · ${p._count.items} item(s)` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
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
        {/* The format we hand vendors. A file filled in from this maps itself —
            every header is a HEADER_MAP alias — so it needs no column mapping. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="sm" variant="outline" className="border-primary/40 text-primary" />}
          >
            <Download className="mr-1.5 h-4 w-4" /> Download template
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={downloadTemplateXlsx}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx) — with instructions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={downloadTemplateCsv}>
              <Upload className="mr-2 h-4 w-4" /> CSV (.csv)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* OCR — read a photo/PDF of the supplier invoice into lines (Gemini).
            Hidden when a super-admin has disabled invoice OCR for this hospital. */}
        {ocrEnabled && (
          <Button size="sm" variant="outline" onClick={() => ocrRef.current?.click()} disabled={ocrPending}>
            {ocrPending ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Reading invoice…</>
            ) : (
              <><Camera className="mr-1.5 h-4 w-4" /> Scan invoice (OCR)</>
            )}
          </Button>
        )}
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
        Add one line or many. Leave <b>Qty</b> blank to just register a product (no stock yet); fill it to also receive stock. Click <ChevronRight className="inline h-3 w-3" /> on a row for more details (dosage form, pack size, unit, reorder level, description). Scan / paste / upload to auto-fill.
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

      {/* ── Import review — what came in, and what still needs a decision ──
          Shown once there's more than a row or two (i.e. an imported file), so
          a 60-row spreadsheet is navigable instead of a wall of cards. */}
      {reviewCounts.total > 1 && (
        <div className="rounded-xl border bg-surface-container-lowest p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              {reviewCounts.total} row{reviewCounts.total === 1 ? '' : 's'} imported
              {!reviewing && (
                <span className="font-normal text-muted-foreground">
                  — run “Find matches” to check them against your master data
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {([
                { key: 'all', label: `All ${reviewCounts.total}`, n: reviewCounts.total, cls: 'bg-primary text-primary-foreground' },
                { key: 'issues', label: `${reviewCounts.issues} to fix`, n: reviewCounts.issues, cls: 'bg-red-600 text-white' },
                { key: 'new', label: `${reviewCounts.notInFormulary} not in master data`, n: reviewCounts.notInFormulary, cls: 'bg-emerald-600 text-white' },
                { key: 'review', label: `${reviewCounts.needsReview} to check`, n: reviewCounts.needsReview, cls: 'bg-blue-600 text-white' },
              ] as const).map((c) =>
                c.key !== 'all' && c.n === 0 ? null : (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setRowFilter(c.key)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      rowFilter === c.key ? c.cls : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {c.label}
                  </button>
                ),
              )}
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {reviewCounts.issues > 0 && (
              <span className="text-red-600">
                {reviewCounts.issues} row{reviewCounts.issues === 1 ? '' : 's'} missing something needed to receive stock (batch / expiry / quantity).{' '}
              </span>
            )}
            {reviewCounts.notInFormulary > 0 && (
              <span className="text-emerald-700">
                {reviewCounts.notInFormulary} not in your master data — each will be added as new; use “From drug catalog” on the row to pick the right one.{' '}
              </span>
            )}
            {reviewCounts.issues === 0 && reviewCounts.notInFormulary === 0 && reviewing && 'Every row matched an existing product and has what it needs.'}
          </p>
          {rowFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setRowFilter('all')}
              className="mt-1.5 text-[11px] font-medium text-primary hover:underline"
            >
              Showing {visibleRows.length} of {lines.length} — show all rows
            </button>
          )}
        </div>
      )}

      {/* Editable lines — responsive cards (wrap to width, no horizontal scroll) */}
      <div className="space-y-2">
        {visibleRows.map((i) => {
          const l = lines[i];
          const flags = rowFlags[i];
          const issue = lineIssues[i];
          const err = issue?.errors ?? [];
          const warn = issue?.warnings ?? [];
          const open = expandedRows.has(l.id);
          const isItem = l.kind === 'item';
          // This line is defining a product that does not exist yet, so there
          // is no medicine to source its composition / strength from. Those two
          // boxes become editable — otherwise they are blank at creation and
          // stay blank forever, and composition is what the matcher scores the
          // NEXT invoice for this drug against.
          const isNewProduct = reviewing && decisions[i]?.action === 'create';
          const rate = parseFloat(l.purchasePrice);
          const net = !rate || isNaN(rate)
            ? null
            : (rate * (1 - (parseFloat(l.purchaseDiscountPercent) || 0) / 100)).toFixed(2);
          return (
            <div
              key={l.id}
              className={cn(
                'overflow-hidden rounded-xl border bg-surface-container-lowest shadow-xs transition-colors',
                err.length > 0 ? 'border-red-400/60' : warn.length > 0 ? 'border-amber-400/60' : 'border-outline-variant/50',
              )}
            >
              {/* ── Header: number · name/attributes · type · actions ── */}
              <div className="flex items-start gap-3 p-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div className="grid flex-1 gap-2.5 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Input
                        className="h-9 flex-1 text-sm font-semibold"
                        value={l.drugName}
                        onChange={(e) => updateLine(l.id, 'drugName', e.target.value)}
                        onBlur={(e) => onResolveName(l.id, e.target.value)}
                        placeholder="Product name *  ·  e.g. Telmac 40 Tab"
                      />
                      {/* Not in this hospital's master data — the row needs an
                          add decision (catalog pick, or add as new). */}
                      {flags?.notInFormulary && (
                        <Badge
                          className="shrink-0 border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-700"
                          title={
                            flags.unknown
                              ? 'No similar product in your master data or the drug catalog — it will be added as new.'
                              : 'Not in your master data — pick it from the drug catalog below, or add it as new.'
                          }
                        >
                          {flags.unknown ? 'not in master data' : 'new — pick from catalog'}
                        </Badge>
                      )}
                    </div>
                    {/* Composition · Strength · GTIN.
                        Read-only while the line MAPS onto an existing medicine —
                        they belong to the drug in our database and are filled
                        from it, never typed here or written by OCR / Excel.
                        But a line that CREATES a new product has no medicine to
                        source them from, so they stayed blank forever and the
                        new product was born with no salt and no strength on
                        record. For those lines they are typed here, which is the
                        only chance to capture them. */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {/* Prefer the medicine's real salt composition; most rows
                          still carry their molecule in genericName alone, so
                          fall back to that rather than showing an empty box. */}
                      <Input
                        className={cn(cell, !isNewProduct && 'text-muted-foreground')}
                        value={isNewProduct ? l.composition : l.composition || l.genericName}
                        onChange={
                          isNewProduct
                            ? (e) => updateLine(l.id, 'composition', e.target.value)
                            : undefined
                        }
                        readOnly={!isNewProduct}
                        tabIndex={isNewProduct ? undefined : -1}
                        title={
                          isNewProduct
                            ? 'Composition — salt of the new product being created'
                            : l.composition
                              ? `Composition — from the mapped medicine${l.genericName ? ` · generic: ${l.genericName}` : ''}`
                              : 'Composition — from the mapped medicine (generic name; no salt composition on record)'
                        }
                        placeholder={isNewProduct ? 'composition (salt)' : 'composition (from medicine)'}
                      />
                      <Input
                        className={cn(cell, !isNewProduct && 'text-muted-foreground')}
                        value={l.strength}
                        onChange={
                          isNewProduct
                            ? (e) => updateLine(l.id, 'strength', e.target.value)
                            : undefined
                        }
                        readOnly={!isNewProduct}
                        tabIndex={isNewProduct ? undefined : -1}
                        title={
                          isNewProduct
                            ? 'Strength — of the new product being created'
                            : 'Strength — from the mapped medicine'
                        }
                        placeholder={isNewProduct ? 'strength' : 'strength (from medicine)'}
                      />
                      <Input
                        className={cn(cell, 'font-mono text-muted-foreground')}
                        value={l.gtin}
                        readOnly
                        tabIndex={-1}
                        title="GTIN / barcode — from the mapped medicine"
                        placeholder="GTIN (from medicine)"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Type</span>
                    <Select
                      value={isItem ? (l.category || 'consumable') : 'drug'}
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
                      <SelectTrigger className={cn(cell, 'w-full')}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2 text-[11px] text-muted-foreground"
                    onClick={() => toggleRow(l.id)}
                    title="More product details"
                  >
                    {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    More
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600" onClick={() => removeLine(l.id)} title="Remove line">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* ── PO check strip: this entered line vs the matched PO line ── */}
              {poId && (() => {
                const m = poMatchByLine[i];
                if (!m) {
                  if (!l.drugName.trim()) return null;
                  return (
                    <div className="border-t border-outline-variant/30 bg-muted/20 px-3 py-1 text-[11px] text-muted-foreground">
                      Not found on PO {poNumber} — off-order / extra item
                    </div>
                  );
                }
                const rec = parseInt(l.quantityReceived, 10) || 0;
                const remaining = Math.max(0, m.orderedQty - m.alreadyReceived);
                const qd = rec - remaining;
                const rate = parseFloat(l.purchasePrice);
                const rd = m.unitPrice != null && !isNaN(rate) ? rate - m.unitPrice : null;
                const chip = 'rounded px-1.5 py-0.5 font-medium';
                return (
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-primary/15 bg-primary/[0.04] px-3 py-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-primary/80"><FileCheck className="h-3 w-3" /> PO · {m.name}</span>
                    <span className="text-muted-foreground">
                      Ordered <b className="text-foreground">{m.orderedQty}</b>
                      {m.alreadyReceived > 0 && ` · ${m.alreadyReceived} already received · ${remaining} outstanding`}
                    </span>
                    {qd === 0
                      ? <span className={cn(chip, 'bg-emerald-100 text-emerald-800')}>qty ✓</span>
                      : qd < 0
                        ? <span className={cn(chip, 'bg-amber-100 text-amber-800')}>short {Math.abs(qd)}</span>
                        : <span className={cn(chip, 'bg-sky-100 text-sky-800')}>excess {qd}</span>}
                    {m.unitPrice != null && (
                      rd == null
                        ? <span className="text-muted-foreground">PO rate ₹{m.unitPrice.toFixed(2)}</span>
                        : Math.abs(rd) < 0.005
                          ? <span className={cn(chip, 'bg-emerald-100 text-emerald-800')}>rate ✓</span>
                          : <span className={cn(chip, 'bg-amber-100 text-amber-800')}>rate {rd > 0 ? '↑' : '↓'} ₹{Math.abs(rd).toFixed(2)} (PO ₹{m.unitPrice.toFixed(2)})</span>
                    )}
                  </div>
                );
              })()}

              {/* ── Batch & stock · Pricing — divided by hairlines, not nested boxes ── */}
              <div className="grid gap-x-5 gap-y-3 border-t border-outline-variant/40 bg-surface-container-low/30 px-3 py-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
                <div>
                  <SectionLabel>Batch &amp; stock</SectionLabel>
                  <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 sm:grid-cols-4">
                    <LineField label={isItem ? 'Batch (opt)' : 'Batch'}>
                      <Input className={cell} value={l.batchNumber} onChange={(e) => updateLine(l.id, 'batchNumber', e.target.value)} placeholder={isItem ? 'optional' : 'B23A01'} />
                    </LineField>
                    <LineField label={isItem ? 'Expiry (opt)' : 'Expiry'}>
                      <Input className={cell} type="date" value={l.expiryDate} onChange={(e) => updateLine(l.id, 'expiryDate', e.target.value)} />
                    </LineField>
                    <LineField label="Qty">
                      <Input className={cell} type="number" min={1} value={l.quantityReceived} onChange={(e) => updateLine(l.id, 'quantityReceived', e.target.value)} placeholder="blank" />
                    </LineField>
                    <LineField label="Free">
                      <Input className={cell} type="number" min={0} value={l.freeQuantity} onChange={(e) => updateLine(l.id, 'freeQuantity', e.target.value)} />
                    </LineField>
                  </div>
                </div>

                <div className="border-t border-outline-variant/40 pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
                  <SectionLabel>Pricing (per unit)</SectionLabel>
                  <div className="grid grid-cols-3 gap-x-2.5 gap-y-2 sm:grid-cols-6">
                    <LineField label="MRP">
                      <Input className={cell} type="number" step="0.01" value={l.mrp} onChange={(e) => updateLine(l.id, 'mrp', e.target.value)} />
                    </LineField>
                    <LineField label="Rate">
                      <Input className={cell} type="number" step="0.01" value={l.purchasePrice} onChange={(e) => updateLine(l.id, 'purchasePrice', e.target.value)} />
                    </LineField>
                    <LineField label="Disc %">
                      <Input className={cell} type="number" step="0.01" value={l.purchaseDiscountPercent} onChange={(e) => updateLine(l.id, 'purchaseDiscountPercent', e.target.value)} />
                    </LineField>
                    <LineField label="Net">
                      <div className={cn('flex h-8 items-center rounded-xl px-2 text-xs font-semibold tabular-nums', net ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-muted-foreground')}>
                        {net ? `₹${net}` : '—'}
                      </div>
                    </LineField>
                    <LineField label="GST %">
                      <Input className={cell} type="number" step="0.01" value={l.gstPercent} onChange={(e) => updateLine(l.id, 'gstPercent', e.target.value)} />
                    </LineField>
                    <LineField label="Sell">
                      <Input className={cell} type="number" step="0.01" value={l.sellingPrice} onChange={(e) => updateLine(l.id, 'sellingPrice', e.target.value)} />
                    </LineField>
                  </div>
                </div>
              </div>

              {/* Inline validation messages. Errors and warnings are shown
                  together — a row missing a batch usually also has something
                  advisory worth seeing, and hiding it until the error is fixed
                  just costs the user another round trip. */}
              {err.length > 0 && (
                <p className="flex items-start gap-1.5 bg-red-500/5 px-3 py-1.5 text-[11px] text-red-600">
                  <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                  <span>{err.join(' · ')}</span>
                </p>
              )}
              {warn.length > 0 && (
                <p className="bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-600">{warn.join(' · ')}</p>
              )}

              {/* Expandable full product detail */}
              {open && (
                <div className="border-t border-outline-variant/40 bg-surface-container-low/30 px-3 py-2.5">
                  <SectionLabel>More product details</SectionLabel>
                  <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
                    <LineField label="Manufacturer / brand">
                      <Input className={cell} value={l.manufacturer} onChange={(e) => updateLine(l.id, 'manufacturer', e.target.value)} />
                    </LineField>
                    <LineField label="Dosage form">
                      <Select value={l.dosageForm} onValueChange={(v) => updateLine(l.id, 'dosageForm', v ?? '')}>
                        <SelectTrigger className={cn(cell, 'w-full')}><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {DOSAGE_FORMS.map((d) => (
                            <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </LineField>
                    <LineField label="Pack size (units/pack)">
                      <Input className={cell} type="number" min={1} value={l.packSize} onChange={(e) => updateLine(l.id, 'packSize', e.target.value)} />
                    </LineField>
                    <LineField label="Unit (tablet, box, ml…)">
                      <Input className={cell} value={l.unit} onChange={(e) => updateLine(l.id, 'unit', e.target.value)} />
                    </LineField>
                    <LineField label="Reorder level">
                      <Input className={cell} type="number" min={0} value={l.minStock} onChange={(e) => updateLine(l.id, 'minStock', e.target.value)} />
                    </LineField>
                    <LineField label="HSN code">
                      <Input
                        className={cell}
                        value={l.hsnCode}
                        onChange={(e) => applyHsn(l.id, e.target.value)}
                        placeholder="e.g. 3004"
                      />
                      {(() => {
                        const hit = matchHsnGstRate(l.hsnCode, hsnRates);
                        return hit ? (
                          <p className="mt-1 text-[10px] leading-tight text-primary">
                            {hit.gstRate}% GST{hit.description ? ` · ${hit.description}` : ''}
                          </p>
                        ) : null;
                      })()}
                    </LineField>
                  </div>
                </div>
              )}

              {/* Inline formulary match — related drugs from stock + add-new,
                  shown right on the row once matches have been found. */}
              {reviewing && matched[i] && decisions[i] && (
                <LineMatchControl
                  line={l}
                  m={matched[i]}
                  decision={decisions[i]}
                  onDecision={(patch) => setDecision(i, patch)}
                  onPickCatalog={(c) => onPickCatalog(i, c)}
                  onUndoCatalog={() => onUndoCatalog(i)}
                  onIdentity={(idn) => onLineIdentity(i, idn)}
                />
              )}
            </div>
          );
        })}
      </div>

      <Button size="sm" variant="outline" onClick={addLine}>
        <Plus className="mr-1.5 h-4 w-4" /> Add line
      </Button>
    </div>
  );
}

// Inline per-line match — shown right on the entry row. Two sources:
//  • formulary matches → "Map to existing" (keeps stock together)
//  • DrugMaster catalog matches → "From drug catalog" (pick one → import + stock)
// so OCR never dead-ends on a blank "create new" when a similar drug exists.
function LineMatchControl({
  line, m, decision, onDecision, onPickCatalog, onUndoCatalog, onIdentity,
}: {
  line: DraftLine;
  m: InwardMatchedLine;
  decision: Decision;
  onDecision: (patch: Partial<Decision>) => void;
  onPickCatalog: (c: CatalogPick) => void;
  onUndoCatalog: () => void;
  // Report the mapped medicine's DB identity (composition / strength / GTIN) so
  // the read-only fields on the row reflect it.
  onIdentity: (idn: { genericName: string; composition: string; strength: string; gtin: string }) => void;
}) {
  const autoFormulary = m.matches.filter((c) => c.source !== 'catalog');
  const catalogMatches = m.matches.filter((c) => c.source === 'catalog');
  // Existing drugs the user pulled in via the formulary search below (so a
  // shorthand like "test 2" can be mapped to ANY stocked drug, not only the
  // auto-suggested ones). Merged with the auto matches for display.
  const [extraTargets, setExtraTargets] = useState<FormularyMatch[]>([]);
  const seenIds = new Set(autoFormulary.map((x) => x.id));
  const formularyMatches = [...autoFormulary, ...extraTargets.filter((x) => !seenIds.has(x.id))];
  const hasFormulary = formularyMatches.length > 0;
  const target = formularyMatches.find((x) => x.id === decision.targetId) ?? null;

  // Keep the row's read-only composition / strength / GTIN in sync with the
  // medicine this line is tied to — these values come from our DB, never typed
  // or imported:
  //   • mapped to an existing drug → adopt that drug's identity
  //   • "add as new" WITH a catalog link → identity set by the catalog pick (leave)
  //   • "add as new" without a catalog link → a brand-new drug, no DB medicine yet → blank
  // Keyed so it fires once per target/decision change, not every render.
  const mapKey = decision.action === 'map' ? (target?.id ?? '') : null;
  // Composition and strength are TYPED by the user on an unmapped "add as new"
  // line, so the blanking below must only clear an identity we actually adopted
  // from a mapping — never a value someone entered. Without this, collapsing the
  // row or changing the filter remounts the panel, the effect runs again on
  // mount, and their typing is wiped.
  const prevAction = useRef<Decision['action'] | null>(null);
  useEffect(() => {
    const leavingAMapping = prevAction.current === 'map';
    prevAction.current = decision.action;
    if (decision.action === 'map') {
      onIdentity({
        genericName: target?.genericName ?? '',
        composition: target?.composition ?? '',
        strength: target?.strength ?? '',
        gtin: target?.gtin ?? '',
      });
    } else if (!line.drugMasterId && leavingAMapping) {
      onIdentity({ genericName: '', composition: '', strength: '', gtin: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey, decision.action, line.drugMasterId]);

  // ONE search across BOTH this hospital's stock (formulary) AND the platform
  // drug catalog — results are shown together but grouped so the user can tell
  // "already in your stock → map" from "from the catalog → add as new".
  const [uSearch, setUSearch] = useState('');
  const q = uSearch.trim();
  const active = q.length >= 2;
  const { data: catalogSearchResults } = useDrugMasterSearch(uSearch, active);
  const fRes = useFormulary({ search: active ? q : undefined, limit: 6, isActive: true });
  const stockResults = active ? (fRes.data?.data ?? []) : [];
  const catalogResults = active ? (catalogSearchResults ?? []) : [];

  // Pick an existing stocked drug → map the line to it (keeps the typed name as
  // the learned-mapping key).
  const pickExisting = (r: {
    id: string; drugName: string; genericName?: string | null; strength?: string | null;
    manufacturer?: string | null; totalStock?: number | null;
  }) => {
    const chip = {
      id: r.id, drugName: r.drugName, genericName: r.genericName ?? null,
      strength: r.strength ?? null, manufacturer: r.manufacturer ?? null,
      totalStock: r.totalStock ?? 0, score: 100, source: 'formulary' as const,
    } as unknown as FormularyMatch;
    setExtraTargets((prev) => (prev.some((x) => x.id === r.id) ? prev : [...prev, chip]));
    onDecision({ action: 'map', targetId: r.id });
    setUSearch('');
  };

  const matchToPick = (c: FormularyMatch): CatalogPick => ({
    drugMasterId: c.drugMasterId ?? '',
    drugName: c.drugName, genericName: c.genericName, manufacturer: c.manufacturer,
    strength: c.strength, dosageForm: c.dosageForm as string | null,
    packSize: c.packSize, hsnCode: c.hsnCode, gtin: c.gtin,
  });

  // The auto-suggested closest catalog matches (free-text catalog search now
  // lives in the single unified search box above).
  const showCatalog = catalogMatches.length > 0;
  return (
    <div className="mt-2 rounded-md border border-primary/15 bg-primary/[0.03] p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">Match</span>
          {recBadge(m)}
          {!hasFormulary && catalogMatches.length === 0 && (
            <span className="text-muted-foreground">no similar drug found</span>
          )}
        </div>
        {/* Map / Add-new toggle */}
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => onDecision({ action: 'map', targetId: decision.targetId ?? formularyMatches[0]?.id ?? null })}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              decision.action === 'map' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Map to existing
          </button>
          <button
            type="button"
            // Clear the map target too — otherwise a stale targetId lingers on a
            // line that is now being created.
            onClick={() => onDecision({ action: 'create', targetId: null })}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              decision.action === 'create' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Add as new
          </button>
        </div>
      </div>

      {/* One search — your stock AND the drug catalog together, grouped. Picking
          a stock drug maps to it (keeps the typed name); picking a catalog drug
          adopts its identity into the boxes and adds it as new. */}
      <div className="mt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={uSearch}
            onChange={(e) => setUSearch(e.target.value)}
            placeholder="Search your stock or the drug catalog by name…"
            className="h-7 pl-7 text-xs"
          />
        </div>
        {active && (stockResults.length > 0 || catalogResults.length > 0) && (
          <div className="mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-sm sanctuary-scrollbar">
            {/* In your stock → map to existing */}
            {stockResults.length > 0 && (
              <>
                <div className="sticky top-0 z-10 border-b bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  In your stock — map to existing
                </div>
                {stockResults.map((r) => (
                  <button
                    key={`s-${r.id}`}
                    type="button"
                    onClick={() => pickExisting(r)}
                    className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs hover:bg-emerald-50/60"
                  >
                    <span className="truncate font-medium">{r.drugName}</span>
                    {r.strength && <span className="shrink-0 text-muted-foreground">{r.strength}</span>}
                    <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      stock {r.totalStock ?? 0}
                    </span>
                  </button>
                ))}
              </>
            )}
            {/* From the catalog → add as new */}
            {catalogResults.length > 0 && (
              <>
                <div className="sticky top-0 z-10 border-b border-t bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                  Drug catalog — add as new
                </div>
                {catalogResults.map((r) => (
                  <button
                    key={`c-${r.id}`}
                    type="button"
                    onClick={() => {
                      onPickCatalog({
                        drugMasterId: r.id, drugName: r.name, genericName: r.genericName,
                        manufacturer: r.manufacturer, strength: r.strength,
                        dosageForm: r.dosageForm as string | null,
                        packSize: r.packSize ?? undefined,
                        hsnCode: r.hsnCode ?? undefined,
                        gtin: r.gtin ?? undefined,
                      });
                      setUSearch('');
                    }}
                    className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs hover:bg-blue-50/60"
                  >
                    <Plus className="h-3 w-3 shrink-0 text-blue-600" />
                    <span className="truncate font-medium">{r.name}</span>
                    {r.strength && <span className="shrink-0 text-muted-foreground">{r.strength}</span>}
                    {r.manufacturer && <span className="truncate text-muted-foreground">· {r.manufacturer}</span>}
                    <Badge variant="outline" className="ml-auto shrink-0 border-blue-500/20 bg-blue-500/10 text-[10px] text-blue-700">
                      catalog
                    </Badge>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {decision.action === 'map' ? (
        <div className="mt-2 space-y-2">
          {!hasFormulary && (
            <p className="text-[11px] text-muted-foreground">
              Use the search above and pick the drug this line should be added to.
            </p>
          )}

          {/* In-stock drugs — pick which one to add this batch to. */}
          <div className="flex flex-wrap gap-1.5">
            {formularyMatches.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onDecision({ targetId: c.id })}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                  decision.targetId === c.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted',
                )}
              >
                {decision.targetId === c.id && <Check className="h-3 w-3 text-primary" />}
                <span className="truncate max-w-[160px]">{c.drugName}</span>
                {c.strength && <span className="text-muted-foreground">{c.strength}</span>}
                {(c as { remembered?: boolean }).remembered ? (
                  <Badge className="border-violet-500/20 bg-violet-500/10 text-[10px] text-violet-700">
                    Remembered
                  </Badge>
                ) : (
                  <Badge variant="outline" className="font-mono text-[10px]">{c.score}%</Badge>
                )}
                <span className="text-[10px] text-emerald-700">stock {c.totalStock}</span>
              </button>
            ))}
          </div>
          {target && (
            <p className="text-[11px] text-muted-foreground">
              Stock will be added to <span className="font-medium text-foreground">{target.drugName}</span>
              {target.strength ? ` ${target.strength}` : ''} — no duplicate created.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {line.drugMasterId ? (
            <>
              Linked to catalog drug{' '}
              <span className="font-medium text-foreground">{line.catalogPickName ?? 'selected'}</span>
              {' '}— it will be created in your formulary from the catalog, then stocked.
            </>
          ) : (
            `Will be added as a new ${line.kind === 'item' ? 'inventory item' : 'drug'}, then stocked.`
          )}
          {hasFormulary && ' A similar record exists — switch to “Map to existing” to avoid splitting stock.'}
        </p>
      )}

      {/* Catalog picker — search the platform catalog OR pick a closest match.
          Picking one adopts its identity and imports it on receive. */}
      {showCatalog && (
        <div className="mt-2 border-t border-primary/10 pt-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              From drug catalog {!hasFormulary && catalogMatches.length > 0 && '— closest matches'}
            </p>
            {line.drugMasterId && (
              <button
                type="button"
                onClick={onUndoCatalog}
                title="Unlink this catalog drug"
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
              >
                <Undo2 className="h-3 w-3" /> Unlink{line.catalogPickName ? ` “${line.catalogPickName}”` : ''}
              </button>
            )}
          </div>

          {/* Auto-suggested closest catalog drugs */}
          {catalogMatches.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {catalogMatches.map((c) => {
                const picked = !!line.drugMasterId && line.drugMasterId === c.drugMasterId;
                return (
                  <button
                    key={c.drugMasterId}
                    type="button"
                    onClick={() => onPickCatalog(matchToPick(c))}
                    title="Use this catalog drug — imports it into your formulary and stocks it"
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                      picked ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'hover:bg-muted',
                    )}
                  >
                    {picked ? <Check className="h-3 w-3 text-emerald-600" /> : <Plus className="h-3 w-3 text-muted-foreground" />}
                    <span className="truncate max-w-[180px]">{c.drugName}</span>
                    {c.strength && <span className="text-muted-foreground">{c.strength}</span>}
                    {c.manufacturer && <span className="hidden text-muted-foreground sm:inline">· {c.manufacturer}</span>}
                    <Badge variant="outline" className="font-mono text-[10px]">{c.score}%</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 3: result summary ──────────────────────────────────
// Shows the internal barcode minted for every batch just posted. This is the
// moment it matters — the stock is physically on the bench in front of whoever
// received it, so the code has to be here rather than somewhere they must go
// and look for it afterwards.
function DoneStep({ lines, result }: { lines: DraftLine[]; result: CommitInwardResult }) {
  const [viewIds, setViewIds] = useState<string[]>([]);
  const postedIds = result.results
    .filter((r) => r.status === 'ok' && r.batchId)
    .map((r) => r.batchId as string);
  const { data: labels = [] } = useBatchLabels(postedIds);
  const codeFor = new Map(labels.map((l) => [l.batchId, l.code128]));

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
      {postedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            An internal barcode was generated for each batch received — scan it or use the
            number below.
          </p>
          <Button size="sm" variant="outline" onClick={() => setViewIds(postedIds)}>
            <Barcode className="mr-1.5 h-4 w-4" /> View barcodes
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        {result.results.map((r) => {
          const code = r.batchId ? codeFor.get(r.batchId) : undefined;
          return (
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
              <div className="flex shrink-0 items-center gap-2">
                {code && (
                  <button
                    type="button"
                    onClick={() => setViewIds([r.batchId as string])}
                    title="View this barcode"
                    className="font-mono text-[11px] font-semibold tracking-wide text-primary hover:underline"
                  >
                    ▮ {code}
                  </button>
                )}
                <span className={cn('text-xs', r.status === 'error' ? 'text-red-600' : 'text-muted-foreground')}>
                  {r.status === 'ok' ? 'Stock posted' : r.message}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <BarcodeViewDialog
        batchIds={viewIds}
        open={viewIds.length > 0}
        onOpenChange={(open) => !open && setViewIds([])}
      />
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

// ── Import step — the uploaded CSV/Excel sheet, full width and editable ───────
// A vendor's sheet is rarely perfect: a missing name, an expiry the parser can't
// read, a column we guessed wrong. So this is a working screen, not a preview —
// map the columns, fix the cells in place, drop the junk rows, and only then
// turn it into lines. Handles any distributor layout, not just our template.
function ImportStep({
  rows,
  onRowsChange,
  onCancel,
  onConfirm,
}: {
  rows: string[][];
  onRowsChange: (rows: string[][]) => void;
  onCancel: () => void;
  onConfirm: (lines: DraftLine[]) => void;
}) {
  const colCount = Math.max(0, ...rows.map((r) => r.length));
  const [hasHeader, setHasHeader] = useState(() => looksLikeHeader(rows[0] ?? []));
  const [mapping, setMapping] = useState<(DraftCol | 'ignore')[]>(() => {
    const base = looksLikeHeader(rows[0] ?? [])
      ? guessMapping(rows[0] ?? [])
      : (DEFAULT_ORDER as (DraftCol | 'ignore')[]);
    return Array.from({ length: colCount }, (_, i) => base[i] ?? 'ignore');
  });

  const setCol = (i: number, v: DraftCol | 'ignore') =>
    setMapping((prev) => prev.map((m, idx) => (idx === i ? v : m)));

  const headerRow = rows[0] ?? [];
  const dataStart = hasHeader ? 1 : 0;
  const built = useMemo(() => buildLinesFromRows(rows, mapping, hasHeader), [rows, mapping, hasHeader]);
  const hasName = mapping.includes('drugName');
  const nameCol = mapping.indexOf('drugName');
  const expiryCol = mapping.indexOf('expiryDate');
  const autoMapped = mapping.filter((m) => m !== 'ignore').length;

  /** Edit one cell of the sheet in place. */
  const setCell = (r: number, c: number, v: string) =>
    onRowsChange(
      rows.map((row, ri) => {
        if (ri !== r) return row;
        // Rows can be ragged — pad so a trailing column is editable.
        const padded = [...row, ...Array(Math.max(0, colCount - row.length)).fill('')];
        return padded.map((cell, ci) => (ci === c ? v : cell));
      }),
    );

  const removeRow = (r: number) => onRowsChange(rows.filter((_, ri) => ri !== r));

  // The two things that quietly lose data: a row with no name is dropped by the
  // parser, and an unreadable date is blanked. Surface both instead.
  const rowIssue = (r: string[]): string | null => {
    if (!hasName) return null;
    if (!(r[nameCol] ?? '').trim()) return 'No name — this row will be skipped';
    if (expiryCol >= 0) {
      const raw = (r[expiryCol] ?? '').trim();
      if (raw && !parseExpiry(raw)) return `Expiry "${raw}" is not a date we can read — use MM/YYYY`;
    }
    return null;
  };
  const dataRows = rows.slice(dataStart);
  const issueCount = dataRows.filter((r) => rowIssue(r)).length;
  const skipped = hasName ? dataRows.filter((r) => !(r[nameCol] ?? '').trim()).length : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-headline text-lg font-bold">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Review imported sheet
          </h2>
          <p className="text-xs text-muted-foreground">
            {dataRows.length} row{dataRows.length === 1 ? '' : 's'} read · {autoMapped} of {colCount}{' '}
            columns matched automatically. Every cell below is editable — fix anything the vendor got
            wrong, then add them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(built)} disabled={!hasName || built.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" /> Add {built.length} line{built.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-surface-container-lowest px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-primary"
            checked={hasHeader}
            onChange={(e) => setHasHeader(e.target.checked)}
          />
          First row is a header
        </label>
        <span className="text-xs text-muted-foreground">
          {built.length} line{built.length === 1 ? '' : 's'} ready
        </span>
        {!hasName && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Set one column to &ldquo;Name&rdquo; to continue — it is the only required field.
          </span>
        )}
        {skipped > 0 && (
          <span className="text-xs font-medium text-amber-600">
            {skipped} row{skipped === 1 ? '' : 's'} have no name and will be skipped
          </span>
        )}
        {issueCount > skipped && (
          <span className="text-xs font-medium text-amber-600">
            {issueCount - skipped} row{issueCount - skipped === 1 ? '' : 's'} with an unreadable date
          </span>
        )}
      </div>

      {/* The sheet — every cell editable */}
      <div className="max-h-[62vh] overflow-auto rounded-lg border sanctuary-scrollbar">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:align-top">
              <th className="w-10" />
              {Array.from({ length: colCount }).map((_, i) => (
                <th key={i} className="min-w-[168px]">
                  <Select
                    value={mapping[i] ?? 'ignore'}
                    onValueChange={(v) => setCol(i, (v ?? 'ignore') as DraftCol | 'ignore')}
                  >
                    <SelectTrigger
                      className={cn('h-8 w-full', mapping[i] === 'ignore' && 'text-muted-foreground')}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAP_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasHeader && headerRow[i] && (
                    <div
                      className="mt-1 truncate text-[10px] font-normal text-muted-foreground"
                      title={headerRow[i]}
                    >
                      from &ldquo;{headerRow[i]}&rdquo;
                    </div>
                  )}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {dataRows.map((r, ri) => {
              const rowIdx = dataStart + ri;
              const issue = rowIssue(r);
              const noName = hasName && !(r[nameCol] ?? '').trim();
              return (
                <tr key={rowIdx} className={cn('border-t', issue && 'bg-amber-500/5')}>
                  <td className="px-2 py-1 text-center text-[10px] text-muted-foreground">{ri + 1}</td>
                  {Array.from({ length: colCount }).map((_, ci) => (
                    <td key={ci} className="px-1 py-1">
                      <Input
                        value={r[ci] ?? ''}
                        onChange={(e) => setCell(rowIdx, ci, e.target.value)}
                        className={cn(
                          'h-7 border-transparent bg-transparent px-1.5 text-xs hover:border-input focus:border-input',
                          mapping[ci] === 'ignore' && 'text-muted-foreground/40',
                          noName && ci === nameCol && 'border-red-400/60 bg-red-500/5',
                          issue && !noName && ci === expiryCol && 'border-amber-400/60 bg-amber-500/5',
                        )}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                      title="Remove this row"
                      onClick={() => removeRow(rowIdx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {dataRows.length === 0 && (
              <tr>
                <td colSpan={colCount + 2} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  Every row was removed. Cancel to start over.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {issueCount > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          Highlighted rows need a look — a row with no name is skipped, and an expiry we cannot read
          is imported blank. Fix them here, or remove the row.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        Columns set to &ldquo;— Ignore —&rdquo; are not imported. Use &ldquo;Type / Category&rdquo;
        for a column that says whether a row is a medicine or another supply. Once added, every line
        is matched against your master data, where you can map it to an existing product or add it
        as new.
      </p>
    </div>
  );
}

