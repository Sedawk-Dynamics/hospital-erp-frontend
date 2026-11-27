import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
vi.mock('@/lib/api', () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPut: (...a: unknown[]) => apiPut(...a),
  apiDelete: (...a: unknown[]) => apiDelete(...a),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

import { DoctorFollowUpRuleCard, HospitalFollowUpRuleCard } from './follow-up-rule-form';
import { BookingFeeNote } from './booking-fee-note';
import { AppointmentTable } from './appointment-table';
import type { FollowUpRules } from '@/hooks/use-follow-up-rules';
import type { Appointment } from '@/types';

vi.mock('./appointment-row-actions', () => ({ AppointmentRowActions: () => null }));

const wrap = (ui: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  );

const rules = (over: Partial<FollowUpRules> = {}): FollowUpRules => ({
  canEdit: true, hospital: null, hospitalSummary: null, hospitalUpdatedAt: null, departments: [], doctors: [], ...over,
});
const saved = {
  freeDays: 7, afterWindow: 'fixed' as const, fixedFee: 300, scope: 'same_doctor' as const, dischargeStartsWindow: false,
};
const doctor = (over: object = {}) => ({
  canEdit: true, doctorId: 'doc-1', name: 'Dr. Asha Rao', department: null, consultationFee: 500,
  override: { freeDays: null, afterWindow: null, fixedFee: null, scope: null, dischargeStartsWindow: null },
  summary: 'Free for 7 days, then ₹300', inheritedSummary: 'Free for 7 days, then ₹300', ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  apiPut.mockResolvedValue({ data: {} });
  apiDelete.mockResolvedValue({ data: {} });
});

describe('hospital default', () => {
  it('lets an admin set every part of the rule', async () => {
    const user = userEvent.setup();
    wrap(<HospitalFollowUpRuleCard rules={rules()} />);
    expect(screen.getByText(/No rule is set/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Free follow-up days/), '7');
    await user.selectOptions(screen.getByLabelText(/a follow-up costs/), 'fixed');
    await user.type(screen.getByLabelText(/Follow-up fee/), '300');
    await user.selectOptions(screen.getByLabelText(/Which return visits/), 'same_doctor');
    await user.selectOptions(screen.getByLabelText(/discharge/), 'no');
    await user.click(screen.getByRole('button', { name: /Save follow-up rule/ }));

    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/hospital-settings/follow-up-rules/hospital', saved));
  });

  it('refuses an incomplete rule without calling the server', async () => {
    const user = userEvent.setup();
    wrap(<HospitalFollowUpRuleCard rules={rules()} />);
    await user.type(screen.getByLabelText(/Free follow-up days/), '91');
    await user.click(screen.getByRole('button', { name: /Save follow-up rule/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('0 to 90');
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('is read-only for anyone else', () => {
    wrap(
      <HospitalFollowUpRuleCard
        rules={rules({ canEdit: false, hospital: saved, hospitalSummary: 'Free for 7 days, then ₹300' })}
      />,
    );
    expect(screen.getByText('Free for 7 days, then ₹300')).toBeInTheDocument();
    expect(screen.getByText(/Only the Hospital Admin/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('doctor override', () => {
  it('shows the inherited rule and saves only what is set', async () => {
    const user = userEvent.setup();
    apiGet.mockResolvedValue({ data: doctor() });
    wrap(<DoctorFollowUpRuleCard doctorId="doc-1" />);
    expect(await screen.findByText('Free for 7 days, then ₹300')).toBeInTheDocument();
    expect(screen.getByText('Using the default')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Free follow-up days/), '0');
    await user.click(screen.getByRole('button', { name: /Save follow-up rule/ }));
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/hospital-settings/follow-up-rules/doctors/doc-1', {
        freeDays: 0, afterWindow: null, fixedFee: null, scope: null, dischargeStartsWindow: null,
      }),
    );
  });

  it('can go back to the default for everything', async () => {
    const user = userEvent.setup();
    apiGet.mockResolvedValue({ data: doctor({ override: { ...doctor().override, freeDays: 3 } }) });
    wrap(<DoctorFollowUpRuleCard doctorId="doc-1" />);
    await user.click(await screen.findByRole('button', { name: /Use default for all/ }));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/hospital-settings/follow-up-rules/doctors/doc-1'));
  });

  it.each([
    ['not an admin', { canEdit: false }, false],
    ['the doctor’s own screen', { canEdit: true }, true],
  ])('has nothing to edit for %s', async (_n, over, readOnly) => {
    apiGet.mockResolvedValue({ data: doctor(over) });
    wrap(<DoctorFollowUpRuleCard doctorId="doc-1" readOnly={readOnly} />);
    expect(await screen.findByText('Free for 7 days, then ₹300')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
  });
});

describe('booking screens', () => {
  const preview = (fee: number, followUp: object) => ({
    data: {
      consultationFee: fee,
      followUp: { isFree: false, listFee: 500, windowDays: 7, previousVisitDate: null, governed: true, label: null, ruleSummary: 'Free for 7 days, then ₹300', ...followUp },
      registration: { applies: false, label: 'Registration Fee', totalAmount: 0, reason: '' },
      total: fee,
    },
  });
  const note = () => wrap(<BookingFeeNote doctorId="d" patientId="p" type="follow_up" date="2026-11-05" />);

  it('asks for the day of the visit and shows the waiver', async () => {
    apiGet.mockResolvedValue(preview(0, { isFree: true, label: 'Free follow-up, day 4 of 7' }));
    note();
    expect(await screen.findByText('₹0 · Waived (Follow-up)')).toBeInTheDocument();
    expect(screen.getByText('Free follow-up, day 4 of 7')).toBeInTheDocument();
    expect(apiGet.mock.calls[0][1].params).toMatchObject({ date: '2026-11-05', type: 'follow_up', patientId: 'p' });
  });

  it('shows the follow-up fee after the free days', async () => {
    apiGet.mockResolvedValue(preview(300, { kind: 'paid_follow_up', label: 'Follow-up fee ₹300 (day 9, free follow-up ended on day 7)' }));
    note();
    expect(await screen.findByText('₹300')).toBeInTheDocument();
    expect(screen.getByText(/day 9/)).toBeInTheDocument();
  });

  it('shows the full fee and the rule for a new consultation', async () => {
    apiGet.mockResolvedValue(preview(500, {}));
    note();
    expect(await screen.findByText('₹500')).toBeInTheDocument();
    expect(screen.getByText('Follow-up rule: Free for 7 days, then ₹300')).toBeInTheDocument();
  });
});

describe('appointment row', () => {
  const row = (paymentInfo: object) =>
    ({
      id: 'a', status: 'booked', appointmentDate: '2026-11-05', startTime: '09:00', endTime: '09:15',
      patient: { id: 'p', firstName: 'A', lastName: 'B', mrn: 'M1' }, doctor: { user: { firstName: 'D', lastName: 'E' } },
      paymentInfo: { billId: 'b', billNumber: 'B1', billStatus: 'paid', amountPaid: 0, balanceDue: 0, ...paymentInfo },
    }) as unknown as Appointment;
  const show = (info: object) =>
    wrap(
      <AppointmentTable appointments={[row(info)]} isLoading={false} page={1} totalPages={1} total={1} onPageChange={() => {}} />,
    );

  it('shows ₹0 and the waiver', () => {
    show({ paymentStatus: 'waived', totalAmount: 0, isFreeFollowUp: true, feeLabel: 'Free follow-up, day 4 of 7' });
    expect(screen.getByText('Waived (Follow-up)')).toBeInTheDocument();
    expect(screen.getByText('₹0')).toBeInTheDocument();
    expect(screen.getByText('Free follow-up, day 4 of 7')).toBeInTheDocument();
  });

  it('shows a chargeable follow-up’s fee and what is due', () => {
    show({ paymentStatus: 'pay_at_frontdesk', totalAmount: 300, balanceDue: 300, isFreeFollowUp: false });
    expect(screen.getByText('₹300 · ₹300 due')).toBeInTheDocument();
  });

  it('does not call a ₹0 follow-up fee a waiver', () => {
    show({ paymentStatus: 'waived', totalAmount: 0, isFreeFollowUp: false });
    expect(screen.getByText('No charge')).toBeInTheDocument();
  });
});
