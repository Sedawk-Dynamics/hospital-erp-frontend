'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { AddIntoxicationExamInput, addIntoxicationExamSchema } from '@/lib/schema/intoxication-exam-schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { CLINICAL_FIELDS, OPINION_OPTIONS } from '@/lib/intoxication-options';

const TEXT_FIELDS: { id: string; label: string; placeholder?: string; type?: string }[] = [
    { id: 'examinerName', label: 'Examining Officer — Name', placeholder: 'e.g. Dr. A. Mehta' },
    { id: 'examinerNmcNo', label: 'NMC Registration No.', placeholder: 'e.g. NMC-123456' },
    { id: 'examinedAt', label: 'Time of Examination', type: 'datetime-local' },
    { id: 'witnessName', label: 'Police IO Witness — Name', placeholder: 'e.g. SI R. Sharma' },
    { id: 'witnessBuckleNo', label: 'Buckle No.', placeholder: 'e.g. 4471' },
    { id: 'witnessPoliceStation', label: 'Police Station', placeholder: 'e.g. Sector 20 PS' },
];

interface IntoxicationExamDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onSave: (values: AddIntoxicationExamInput) => void;
}

function nowLocal(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function IntoxicationExamDialog({ open, setOpen, onSave }: IntoxicationExamDialogProps) {

    const intoxicationExamForm = useForm<AddIntoxicationExamInput>({
        resolver: zodResolver(addIntoxicationExamSchema) as never, defaultValues: {
            alcoholSmell: undefined,
            speech: undefined,
            pupilsConjunctiva: undefined,
            gaitBalance: undefined,
            rombergSign: undefined,
            fingerToNose: undefined,
            recordedBac: undefined,
            opinion: undefined,
            examinerName: '',
            examinerNmcNo: '',
            examinedAt: nowLocal(),
            witnessName: '',
            witnessBuckleNo: '',
            witnessPoliceStation: '',
        }
    })

    const onsubmit = (data: AddIntoxicationExamInput) => {
        onSave(data);
        setOpen(false);
    }
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Intoxication Exam (Form 39)</DialogTitle>
                    <DialogDescription>
                        Record the clinical examination, blood alcohol, statutory opinion and witnessing details.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={intoxicationExamForm.handleSubmit(onsubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ">
                        {CLINICAL_FIELDS.map((f) => (
                            <div key={f.name} className="space-y-1.5">
                                <Label htmlFor={f.name}>{f.label}</Label>
                                <Select
                                    value={(intoxicationExamForm.watch(f.name as keyof AddIntoxicationExamInput) as string) ?? ''}
                                    onValueChange={(v) => intoxicationExamForm.setValue(f.name as keyof AddIntoxicationExamInput, v ?? '')}
                                >
                                    <SelectTrigger id={f.name} className="w-full">
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {f.options.map((o) => (
                                            <SelectItem key={o.value} value={o.value}>
                                                {o.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}

                        <div className="col-span-full flex flex-row  justify-between items-center gap-3">
                            <Label htmlFor="recordedBac" className="whitespace-nowrap shrink-0">
                                Recorded BAC (mg/dL)
                            </Label>
                            <Input id="recordedBac" type="number" min={0} step="0.01" placeholder="e.g. 120" className="flex-1" {...intoxicationExamForm.register('recordedBac')} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="opinion">Certificate of Opinion</Label>
                        <Select
                            value={intoxicationExamForm.watch('opinion') ?? ''}
                            onValueChange={(v) => intoxicationExamForm.setValue('opinion', v ?? '')}
                        >
                            <SelectTrigger id="opinion" className="w-full">
                                <SelectValue placeholder="Select an opinion" />
                            </SelectTrigger>
                            <SelectContent>
                                {OPINION_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
                        {TEXT_FIELDS.map((f) => (
                            <div key={f.id} className="space-y-1.5">
                                <Label htmlFor={f.id}>{f.label}</Label>
                                <Input id={f.id} type={f.type ?? 'text'} placeholder={f.placeholder} {...intoxicationExamForm.register(f.id as keyof AddIntoxicationExamInput)} />
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
