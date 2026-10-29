"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «¿CÓMO SE CALCULA?» (30-oct-2026): la hoja corta que abre la línea bajo el número del mapa, con y sin cuenta. Cuatro ideas
// en el tono de Franco —cada noche y con qué crédito, qué quiere decir «conviene» (la frase de Fabrizio sobre la regla del
// motor), de dónde sale la tasa y cuándo se revisó, y que con otro pie o plazo cambia— y un solo botón: «Entendido». Papel, no
// tríada: explica, no ofrece. En el teléfono sube desde abajo; en el PC va al centro. Los textos, en portal.ts › COMO_SE_CALCULA.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { COMO_SE_CALCULA, type FiltrosPortal, type TasaDelMotor } from "@/lib/explorar/portal";

export function HojaCalculo({ filtros, tasa, sinCuenta, alCerrar }: {
  filtros: Pick<FiltrosPortal, "pie" | "plazo">;
  tasa: TasaDelMotor | null;
  sinCuenta: boolean;
  alCerrar: () => void;
}) {
  const boton = useRef<HTMLButtonElement>(null);
  // Escape la cierra, como la bienvenida: una vez y en captura, para que un render a mitad del evento no lo saque.
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;
  useEffect(() => {
    boton.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopImmediatePropagation(); cerrarRef.current(); };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, []);
  const c = COMO_SE_CALCULA;
  return (
    <div className="ex-calculo-velo" data-explorar="calculo" onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <section className="ex-calculo" role="dialog" aria-modal="true" aria-labelledby="ex-calculo-t">
        <h2 id="ex-calculo-t" className="ex-calculo-t">{c.titulo}</h2>
        <ol className="ex-calculo-ideas">
          <li data-explorar="calculo-noche"><span className="ex-calculo-num" aria-hidden="true">1</span><span>{c.noche(filtros, tasa?.tasa ?? null)}</span></li>
          <li data-explorar="calculo-conviene"><span className="ex-calculo-num" aria-hidden="true">2</span><span>{c.conviene} {c.poner(sinCuenta)}</span></li>
          <li data-explorar="calculo-tasa"><span className="ex-calculo-num" aria-hidden="true">3</span><span>{c.tasa(tasa?.revisada ?? null)}</span></li>
          <li data-explorar="calculo-otro"><span className="ex-calculo-num" aria-hidden="true">4</span><span>{c.otroPie}</span></li>
        </ol>
        <button ref={boton} type="button" className="ex-cta ex-calculo-ok" onClick={alCerrar} data-explorar="calculo-ok">{c.boton}</button>
      </section>
    </div>
  );
}
