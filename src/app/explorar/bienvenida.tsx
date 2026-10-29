"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA BIENVENIDA DE EXPLORAR SIN CUENTA (29-oct-2026, estado B de docs/puerta-b-mockups/6-puerta-e.html): solo la primera
// vez (abierto.ts › bienvenidaVista), sobre el mapa oscurecido. El número de la noche en grande en el material de la tríada,
// «Revisados por Franco» a su lado, «Deptos en venta que convienen como inversión hoy.» y dos pasos: tocar uno en el mapa y
// registrarse para el regalo. Un solo botón: «Ver el mapa». Ni pie, ni plazo, ni el ticket: ofertas de a una.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { BIENVENIDA_COPY } from "@/lib/explorar/abierto";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export function Bienvenida({ n, alCerrar }: { n: number; alCerrar: () => void }) {
  const boton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    boton.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [alCerrar]);
  return (
    <div className="ex-bienvenida-velo" data-explorar="bienvenida">
      <section className="ex-bienvenida" role="dialog" aria-modal="true" aria-labelledby="ex-bienvenida-t">
        <div className="ex-bienvenida-cab ex-triada">
          <p className="ex-bienvenida-n"><span className="ex-bienvenida-cifra" data-explorar="bienvenida-n">{miles(n)}</span><span className="ex-bienvenida-rev">{BIENVENIDA_COPY.revisados}</span></p>
          <h2 id="ex-bienvenida-t" className="ex-bienvenida-t">{BIENVENIDA_COPY.titulo}</h2>
        </div>
        <ol className="ex-bienvenida-pasos">
          <li><span className="ex-bienvenida-num" aria-hidden="true">1</span><span>{BIENVENIDA_COPY.paso1}</span></li>
          <li><span className="ex-bienvenida-num" aria-hidden="true">2</span><span>{BIENVENIDA_COPY.paso2.antes}<strong>{BIENVENIDA_COPY.paso2.fuerte}</strong>{BIENVENIDA_COPY.paso2.despues}</span></li>
        </ol>
        <button ref={boton} type="button" className="ex-cta ex-bienvenida-ok" onClick={alCerrar} data-explorar="bienvenida-ok">{BIENVENIDA_COPY.boton}</button>
      </section>
    </div>
  );
}
