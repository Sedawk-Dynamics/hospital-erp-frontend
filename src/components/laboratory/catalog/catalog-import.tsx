'use client';

// Gap 369: bulk catalogue maintenance by the Hospital Admin.

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCommitLabImport, usePreviewLabImport, type ImportPlan } from '@/hooks/use-lab-catalog';
import { labImportTemplate, parseLabImportGrid, type LabImportRow } from '@/lib/lab-catalog-import';
import { getApiErrorMessage } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;

export function CatalogImportSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = usePreviewLabImport();
  const commit = useCommitLabImport();
  const [rows, setRows] = useState<LabImportRow[]>([]);
  const [plans, setPlans] = useState<ImportPlan[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Record<string, { status: 'saved' | 'failed'; message: string }>>({});

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(labImportTemplate()), 'Lab tests');
    XLSX.writeFile(wb, 'lab-catalogue-template.xlsx');
  };

  const onFile = async (file: File) => {
    if (file.size > MAX_BYTES) return void toast.error('The file is larger than 5 MB');
    setPlans([]);
    setOutcome({});
    setReasons({});
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const grid = sheet
        ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true, defval: '', raw: true })
        : [];
      const parsed = parseLabImportGrid(grid);
      if (parsed.error) return void toast.error(parsed.error);
      const res = await preview.mutateAsync(parsed.rows);
      setRows(parsed.rows);
      setPlans(res.tests);
      // Nothing is ticked for you: each test is confirmed deliberately.
      setTicked(new Set());
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not read this file'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const usable = plans.filter((p) => p.errors.length === 0 && !outcome[p.key]);
  const chosen = usable.filter((p) => ticked.has(p.key));
  const missingReason = chosen.some((p) => p.priceConflicts.length > 0 && (reasons[p.key] ?? '').trim().length < 5);

  const onCommit = async () => {
    try {
      const res = await commit.mutateAsync({
        rows,
        confirmed: chosen.map((p) => ({
          key: p.key,
          action: p.action,
          testId: p.testId,
          stamp: p.stamp,
          priceReason: p.priceConflicts.length > 0 ? reasons[p.key].trim() : undefined,
        })),
      });
      setOutcome((o) => ({ ...o, ...Object.fromEntries(res.results.map((r) => [r.key, r])) }));
      setTicked(new Set());
      const ranges = res.results.reduce((n, r) => n + (r.rangeProposals ?? 0), 0);
      const text = `${res.saved} saved, ${res.failed} not saved${ranges ? `; ${ranges} range(s) sent for pathologist approval` : ''}`;
      if (res.failed) toast.warning(text);
      else toast.success(text);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Import failed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
          <Download className="h-4 w-4" /> Template
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          aria-label="Lab catalogue file"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button size="sm" className="gap-1.5" disabled={preview.isPending} onClick={() => fileRef.current?.click()}>
          {preview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Choose file
        </Button>
        <p className="text-xs text-muted-foreground">
          One row per parameter; repeat the test name and code on each row. Blank cells leave what is already there.
          Reference ranges in the file wait for a pathologist.
        </p>
      </div>

      {plans.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{plans.length} test(s) in the file, {plans.filter((p) => p.errors.length > 0).length} with errors</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={usable.length === 0} onClick={() => setTicked(new Set(usable.map((p) => p.key)))}>
              Tick all without errors
            </Button>
            <Button size="sm" className="ml-auto" disabled={chosen.length === 0 || missingReason || commit.isPending} onClick={onCommit}>
              {commit.isPending ? 'Saving…' : `Save ${chosen.length} ticked`}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-surface-container-lowest">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase text-muted-foreground">
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2">Rows</th>
                  <th className="px-3 py-2">Test</th>
                  <th className="px-3 py-2">What happens</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const done = outcome[p.key];
                  return (
                    <tr key={p.key} className="border-b align-top last:border-b-0">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Import ${p.testName}`}
                          disabled={p.errors.length > 0 || !!done}
                          checked={ticked.has(p.key)}
                          onChange={(e) =>
                            setTicked((s) => {
                              const n = new Set(s);
                              if (e.target.checked) n.add(p.key);
                              else n.delete(p.key);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{p.rowNumbers.join(', ')}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.testName}</div>
                        <span className="font-mono text-[10px] text-muted-foreground">{p.testCode}</span>{' '}
                        <Badge className="text-[10px]">{p.action === 'create' ? 'New' : 'Update'}</Badge>
                      </td>
                      <td className="space-y-0.5 px-3 py-2">
                        {p.errors.map((m) => <p key={m} className="text-destructive">{m}</p>)}
                        {p.changes.map((m) => <p key={m}>{m}</p>)}
                        {p.rangeChanges.map((m) => <p key={m} className="text-sky-800">Range for approval: {m}</p>)}
                        {p.warnings.map((m) => <p key={m} className="text-amber-800">{m}</p>)}
                        {p.priceConflicts.map((c) => <p key={c.message} className="text-amber-800">{c.message}</p>)}
                        {p.priceConflicts.length > 0 && !done && (
                          <Input
                            className="h-7 text-xs"
                            placeholder="Reason for this price (required)"
                            value={reasons[p.key] ?? ''}
                            onChange={(e) => setReasons((r) => ({ ...r, [p.key]: e.target.value }))}
                          />
                        )}
                        {done && <p className={done.status === 'saved' ? 'text-emerald-700' : 'text-destructive'}>{done.message}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
