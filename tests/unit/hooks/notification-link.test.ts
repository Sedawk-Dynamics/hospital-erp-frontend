import { describe, it, expect } from 'vitest';
import { notificationLink } from '@/hooks/use-notifications';
import type { AppNotification } from '@/hooks/use-notifications';

const n = (referenceType: string, referenceId?: string): AppNotification =>
  ({
    id: 'x',
    title: 't',
    message: 'm',
    notificationType: 'system',
    referenceType,
    referenceId,
    isRead: false,
    createdAt: new Date().toISOString(),
  }) as unknown as AppNotification;

const DOCTOR = ['doctor'];
const OT_DESK = ['ot_manager'];
const PATIENT = ['patient'];
const PHARMACY = ['pharmacist'];
const ADMIN = ['admin'];

describe('notificationLink — operating theatre', () => {
  // `ot_response` is written for BOTH sides: the OT desk when a doctor answers
  // a proposal, and the doctor when the desk cancels a surgery. It used to be
  // hardcoded to /ot, which a doctor cannot even open — `doctor` is their only
  // module.
  it('sends a doctor to their own OT list, and the desk to the board', () => {
    expect(notificationLink(n('ot_response'), DOCTOR)).toBe('/doctor/ot-list');
    expect(notificationLink(n('ot_response'), OT_DESK)).toBe('/ot');
  });

  it('does the same for a newly scheduled surgery', () => {
    expect(notificationLink(n('ot_scheduled'), DOCTOR)).toBe('/doctor/ot-list');
    expect(notificationLink(n('ot_scheduled'), OT_DESK)).toBe('/ot');
  });

  // Only ever sent to the doctor, so it needs no role to resolve.
  it('always sends a reschedule to the doctor list', () => {
    expect(notificationLink(n('ot_reschedule'), DOCTOR)).toBe('/doctor/ot-list');
    expect(notificationLink(n('ot_reschedule'))).toBe('/doctor/ot-list');
  });
});

describe('notificationLink — patient-facing', () => {
  // These are sent to the PATIENT's user account. Pointing them at a hospital
  // screen would land someone on a page they cannot open.
  it('keeps a patient inside the portal', () => {
    expect(notificationLink(n('discharge_summary'), PATIENT)).toBe(
      '/patient-portal/discharge-summaries',
    );
    expect(notificationLink(n('lab_report'), PATIENT)).toBe('/patient-portal/lab-reports');
    expect(notificationLink(n('imaging_request'), PATIENT)).toBe(
      '/patient-portal/imaging-reports',
    );
    expect(notificationLink(n('prescription'), PATIENT)).toBe('/patient-portal/prescriptions');
    expect(notificationLink(n('drug_return'), PATIENT)).toBe('/patient-portal/billing');
  });

  it('sends the same references to the right staff screen', () => {
    expect(notificationLink(n('lab_report'), DOCTOR)).toBe('/doctor/registry');
    expect(notificationLink(n('lab_report'), ['lab_technician'])).toBe('/laboratory');
    expect(notificationLink(n('drug_return'), PHARMACY)).toBe('/pharmacy/returns');
  });
});

describe('notificationLink — deep links', () => {
  it('opens the mentioned patient, not a list', () => {
    expect(notificationLink(n('progress_note_mention_ip', 'adm-1'), DOCTOR)).toBe(
      '/doctor/ip/adm-1',
    );
    expect(notificationLink(n('progress_note_mention', 'pat-1'), DOCTOR)).toBe(
      '/doctor/consultation/pat-1',
    );
  });

  // A missing referenceId must not produce "/doctor/ip/undefined".
  it('falls back to the list when the reference is missing', () => {
    expect(notificationLink(n('progress_note_mention_ip'), DOCTOR)).toBe('/doctor/ip');
    expect(notificationLink(n('progress_note_mention'), DOCTOR)).toBe('/doctor/progress-notes');
  });

  it('opens the stay whose bill has to be cleared before discharge', () => {
    expect(notificationLink(n('discharge_ready', 'adm-9'), ['front_desk'])).toBe(
      '/hospital/billing?tab=ip&admissionId=adm-9',
    );
  });
});

describe('notificationLink — safety', () => {
  it('returns null for anything it does not know', () => {
    expect(notificationLink(n('something_new'), DOCTOR)).toBe(null);
    expect(notificationLink(n(''), DOCTOR)).toBe(null);
  });

  // These strings ARE used in the codebase — as BillItem and StockTransaction
  // references, never as notifications. Mapping them would imply a
  // notification exists that does not.
  it('does not invent links for bill-item / stock references', () => {
    for (const t of [
      'lab_order_item',
      'ward_dispense',
      'ot_kit_issue',
      'purchase_order',
      'supply_request',
      'auto_expiry',
      'dispensing_record',
    ]) {
      expect(notificationLink(n(t), DOCTOR), `${t} must not resolve`).toBe(null);
    }
  });

  it('does not send a non-admin to the subscription settings', () => {
    expect(notificationLink(n('subscription'), ADMIN)).toBe('/hospital/settings');
    expect(notificationLink(n('subscription'), DOCTOR)).toBe(null);
  });

  it('resolves without roles at all', () => {
    expect(() => notificationLink(n('ot_response'))).not.toThrow();
    expect(notificationLink(n('ot_response'))).toBe('/ot');
  });
});
