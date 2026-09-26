import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./fuentes.css";
import { PHProvider } from "./providers";
import { COMPARABLES_TEXTO } from "@/lib/stats";
import { buildSiteJsonLd } from "@/lib/seo/jsonld";

// ── LAS FUENTES ───────────────────────────────────────────────────────────────
// Desde el 25-sep-2026 se sirven desde el propio sitio (`public/fonts/` + `fuentes.css`): el build
// ya no depende de que Google responda (dos builds de Vercel fallaron por eso). Son los mismos
// archivos y las mismas caras que generaba `next/font/google`, con los mismos pesos declarados:
//  · Source Serif 4 → `--font-heading`: 300 (italic, la «re» del wordmark), 400 (la prosa serif del
//    hallazgo: sin él el navegador caía al 300), 600 (el titular del hero) y 700.
//  · IBM Plex Sans → `--font-body`: 400 y 500 (la skill prohíbe Semibold/Bold).
//  · Inter → `--font-ui`: variable 100-900, la tipografía del rediseño del informe.
//  · JetBrains Mono → `--font-mono`: 400, 500 y 700.
// Las variables viven en la clase `fuentes-franco` de <body>, como la clase de next/font.
// Se precargan los rangos latin y latin-ext, los mismos que next/font marcaba para precargar.
const FUENTES_PRECARGA = [
  "source-serif-4-normal-latin.woff2",
  "source-serif-4-normal-latin-ext.woff2",
  "source-serif-4-italic-latin.woff2",
  "source-serif-4-italic-latin-ext.woff2",
  "ibm-plex-sans-normal-latin.woff2",
  "ibm-plex-sans-normal-latin-ext.woff2",
  "inter-normal-latin.woff2",
  "inter-normal-latin-ext.woff2",
  "jetbrains-mono-normal-latin.woff2",
] as const;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  // Base para resolver metadata relativa (canonicals, OG images) en absoluta.
  metadataBase: new URL("https://refranco.ai"),
  title: {
    default: "Franco — ¿Ese depto es buena inversión? Análisis con datos reales",
    template: "%s | Franco",
  },
  description:
    `Analiza departamentos como inversión en Santiago. Franco Score, rentabilidad, flujo de caja, comparación con la zona y análisis con datos reales de ${COMPARABLES_TEXTO} propiedades.`,
  keywords: [
    "inversión inmobiliaria",
    "departamentos Santiago",
    "análisis inversión",
    "rentabilidad arriendo",
    "Franco Score",
    "invertir en departamentos Chile",
  ],
  openGraph: {
    title: "refranco.ai — Análisis de inversión inmobiliaria en Chile",
    description:
      "Analiza departamentos como inversión en Santiago. Franco Score, rentabilidad, flujo de caja y análisis con datos reales. Gratis, en 30 segundos.",
    type: "website",
    url: "https://refranco.ai",
    siteName: "Franco",
    locale: "es_CL",
    // Sin `images` acá: la imagen la aporta la convención de archivo
    // src/app/opengraph-image.tsx (el /og-image.png referenciado antes era un
    // 404 desde abr-2026). Twitter/X cae al og:image cuando no hay
    // twitter:image explícito.
  },
  twitter: {
    card: "summary_large_image",
    title: "Franco — ¿Ese depto es buena inversión?",
    description:
      "Analiza departamentos como inversión en Santiago. Franco Score, rentabilidad y análisis con datos reales. Gratis.",
  },
  robots: {
    index: true,
    follow: true,
  },
  // Sin `alternates.canonical` acá: Next hereda la metadata del root en toda
  // página que no la sobreescriba, y un canonical absoluto en el root declaraba
  // a cada página "copia de la homepage" (bug Fase 0 SEO). El canonical va por
  // página, relativo, resuelto contra metadataBase.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {FUENTES_PRECARGA.map((f) => (
          <link key={f} rel="preload" href={`/fonts/${f}`} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
        {/* Pre-paint (sin flash): resuelve el tema ANTES del primer render.
            DEFAULT = LIGHT (cierre del capítulo Galería): quien no tiene
            preferencia guardada (o localStorage no disponible) ve light. Solo
            un 'dark' explícito guardado deja el atributo ausente (= dark). Quien
            ya eligió conserva su elección; cero migración forzada (no se
            persiste el default). Mantener el READ en sync con theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t;try{var k='franco-theme';t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){var l=localStorage.getItem('franco-landing-theme');if(l==='light'||l==='dark'){t=l;localStorage.setItem(k,l);}}}catch(e){}if(t!=='dark')document.documentElement.setAttribute('data-theme','light');})();` }} />
      </head>
      <body className="fuentes-franco font-body antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSiteJsonLd()) }}
        />
        <PHProvider>
          {children}
        </PHProvider>
      </body>
    </html>
  );
}
