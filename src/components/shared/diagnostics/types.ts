// ────────────────────────────────────────────────────────────────────────
// Shared shapes for the lab + radiology accept flow.
//
// A lab order and an imaging request are the same commercial event, so the two
// departments run one flow: the admin accepts at their own counter, taking the
// money for an OP patient or posting to the stay ledger for an admitted one,
// then hands the work to whoever will do it. One dialog drives both, which is
// why these types live outside either module.
// ────────────────────────────────────────────────────────────────────────

export type DiagnosticPaymentMethod =
  | 'cash'
  | 'upi'
  | 'credit_card'
  | 'debit_card'
  | 'net_banking'
  | 'cheque'
  | 'insurance'
  | 'other';

/** Where a patient settles. All three admission types run the one IP flow. */
export type DiagnosticPayerMode = 'ip' | 'op';
export type DiagnosticAdmissionType = 'ip' | 'emergency' | 'daycare';

export const ADMISSION_TYPE_LABELS: Record<DiagnosticAdmissionType, string> = {
  ip: 'In-Patient',
  emergency: 'Emergency',
  daycare: 'Day Care',
};

/** GET /lab/orders/:id/billing-preview · GET /imaging/requests/:id/billing-preview */
export interface DiagnosticBillingPreview {
  mode: DiagnosticPayerMode;
  admissionId: string | null;
  admissionType: DiagnosticAdmissionType | null;
  lines: { referenceId: string; description: string; amount: number }[];
  chargeAmount: number;
  /** Tests/studies with no price in the catalog — they bill nothing. */
  unpricedCount: number;
  alreadyBilled: boolean;
  bill: {
    id: string;
    billNumber: string;
    status: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
  } | null;
}

export interface DiagnosticPaymentInput {
  paymentMethod: DiagnosticPaymentMethod;
  amount?: number;
  referenceNumber?: string;
  notes?: string;
}

/** What the accept endpoints take, minus each module's own assignee field. */
export interface DiagnosticAcceptPayload {
  notes?: string;
  payment?: DiagnosticPaymentInput;
  deferReason?: string;
}

/** The bill decoration both list endpoints attach to a row. */
export interface DiagnosticLinkedBill {
  id?: string;
  billNumber?: string;
  status?: string;
  /** True when this is an admission's running ledger, not a counter bill. */
  isLedger?: boolean;
  chargeAmount?: number | string;
  totalAmount?: number | string;
  amountPaid?: number | string;
  balanceDue?: number | string;
  payments?: { paymentMethod: string; amount: number | string; paymentDate: string }[];
}

/**
 * Why an order was admitted without collecting. Free text is still allowed —
 * these are the answers a counter actually gives, offered so the reason is
 * consistent enough to report on.
 */
export const DEFER_REASONS = [
  { value: 'TPA / Insurance — billed to payer', hint: 'The payer settles this, not the patient.' },
  { value: 'Credit patient — settle on account', hint: 'Corporate or panel patient with a running account.' },
  { value: 'Will pay at the front desk', hint: 'Patient is paying at the main counter instead.' },
  { value: 'Concession pending approval', hint: 'Waiting on a discount decision before collecting.' },
  { value: 'Emergency — collect later', hint: 'Clinically urgent; money follows.' },
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  net_banking: 'Net Banking',
  cheque: 'Cheque',
  insurance: 'Insurance',
  other: 'Other',
};

export function formatPaymentMethod(method: string) {
  return PAYMENT_METHOD_LABELS[method] ?? method.replace(/_/g, ' ');
}

/** Methods that are meaningless without a transaction reference. */
export const REFERENCE_REQUIRED: DiagnosticPaymentMethod[] = [
  'credit_card',
  'debit_card',
  'upi',
  'net_banking',
  'cheque',
];

export const money = (n: number | string | null | undefined) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
