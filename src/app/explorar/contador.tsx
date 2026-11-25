"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA TARJETA DEL CONTADOR (25-nov-2026, láminas 5 y 8; rediseñada el 26-nov-2026 con la lámina 5d «La tarjeta del contador», revisión
// de Claude y Fabrizio del preview). Flota sobre el mapa, arriba a la izquierda (en el teléfono, de lado a lado):
//   «4.513» grande y en azul, «de 19.056 deptos convienen» y, a la derecha, la flecha que la pliega;
//   una barra fina con la proporción de Comprar, Ajustar y No conviene, en sus tres colores;
//   los tres veredictos como casillas con su número: prendido con fondo suave del color, borde del color y un check; apagado, blanco,
//   gris y con la casilla vacía. Tocar una apaga ese veredicto en el mapa. En el teléfono se deslizan de lado si no caben.
// PLEGADA, una sola línea con el número y «de 19.056 deptos convienen», que sigue cambiando con los filtros; la misma flecha la abre.
// El navegador recuerda si la persona la dejó plegada (localStorage). La flecha se llama «Plegar» o «Desplegar» y es un botón.
// La (i) de «¿Cómo se calcula?» volvió a la barra de arriba y «Ver lista» flota abajo al centro (explorar-cliente.tsx).
// El número de «convienen» es el de los Comprar: el mismo de la landing y de /deptos (mapa-todos.ts › textoContador). Sin manejadores
// (el esqueleto de carga), las casillas no hacen nada todavía.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { CHIP_CLASE_COPY, CLASES_MAPA, CONTADOR_COPY, proporcionClases, textoChipClase, textoContador, type ClaseMapa, type ConteoClases } from "@/lib/explorar/mapa-todos";
import { PORTAL_COPY } from "@/lib/explorar/portal";

/** La llave en el navegador de «la dejó plegada». */
export const CLAVE_CONTADOR_PLEGADO = "franco_contador_plegado";

export function Contador({ conteo, ocultar, calculando = null, alAlternar }: {
  /** null mientras llega el universo. */
  conteo: ConteoClases | null;
  ocultar: readonly ClaseMapa[];
  /** El texto del avance («Calculando…»), en lugar del número. */
  calculando?: string | null;
  alAlternar?: (clase: ClaseMapa) => void;
}) {
  const [plegada, setPlegada] = useState(false);
  // Lo que dejó la persona la última vez (después del primer pintado: el servidor no sabe).
  useEffect(() => { try { if (window.localStorage.getItem(CLAVE_CONTADOR_PLEGADO) === "1") setPlegada(true); } catch { /* sin almacenamiento */ } }, []);
  const alternarPliegue = () => setPlegada((x) => {
    try { window.localStorage.setItem(CLAVE_CONTADOR_PLEGADO, x ? "0" : "1"); } catch { /* sin almacenamiento */ }
    return !x;
  });
  const t = conteo && !calculando ? textoContador(conteo) : null;
  const prop = conteo ? proporcionClases(conteo) : null;
  return (
    <section className="ex-contador" aria-label={CONTADOR_COPY.region} data-explorar="contador" data-plegada={plegada ? "1" : undefined}>
      <div className="ex-contador-cab">
        <p className="ex-contador-n" aria-live="polite" data-explorar="contador-n">
          {t ? (<><b className="ex-contador-big" data-explorar="contador-numero">{t.numero}</b> <span>{t.resto}</span></>) : <span>{calculando ?? PORTAL_COPY.calculando}</span>}
        </p>
        <button type="button" className="ex-contador-pliegue" aria-expanded={!plegada} aria-label={plegada ? CONTADOR_COPY.desplegar : CONTADOR_COPY.plegar} title={plegada ? CONTADOR_COPY.desplegar : CONTADOR_COPY.plegar} data-explorar="contador-pliegue" onClick={alternarPliegue}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={plegada ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"} /></svg>
        </button>
      </div>
      {!plegada && (
        <>
          <div className="ex-proporcion" role="img" aria-label={conteo ? CLASES_MAPA.map((c) => textoChipClase(c, conteo[c])).join(", ") : PORTAL_COPY.calculando} data-explorar="contador-proporcion">
            {CLASES_MAPA.map((c) => <span key={c} data-clase={c} style={{ width: `${prop ? prop[c] : 0}%` }} />)}
          </div>
          <div className="ex-contador-chips" role="group" aria-label={CONTADOR_COPY.grupo}>
            {CLASES_MAPA.map((c) => {
              const apagado = ocultar.includes(c);
              return (
                <button key={c} type="button" className="ex-vc" data-clase={c} data-off={apagado ? "1" : undefined} aria-pressed={!apagado}
                  aria-label={conteo ? `${textoChipClase(c, conteo[c])}${apagado ? ", apagado" : ""}` : CHIP_CLASE_COPY[c]} data-explorar={`chip-${c}`} onClick={alAlternar ? () => alAlternar(c) : undefined}>
                  <span className="ex-ck" aria-hidden="true">{!apagado && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>}</span>
                  {conteo ? textoChipClase(c, conteo[c]) : CHIP_CLASE_COPY[c]}
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
