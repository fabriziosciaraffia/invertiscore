import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // @sparticuz/chromium ships un binario nativo en node_modules/.../bin que
  // webpack rompe al relocate. Externalizarlo evita el bundling y deja el
  // path original intacto en la function de Vercel.
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // 302: el formulario canónico ahora es el wizard v2. Path exacto: no captura
      // /analisis/nuevo/revisar (ese sigue vivo para entries antiguas).
      {
        source: '/analisis/nuevo',
        destination: '/analisis/nuevo-v2',
        permanent: false,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "franco-1v",
  project: "javascript-nextjs",
  disableSourceMapUpload: true,
  hideSourceMaps: true,
  telemetry: false,
});
