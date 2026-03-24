import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0F0F0F]">
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

      <main className="max-w-[640px] mx-auto px-6 py-16 md:py-24">
        <h1 className="font-heading font-bold text-3xl md:text-4xl text-[#FAFAF8]">
          Términos de Uso
        </h1>
        <p className="font-body text-[13px] text-[#FAFAF8]/50 mt-3">
          Última actualización: marzo 2026
        </p>

        {/* Disclaimer */}
        <div className="mt-10 rounded-xl border-2 border-[#C8323C] bg-[#C8323C]/[0.04] p-6">
          <p className="font-mono text-[10px] text-[#C8323C] uppercase tracking-[0.1em] font-bold mb-2">
            IMPORTANTE
          </p>
          <p className="font-body text-[15px] text-[#FAFAF8] leading-relaxed font-semibold">
            Franco NO es asesor financiero.
          </p>
          <p className="font-body text-[14px] text-[#FAFAF8]/80 leading-relaxed mt-2">
            La información entregada por Franco es referencial y no constituye recomendación de inversión. El usuario es el único responsable de sus decisiones de inversión. Consulte siempre con un profesional antes de invertir.
          </p>
        </div>

        <div className="mt-10 space-y-10">
          {/* 1 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">1. Qué es Franco</h2>
            <p className="font-body text-[15px] text-[#FAFAF8]/80 leading-relaxed mt-3">
              Franco (refranco.ai) es una herramienta de análisis de inversión inmobiliaria operada desde Chile. Permite evaluar propiedades residenciales mediante métricas financieras calculadas a partir de los datos ingresados por el usuario.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">2. Datos y precisión</h2>
            <p className="font-body text-[15px] text-[#FAFAF8]/80 leading-relaxed mt-3">
              Los datos utilizados provienen de fuentes públicas (Banco Central, SII, CMF) e información de mercado. Franco no garantiza la exactitud, completitud ni actualidad de los datos. Los resultados son estimaciones basadas en los parámetros ingresados y supuestos del modelo.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">3. Servicio</h2>
            <p className="font-body text-[15px] text-[#FAFAF8]/80 leading-relaxed mt-3">
              El servicio se ofrece &ldquo;tal cual&rdquo; y &ldquo;según disponibilidad&rdquo;, sin garantías de ningún tipo, expresas o implícitas. Franco no garantiza que el servicio sea ininterrumpido, libre de errores o que cumpla con las expectativas del usuario.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">4. Precios y cambios</h2>
            <p className="font-body text-[15px] text-[#FAFAF8]/80 leading-relaxed mt-3">
              Franco puede modificar precios, funcionalidades y estos términos en cualquier momento. Los cambios se aplicarán desde su publicación en el sitio. El uso continuado del servicio después de un cambio implica su aceptación.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">5. Propiedad intelectual</h2>
            <p className="font-body text-[15px] text-[#FAFAF8]/80 leading-relaxed mt-3">
              El contenido, diseño, marca, código y metodología de Franco son propiedad de sus creadores. Queda prohibida su reproducción, distribución o uso comercial sin autorización expresa.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">6. Aceptación</h2>
            <p className="font-body text-[15px] text-[#FAFAF8]/80 leading-relaxed mt-3">
              El uso de Franco implica la aceptación de estos términos. Si no estás de acuerdo, no utilices el servicio.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">7. Ley aplicable</h2>
            <p className="font-body text-[15px] text-[#FAFAF8]/80 leading-relaxed mt-3">
              Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia será sometida a los tribunales ordinarios de justicia de Santiago.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">8. Contacto</h2>
            <p className="font-body text-[15px] text-[#FAFAF8]/80 leading-relaxed mt-3">
              Para consultas sobre estos términos:{" "}
              <a href="mailto:contacto@refranco.ai" className="text-[#C8323C] font-semibold hover:underline">
                contacto@refranco.ai
              </a>
            </p>
          </section>
        </div>
      </main>

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
