'use client';

// Super-admin Lab Test Templates — platform-wide catalog of structured
// lab reports (CBC, Lipid Profile, LFT, ...). Each hospital admin can
// clone them into their own LabTestCatalog with a single click.
//
// Mirrors the Form Templates page (see /super-admin/form-templates).

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Beaker,
  Eye,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useLabTemplates,
  useCreateLabTemplate,
  useDeleteLabTemplate,
  type LabTestTemplate,
} from '@/hooks/use-lab-templates';
import { LabReportPreviewDialog } from '@/components/laboratory/lab-report-preview';

export default function SuperAdminLabTemplatesPage() {
  const router = useRouter();
  const { data, isLoading } = useLabTemplates({ limit: 100 });
  const createTpl = useCreateLabTemplate();
  const deleteTpl = useDeleteLabTemplate();

  const [search, setSearch] = useState('');
  const [openNew, setOpenNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', departmentName: '', code: '' });
  const [confirmDelete, setConfirmDelete] = useState<LabTestTemplate | null>(null);
  const [previewTpl, setPreviewTpl] = useState<LabTestTemplate | null>(null);

  const templates = data?.data ?? [];
  const filtered = templates.filter((t) =>
    !search.trim()
      ? true
      : `${t.name} ${t.code ?? ''} ${t.departmentName}`.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleCreate() {
    if (!newForm.name.trim() || !newForm.departmentName.trim()) {
      toast.error('Name and department are required');
      return;
    }
    try {
      const tpl = await createTpl.mutateAsync({
        name: newForm.name.trim(),
        departmentName: newForm.departmentName.trim(),
        code: newForm.code.trim() || null,
        parameters: [],
        isPublished: false,
      });
      toast.success('Template created');
      setOpenNew(false);
      setNewForm({ name: '', departmentName: '', code: '' });
      if (tpl?.id) router.push(`/super-admin/lab-templates/${tpl.id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create';
      toast.error(msg);
    }
  }

  async function handleDelete(tpl: LabTestTemplate) {
    try {
      await deleteTpl.mutateAsync(tpl.id);
      toast.success('Template deleted');
      setConfirmDelete(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete';
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            Lab Test Templates
          </h1>
          <p className="font-label text-sm text-on-surface-variant">
            Platform-wide lab report definitions. Hospitals clone these one-by-one or all-at-once into their own catalog.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New template
        </Button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {templates.length}
          </p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {templates.length === 0
              ? 'No templates yet. Click "New template" to start building one.'
              : 'No templates match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Test</th>
                  <th className="text-left py-2 px-2">Code</th>
                  <th className="text-left py-2 px-2">Department</th>
                  <th className="text-right py-2 px-2">Parameters</th>
                  <th className="text-right py-2 px-2">Default ₹</th>
                  <th className="text-right py-2 px-2">TAT</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Hospital clones</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-surface-container-low transition-colors">
                    <td className="py-2 px-2">
                      <Link
                        href={`/super-admin/lab-templates/${t.id}`}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {t.name}
                      </Link>
                      {t.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono text-[11px] text-muted-foreground">{t.code ?? '—'}</td>
                    <td className="py-2 px-2 text-xs">{t.departmentName}</td>
                    <td className="py-2 px-2 text-right text-xs font-semibold">{t.parameters?.length ?? 0}</td>
                    <td className="py-2 px-2 text-right text-xs">
                      {t.defaultPrice != null ? `₹ ${Number(t.defaultPrice).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2 px-2 text-right text-xs">{t.turnaroundHours ? `${t.turnaroundHours}h` : '—'}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.isPublished ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {t.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-xs font-semibold">{t._count?.catalogs ?? 0}</td>
                    <td className="py-2 px-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button className="p-1 rounded hover:bg-surface-container-high">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            render={
                              <Link href={`/super-admin/lab-templates/${t.id}`}>
                                <Eye className="h-3.5 w-3.5 mr-2" />
                                Open builder
                              </Link>
                            }
                          />
                          <DropdownMenuItem onClick={() => setPreviewTpl(t)}>
                            <Eye className="h-3.5 w-3.5 mr-2" />
                            Preview report
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirmDelete(t)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New template dialog */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New lab test template</DialogTitle>
            <DialogDescription>
              Give the test a name + department to start. Add parameters on the next screen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Test name (e.g. Complete Blood Count)"
              value={newForm.name}
              onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Department (e.g. Hematology)"
                value={newForm.departmentName}
                onChange={(e) => setNewForm((p) => ({ ...p, departmentName: e.target.value }))}
              />
              <Input
                placeholder="Code (e.g. CBC)"
                value={newForm.code}
                onChange={(e) => setNewForm((p) => ({ ...p, code: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)} disabled={createTpl.isPending}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createTpl.isPending}>
              {createTpl.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <LabReportPreviewDialog
        open={!!previewTpl}
        onOpenChange={(open) => !open && setPreviewTpl(null)}
        source={
          previewTpl
            ? {
                name: previewTpl.name,
                code: previewTpl.code,
                departmentName: previewTpl.departmentName,
                sampleType: previewTpl.sampleType,
                specimen: previewTpl.specimen,
                instructions: previewTpl.instructions,
                description: previewTpl.description,
                interpretation: previewTpl.interpretation,
                turnaroundHours: previewTpl.turnaroundHours ?? null,
                parameters: previewTpl.parameters ?? [],
              }
            : null
        }
      />

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              {confirmDelete?._count?.catalogs
                ? `This template has been cloned by ${confirmDelete._count.catalogs} hospital(s) and cannot be deleted. Unlink the clones first or unpublish instead.`
                : `"${confirmDelete?.name}" will be permanently deleted.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!confirmDelete?._count?.catalogs || deleteTpl.isPending}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
