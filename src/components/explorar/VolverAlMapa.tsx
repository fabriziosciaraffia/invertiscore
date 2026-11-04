"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «← VOLVER AL MAPA» ARRIBA DEL INFORME (04-nov-2026, la pasada de Fabrizio; regla en lib/explorar/volver-al-mapa.ts): solo si este
// informe se abrió desde Explorar en esta pestaña. Lleva al mapa con los mismos filtros, centrado en el pin y con su tarjeta en
// «Ya lo analizaste · Ver informe». Abierto desde el dashboard o la selección, no aparece: la nota se gasta al mostrarse.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { tomarNotaDelInforme, VOLVER_AL_MAPA } from "@/lib/explorar/volver-al-mapa";

export function VolverAlMapa({ analysisId }: { analysisId: string | null | undefined }) {
  // Se lee después de montar: el servidor no sabe desde dónde se abrió.
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    if (!analysisId) return;
    let almacen: Storage | null = null;
    try { almacen = window.sessionStorage; } catch { /* sin almacenamiento */ }
    // Se gasta al leerla; si el efecto corre otra vez (desarrollo), queda la que ya se mostró.
    const nota = tomarNotaDelInforme(almacen, analysisId);
    if (nota) setHref(nota.href);
  }, [analysisId]);
  if (!href) return null;
  return (
    <p className="mb-3 mt-0" data-informe="volver-al-mapa">
      <EnlaceCarga href={href} className="inline-flex items-center gap-1.5 font-body text-[14px] font-medium text-[var(--franco-text)] no-underline underline-offset-4 hover:underline">
        <span aria-hidden="true">←</span> {VOLVER_AL_MAPA}
      </EnlaceCarga>
    </p>
  );
}
