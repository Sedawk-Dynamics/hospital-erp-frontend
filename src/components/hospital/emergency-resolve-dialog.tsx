'use client';

import { useState, useEffect } from 'react';
import { Siren, Search, Loader2, UserPlus, Link2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { usePatientSearch } from '@/hooks/use-hospital';
import {
  useRegisterEmergencyPatient,
  useMergeEmergencyPatient,
  type EmergencyPatient,
} from '@/hooks/use-emergency';

type Mode = 'register' | 'connect';

/**
 * Resolve a temporary emergency patient once identified:
 *  - "Register as new" fills real details + issues a permanent MRN in place
 *    (the whole emergency episode stays on the record).
 *  - "Connect to existing" repoints the episode onto an already-registered
 *    patient and retires the temp record.
 */
export function EmergencyResolveDialog({
  open,
  onOpenChange,
  patient,
  onResolved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: EmergencyPatient | null;
  onResolved?: () => void;
}) {
  const [mode, setMode] = useState<Mode>('register');

  // Register form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [address, setAddress] = useState('');

  // Connect
  const [patientSearch, setPatientSearch] = useState('');
  const [target, setTarget] = useState<{ id: string; name: string; mrn?: string } | null>(null);

  const { data: patientResults } = usePatientSearch(patientSearch);
  const register = useRegisterEmergencyPatient();
  const merge = useMergeEmergencyPatient();

  // Prefill the register form from whatever the ER captured.
  useEffect(() => {
    if (open && patient) {
      setMode('register');
      setFirstName(patient.firstName && patient.firstName !== 'Emergency' ? patient.firstName : '');
      setLastName(patient.lastName && patient.lastName !== 'Patient' ? patient.lastName : '');
      setGender(patient.gender || '');
      setDateOfBirth('');
      setPhone(patient.phone || '');
      setEmail('');
      setBloodGroup('');
      setAddress('');
      setPatientSearch('');
      setTarget(null);
    }
  }, [open, patient]);

  async function handleRegister() {
    if (!patient) return;
    if (!firstName.trim()) {
      toast.error('Patient name is required to register');
      return;
    }
    try {
      await register.mutateAsync({
        id: patient.id,
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          gender: gender || undefined,
          dateOfBirth: dateOfBirth || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          bloodGroup: bloodGroup || undefined,
          address: address.trim() || undefined,
        },
      });
      toast.success('Emergency patient registered — permanent MRN issued');
      onOpenChange(false);
      onResolved?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to register');
    }
  }

  async function handleConnect() {
    if (!patient || !target) return;
    try {
      await merge.mutateAsync({ id: patient.id, targetPatientId: target.id });
      toast.success(`Emergency episode connected to ${target.name}`);
      onOpenChange(false);
      onResolved?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to connect');
    }
  }

  const busy = register.isPending || merge.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-red-600" />
            Resolve emergency patient
          </DialogTitle>
          <DialogDescription>
            {patient ? (
              <>
                <span className="font-mono">{patient.mrn}</span> ·{' '}
                {patient.firstName} {patient.lastName} · {patient.type.toUpperCase()}
              </>
            ) : (
              'Register the casualty as a new patient, or connect it to an existing one.'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { key: 'register', label: 'Register as new', icon: UserPlus },
              { key: 'connect', label: 'Connect to existing', icon: Link2 },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors',
                mode === m.key
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/40',
              )}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'register' ? (
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">First name <span className="text-red-500">*</span></Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Gender</Label>
                <Select value={gender} onValueChange={(v) => setGender(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date of birth</Label>
                <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Blood group</Label>
                <Select value={bloodGroup} onValueChange={(v) => setBloodGroup(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <SelectItem key={bg} value={bg}>
                        {bg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              All the emergency history (visit, admission, orders, prescriptions and bills) stays on
              this record — only the identity and a permanent MRN are added.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            {target ? (
              <div className="flex items-center justify-between rounded-md bg-muted/40 p-3 text-sm">
                <span>
                  <b>{target.name}</b>
                  {target.mrn && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{target.mrn}</span>
                  )}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search registered patient by name, MRN or phone"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {(patientResults?.length ?? 0) > 0 && (
                  <div className="max-h-52 overflow-y-auto rounded-md border">
                    {patientResults!.map((p) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          setTarget({
                            id: p.id,
                            name: `${p.firstName} ${p.lastName ?? ''}`.trim(),
                            mrn: p.mrn,
                          })
                        }
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium">
                          {p.firstName} {p.lastName}
                        </span>
                        {p.mrn && (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{p.mrn}</span>
                        )}
                        {p.phone && <span className="ml-2 text-xs text-muted-foreground">· {p.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              The whole emergency episode is moved onto the selected patient and this temporary
              record is retired.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {mode === 'register' ? (
            <Button onClick={handleRegister} disabled={busy || !firstName.trim()}>
              {register.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Registering…
                </>
              ) : (
                <>
                  <UserPlus className="mr-1.5 h-4 w-4" /> Register patient
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={busy || !target}>
              {merge.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Connecting…
                </>
              ) : (
                <>
                  Connect <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
