import type { Metadata } from "next";
import { Source_Serif_4, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-heading",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Franco — Análisis de inversión inmobiliaria con IA",
  description:
    "Re franco con tu inversión. Análisis objetivo de departamentos para inversión en Chile. Score, flujo de caja real, y veredicto sin conflictos de interés.",
  openGraph: {
    title: "Franco — Re franco con tu inversión",
    description:
      "Tu corredor gana si compras. Franco gana si decides bien.",
    type: "website",
    url: "https://refranco.ai",
    siteName: "Franco",
    locale: "es_CL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Franco — Análisis de inversión inmobiliaria con IA",
    description:
      "Re franco con tu inversión. Análisis objetivo de departamentos para inversión en Chile.",
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
      <body className={`${sourceSerif.variable} ${sourceSans.variable} ${jetbrainsMono.variable} font-body antialiased`}>
        {children}
        <div className="border-t border-franco-border px-4 pb-6 pt-4 text-center">
          <p className="mx-auto max-w-xl text-[11px] leading-relaxed text-[#9ca3af]">
            Franco es una herramienta informativa. Los resultados son estimaciones basadas en los datos ingresados y no constituyen asesoría financiera, tributaria ni legal. Consulta con un profesional antes de tomar decisiones de inversión.
          </p>
        </div>
      </body>
    </html>
  );
}
