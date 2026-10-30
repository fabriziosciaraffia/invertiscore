"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «¿CÓMO SE CALCULA?» (30-oct-2026): la hoja corta que abre el enlace de la barra de arriba, con y sin cuenta. Tres párrafos,
// con el texto del recorrido real de Fabrizio del 30-oct —el perfil de búsqueda estándar (pie, plazo y la tasa del motor),
// que se cambia en Filtros, y qué quiere decir que un depto lleve el chip ✓ Comprar— y un solo botón: «Entendido». Papel, no
// tríada: explica, no ofrece. En el teléfono sube desde abajo; en el PC va al centro. Los textos, en portal.ts ›
// COMO_SE_CALCULA; los números, de la constante y del motor.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { COMO_SE_CALCULA, type TasaDelMotor } from "@/lib/explorar/portal";

export function HojaCalculo({ tasa, sinCuenta, alCerrar }: {
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
        <p className="ex-calculo-p" data-explorar="calculo-estandar">{c.estandar(tasa?.tasa ?? null)}</p>
        <p className="ex-calculo-p" data-explorar="calculo-cambiar">{c.cambiar.antes}<strong>{c.cambiar.fuerte}</strong>{c.cambiar.despues(sinCuenta)}</p>
        <p className="ex-calculo-p" data-explorar="calculo-conviene">{c.chip.antes}<ChipVeredicto v="COMPRAR" />{c.chip.despues}{c.cuanto(sinCuenta)}</p>
        <button ref={boton} type="button" className="ex-cta ex-calculo-ok" onClick={alCerrar} data-explorar="calculo-ok">{c.boton}</button>
      </section>
    </div>
  );
}
