"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «VER LISTA» (28-oct-2026, estado D de 5b-explorar-portal.html; desde el 30-oct-2026, recorrido real de Fabrizio): los mismos
// deptos del mapa, con miniatura (la imagen de la calle o el mapa chico) y el corazón. En el teléfono es una hoja que sube
// como «¿Cómo se calcula?», casi a pantalla completa, con su manija, una X arriba a la derecha y el botón «Mapa» flotando;
// también se cierra deslizándola hacia abajo. En el PC es un panel a la derecha, encima del mapa (unos 480 px, con X), y el
// mapa sigue a la vista y se puede usar a su izquierda. Arriba, «N deptos ✓ Comprar» y una sola fila con «Ordenar» —que
// existe solo acá— y «Avísame de nuevos». Se dibujan de a tandas a medida que se baja: con todo Gran Santiago son miles.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { lineaDepto } from "@/lib/guia/linea-depto";
import { flujoTexto } from "@/lib/explorar/explorar";
import { deptosN, ORDENES, PORTAL_COPY, type OrdenPortal, type PinMapa } from "@/lib/explorar/portal";
import { BORROSO } from "@/lib/explorar/abierto";
import { Borroso, Corazon, ImagenDepto, veredictoConPuntaje } from "./tarjeta-pin";

const TANDA = 30;
/** Cuánto hay que deslizar hacia abajo (px) para cerrar la hoja en el teléfono. */
const CIERRE_DESLIZANDO_PX = 90;
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export function ListaPortal({ pines, total, calculando, orden, analizados, guardados, alOrden, alAbrir, alGuardar, alAvisame, alCerrar, sinCuenta = false }: {
  pines: PinMapa[];
  total: number | null;
  calculando: boolean;
  orden: OrdenPortal;
  uf: number | null;
  analizados: Record<string, string>;
  guardados: ReadonlySet<string>;
  alOrden: (o: OrdenPortal) => void;
  alAbrir: (avisoId: string) => void;
  alGuardar: (avisoId: string) => void;
  alAvisame: () => void;
  /** Cierra la lista: la X, el botón «Mapa», deslizar hacia abajo, Escape o tocar fuera (en el teléfono). */
  alCerrar: () => void;
  /** Sin cuenta (29-oct-2026, la puerta E): el flujo va borroso, con un relleno fijo (no viaja al navegador). */
  sinCuenta?: boolean;
}) {
  const [hasta, setHasta] = useState(TANDA);
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => { setHasta(TANDA); }, [orden, pines.length]);
  useEffect(() => {
    const el = fin.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setHasta((h) => h + TANDA); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [pines.length]);
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") cerrarRef.current(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  // Deslizar hacia abajo desde la manija o la cabecera la cierra (en el teléfono; en el PC no hay manija).
  const [arrastre, setArrastre] = useState(0);
  const inicio = useRef<number | null>(null);
  const alEmpezar = (e: React.TouchEvent) => { inicio.current = e.touches[0]?.clientY ?? null; };
  const alMover = (e: React.TouchEvent) => {
    if (inicio.current == null) return;
    setArrastre(Math.max(0, (e.touches[0]?.clientY ?? inicio.current) - inicio.current));
  };
  const alSoltar = () => {
    if (arrastre > CIERRE_DESLIZANDO_PX) alCerrar();
    inicio.current = null;
    setArrastre(0);
  };

  const titulo = calculando || total == null ? PORTAL_COPY.calculando : deptosN(total);
  return (
    <div className="ex-lista-velo" data-explorar="lista-velo" onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <section className="ex-lista" data-explorar="lista" role="dialog" aria-labelledby="ex-lista-t" style={arrastre ? { transform: `translateY(${arrastre}px)`, transition: "none" } : undefined}>
        <div className="ex-lista-arriba" onTouchStart={alEmpezar} onTouchMove={alMover} onTouchEnd={alSoltar} onTouchCancel={alSoltar}>
          <span className="ex-asa ex-lista-asa" aria-hidden="true" />
          <div className="ex-lista-cab">
            <h2 id="ex-lista-t" className="ex-lista-t" data-explorar="titulo-lista">
              {titulo}{!calculando && total != null && total > 0 && <> <ChipVeredicto v="COMPRAR" /></>}
            </h2>
            <button type="button" className="ex-x" aria-label={PORTAL_COPY.cerrar} onClick={alCerrar} data-explorar="cerrar-lista">×</button>
          </div>
          <div className="ex-lista-acciones">
            <label className="ex-ordenar" data-explorar="ordenar">
              <span>{PORTAL_COPY.ordenar}</span>
              <select value={orden} onChange={(e) => alOrden(e.target.value as OrdenPortal)} aria-label={PORTAL_COPY.ordenar}>
                {ORDENES.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
              </select>
            </label>
            <button type="button" className="ex-enlace" onClick={alAvisame} data-explorar="avisame">{PORTAL_COPY.avisame}</button>
          </div>
        </div>
        <div className="ex-lista-scroll">
          {pines.length === 0 && !calculando ? <p className="ex-vacia" data-explorar="vacia">{PORTAL_COPY.vacia}</p> : (
            <ul className="ex-filas">
              {pines.slice(0, hasta).map((p) => {
                const neg = (p.flujo ?? 0) < 0;
                return (
                  <li key={p.avisoId} className="ex-fila-l" data-explorar="fila" data-aviso={p.avisoId} data-analizado={analizados[p.avisoId] ? "1" : undefined}>
                    <button type="button" className="ex-fila-btn" onClick={() => alAbrir(p.avisoId)} aria-label={`${lineaDepto(p)} · UF ${miles(p.precioUF)}`}>
                      <ImagenDepto avisoId={p.avisoId} tipo={undefined} clase="ex-mini" carga="lazy" />
                      <span className="ex-fila-datos">
                        <span className="ex-ojo">{lineaDepto(p)}</span>
                        <b className="ex-precio-l">UF {miles(p.precioUF)}</b>
                        <span className="ex-linea2">
                          <b className="ex-ver">{analizados[p.avisoId] ? PORTAL_COPY.analizado : veredictoConPuntaje(p)}</b>
                          {sinCuenta ? <> · <Borroso texto={BORROSO.flujo} /></> : p.flujo != null && <> · <b className={neg ? "ex-neg" : undefined}>{flujoTexto(p.flujo)}</b></>}
                        </span>
                      </span>
                    </button>
                    <Corazon guardado={guardados.has(p.avisoId)} alTocar={() => alGuardar(p.avisoId)} />
                  </li>
                );
              })}
            </ul>
          )}
          <div ref={fin} aria-hidden="true" className="ex-lista-fin" />
        </div>
        <button type="button" className="ex-boton-mapa" onClick={alCerrar} data-explorar="volver-mapa">{PORTAL_COPY.mapa}</button>
      </section>
    </div>
  );
}
