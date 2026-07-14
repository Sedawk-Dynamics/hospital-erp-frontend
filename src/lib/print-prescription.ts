import apiClient from '@/lib/api-client';

/**
 * Open the hospital-BRANDED prescription PDF (letterhead / accent / footer set by
 * the hospital admin in the PDF Builder). Renders server-side as a full OP
 * consultation document (patient + allergies + complaint + diagnosis + vitals +
 * Rx + advice + follow-up) and opens it in a new tab to print or Save-as-PDF.
 * This is the single prescription print path — the old client-side HTML printer
 * was removed in favour of the branded server render.
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
