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

describe('notificationLink — radiology results', () => {
  // Test Report 3 / C8: "Doctor receives Lab notifications but not the
  // corresponding Radiology notification."
  //
  // The notification was always sent — the dev database holds 11 of them. What
  // was missing was a destination: 'imaging_result' was the only diagnostic
  // reference absent from the map, so the bell showed "Radiology report ready"
  // and clicking it did nothing, while its lab twin opened the record.
  it('takes a doctor to the record for a published radiology report', () => {
    expect(notificationLink(n('imaging_result'), DOCTOR)).toBe('/doctor/registry');
  });

  it('takes the patient to their own imaging reports', () => {
    expect(notificationLink(n('imaging_result'), PATIENT)).toBe('/patient-portal/imaging-reports');
  });

  it('takes the department to the radiology worklist', () => {
    expect(notificationLink(n('imaging_result'), ADMIN)).toBe('/radiology');
  });

  // The published report and the order moving are different events, and both
  // have to land somewhere.
  it('routes a result exactly like a request, per role', () => {
    for (const roles of [DOCTOR, PATIENT, ADMIN]) {
      expect(notificationLink(n('imaging_result'), roles)).toBe(
        notificationLink(n('imaging_request'), roles),
      );
    }
  });

  it('matches how the lab equivalent behaves for the same role', () => {
    // Lab sends the doctor to the record rather than the worklist; radiology
    // must not be the one modality that dead-ends.
    expect(notificationLink(n('imaging_result'), DOCTOR)).toBe(
      notificationLink(n('lab_report'), DOCTOR),
    );
  });
});

describe('notificationLink — every type the system actually sends', () => {
  // Found while fixing C8: imaging_result was not the only reference with no
  // destination. These were all live in the dev database, each showing in the
  // bell and doing nothing when clicked.
  const FRONT_DESK = ['front_desk'];

  it('opens an admission request on the tab it is actioned from', () => {
    // Sent to front desk / admin / billing when a doctor raises an IP request.
    // The page opens on the ward list, so landing there loses the request.
    expect(notificationLink(n('admission_request'), FRONT_DESK)).toBe(
      '/hospital/ip?tab=ip-requests',
    );
  });

  it('opens the specific expiring insurance claim, not the list', () => {
    expect(notificationLink(n('insurance_claim', 'claim-1'), ADMIN)).toBe(
      '/insurance/claims/claim-1',
    );
    // Without an id there is nowhere specific to go, so the list is right.
    expect(notificationLink(n('insurance_claim'), ADMIN)).toBe('/insurance/claims');
  });

  it('takes the patient to their appointments for a reminder', () => {
    expect(notificationLink(n('appointment_reminder'), PATIENT)).toBe(
      '/patient-portal/appointments',
    );
  });

  it('still opens the legacy admission-typed discharge notice', () => {
    // Older "Patient ready for discharge" notices predate discharge_ready but
    // carry the same admissionId.
    expect(notificationLink(n('admission', 'adm-1'), FRONT_DESK)).toBe(
      '/hospital/billing?tab=ip&admissionId=adm-1',
    );
  });

  it('still returns null for a genuinely unknown type', () => {
    // The fallback must stay: marking read in place beats navigating somewhere
    // arbitrary.
    expect(notificationLink(n('something_new_entirely'), ADMIN)).toBeNull();
  });
});

describe('notificationLink — the notifications that were never sent before', () => {
  const FRONT_DESK = ['front_desk'];

  // Nursing takes almost every reading in the hospital and an abnormal one
  // reached the treating doctor nowhere. referenceId is the PATIENT: what the
  // doctor wants from that bell is the patient, not a worklist.
  it('opens the patient a doctor was alerted about', () => {
    expect(notificationLink(n('vital_abnormal', 'pat-1'), DOCTOR)).toBe(
      '/doctor/consultation/pat-1',
    );
  });

  it('falls back to the doctor home when the alert names no patient', () => {
    expect(notificationLink(n('vital_abnormal'), DOCTOR)).toBe('/doctor');
  });

  // A portal booking or cancellation used to reach the hospital silently. It
  // goes to the doctor whose list changed and to the desk that takes payment.
  it('sends a portal booking to the right side of the hospital', () => {
    expect(notificationLink(n('appointment_booked', 'appt-1'), DOCTOR)).toBe('/doctor');
    expect(notificationLink(n('appointment_booked', 'appt-1'), FRONT_DESK)).toBe('/hospital');
  });

  it('sends a portal cancellation the same way', () => {
    expect(notificationLink(n('appointment_cancelled', 'appt-1'), DOCTOR)).toBe('/doctor');
    expect(notificationLink(n('appointment_cancelled', 'appt-1'), FRONT_DESK)).toBe('/hospital');
  });

  // Adding a notification is only half the job: an unmapped referenceType
  // returns null and the bell just marks it read in place, which is
  // indistinguishable from the notification never arriving.
  it('leaves none of the three unmapped', () => {
    for (const t of ['vital_abnormal', 'appointment_booked', 'appointment_cancelled']) {
      expect(notificationLink(n(t, 'x'), DOCTOR)).not.toBeNull();
    }
  });
});

describe('notificationLink — the nightly insurance job', () => {
  const INSURANCE = ['insurance_staff'];

  // The job emits three types; only the claim one was mapped, so policy and
  // pre-auth expiry notices arrived in the bell and went nowhere when clicked.
  it('opens the policies list for an expiring policy', () => {
    expect(notificationLink(n('insurance_policy', 'pol-1'), INSURANCE)).toBe('/insurance/policies');
  });

  it('opens the pre-auth list for an expiring pre-authorisation', () => {
    expect(notificationLink(n('pre_authorization_request', 'pa-1'), INSURANCE)).toBe(
      '/insurance/pre-auth',
    );
  });

  it('leaves nothing the job emits unmapped', () => {
    for (const t of ['insurance_claim', 'insurance_policy', 'pre_authorization_request']) {
      expect(notificationLink(n(t, 'x'), INSURANCE)).not.toBeNull();
    }
  });
});
