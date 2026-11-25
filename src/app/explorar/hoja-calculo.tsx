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
import { COMO_SE_CALCULA, type TasaDelMotor } from "@/lib/explorar/portal";
import { textoComoSeCalcula } from "@/lib/explorar/mapa-todos";

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
  // EL TEXTO DEL 26-NOV-2026 (lámina 5d): pie, plazo, tasa y el 10 % de la misma fuente que usa el mapa (mapa-todos.ts › textoComoSeCalcula).
  const t = textoComoSeCalcula(tasa?.tasa ?? null, sinCuenta);
  return (
    <div className="ex-calculo-velo" data-explorar="calculo" onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <section className="ex-calculo" role="dialog" aria-modal="true" aria-labelledby="ex-calculo-t">
        <h2 id="ex-calculo-t" className="ex-calculo-t">{t.titulo}</h2>
        <p className="ex-calculo-p" data-explorar="calculo-estandar">{t.intro}{!sinCuenta && elegida != null && <span data-explorar="calculo-tasa">{c.tuTasa(elegida, tasa?.tasa ?? null)}</span>}</p>
        <ul className="ex-calculo-clases" data-explorar="calculo-clases">
          {t.clases.map((k) => <li key={k.clase} data-clase={k.clase}><i aria-hidden="true" /><span><b>{k.nombre}:</b> {k.texto}</span></li>)}
        </ul>
        <p className="ex-calculo-p ex-calculo-chico" data-explorar="calculo-cap-rate"><b>{t.capRate.nombre}:</b> {t.capRate.texto} <b>{t.rentaCorta.nombre}:</b> {t.rentaCorta.texto}</p>
        <p className="ex-calculo-p" data-explorar="calculo-metodologia">{t.metodologia.antes}<a className="ex-calculo-enlace" href={t.metodologia.href} data-explorar="calculo-metodologia-enlace"><strong>{t.metodologia.enlace}</strong></a></p>
        <button ref={boton} type="button" className="ex-cta ex-calculo-ok" onClick={alCerrar} data-explorar="calculo-ok">{t.boton}</button>
      </section>
    </div>
  );
}
