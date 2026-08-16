'use client';

import { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

/**
 * A second authorised person co-signing a controlled-drug hand-over.
 *
 * The password is the whole point. Picking a colleague from a dropdown proves
 * nothing — anyone at the terminal could name someone who is not in the room.
 * Asking that person to type their own password is what makes the signature
 * mean a second person was physically present.
 *
 * The password is never stored. It is sent with the one request it authorises
 * and verified server-side against that user.
 */
export function WitnessCosignDialog({
  open,
  onOpenChange,
  title = 'Witness required',
  description,
  witnessOptions,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  witnessOptions: Array<{ id: string; name: string; role?: string | null }>;
  busy?: boolean;
  onConfirm: (witnessId: string, password: string) => void | Promise<void>;
}) {
  const [witnessId, setWitnessId] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  const reset = () => {
    setWitnessId(null);
    setPassword('');
  };

  const confirm = async () => {
    if (!witnessId || !password) return;
    await onConfirm(witnessId, password);
    // Cleared whatever the outcome — a password must not linger in a form the
    // next person at this terminal could submit.
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-error" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="witness-person">Witness</Label>
            <Select value={witnessId ?? ''} onValueChange={(v: string | null) => setWitnessId(v || null)}>
              <SelectTrigger id="witness-person">
                <SelectValue placeholder="Who is co-signing?" />
              </SelectTrigger>
              <SelectContent>
                {witnessOptions.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}{w.role ? ` · ${w.role}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="witness-password">Their password</Label>
            <Input
              id="witness-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && witnessId && password && void confirm()}
              placeholder="Hand the keyboard to the witness"
            />
            <p className="text-[11px] text-muted-foreground">
              The witness types this themselves. It is checked against their account and never stored.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void confirm()} disabled={busy || !witnessId || !password}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Co-sign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
