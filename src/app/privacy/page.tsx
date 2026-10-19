import type { Metadata } from "next";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Cómo Franco trata tus datos: qué información guarda, para qué la usa y qué no hace nunca con ella. Explicado claro y directo, como todo lo que dice Franco.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <HeaderFranco />

      <main className="max-w-[640px] mx-auto px-6 py-16 md:py-24">
        <h1 className="font-heading font-bold text-3xl md:text-4xl text-[var(--franco-text)]">
          Política de Privacidad
        </h1>
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mt-3">
          Última actualización: octubre 2026
        </p>

        <div className="mt-10 space-y-10">
          {/* 1 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[var(--franco-text)]">1. Qué datos recopilamos</h2>
            <div className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed mt-3 space-y-3">
              <p>
                <strong className="text-[var(--franco-text)]">Datos del análisis:</strong> los datos que ingresas en el formulario (dirección, precio, superficie, características del departamento, parámetros financieros). Estos datos se almacenan para generar y guardar tu análisis.
              </p>
              <p>
                <strong className="text-[var(--franco-text)]">Cuenta de usuario:</strong> si te registras, almacenamos tu email y los análisis asociados a tu cuenta.
              </p>
              <p>
                <strong className="text-[var(--franco-text)]">Datos de uso:</strong> información técnica como tipo de dispositivo, navegador y páginas visitadas, recopilada mediante cookies y herramientas de analytics.
              </p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[var(--franco-text)]">2. Para qué usamos los datos</h2>
            <ul className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed mt-3 space-y-2 list-disc pl-5">
              <li>Generar y almacenar tus análisis de inversión</li>
              <li>Mejorar la precisión del servicio y las sugerencias de mercado</li>
              <li>Generar estadísticas agregadas y anónimas sobre el mercado inmobiliario</li>
              <li>Comunicarnos contigo si lo solicitas</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[var(--franco-text)]">3. Lo que NO hacemos</h2>
            <div className="rounded-xl bg-[var(--franco-card)] border border-[var(--franco-border)] p-5 mt-3">
              <ul className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed space-y-2">
                <li><strong className="text-[var(--franco-text)]">No vendemos</strong> tus datos personales a terceros</li>
                <li><strong className="text-[var(--franco-text)]">No compartimos</strong> tus análisis con corredores, inmobiliarias ni terceros</li>
                <li><strong className="text-[var(--franco-text)]">No enviamos</strong> comunicaciones comerciales no solicitadas</li>
              </ul>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[var(--franco-text)]">4. Cookies</h2>
            {/* Lo mismo que hace el código (19-oct-2026, lib/consentimiento.ts): lo fija el tier CONSENTIMIENTO. */}
            <div className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed mt-3 space-y-3">
              <p>
                Usamos cookies propias, necesarias para que el sitio funcione: tu sesión, tus preferencias y la elección que hiciste sobre cookies. Esas no se pueden apagar.
              </p>
              <p>Con tu permiso, usamos además:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-[var(--franco-text)]">Meta</strong> (su pixel y su API de conversiones), para medir qué anuncios traen a quienes se registran o compran. Con tu permiso le mandamos tu correo cifrado, para reconocer el registro o la compra.
                </li>
                <li>
                  <strong className="text-[var(--franco-text)]">PostHog</strong>, la grabación de sesiones, para ver dónde se traba la gente. Lo que escribes en los campos va oculto.
                </li>
              </ul>
              <p>
                Sin tu permiso, el pixel de Meta no carga y la grabación no corre. PostHog igual cuenta las visitas, pero sin guardar nada en tu navegador. Y de un registro o una compra, a Meta solo le llegan el evento, tu navegador y tu dirección IP, nunca tu correo.
              </p>
              <p>
                Tu elección dura un año y la puedes cambiar cuando quieras desde «Cookies», al pie de la página.
              </p>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[var(--franco-text)]">5. Tus derechos</h2>
            <p className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed mt-3">
              Puedes solicitar acceso, rectificación o eliminación de tus datos en cualquier momento escribiendo a{" "}
              <a href="mailto:hola@refranco.ai" className="text-[#C8323C] font-semibold hover:underline">
                hola@refranco.ai
              </a>
              . Procesaremos tu solicitud en un plazo razonable.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[var(--franco-text)]">6. Seguridad</h2>
            <p className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed mt-3">
              Usamos medidas de seguridad razonables para proteger tu información, incluyendo cifrado en tránsito (HTTPS) y almacenamiento seguro. Sin embargo, ningún sistema es 100% seguro.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[var(--franco-text)]">7. Cambios a esta política</h2>
            <p className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed mt-3">
              Podemos actualizar esta política. Los cambios se reflejarán actualizando la fecha de &ldquo;Última actualización&rdquo; en esta página.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-heading font-bold text-lg text-[var(--franco-text)]">8. Contacto</h2>
            <p className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed mt-3">
              Para consultas sobre privacidad:{" "}
              <a href="mailto:hola@refranco.ai" className="text-[#C8323C] font-semibold hover:underline">
                hola@refranco.ai
              </a>
            </p>
          </section>
        </div>
      </main>

      <AppFooter variant="rich" />
    </div>
  );
}
