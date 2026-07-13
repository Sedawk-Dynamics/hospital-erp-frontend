import { formatDateTimeAmPm } from './date-utils';
import apiClient from '@/lib/api-client';

/**
 * Open the hospital-BRANDED prescription PDF (letterhead / accent / footer set by
 * the hospital admin in the PDF Builder). Renders server-side and opens it in a
 * new tab so the user can print or Save-as-PDF. Preferred over the client-side
 * HTML printer below.
 */
export async function openPrescriptionPdf(prescriptionId: string): Promise<void> {
  const res = await apiClient.get(`/prescriptions/${prescriptionId}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const w = window.open(url, '_blank');
  if (!w) {
    // Popup blocked — fall back to a same-gesture anchor click.
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

interface PrintablePrescription {
  id: string;
  createdAt: string;
  status: string;
  notes?: string;
  patient?: {
    firstName?: string;
    lastName?: string;
    mrn?: string;
  };
  doctor?: {
    user?: { firstName?: string; lastName?: string };
    specialization?: string;
  };
  items?: Array<{
    drugName: string;
    genericName?: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    route?: string;
    quantity?: number | null;
    instructions?: string;
  }>;
}

function esc(value: string | undefined | null): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate the printable HTML document for a prescription.
 * Used both by the prescription editor print button and the doctor action-bar
 * "Print Prescription" dialog.
 */
export function buildPrescriptionHtml(prescription: PrintablePrescription): string {
  const patientName = prescription.patient
    ? `${prescription.patient.firstName || ''} ${prescription.patient.lastName || ''}`.trim()
    : 'Unknown';
  const doctorName = prescription.doctor?.user
    ? `Dr. ${prescription.doctor.user.firstName || ''} ${prescription.doctor.user.lastName || ''}`.trim()
    : '-';
  const items = prescription.items ?? [];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Prescription - ${esc(patientName)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
        h1 { text-align: center; color: #00897B; margin-bottom: 5px; font-size: 24px; }
        .subtitle { text-align: center; color: #666; font-size: 12px; margin-bottom: 30px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .info-label { color: #666; }
        .info-value { font-weight: 600; }
        hr { border: none; border-top: 1px solid #e0e0e0; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f5f5f5; text-align: left; padding: 10px; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #e0e0e0; }
        td { padding: 10px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
        .footer { margin-top: 60px; text-align: right; }
        .footer .sign { border-top: 1px solid #333; display: inline-block; padding-top: 5px; min-width: 200px; text-align: center; font-size: 14px; }
        .notes { margin-top: 20px; padding: 10px; background: #f9f9f9; border-radius: 4px; font-size: 13px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>e-Prescription</h1>
      <p class="subtitle">Date: ${esc(formatDateTimeAmPm(prescription.createdAt))}</p>
      <hr />
      <div class="info-row"><span class="info-label">Patient:</span> <span class="info-value">${esc(patientName)}</span></div>
      <div class="info-row"><span class="info-label">MRN:</span> <span class="info-value">${esc(prescription.patient?.mrn) || '-'}</span></div>
      <div class="info-row"><span class="info-label">Doctor:</span> <span class="info-value">${esc(doctorName)}${prescription.doctor?.specialization ? ` <span style="color:#888;font-weight:400">(${esc(prescription.doctor.specialization)})</span>` : ''}</span></div>
      <div class="info-row"><span class="info-label">Status:</span> <span class="info-value">${esc(prescription.status)}</span></div>
      <hr />
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Drug</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Duration</th>
            <th>Route</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${esc(item.drugName)}</strong>${item.genericName ? `<br/><small style="color:#888">${esc(item.genericName)}</small>` : ''}</td>
              <td>${esc(item.dosage)}</td>
              <td>${esc(item.frequency)}</td>
              <td>${esc(item.duration)}</td>
              <td>${esc(item.route) || '-'}</td>
              <td>${item.quantity ?? '-'}</td>
            </tr>
            ${item.instructions ? `<tr><td></td><td colspan="6" style="padding-top:0;font-style:italic;color:#666;font-size:12px">Instructions: ${esc(item.instructions)}</td></tr>` : ''}
          `,
            )
            .join('')}
        </tbody>
      </table>
      ${prescription.notes ? `<div class="notes"><strong>Notes:</strong> ${esc(prescription.notes)}</div>` : ''}
      <div class="footer">
        <div class="sign">${esc(doctorName)}</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Open a new window and print the given prescription.
 */
export function printPrescription(prescription: PrintablePrescription): void {
  const html = buildPrescriptionHtml(prescription);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
