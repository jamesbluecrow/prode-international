import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'flagcdn.com' },
      { protocol: 'https', hostname: 'dltgbifqdwnynimhiguf.supabase.co' },
    ],
  },
};

export default nextConfig;
