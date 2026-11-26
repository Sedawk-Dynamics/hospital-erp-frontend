import { z } from 'zod/v4';


const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().min(0).optional(),
);

export const injurySchema = z.object({
  bodySite: z.string().trim().min(1, 'Body site is required'),
  nature: z.string().trim().optional(),
  length: optionalNumber,
  width: optionalNumber,
});


export const addMedicoLegalSchema = z.object({
    isMlc: z.boolean(),
    mlcSerialNumber: z.string().trim().optional(),
    policeStation: z.string().trim().optional(),
    investigatingOfficer: z.string().trim().optional(),
    policeIntimationAt: z.string().optional(),
    ioArrivalAt: z.string().optional(),
    receiptAckNo: z.string().trim().optional(),
    items: z.array(z.string()).default([]),
    injuries: z.array(injurySchema).default([]),
});

export type addMedicoLegalInput=z.infer<typeof addMedicoLegalSchema>;

