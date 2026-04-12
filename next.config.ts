import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tafs-assets.sgp1.cdn.digitaloceanspaces.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'tafs-assets.sgp1.digitaloceanspaces.com',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://tafs-backend-production.up.railway.app/api'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
