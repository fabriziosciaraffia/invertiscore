"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «Lo que haría Franco», después del titular (28-sep-2026, rendimiento de la landing).
//
// La sección 3 es la card real del informe con su pop-up: arrastra el motor de análisis, DocTokens,
// TokensHallazgos y PopupAjustes —unos 98 kB gz de JavaScript— y, servida desde el servidor, metía
// 135 kB de `<style>` inline en el HTML de la landing. Nada de eso se ve en la primera pantalla.
//
// Acá se carga con `next/dynamic` sin SSR, y recién cuando la página está quieta (`load` + ocio) o
// cuando la sección se acerca al área visible, lo que pase primero. La altura ya está reservada en
// el CSS (`.lv-sreco`, `--lv-sreco-reserva`, medida por ancho en el preview), así que al aparecer
// no mueve nada de lo que está debajo.
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { cuandoLaPaginaEsteQuieta } from "@/lib/pagina-quieta";

const LoQueHariaFranco = dynamic(() => import("./Recomendacion").then((m) => ({ default: m.LoQueHariaFranco })), {
  ssr: false,
  loading: () => null,
});

export function LoQueHariaFrancoDiferida() {
  const [listo, setListo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listo) return;
    const cancelarQuieta = cuandoLaPaginaEsteQuieta(() => setListo(true));
    // Si el usuario baja antes de que la página se quede quieta, la sección se carga al acercarse.
    const nodo = ref.current;
    let obs: IntersectionObserver | null = null;
    if (nodo && typeof IntersectionObserver !== "undefined") {
      obs = new IntersectionObserver((entradas) => {
        if (entradas.some((e) => e.isIntersecting)) setListo(true);
      }, { rootMargin: "100% 0px" });
      obs.observe(nodo);
    }
    return () => { cancelarQuieta(); obs?.disconnect(); };
  }, [listo]);

  return (
    <div ref={ref} className="lv-sreco-diferida" data-listo={listo ? "1" : "0"}>
      {listo && <LoQueHariaFranco />}
    </div>
  );
}
