import type { Metadata, Viewport } from "next";
import { Source_Serif_4, IBM_Plex_Sans, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { PHProvider } from "./providers";
import { PROPERTIES_COUNT } from "@/lib/stats";
import { buildSiteJsonLd } from "@/lib/seo/jsonld";

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  // Skill franco-design-system Capa 2: Light 300 (italic, solo wordmark "re") + Bold 700 (resto).
  // 400 agregado el 09-sep-2026: la prosa serif del informe (la frase del hallazgo) pide
  // peso normal y NO estaba cargado, así que el navegador caía al 300 por font-matching y
  // se rendíia en Light. Se veía apretada, y la causa era el peso faltante.
  // 600 agregado el 10-sep-2026 para el titular del hero del rediseño (contrato §1).
  // Sin el peso cargado pasa lo mismo que pasó con el 400: el navegador cae al más
  // cercano por font-matching y el titular se rinde en 700, más pesado que lo pedido.
  // Un peso más en una fuente que ya se descarga; lo pide el titular del hero.
  weight: ["300", "400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-heading",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  // Skill franco-design-system Capa 2: Regular 400 + Medium 500. Prohíbe Semibold/Bold (énfasis va por familia, no por peso).
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});

// ── INTER — la tipografía del rediseño del informe (contrato §1) ───────────────
// Reemplaza a IBM Plex como cuerpo y títulos, y al mono en cifras, referencias y
// rótulos. Source Serif queda reservada al titular del hero.
//
// SIN `weight`: así Next toma la VARIABLE de Inter — un archivo para todo el rango
// 400-700 — en vez de cuatro estáticos. `latin-ext` no es opcional: los nombres de
// comuna llevan tilde y ñ.
//
// `preload: true` DESDE EL GOAL 4d (10-sep-2026), el commit que encendió el rediseño.
// Mientras el rediseño estuvo detrás de un interruptor iba en `false`, y eso era lo que
// hacía que no costara nada: sin preload el navegador solo descarga el archivo cuando
// una regla usa la familia. Desde el 12-sep-2026 el rediseño es el único camino del
// informe y no hay vuelta a `false`: la primera regla que pide Inter es la del informe,
// así que sin preload la descarga arrancaría recién al renderizarlo y el lector vería
// el fallback y después el salto. Con `true` el archivo viaja con el documento.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-ui",
  display: "swap",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

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
    `Analiza departamentos como inversión en Santiago. Franco Score, rentabilidad, flujo de caja, comparación con la zona y análisis con IA. Datos reales de ${PROPERTIES_COUNT} propiedades.`,
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
      "Analiza departamentos como inversión en Santiago. Franco Score, rentabilidad, flujo de caja y análisis con IA. Gratis, en 30 segundos.",
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
      "Analiza departamentos como inversión en Santiago. Franco Score, rentabilidad y análisis con IA. Gratis.",
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
        {/* Pre-paint (sin flash): resuelve el tema ANTES del primer render.
            DEFAULT = LIGHT (cierre del capítulo Galería): quien no tiene
            preferencia guardada (o localStorage no disponible) ve light. Solo
            un 'dark' explícito guardado deja el atributo ausente (= dark). Quien
            ya eligió conserva su elección; cero migración forzada (no se
            persiste el default). Mantener el READ en sync con theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t;try{var k='franco-theme';t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){var l=localStorage.getItem('franco-landing-theme');if(l==='light'||l==='dark'){t=l;localStorage.setItem(k,l);}}}catch(e){}if(t!=='dark')document.documentElement.setAttribute('data-theme','light');})();` }} />
      </head>
      <body className={`${sourceSerif.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable} ${inter.variable} font-body antialiased`}>
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
