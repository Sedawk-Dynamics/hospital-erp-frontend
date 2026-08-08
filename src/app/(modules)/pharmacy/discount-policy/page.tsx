'use client';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Percent, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  useDiscountConfig,
  useUpdateDiscountConfig,
  useDiscountRules,
  useCreateDiscountRule,
  useUpdateDiscountRule,
  useDeleteDiscountRule,
  type DiscountMode,
  type MarginDiscountRule,
} from '@/hooks/use-discount-policy';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';

interface RuleForm {
  label: string;
  minMarginPercent: string;
  maxMarginPercent: string;
  maxDiscountPercent: string;
  isActive: boolean;
  sortOrder: string;
}

const emptyForm: RuleForm = {
  label: '',
  minMarginPercent: '',
  maxMarginPercent: '',
  maxDiscountPercent: '',
  isActive: true,
  sortOrder: '0',
};

function DiscountPolicyInner() {
  const { data: config, isLoading: configLoading } = useDiscountConfig();
  const { data: rules, isLoading: rulesLoading } = useDiscountRules();
  const updateConfig = useUpdateDiscountConfig();
  const createRule = useCreateDiscountRule();
  const updateRule = useUpdateDiscountRule();
  const deleteRule = useDeleteDiscountRule();

  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<DiscountMode>('cap');
  // Seed once on arrival. Re-seeding on every refetch would flip the toggles
  // back under the user as soon as the window regained focus.
  useSeedOnChange(config ? 'discount-policy' : null, () => {
    if (!config) return;
    setEnabled(config.enabled);
    setMode(config.mode);
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const saveConfig = async (next: { enabled?: boolean; mode?: DiscountMode }) => {
    try {
      await updateConfig.mutateAsync(next);
      toast.success('Discount policy updated');
    } catch {
      toast.error('Failed to update policy');
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (r: MarginDiscountRule) => {
    setEditingId(r.id);
    setForm({
      label: r.label,
      minMarginPercent: String(r.minMarginPercent),
      maxMarginPercent: r.maxMarginPercent == null ? '' : String(r.maxMarginPercent),
      maxDiscountPercent: String(r.maxDiscountPercent),
      isActive: r.isActive,
      sortOrder: String(r.sortOrder),
    });
    setDialogOpen(true);
  };

  const saveRule = async () => {
    if (!form.label.trim()) return toast.error('Label is required');
    const min = Number(form.minMarginPercent);
    const disc = Number(form.maxDiscountPercent);
    if (!Number.isFinite(min)) return toast.error('Enter a valid lower margin %');
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) return toast.error('Discount must be 0–100%');
    const max = form.maxMarginPercent.trim() === '' ? null : Number(form.maxMarginPercent);
    if (max != null && max < min) return toast.error('Upper margin must be ≥ lower margin');
    const payload = {
      label: form.label.trim(),
      minMarginPercent: min,
      maxMarginPercent: max,
      maxDiscountPercent: disc,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      if (editingId) await updateRule.mutateAsync({ id: editingId, ...payload });
      else await createRule.mutateAsync(payload);
      toast.success(editingId ? 'Band updated' : 'Band added');
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save band');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteRule.mutateAsync(deleteId);
      toast.success('Band removed');
    } catch {
      toast.error('Failed to remove band');
    } finally {
      setDeleteId(null);
    }
  };

  const bands = rules ?? [];
  const band = (r: MarginDiscountRule) =>
    r.maxMarginPercent == null
      ? `≥ ${r.minMarginPercent}%`
      : `${r.minMarginPercent}% – ${r.maxMarginPercent}%`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Percent className="h-6 w-6 text-primary" /> Margin-based Discount
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A separate, system-wide discount layer. Map a medicine&apos;s profit-margin band to the
          maximum discount the counter may grant — instead of editing each medicine&apos;s price.
          It is a visual refinement: it never changes stored prices.
        </p>
      </div>

      {/* Config card */}
      <div className="rounded-xl border bg-surface-container-lowest p-4 shadow-sanctuary">
        {configLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={enabled}
                onChange={(e) => {
                  setEnabled(e.target.checked);
                  void saveConfig({ enabled: e.target.checked });
                }}
              />
              <span className="text-sm font-medium">Enable margin-based discount at the counter</span>
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Behaviour</Label>
              <Select
                value={mode}
                onValueChange={(v) => {
                  const m = v as DiscountMode;
                  setMode(m);
                  void saveConfig({ mode: m });
                }}
              >
                <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cap">Cap (enforce ceiling)</SelectItem>
                  <SelectItem value="suggest">Suggest (show only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Rules */}
      <div className="rounded-xl border bg-surface-container-lowest shadow-sanctuary">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-sm font-semibold">Margin bands</h2>
            <p className="text-xs text-muted-foreground">
              The first matching active band (top-down) sets the maximum discount.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> Add band
          </Button>
        </div>

        {rulesLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : bands.length === 0 ? (
          <EmptyState
            icon={Percent}
            title="No margin bands yet"
            description="Add a band (e.g. margin ≥ 30% → up to 10% discount) to start."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Margin band</TableHead>
                <TableHead className="text-right">Max discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bands.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{r.sortOrder}</TableCell>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="tabular-nums">{band(r)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{r.maxDiscountPercent}%</TableCell>
                  <TableCell>
                    {r.isActive ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                      onClick={() => setDeleteId(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit band' : 'Add band'}</DialogTitle>
            <DialogDescription>
              Items whose profit margin falls in this band may be discounted up to the max below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. High margin" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Margin % from</Label>
                <Input type="number" step="0.01" value={form.minMarginPercent} onChange={(e) => setForm({ ...form, minMarginPercent: e.target.value })} placeholder="30" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">to (blank = and above)</Label>
                <Input type="number" step="0.01" value={form.maxMarginPercent} onChange={(e) => setForm({ ...form, maxMarginPercent: e.target.value })} placeholder="∞" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Max discount %</Label>
                <Input type="number" step="0.01" min={0} max={100} value={form.maxDiscountPercent} onChange={(e) => setForm({ ...form, maxDiscountPercent: e.target.value })} placeholder="10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority (lower first)</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={saveRule} disabled={createRule.isPending || updateRule.isPending}>
              <Check className="mr-1.5 h-4 w-4" /> {editingId ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove band?</DialogTitle>
            <DialogDescription>This margin band will no longer cap discounts at the counter.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteRule.isPending}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DiscountPolicyPage() {
  return (
    <PharmacyAdminGuard>
      <DiscountPolicyInner />
    </PharmacyAdminGuard>
  );
}
