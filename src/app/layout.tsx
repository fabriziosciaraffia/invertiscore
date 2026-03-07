import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "InvertiScore - Análisis de Inversión Inmobiliaria en Chile",
  description:
    "Analiza cualquier propiedad de inversión en Chile en 30 segundos. Score de 1-100, flujo de caja real, proyecciones y análisis IA. Sin sesgos, sin comisiones.",
  openGraph: {
    title: "InvertiScore - Análisis de Inversión Inmobiliaria en Chile",
    description:
      "Analiza cualquier propiedad de inversión en Chile en 30 segundos. Score de 1-100, flujo de caja real, proyecciones y análisis IA.",
    type: "website",
    url: "https://invertiscore.cl",
    siteName: "InvertiScore",
    locale: "es_CL",
  },
  twitter: {
    card: "summary_large_image",
    title: "InvertiScore - Análisis de Inversión Inmobiliaria",
    description:
      "Score de 1-100, flujo de caja real, proyecciones y análisis IA para cualquier propiedad en Chile.",
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
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
