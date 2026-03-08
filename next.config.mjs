/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@dashevo/dashcore-lib'],
  },
  env: {
    ADMIN_PASSWORD:   process.env.ADMIN_PASSWORD || '',
    DASH_NETWORK:     process.env.DASH_NETWORK     || 'mainnet',
    LOTTERY_DATA_DIR: process.env.LOTTERY_DATA_DIR || '/root/.openclaw/workspace/timely-lottery-data',
  },

  // ── Webpack: exclude Node-only modules from browser bundle ───────────────
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, path: false, crypto: false, stream: false,
        net: false, tls: false, child_process: false,
      };
    }
    return config;
  },

  // ── Security Headers ───────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options',           value: 'DENY' },
          // Prevent MIME sniffing
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          // Referrer policy — don't leak URLs
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          // Permissions policy — disable unused browser features
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          // XSS protection (legacy browsers)
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          // HSTS — force HTTPS for 1 year
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // needed for Next.js
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
