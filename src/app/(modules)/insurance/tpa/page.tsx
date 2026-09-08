'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Users, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useTpas,
  useCreateTpa,
  useUpdateTpa,
  useDeleteTpa,
  type TpaProvider,
} from '@/hooks/use-insurance';

interface FormState {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
  isActive: true,
};

export default function TpaPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TpaProvider | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading } = useTpas({ search: search || undefined });
  const createMut = useCreateTpa();
  const updateMut = useUpdateTpa();
  const deleteMut = useDeleteTpa();

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }
  function openEdit(tpa: TpaProvider) {
    setEditing(tpa);
    setForm({
      name: tpa.name,
      contactPerson: tpa.contactPerson ?? '',
      phone: tpa.phone ?? '',
      email: tpa.email ?? '',
      address: tpa.address ?? '',
      gstin: tpa.gstin ?? '',
      isActive: tpa.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) return toast.error('Name is required');
    const payload = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      // Blank clears it; an invalid one is refused at the door rather than

      // tidied up — a wrong GSTIN means every invoice against this payer is

      // defective.

      gstin: form.gstin.trim() || null,
      isActive: form.isActive,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, body: payload });
        toast.success('TPA updated');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('TPA added');
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Save failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this TPA? Linked policies will block deletion.')) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success('TPA deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Delete failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">TPA Providers</h1>
          <p className="text-sm text-on-surface-variant">
            Third-party administrators that process claims on behalf of insurers.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="size-4" /> Add TPA
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-primary" /> TPA Providers
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" />
              <Input
                placeholder="Search TPAs"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <CardDescription>
            Showing {data?.data?.length ?? 0} of {data?.meta?.total ?? 0}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-on-surface-variant">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : data?.data?.length ? (
                data.data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.contactPerson ?? '—'}</TableCell>
                    <TableCell>{t.email ?? '—'}</TableCell>
                    <TableCell>{t.phone ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? 'default' : 'outline'}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="icon-sm" variant="ghost" onClick={() => openEdit(t)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-on-surface-variant">
                    No TPAs configured yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit TPA Provider' : 'Add TPA Provider'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                placeholder="27AAPFU0939F1ZV"
                maxLength={15}
                className="font-mono"
              />
              {/* Without this the whole B2B path is unreachable. A payer with a
                  GSTIN is a REGISTERED recipient, which is what turns a hospital
                  bill into a tax invoice under GSTR-1 Table 4 instead of the
                  B2C summary — and one registered in another state is what makes
                  the supply inter-state, so IGST rather than CGST+SGST. Leave it
                  blank and billing carries on exactly as before. */}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Their own GST registration. With it, a bill raised against them
                becomes a B2B tax invoice — and if they are registered in another
                state, it carries IGST. The state is taken from the GSTIN itself.
              </p>
            </div>
            <label className="col-span-2 inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editing ? 'Save Changes' : 'Add TPA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
