import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    domains: ['scbqioxxfyoghyeawhfz.supabase.co', 'pub-ba37f7feda784cc18547900bd928a99a.r2.dev', 'lhhcbzjeonplcrpizsdp.supabase.co'],
  },
};

export default nextConfig;
