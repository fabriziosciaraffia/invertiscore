"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA PRIMERA SELECCIÓN SOBRE EL INFORME (20-oct-2026, la puerta A): al terminar «Estás dentro» en el banner, sus primeros
// deptos aparecen en una hoja SOBRE el informe que estaba leyendo, sin sacarlo de ahí —el mismo velo y la misma hoja del
// ticket (lo-que-sigue.css), más ancha—. Se abre sola una vez por informe y pestaña (sessionStorage); «Seguir leyendo el
// informe» la cierra y «Ver mis primeros deptos», en «Estás dentro», la vuelve a abrir.
// Abierta, el ticket del pack espera a que se cierre (20-oct-2026, `uso-banner.ts`): nunca le sube encima.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { PRIMERA_SELECCION } from "@/lib/guia/del-dia";
import { usoBanner } from "@/lib/lo-que-sigue/uso-banner";
export { CLAVE_HOJA_VISTA, hojaYaVista, marcarHojaVista } from "@/lib/lo-que-sigue/hoja-primera-seleccion";
import { PrimeraSeleccion } from "@/components/deptos/PrimeraSeleccion";
import "./lo-que-sigue.css";

export function HojaPrimeraSeleccion({ abierta, alCerrar }: { abierta: boolean; alCerrar: () => void }) {
  const velo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierta) return;
    usoBanner.hojaAbierta(true);
    return () => usoBanner.hojaAbierta(false);
  }, [abierta]);
  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", alTeclear);
    // Arriba de la hoja al abrir: el foco entra a la hoja y el informe de atrás no hace scroll.
    velo.current?.querySelector<HTMLElement>(".lqs-hoja")?.scrollTo({ top: 0 });
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = antes;
    };
  }, [abierta, alCerrar]);

  return (
    <div
      ref={velo}
      className="lqs-velo doc-tokens"
      data-lqs="primera-seleccion"
      data-abierto={abierta ? "1" : "0"}
      role={abierta ? "dialog" : undefined}
      aria-modal={abierta || undefined}
      aria-label={PRIMERA_SELECCION.kicker}
      onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}
    >
      <div className="lqs-hoja lqs-hoja-ancha">
        <div className="lqs-franja" aria-hidden="true" />
        <div className="lqs-asa" aria-hidden="true" />
        <div className="lqs-ps">
          <div className="lqs-ps-cab">
            <button type="button" className="lqs-x" onClick={alCerrar} aria-label={PRIMERA_SELECCION.cerrar}>✕</button>
          </div>
          {abierta && <PrimeraSeleccion />}
          <button type="button" className="lqs-seguir" onClick={alCerrar} data-lqs="seguir-leyendo">{PRIMERA_SELECCION.seguirLeyendo}</button>
        </div>
      </div>
    </div>
  );
}
