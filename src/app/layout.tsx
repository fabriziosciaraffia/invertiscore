import type { Metadata, Viewport } from "next";
import { Source_Serif_4, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
  title: "Franco — ¿Ese depto es buena inversión?",
  description:
    "Tu corredor gana si compras. Franco te muestra los números reales. Análisis de inversión inmobiliaria con IA. Gratis, en 30 segundos.",
  openGraph: {
    title: "Franco — Re franco con tu inversión",
    description:
      "Tu corredor gana si compras. Franco gana si decides bien. Análisis objetivo de departamentos para inversión en Chile.",
    type: "website",
    url: "https://refranco.ai",
    siteName: "Franco",
    locale: "es_CL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Franco — ¿Ese depto es buena inversión?",
    description:
      "Tu corredor gana si compras. Franco te muestra los números reales. Análisis de inversión inmobiliaria con IA.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${sourceSerif.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable} font-body antialiased`}>
        {children}
      </body>
    </html>
  );
}
