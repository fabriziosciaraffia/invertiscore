"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";

/**
 * LA CABECERA DEL DEMO PÚBLICO (25-sep-2026). Dos pestañas, una por modalidad, cada una con su URL
 * para compartir: `/demo` (renta larga, la que abre) y `/demo/renta-corta`.
 *
 * NO ES UNA COMPARACIÓN. Son dos departamentos distintos y cada pestaña carga un informe entero y
 * propio. Por eso el control no muestra puntaje ni veredicto, nada va lado a lado, no dice «vs» ni
 * «cuál conviene», y no usa rojo: la pestaña activa se marca en tinta. La línea de abajo lo dice.
 *
 * Un evento de PostHog por pestaña vista (`demo_pestana_vista`, con la modalidad).
 *
 * DESDE EL 27-SEP-2026 LA CABECERA ES EL HEADER ÚNICO (HeaderFranco, en modo «ejemplo»: el demo se
 * ve como sin sesión y, al bajar, lleva la identidad del informe) y debajo van las pestañas, que
 * ya no son parte del header: su wordmark y su botón rojo propios salieron.
 */
export type ModalidadDemo = "larga" | "corta";

const PESTANAS: { modalidad: ModalidadDemo; href: string; rotulo: string }[] = [
  { modalidad: "larga", href: "/demo", rotulo: "Ejemplo en renta larga" },
  { modalidad: "corta", href: "/demo/renta-corta", rotulo: "Ejemplo en renta corta" },
];

export function DemoCabecera({ modalidad }: { modalidad: ModalidadDemo }) {
  const posthog = usePostHog();
  useEffect(() => {
    posthog?.capture("demo_pestana_vista", { modalidad });
  }, [posthog, modalidad]);

  return (
    <>
      <HeaderFranco informe={{ modo: "ejemplo" }} />
      <div className="container mx-auto max-w-6xl px-4 pt-3 pb-3">
        <nav role="tablist" aria-label="Análisis de ejemplo" className="flex gap-6 border-b border-[var(--franco-border)]">
          {PESTANAS.map((p) => {
            const activa = p.modalidad === modalidad;
            return (
              <Link
                key={p.modalidad}
                href={p.href}
                role="tab"
                aria-selected={activa}
                aria-current={activa ? "page" : undefined}
                className={`-mb-px border-b-2 py-2 font-body text-[13px] transition-colors ${
                  activa
                    ? "border-[var(--franco-text)] font-semibold text-[var(--franco-text)]"
                    : "border-transparent text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
                }`}
              >
                {p.rotulo}
              </Link>
            );
          })}
        </nav>
        <p className="mt-2 mb-0 font-body text-[12px] text-[var(--franco-text-muted)]">
          Dos departamentos distintos, uno por modalidad. Cada ejemplo es un análisis completo de Franco.
        </p>
      </div>
    </>
  );
}
