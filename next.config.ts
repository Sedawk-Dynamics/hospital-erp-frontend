import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  // NOTE: CORS is handled by the backend API (api.cenaps.in). The frontend
  // serves its own pages same-origin, so it needs no CORS headers of its own.
  // (Previously this block set Access-Control-Allow-Origin: * on every page,
  // which was a no-op at best and misleading at worst.)

  // Retire the legacy duplicate shell (gap items 180, 195–198). The old
  // `(dashboard)` pages showed $ instead of ₹ (/dashboard), raw 1970-01-01
  // epoch times (/appointments), an empty lab next to the live /laboratory
  // portal (/lab) and a 404 on /departments/{id}. Every old route with a
  // current equivalent now redirects to it, so bookmarks never land on the old
  // UI. Temporary (307) for now: once these have been live for a release the
  // legacy pages can be deleted and the redirects made permanent.
  // Routes with no current equivalent (/blood-bank, /prescriptions,
  // /progress-notes, /nursing-notes, /messages, /tickets) are left as they are.
  async redirects() {
    const to = (source: string, destination: string) => ({ source, destination, permanent: false });
    return [
      // Lands each user on the first portal their role allows — not every
      // role may open the Hospital dashboard.
      to('/dashboard/:path*', '/select-module'),
      to('/appointments/:path*', '/hospital'),
      to('/visits/:path*', '/hospital'),
      to('/patients/new', '/hospital/patients'),
      to('/patients/:id/:rest+', '/hospital/patients/:id'),
      to('/patients', '/hospital/patients'),
      to('/patients/:id', '/hospital/patients/:id'),
      to('/admissions/:path*', '/hospital/ip'),
      to('/vitals/:path*', '/hospital/patients'),
      to('/diagnoses/:path*', '/hospital/patients'),
      to('/lab/:path*', '/laboratory'),
      to('/imaging/:path*', '/radiology'),
      to('/billing/payments', '/hospital/transactions'),
      to('/billing/:path*', '/hospital/billing'),
      to('/users/:path*', '/hospital/settings/users'),
      // Gap 197: carry the id along so the services page can say "not found"
      // for an unknown department instead of silently listing the rest.
      to('/departments', '/hospital/settings/services'),
      to('/departments/:id/:rest+', '/hospital/settings/services?department=:id'),
      to('/departments/:id', '/hospital/settings/services?department=:id'),
      to('/settings/:path*', '/hospital/settings/:path*'),
      to('/reports/:path*', '/hospital/reports'),
      to('/attendance/:path*', '/hr/attendance'),
      to('/payroll/:path*', '/hr/payroll'),

      // Counsellor Reports and Settings were never built, so their menu links
      // 404'd (gap items 178, 179). The links are hidden in config/modules.ts
      // until the pages exist; a bookmark goes back to Counsellor Home.
      to('/counsellor/reports/:path*', '/counsellor'),
      to('/counsellor/settings/:path*', '/counsellor'),
    ];
  },
};

export default nextConfig;
