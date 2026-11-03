"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «¿CÓMO SE CALCULA?» (30-oct-2026; el texto de hoy, de la pasada real de Fabrizio del 03-nov-2026): la hoja corta que abre el
// botón de la barra de arriba —directo, en el teléfono y en el PC—, con y sin cuenta. Qué revisa Franco cada noche con el perfil
// estándar (pie, plazo y la tasa del motor, en tres viñetas), que se cambia en Filtros, qué quieren decir los dos chips del mapa
// —✓ Comprar al precio publicado, − Ajustar con un descuento— y el enlace a la metodología, donde vive la regla del veredicto.
// Un solo botón: «Entendido». Papel, no tríada: explica, no ofrece. En el teléfono sube desde abajo; en el PC va al centro. Los
// textos, en portal.ts › COMO_SE_CALCULA; los números, de la constante y del motor. Sin hooks fuera del efecto: el tier
// EXPLORAR-PASADA la renderiza en el servidor y lee su texto.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { COMO_SE_CALCULA, type TasaDelMotor } from "@/lib/explorar/portal";

export function HojaCalculo({ tasa, elegida = null, sinCuenta, alCerrar }: {
  tasa: TasaDelMotor | null;
  /** La tasa elegida en Filtros (30-oct-2026); null = la de hoy. */
  elegida?: number | null;
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
        <div className="ex-calculo-bloque">
          <p className="ex-calculo-p" data-explorar="calculo-estandar">{c.estandar}</p>
          <ul className="ex-calculo-lista" data-explorar="calculo-perfil">
            {c.perfil(tasa?.tasa ?? null).map((v) => <li key={v}>{v}</li>)}
          </ul>
        </div>
        <p className="ex-calculo-p" data-explorar="calculo-cambiar">{c.cambiar.antes}<strong>{c.cambiar.fuerte}</strong>{c.cambiar.despues(sinCuenta)}{!sinCuenta && elegida != null && <span data-explorar="calculo-tasa">{c.tuTasa(elegida, tasa?.tasa ?? null)}</span>}</p>
        <p className="ex-calculo-p" data-explorar="calculo-chips">{c.chips.comprarAntes}<ChipVeredicto v="COMPRAR" />{c.chips.comprarDespues}{c.chips.ajustarAntes}<span className="ex-pegado"><ChipVeredicto v="AJUSTA SUPUESTOS" />{c.chips.ajustarComa}</span>{c.chips.ajustarDespues}</p>
        <p className="ex-calculo-p" data-explorar="calculo-metodologia">{c.metodologia.antes}<a className="ex-calculo-enlace" href={c.metodologia.href} data-explorar="calculo-metodologia-enlace"><strong>{c.metodologia.enlace}</strong></a></p>
        <button ref={boton} type="button" className="ex-cta ex-calculo-ok" onClick={alCerrar} data-explorar="calculo-ok">{c.boton}</button>
      </section>
    </div>
  );
}
