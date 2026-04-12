import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";
import LeverageSection from "@/components/leverage-section";

export default function AprendePage() {
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

      {/* Page title */}
      <div className="max-w-[640px] mx-auto px-6 pt-16 md:pt-24 pb-10">
        <h1 className="font-heading font-bold text-3xl md:text-4xl text-[#FAFAF8]">
          Aprende
        </h1>
        <p className="font-body text-[15px] text-white/50 mt-3">
          Guías prácticas para invertir en departamentos en Chile
        </p>
      </div>

      {/* Article card */}
      <div className="max-w-[640px] mx-auto px-6 pb-12">
        <Link
          href="#articulo-apalancamiento"
          className="block rounded-2xl border border-white/[0.08] bg-[#1A1A1A] p-6 hover:border-white/20 transition-colors"
        >
          <p className="font-mono text-[9px] text-[#C8323C] uppercase tracking-[0.1em] mb-2">
            GUÍA
          </p>
          <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">
            ¿Por qué invertir en un depto que pierde plata cada mes?
          </h2>
          <p className="font-body text-[13px] text-white/50 mt-2 leading-relaxed">
            El flujo negativo no es toda la historia. Entiende cómo el apalancamiento transforma $24M en $80M+ de patrimonio en 10 años.
          </p>
        </Link>
      </div>

      {/* Article content */}
      <div id="articulo-apalancamiento">
        <LeverageSection />
      </div>

      {/* Bottom CTA */}
      <div className="bg-[#1A1A1A] border-t border-white/[0.08] py-14 text-center px-6">
        <p className="font-heading font-bold text-xl text-[#FAFAF8] mb-2">
          ¿Quieres saber si tu depto vale la pena?
        </p>
        <p className="font-body text-sm text-white/50 mb-6">
          Ingresa los datos y Franco te dice la verdad en 30 segundos.
        </p>
        <Link
          href="/register"
          className="inline-block bg-[#C8323C] text-white font-body text-[15px] font-semibold px-8 py-3.5 rounded-lg hover:bg-[#C8323C]/90 transition-colors"
        >
          Analiza gratis →
        </Link>
      </div>

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
