'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Building2, Search } from 'lucide-react';
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
  useInsurers,
  useCreateInsurer,
  useUpdateInsurer,
  useDeleteInsurer,
  type Insurer,
} from '@/hooks/use-insurance';

interface FormState {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  isActive: true,
};

export default function InsurersPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Insurer | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading } = useInsurers({ search: search || undefined });
  const createMut = useCreateInsurer();
  const updateMut = useUpdateInsurer();
  const deleteMut = useDeleteInsurer();

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }
  function openEdit(insurer: Insurer) {
    setEditing(insurer);
    setForm({
      name: insurer.name,
      contactPerson: insurer.contactPerson ?? '',
      phone: insurer.phone ?? '',
      email: insurer.email ?? '',
      address: insurer.address ?? '',
      isActive: insurer.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    const payload = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      isActive: form.isActive,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, body: payload });
        toast.success('Insurer updated');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('Insurer added');
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Save failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this insurer? Linked policies will block deletion.')) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success('Insurer deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Delete failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">Insurers</h1>
          <p className="text-sm text-on-surface-variant">
            Master list of insurance companies your hospital works with.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="size-4" /> Add Insurer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" /> Insurance Companies
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" />
              <Input
                placeholder="Search insurers"
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
                data.data.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>{i.contactPerson ?? '—'}</TableCell>
                    <TableCell>{i.email ?? '—'}</TableCell>
                    <TableCell>{i.phone ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={i.isActive ? 'default' : 'outline'}>
                        {i.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="icon-sm" variant="ghost" onClick={() => openEdit(i)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          onClick={() => handleDelete(i.id)}
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
                    No insurers configured yet.
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
            <DialogTitle>{editing ? 'Edit Insurer' : 'Add Insurer'}</DialogTitle>
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
              {editing ? 'Save Changes' : 'Add Insurer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
