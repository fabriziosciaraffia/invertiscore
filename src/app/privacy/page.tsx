import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";

export default function PrivacyPage() {
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
          Política de Privacidad
        </h1>
        <p className="font-body text-[13px] text-white/50 mt-3">
          Última actualización: marzo 2026
        </p>

        <div className="mt-10 space-y-10">
          {/* 1 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">1. Qué datos recopilamos</h2>
            <div className="font-body text-[15px] text-[#FAFAF8] leading-relaxed mt-3 space-y-3">
              <p>
                <strong className="text-[#FAFAF8]">Datos del análisis:</strong> los datos que ingresas en el formulario (dirección, precio, superficie, características del departamento, parámetros financieros). Estos datos se almacenan para generar y guardar tu análisis.
              </p>
              <p>
                <strong className="text-[#FAFAF8]">Cuenta de usuario:</strong> si te registras, almacenamos tu email y los análisis asociados a tu cuenta.
              </p>
              <p>
                <strong className="text-[#FAFAF8]">Datos de uso:</strong> información técnica como tipo de dispositivo, navegador y páginas visitadas, recopilada mediante cookies y herramientas de analytics.
              </p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">2. Para qué usamos los datos</h2>
            <ul className="font-body text-[15px] text-[#FAFAF8] leading-relaxed mt-3 space-y-2 list-disc pl-5">
              <li>Generar y almacenar tus análisis de inversión</li>
              <li>Mejorar la precisión del servicio y las sugerencias de mercado</li>
              <li>Generar estadísticas agregadas y anónimas sobre el mercado inmobiliario</li>
              <li>Comunicarnos contigo si lo solicitas</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">3. Lo que NO hacemos</h2>
            <div className="rounded-xl bg-[#1A1A1A] border border-white/[0.08] p-5 mt-3">
              <ul className="font-body text-[15px] text-[#FAFAF8] leading-relaxed space-y-2">
                <li><strong className="text-[#FAFAF8]">No vendemos</strong> tus datos personales a terceros</li>
                <li><strong className="text-[#FAFAF8]">No compartimos</strong> tus análisis con corredores, inmobiliarias ni terceros</li>
                <li><strong className="text-[#FAFAF8]">No enviamos</strong> comunicaciones comerciales no solicitadas</li>
              </ul>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">4. Cookies</h2>
            <p className="font-body text-[15px] text-[#FAFAF8] leading-relaxed mt-3">
              Usamos cookies técnicas necesarias para el funcionamiento del sitio (autenticación, preferencias) y cookies de analytics para entender cómo se usa el servicio. No usamos cookies de publicidad.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">5. Tus derechos</h2>
            <p className="font-body text-[15px] text-[#FAFAF8] leading-relaxed mt-3">
              Puedes solicitar acceso, rectificación o eliminación de tus datos en cualquier momento escribiendo a{" "}
              <a href="mailto:contacto@refranco.ai" className="text-[#C8323C] font-semibold hover:underline">
                contacto@refranco.ai
              </a>
              . Procesaremos tu solicitud en un plazo razonable.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">6. Seguridad</h2>
            <p className="font-body text-[15px] text-[#FAFAF8] leading-relaxed mt-3">
              Usamos medidas de seguridad razonables para proteger tu información, incluyendo cifrado en tránsito (HTTPS) y almacenamiento seguro. Sin embargo, ningún sistema es 100% seguro.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">7. Cambios a esta política</h2>
            <p className="font-body text-[15px] text-[#FAFAF8] leading-relaxed mt-3">
              Podemos actualizar esta política. Los cambios se reflejarán actualizando la fecha de &ldquo;Última actualización&rdquo; en esta página.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[#FAFAF8]">8. Contacto</h2>
            <p className="font-body text-[15px] text-[#FAFAF8] leading-relaxed mt-3">
              Para consultas sobre privacidad:{" "}
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
