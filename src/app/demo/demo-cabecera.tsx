"use client";

import { useEffect } from "react";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
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
 *
 * LAS PESTAÑAS SE VEN TOCABLES Y SE VEN CARGANDO (28-sep-2026): cada una calcula el informe entero
 * al abrirse y no daba ninguna señal. Ahora son píldoras con contorno (la activa, rellena en tinta),
 * quedan presionadas al toque y la barra bajo el header corre hasta que la otra llega (EnlaceCarga).
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
        <nav role="tablist" aria-label="Análisis de ejemplo" className="flex flex-wrap gap-2">
          {PESTANAS.map((p) => {
            const activa = p.modalidad === modalidad;
            return (
              <EnlaceCarga
                key={p.modalidad}
                href={p.href}
                role="tab"
                aria-selected={activa}
                aria-current={activa ? "page" : undefined}
                className={`inline-flex h-9 items-center rounded-full border px-4 font-body text-[13px] font-semibold transition-colors ${
                  activa
                    ? "border-[var(--franco-text)] bg-[var(--franco-text)] text-[var(--franco-bg)]"
                    : "border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-text)] hover:text-[var(--franco-text)]"
                }`}
              >
                {p.rotulo}
              </EnlaceCarga>
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
