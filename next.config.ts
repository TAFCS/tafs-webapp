import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. A stray package.json + lockfile at ../ (added for
  // the one-off scripts in ../scripts) makes Next infer the whole TAFS folder
  // as the root, so Turbopack tries to scan and watch ~7GB — tafs-backend,
  // tafs-flutter, the spreadsheet dumps — and dev never finishes compiling.
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    // Assets are served from DigitalOcean Spaces CDN — skip Vercel image optimization.
    unoptimized: true,
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
    // Only proxy Nest `/api/v1/*`. Leave Next route handlers alone
    // (`/api/web-session`, `/api/photo-proxy`) so they are not forwarded to Railway.
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://tafs-backend-production.up.railway.app/api'}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
