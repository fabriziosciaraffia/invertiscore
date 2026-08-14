import type { Metadata } from "next";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { AppFooter } from "@/components/chrome/AppFooter";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Habla con el equipo detrás de Franco: dudas sobre tu análisis, los planes o los datos. Escríbenos y te respondemos directo, con la misma franqueza del análisis.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <UnifiedNav variant="marketing" />

      {/* Content */}
      <main className="max-w-[640px] mx-auto px-6 py-16 md:py-24">
        <h1 className="font-heading font-bold text-3xl md:text-4xl text-[var(--franco-text)]">
          Contacto
        </h1>

        <div className="mt-8 space-y-6 font-body text-[15px] text-[var(--franco-text)] leading-relaxed">
          <p>
            ¿Tienes dudas, sugerencias o quieres reportar un error?
          </p>
          <p>
            Escríbenos a{" "}
            <a
              href="mailto:hola@refranco.ai"
              className="text-[#C8323C] font-semibold hover:underline"
            >
              hola@refranco.ai
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <AppFooter variant="minimal" />
    </div>
  );
}
