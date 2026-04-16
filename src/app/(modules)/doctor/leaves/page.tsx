import { redirect } from 'next/navigation';

// Leaves were merged into /doctor/schedule as a side panel. Keep this route
// as a permanent redirect so deep-links from old pages/emails still work.
export default function DoctorLeavesRedirect() {
  redirect('/doctor/schedule');
}
