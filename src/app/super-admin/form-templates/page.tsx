'use client';

// Super-admin Form Templates list. Each template is a reusable form
// definition that any hospital admin can clone into their own library
// (with a snapshot — later template edits don't change the clones).

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Copy,
  Eye,
  FileText,
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
  useFormTemplates,
  useCreateTemplate,
  useDeleteTemplate,
  FORM_CATEGORIES,
  type FormTemplate,
  type FormCategory,
} from '@/hooks/use-forms';
import { FormPreviewDialog } from '@/components/forms/form-preview-dialog';

function categoryLabel(c: FormCategory): string {
  return FORM_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export default function SuperAdminFormTemplatesPage() {
  const router = useRouter();
  const { data, isLoading } = useFormTemplates({ limit: 100 });
  const createTpl = useCreateTemplate();
  const deleteTpl = useDeleteTemplate();

  const [search, setSearch] = useState('');
  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<FormTemplate | null>(null);
  const [previewTpl, setPreviewTpl] = useState<FormTemplate | null>(null);

  const templates = data?.data ?? [];
  const filtered = templates.filter((t) =>
    !search.trim() ? true : t.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    try {
      const res = await createTpl.mutateAsync({
        name: newName.trim(),
        description: null,
        category: 'other',
        schema: { fields: [], version: 1 },
        isPublished: false,
      });
      toast.success('Template created');
      setOpenNew(false);
      setNewName('');
      const id = res.data?.id;
      if (id) router.push(`/super-admin/form-templates/${id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create';
      toast.error(msg);
    }
  }

  async function handleDelete(tpl: FormTemplate) {
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
            <FileText className="h-5 w-5 text-primary" />
            Form Templates
          </h1>
          <p className="font-label text-sm text-on-surface-variant">
            Build reusable form definitions that any hospital can clone into their own library.
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
              placeholder="Search templates…"
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
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2">Category</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Hospital clones</th>
                  <th className="text-left py-2 px-2">Updated</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-surface-container-low transition-colors">
                    <td className="py-2 px-2">
                      <Link
                        href={`/super-admin/form-templates/${t.id}`}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {t.name}
                      </Link>
                      {t.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                      )}
                    </td>
                    <td className="py-2 px-2 text-xs">{categoryLabel(t.category)}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.isPublished ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {t.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-xs font-semibold">
                      {t._count?.hospitalForms ?? 0}
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewTpl(t)}
                          className="h-7 gap-1 px-2 text-xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </Button>
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
                                <Link href={`/super-admin/form-templates/${t.id}`}>
                                  <Copy className="h-3.5 w-3.5 mr-2" />
                                  Open builder
                                </Link>
                              }
                            />
                            <DropdownMenuItem
                              onClick={() => setPreviewTpl(t)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-2" />
                              Preview
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
                      </div>
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
            <DialogTitle>New form template</DialogTitle>
            <DialogDescription>
              Give it a name to start. You&apos;ll add fields on the next screen.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="e.g. Admission Assessment"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
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
      <FormPreviewDialog
        open={!!previewTpl}
        onOpenChange={(open) => !open && setPreviewTpl(null)}
        name={previewTpl?.name ?? ''}
        description={previewTpl?.description}
        category={previewTpl?.category ?? 'other'}
        version={previewTpl?.version}
        schema={previewTpl?.schema}
      />

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              {confirmDelete?._count?.hospitalForms
                ? `This template has been cloned by ${confirmDelete._count.hospitalForms} hospital(s) and cannot be deleted. Unlink the clones first.`
                : `"${confirmDelete?.name}" will be permanently deleted.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!confirmDelete?._count?.hospitalForms || deleteTpl.isPending}
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
