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
      // /analisis/nuevo/revisar — por eso la entrada de abajo.
      {
        source: '/analisis/nuevo',
        destination: '/analisis/nuevo-v2',
        permanent: false,
      },
      // 302: el paso "revisar" del wizard v1 se borró el 2026-08-03 junto con el
      // resto del v1. Sin esta entrada, quien tenga la URL en historial o marcador
      // cae en 404 (el redirect de arriba es de path exacto y no la cubre). Su
      // draft en sessionStorage (`franco:revisar:v1`) ya no lo lee nadie, así que
      // el destino es el wizard vivo, no un intento de rehidratar.
      {
        source: '/analisis/nuevo/revisar',
        destination: '/analisis/nuevo-v2',
        permanent: false,
      },
      // 302: el wizard legacy de renta corta se borró junto con este redirect. Path
      // EXACTO a propósito: NO debe capturar /analisis/renta-corta/{id}, que es la
      // página de resultados STR y sigue viva —  la referencian el dashboard, la
      // comparativa, el admin y los dos wizards.
      //
      // Se retira y no se unifica porque estaba muerto: cero CTAs apuntaban a él,
      // los 18 análisis que creó son de abril-mayo de 2026 y ninguno desde el
      // 2026-05-10. Mantenerlo vivo habría significado sostener un segundo
      // formulario, con sus propios defaults y su propia forma de declarar la
      // entrega (`mesesEntrega` relativo contra el `fechaEntrega` absoluto del
      // wizard v4), para nadie. Mismo tratamiento que el wizard v1, borrado el
      // 2026-08-03.
      {
        source: '/analisis/renta-corta',
        destination: '/analisis/nuevo-v2',
        permanent: false,
      },
      // 301: /proximamente fue retirada (waitlist de pre-lanzamiento). La cobertura
      // ahora vive en /cobertura; mandamos la vieja URL a la home.
      {
        source: '/proximamente',
        destination: '/',
        permanent: true,
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
