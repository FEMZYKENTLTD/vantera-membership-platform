import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  },
  experimental: {
    serverActions: {
      // Evidence and card-design uploads travel through server actions as
      // multipart form data and are strictly validated server-side
      // (extension allowlist, magic-byte sniffing, size caps) before they
      // reach private storage. 30 MB covers the 25 MB hard bucket limit.
      bodySizeLimit: '30mb'
    }
  }
};

export default nextConfig;
