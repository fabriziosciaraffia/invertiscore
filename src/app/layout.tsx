import type { Metadata, Viewport } from "next";
import { Source_Serif_4, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PHProvider } from "./providers";

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-heading",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
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
  title: {
    default: "Franco — ¿Ese depto es buena inversión? Análisis con datos reales",
    template: "%s | Franco",
  },
  description:
    "Analiza departamentos como inversión en Santiago. Franco Score, rentabilidad, flujo de caja, comparación con la zona y análisis con IA. Datos reales de 20.000+ propiedades.",
  keywords: [
    "inversión inmobiliaria",
    "departamentos Santiago",
    "análisis inversión",
    "rentabilidad arriendo",
    "Franco Score",
    "invertir en departamentos Chile",
  ],
  openGraph: {
    title: "Franco — Re franco con tu inversión",
    description:
      "Analiza departamentos como inversión en Santiago. Franco Score, rentabilidad, flujo de caja y análisis con IA. Gratis, en 30 segundos.",
    type: "website",
    url: "https://refranco.ai",
    siteName: "Franco",
    locale: "es_CL",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Franco — Análisis de inversión inmobiliaria" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Franco — ¿Ese depto es buena inversión?",
    description:
      "Analiza departamentos como inversión en Santiago. Franco Score, rentabilidad y análisis con IA. Gratis.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://refranco.ai",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('franco-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');})();` }} />
      </head>
      <body className={`${sourceSerif.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable} font-body antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Franco",
              url: "https://refranco.ai",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web",
              description: "Analiza departamentos como inversión en Santiago con datos reales. Franco Score, rentabilidad, flujo de caja y análisis con IA.",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "CLP",
              },
            }),
          }}
        />
        <PHProvider>
          {children}
        </PHProvider>
      </body>
    </html>
  );
}
