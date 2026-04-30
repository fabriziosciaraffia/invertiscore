import { AppNav, NavPrimaryCTA } from "@/components/chrome/AppNav";
import { AppFooter } from "@/components/chrome/AppFooter";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <AppNav variant="marketing" ctaSlot={<NavPrimaryCTA href="/register" />} />

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
              href="mailto:contacto@refranco.ai"
              className="text-[#C8323C] font-semibold hover:underline"
            >
              contacto@refranco.ai
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <AppFooter variant="minimal" />
    </div>
  );
}
