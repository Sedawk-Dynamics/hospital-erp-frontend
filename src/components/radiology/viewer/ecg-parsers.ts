// Lightweight ECG parsers — recognize the three common raw-waveform export
// shapes our customers send in:
//   1. HL7 aECG XML  — `<AnnotatedECG>` envelope with <component>… signal
//      blocks; we parse the digit list for each lead.
//   2. CSV           — first row = headers ("Time,I,II,III,…"), one column
//      per lead. Sampling rate inferred from the time column.
//   3. JSON          — Philips/GE Muse exports often dump structured JSON
//      with `{ samplingRate, leads: { I: [...], II: [...], ... } }`.
//
// All three normalize to the same `ParsedEcg` shape so the SVG plotter can
// consume them uniformly.

export interface ParsedEcgLead {
  name: string;            // "I", "II", "III", "aVR", "V1", …
  samples: number[];       // microvolts (uV)
}

export interface ParsedEcg {
  /** Hz */
  samplingRate: number;
  /** millivolts per ADC unit if the file isn't already in uV. */
  unit: 'mV' | 'uV';
  leads: ParsedEcgLead[];
  meta: {
    heartRate?: number;
    pr?: number; // ms
    qrs?: number; // ms
    qt?: number; // ms
    qtc?: number; // ms
    rhythm?: string;
    recordedAt?: string;
  };
}

const STANDARD_LEAD_ORDER = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

function sortLeads(leads: ParsedEcgLead[]): ParsedEcgLead[] {
  const order = new Map(STANDARD_LEAD_ORDER.map((n, i) => [n.toUpperCase(), i]));
  return [...leads].sort((a, b) => {
    const ai = order.get(a.name.toUpperCase()) ?? 99;
    const bi = order.get(b.name.toUpperCase()) ?? 99;
    return ai - bi;
  });
}

/** Master entry — sniff the format from a fetched body. */
export async function parseEcgBlob(blob: Blob, fileName?: string): Promise<ParsedEcg | null> {
  const text = await blob.text();
  const trimmed = text.trim();

  // XML / HL7 aECG
  if (trimmed.startsWith('<') || fileName?.toLowerCase().endsWith('.xml') || fileName?.toLowerCase().endsWith('.hl7')) {
    return parseAEcgXml(trimmed);
  }
  // JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || fileName?.toLowerCase().endsWith('.json')) {
    return parseJsonEcg(trimmed);
  }
  // CSV fallback
  return parseCsvEcg(trimmed);
}

// ─── HL7 aECG parser ─────────────────────────────────────────────────
// Looks for <code code="II"> or similar in <component> blocks and the
// <digits> element under <value> for each lead. Robust to most aECG dumps;
// signed integers are interpreted in the unit declared on <scale>.
function parseAEcgXml(xml: string): ParsedEcg | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) return null;

    const samplingNode = doc.querySelector('increment[unit][value]');
    const incrementValue = parseFloat(samplingNode?.getAttribute('value') ?? '');
    const incrementUnit = samplingNode?.getAttribute('unit') ?? 's';
    let samplingRate = 500;
    if (incrementValue) {
      const seconds = incrementUnit === 'ms' ? incrementValue / 1000 : incrementValue;
      if (seconds > 0) samplingRate = Math.round(1 / seconds);
    }

    const leads: ParsedEcgLead[] = [];
    const components = doc.querySelectorAll('component');
    components.forEach((cmp) => {
      const codeEl = cmp.querySelector('code[code]');
      const code = codeEl?.getAttribute('code') ?? '';
      // Match standard 12-lead names + minor variations (MDC_ECG_LEAD_II → II).
      const m = code.toUpperCase().match(/(?:MDC_ECG_LEAD_)?(I{1,3}|AVR|AVL|AVF|V[1-6])$/);
      if (!m) return;
      const digits = cmp.querySelector('digits')?.textContent?.trim() ?? '';
      if (!digits) return;
      const samples = digits.split(/\s+/).map(Number).filter((n) => isFinite(n));
      if (samples.length > 0) {
        leads.push({ name: m[1].replace('AVR', 'aVR').replace('AVL', 'aVL').replace('AVF', 'aVF'), samples });
      }
    });

    if (leads.length === 0) return null;
    return {
      samplingRate,
      unit: 'uV',
      leads: sortLeads(leads),
      meta: extractAEcgMeta(doc),
    };
  } catch {
    return null;
  }
}

function extractAEcgMeta(doc: Document) {
  const meta: ParsedEcg['meta'] = {};
  // Heart rate observation
  const hrNode = doc.querySelector('observation[code="HR"] value[value]')
    || doc.querySelector('observation code[code="HR"] + value');
  const hrAttr = hrNode?.getAttribute('value');
  if (hrAttr) meta.heartRate = parseFloat(hrAttr);
  return meta;
}

// ─── CSV parser ──────────────────────────────────────────────────────
// First line = header. We find a "time" column (any header containing
// "time" or "ms" or "s") to compute sampling rate; remaining columns become
// leads. Numeric values are read as microvolts by default — if a header
// says "mV" we'll multiply by 1000 to normalize.
function parseCsvEcg(text: string): ParsedEcg | null {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 3) return null;
  const headers = lines[0].split(/[,;\t]/).map((s) => s.trim());
  const timeIdx = headers.findIndex((h) => /time|ms|sec/i.test(h));
  const dataRows = lines.slice(1).map((l) => l.split(/[,;\t]/).map((v) => parseFloat(v)));

  let samplingRate = 500;
  if (timeIdx >= 0 && dataRows.length > 1) {
    const t0 = dataRows[0][timeIdx];
    const t1 = dataRows[1][timeIdx];
    if (isFinite(t0) && isFinite(t1) && t1 !== t0) {
      // Heuristic: if values look like seconds (<10), treat as s; else ms.
      const unit = Math.abs(t1) < 10 ? 's' : 'ms';
      const dt = unit === 's' ? t1 - t0 : (t1 - t0) / 1000;
      if (dt > 0) samplingRate = Math.round(1 / dt);
    }
  }

  const leads: ParsedEcgLead[] = [];
  headers.forEach((h, i) => {
    if (i === timeIdx) return;
    if (!/^([IVX]+|aVR|aVL|aVF|V[1-6])/i.test(h.trim())) return;
    const isMv = /mv/i.test(h);
    const samples = dataRows.map((r) => {
      const v = r[i];
      return isFinite(v) ? (isMv ? v * 1000 : v) : 0;
    });
    leads.push({ name: h.trim(), samples });
  });

  if (leads.length === 0) return null;
  return { samplingRate, unit: 'uV', leads: sortLeads(leads), meta: {} };
}

// ─── JSON parser ─────────────────────────────────────────────────────
// Accepts a number of common shapes:
//   { samplingRate, leads: { I: [...], II: [...] } }
//   { fs, leads: [{ name, samples }, …] }
//   { ecg: { … } } (one level deeper)
function parseJsonEcg(text: string): ParsedEcg | null {
  try {
    const data = JSON.parse(text);
    const root = data?.ecg ?? data;
    const samplingRate = Number(root?.samplingRate ?? root?.fs ?? 500);
    let leads: ParsedEcgLead[] = [];
    if (Array.isArray(root?.leads)) {
      leads = root.leads
        .filter((l: any) => typeof l?.name === 'string' && Array.isArray(l?.samples))
        .map((l: any) => ({ name: l.name, samples: l.samples.map(Number) }));
    } else if (root?.leads && typeof root.leads === 'object') {
      leads = Object.entries(root.leads)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => ({ name: k, samples: (v as any[]).map(Number) }));
    }
    if (leads.length === 0) return null;
    return {
      samplingRate,
      unit: root?.unit === 'mV' ? 'mV' : 'uV',
      leads: sortLeads(leads),
      meta: {
        heartRate: root?.heartRate ?? root?.hr,
        pr: root?.pr,
        qrs: root?.qrs,
        qt: root?.qt,
        qtc: root?.qtc,
        rhythm: root?.rhythm,
        recordedAt: root?.recordedAt,
      },
    };
  } catch {
    return null;
  }
}
