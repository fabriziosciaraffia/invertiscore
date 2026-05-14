import Link from "next/link";

/**
 * Footer landing — fondo #0A0A0A, 4 columnas + bottom bar.
 */
export default function LandingFooter() {
  return (
    <footer className="bg-[#0A0A0A] text-[#FAFAF8]">
      <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[2fr_1fr_1fr_1fr] md:gap-12">
          {/* Col 1 — wordmark + descripción */}
          <div>
            <div data-theme="light" className="inline-flex">
              {/* Forzar wordmark sobre dark: aplico inversion manual */}
              <span className="inline-flex items-baseline">
                <span className="font-heading text-[36px] italic font-light leading-none text-[rgba(250,250,248,0.32)]" style={{ marginRight: "-0.08em" }}>
                  re
                </span>
                <span className="font-heading text-[36px] font-bold leading-none text-[#FAFAF8]">
                  franco
                </span>
                <span className="font-body font-semibold tracking-wide text-[#C8323C]" style={{ fontSize: "0.35em", letterSpacing: "0.1em", marginLeft: 1 }}>
                  .ai
                </span>
              </span>
            </div>
            <p className="mt-6 max-w-[360px] font-body text-[14px] leading-[1.6] text-[#FAFAF8]/55">
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
          style={{ borderTop: "0.5px solid rgba(250,250,248,0.10)" }}
        >
          <p className="font-mono text-[11px] font-medium text-[#FAFAF8]/45">
            © 2026 refranco.ai · Santiago, Chile
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] font-medium text-[#FAFAF8]/45">
            <Link href="/terms" className="transition-colors hover:text-[#FAFAF8]/80">
              Términos
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-[#FAFAF8]/80">
              Privacidad
            </Link>
            <span className="italic text-[#FAFAF8]/35">
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
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#FAFAF8]/55">
        {title}
      </p>
      <ul className="mt-5 space-y-3">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href}
              className="font-body text-[14px] text-[#FAFAF8]/70 transition-colors hover:text-[#FAFAF8]"
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
