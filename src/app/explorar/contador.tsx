// ─────────────────────────────────────────────────────────────────────────────
// LA TARJETA DEL CONTADOR (25-nov-2026, láminas 5 y 8 del canvas «La asesoría en el mapa», decisiones 3 y 5 de Fabrizio): flota sobre
// el mapa, arriba a la izquierda (en el teléfono, de lado a lado):
//   «4.513 de 19.056 convienen» · la (i) que abre «¿Cómo se calcula?»
//   [● 4.513 Comprar] [● 3.016 Ajustar] [● 11.527 No conviene] — tocar un chip lo apaga en el mapa (y otra vez, lo prende); en el
//   teléfono los chips van en una fila que se desliza de lado.
//   «Ver lista», para teclado y lector de pantalla (el mapa es un canvas).
// El número de «convienen» es el de los Comprar: el mismo de la landing y de /deptos (mapa-todos.ts › textoContador). Los chips cuentan
// con los filtros aunque estén apagados: apagar un chip esconde sus pines, no cambia la cuenta. Sin hooks: se dibuja igual en el servidor.
// ─────────────────────────────────────────────────────────────────────────────
import { CHIP_CLASE_COPY, CLASES_MAPA, textoChipClase, textoContador, type ClaseMapa, type ConteoClases } from "@/lib/explorar/mapa-todos";
import { COMO_SE_CALCULA, PORTAL_COPY } from "@/lib/explorar/portal";

export function Contador({ conteo, ocultar, calculando = null, alAlternar, alComo, alVerLista }: {
  /** null mientras llega el universo. */
  conteo: ConteoClases | null;
  ocultar: readonly ClaseMapa[];
  /** El texto del avance («Calculando…»), en lugar del número. */
  calculando?: string | null;
  /** Sin manejadores (el esqueleto, que se dibuja en el servidor), los botones no hacen nada todavía. */
  alAlternar?: (clase: ClaseMapa) => void;
  alComo?: () => void;
  alVerLista?: () => void;
}) {
  const t = conteo ? textoContador(conteo) : null;
  return (
    <section className="ex-contador" aria-label="Cuántos convienen" data-explorar="contador">
      <div className="ex-contador-cab">
        <p className="ex-contador-n" aria-live="polite" data-explorar="contador-n">
          {t && !calculando ? (<><b>{t.cifra}</b> <span>{t.resto}</span></>) : <span>{calculando ?? PORTAL_COPY.calculando}</span>}
        </p>
        <button type="button" className="ex-contador-i" aria-label={COMO_SE_CALCULA.enlace} title={COMO_SE_CALCULA.enlace} data-explorar="como-se-calcula" onClick={alComo}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        </button>
      </div>
      <div className="ex-contador-chips" role="group" aria-label="Qué veredictos se ven en el mapa">
        {CLASES_MAPA.map((c) => {
          const apagado = ocultar.includes(c);
          return (
            <button key={c} type="button" className="ex-vc" data-clase={c} data-off={apagado ? "1" : undefined} aria-pressed={!apagado}
              aria-label={conteo ? `${textoChipClase(c, conteo[c])}${apagado ? ", apagado" : ""}` : CHIP_CLASE_COPY[c]} data-explorar={`chip-${c}`} onClick={alAlternar ? () => alAlternar(c) : undefined}>
              <i aria-hidden="true" />{conteo ? textoChipClase(c, conteo[c]) : CHIP_CLASE_COPY[c]}
            </button>
          );
        })}
      </div>
      <button type="button" className="ex-contador-lista" data-explorar="ver-lista" onClick={alVerLista}>{PORTAL_COPY.verLista}</button>
    </section>
  );
}
