import Link from "next/link";

/**
 * Footer landing — hereda fondo del tema activo. Tagline reemplaza
 * la descripción larga.
 */
export default function LandingFooter() {
  return (
    <footer className="border-t text-[var(--landing-text)]" style={{ borderColor: "var(--landing-divider)" }}>
      <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[2fr_1fr_1fr_1fr] md:gap-12">
          {/* Col 1 — wordmark + tagline */}
          <div>
            <div className="inline-flex flex-col">
              <span className="inline-flex items-baseline">
                <span
                  className="font-heading text-[36px] italic font-light leading-none"
                  style={{ color: "var(--landing-wm-re)", marginRight: "-0.08em" }}
                >
                  re
                </span>
                <span
                  className="font-heading text-[36px] font-bold leading-none"
                  style={{ color: "var(--landing-wm-franco)" }}
                >
                  franco
                </span>
                <span
                  className="font-body font-semibold tracking-wide text-[#C8323C]"
                  style={{ fontSize: "0.35em", letterSpacing: "0.1em", marginLeft: 1 }}
                >
                  .ai
                </span>
              </span>
              <span
                className="mt-2 font-mono uppercase"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "var(--landing-text-secondary)",
                }}
              >
                Real estate en su estado más franco
              </span>
            </div>
            <p className="mt-5 max-w-[360px] font-body text-[14px] leading-[1.6] text-[var(--landing-text-muted)]">
              Análisis de inversión inmobiliaria con datos reales. Para que
              decidas con criterio, no con corazonadas.
            </p>
          </div>

          <FooterCol
            title="Producto"
            items={[
              { label: "Cómo funciona", href: "/#que-hace-franco" },
              { label: "Precios", href: "/#pricing" },
              { label: "Para asesores", href: "/register" },
              { label: "Metodología", href: "/proximamente" },
            ]}
          />

          <FooterCol
            title="Recursos"
            items={[
              { label: "Glosario", href: "/proximamente" },
              { label: "Casos de uso", href: "/#que-hace-franco" },
              { label: "Blog", href: "/proximamente" },
              { label: "FAQ", href: "/proximamente" },
            ]}
          />

          <FooterCol
            title="Contacto"
            items={[
              { label: "hola@refranco.ai", href: "mailto:hola@refranco.ai" },
              { label: "Instagram", href: "https://instagram.com" },
              { label: "LinkedIn", href: "https://linkedin.com" },
            ]}
          />
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between"
          style={{ borderTop: "0.5px solid var(--landing-divider)" }}
        >
          <p className="font-mono text-[11px] font-medium text-[var(--landing-text-muted)]">
            © 2026 refranco.ai · Santiago, Chile
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] font-medium text-[var(--landing-text-muted)]">
            <Link href="/terms" className="transition-opacity hover:opacity-80">
              Términos
            </Link>
            <Link href="/privacy" className="transition-opacity hover:opacity-80">
              Privacidad
            </Link>
            <span className="italic">
              Análisis informativo · no constituye asesoría financiera
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--landing-text-muted)]">
        {title}
      </p>
      <ul className="mt-5 space-y-3">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href}
              className="font-body text-[14px] text-[var(--landing-text-secondary)] transition-opacity hover:opacity-90"
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
