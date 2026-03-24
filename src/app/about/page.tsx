import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0F0F0F]">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <FrancoLogo size="header" href="/" inverted />
          <Link
            href="/register"
            className="bg-[#C8323C] text-white font-body text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#C8323C]/90 transition-colors"
          >
            Analizar gratis →
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-[640px] mx-auto px-6 py-16 md:py-24">
        <h1 className="font-heading font-bold text-3xl md:text-4xl text-[#FAFAF8]">
          Sobre Franco
        </h1>

        <div className="mt-8 space-y-6 font-body text-[15px] text-[#FAFAF8]/80 leading-relaxed">
          <p>
            Franco nació de una frustración: los números que te muestra tu corredor no cuentan la historia completa.
          </p>
          <p>
            Somos una herramienta independiente de análisis de inversión inmobiliaria en Chile. Nuestro modelo es simple: ganamos cuando tú decides bien, no cuando compras.
          </p>
          <p>
            Usamos datos públicos del Banco Central, SII e información de mercado para mostrarte los números reales — sin maquillaje, sin conflictos de interés.
          </p>
          <p className="text-[#FAFAF8]/50">
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
      <footer className="bg-[#0F0F0F] py-9 px-6">
        <div className="max-w-[640px] mx-auto">
          <FrancoLogo inverted size="header" href="/" />
          <p className="font-mono text-[8px] text-white/25 uppercase tracking-[0.1em] mt-1">
            RE FRANCO CON TU INVERSIÓN
          </p>
          <div className="border-t border-white/[0.05] mt-6 pt-3.5">
            <p className="font-body text-[10px] text-white/[0.18]">
              © 2026 refranco.ai — No somos asesores financieros. Somos francos.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
