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
};

export default nextConfig;
