import Link from "next/link";
import { AppNav, NavPrimaryCTA } from "@/components/chrome/AppNav";
import { AppFooter } from "@/components/chrome/AppFooter";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <AppNav variant="marketing" ctaSlot={<NavPrimaryCTA href="/register" />} />

      {/* Content */}
      <main className="max-w-[640px] mx-auto px-6 py-16 md:py-24">
        <h1 className="font-heading font-bold text-3xl md:text-4xl text-[var(--franco-text)]">
          Sobre Franco
        </h1>

        <div className="mt-8 space-y-6 font-body text-[15px] text-[var(--franco-text)] leading-relaxed">
          <p>
            Franco nació de una frustración: los números que te muestra tu corredor no cuentan la historia completa.
          </p>
          <p>
            Somos una herramienta independiente de análisis de inversión inmobiliaria en Chile. Nuestro modelo es simple: ganamos cuando tú decides bien, no cuando compras.
          </p>
          <p>
            Usamos datos públicos del Banco Central, SII e información de mercado para mostrarte los números reales — sin maquillaje, sin conflictos de interés.
          </p>
          <p className="text-[var(--franco-text-secondary)]">
            Franco es un proyecto de refranco.ai — re franco con tu inversión.
          </p>
        </div>

        <div className="mt-12">
          <Link
            href="/register"
            className="inline-block bg-[#C8323C] text-white font-body text-[15px] font-semibold px-8 py-3.5 rounded-lg hover:bg-[#C8323C]/90 transition-colors"
          >
            Analizar un departamento →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <AppFooter variant="rich" />
    </div>
  );
}
