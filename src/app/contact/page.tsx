import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";

export default function ContactPage() {
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
          Contacto
        </h1>

        <div className="mt-8 space-y-6 font-body text-[15px] text-[#FAFAF8]/80 leading-relaxed">
          <p>
            ¿Tienes dudas, sugerencias o quieres reportar un error?
          </p>
          <p>
            Escríbenos a{" "}
            <a
              href="mailto:contacto@refranco.ai"
              className="text-[#C8323C] font-semibold hover:underline"
            >
              contacto@refranco.ai
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#0F0F0F] py-9 px-6 mt-auto">
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
