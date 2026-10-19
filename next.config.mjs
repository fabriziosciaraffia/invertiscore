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
          // geolocation=(self): «Estoy en el depto» (wizard, 26-sep-2026) pide la ubicación del
          // teléfono. Con `geolocation=()` el navegador la niega antes de preguntar y el camino
          // cae siempre en «Sin tu ubicación». `self` la permite en el sitio y la sigue negando
          // a cualquier iframe de terceros.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // 302 · Las tres entradas de acá abajo apuntan al wizard VIGENTE, que es el
      // v4 — la constante canónica es `RUTA_WIZARD` en src/lib/cta-analizar.ts, y
      // no se puede importar en un config de build, así que si esa cambia hay que
      // mover estas tres a mano.
      //
      // Apuntaban a /analisis/nuevo-v2, que es el v3 y quedó retirado en el
      // cutover ca3106f (27-jul-2026): sigue montado en su ruta pero ya nadie
      // debería mandarle gente. Los redirects se habían quedado atrás, así que
      // quien llegaba desde una URL vieja aterrizaba en el wizard anterior.
      //
      // Path exacto: no captura /analisis/nuevo/revisar — por eso la entrada de abajo.
      {
        source: '/analisis/nuevo',
        destination: '/analisis/nuevo-v4',
        permanent: false,
      },
      // 302: el paso "revisar" del wizard v1 se borró el 2026-08-03 junto con el
      // resto del v1. Sin esta entrada, quien tenga la URL en historial o marcador
      // cae en 404 (el redirect de arriba es de path exacto y no la cubre). Su
      // draft en sessionStorage (`franco:revisar:v1`) ya no lo lee nadie, así que
      // el destino es el wizard vivo, no un intento de rehidratar.
      {
        source: '/analisis/nuevo/revisar',
        destination: '/analisis/nuevo-v4',
        permanent: false,
      },
      // 302: el wizard v3 (/analisis/nuevo-v2) se borró el 25-sep-2026. Estaba retirado desde el
      // cutover ca3106f (27-jul-2026) y ya nadie lo enlazaba: en los 30 días previos, cero
      // análisis creados con él (todos llevan la marca del v4). Quien tenga la URL vieja —o el
      // ?resume=1 de su registro— cae en el wizard vivo.
      {
        source: '/analisis/nuevo-v2',
        destination: '/analisis/nuevo-v4',
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
        destination: '/analisis/nuevo-v4',
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

// Source maps a Sentry (19-oct-2026): las pilas llegaban minificadas (`js_no_source`) y en Sentry había cero mapas. Las
// opciones de antes (`disableSourceMapUpload`, `hideSourceMaps`) ya no existen en @sentry/nextjs 10 y no hacían nada: cada
// build intentaba subir con un SENTRY_AUTH_TOKEN de solo lectura, fallaba en silencio (`silent: true`) y borraba los mapas.
// Ahora: solo el build de producción de Vercel genera y sube (nunca uno local ni un preview), los mapas se borran después
// de subir (no quedan públicos) y el log del build dice si subió. Para que suba, el token necesita `project:releases`.
const buildDeProduccion = process.env.VERCEL_ENV === "production";

export default withSentryConfig(nextConfig, {
  silent: !buildDeProduccion,
  org: "franco-1v",
  project: "javascript-nextjs",
  sourcemaps: { disable: !buildDeProduccion, deleteSourcemapsAfterUpload: true },
  telemetry: false,
});
