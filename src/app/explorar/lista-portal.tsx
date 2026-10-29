"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «VER LISTA» (28-oct-2026, estado D de 5b-explorar-portal.html): los mismos deptos del mapa, ordenables (puntaje, mayor
// flujo, cap rate, menor precio, más recientes), con miniatura (la imagen de la calle o el mapa chico), el corazón y un
// botón «Mapa» flotando para volver. Arriba, «Avísame de nuevos». Se dibujan de a tandas a medida que se baja: con todo
// Gran Santiago son miles.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { lineaDepto } from "@/lib/guia/linea-depto";
import { flujoTexto } from "@/lib/explorar/explorar";
import { ORDENES, PORTAL_COPY, tituloLista, type OrdenPortal, type PinMapa } from "@/lib/explorar/portal";
import { BORROSO } from "@/lib/explorar/abierto";
import { Borroso, Corazon, ImagenDepto, veredictoConPuntaje } from "./tarjeta-pin";

const TANDA = 30;
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export function ListaPortal({ pines, total, calculando, orden, analizados, guardados, alOrden, alAbrir, alGuardar, alAvisame, alMapa, sinCuenta = false }: {
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
  alMapa: () => void;
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

  return (
    <section className="ex-lista" data-explorar="lista" aria-label={total != null ? tituloLista(total) : PORTAL_COPY.calculando}>
      <div className="ex-lista-cab">
        <h2 className="ex-lista-t" data-explorar="titulo-lista">{calculando || total == null ? PORTAL_COPY.calculando : tituloLista(total)}</h2>
        <button type="button" className="ex-enlace" onClick={alAvisame} data-explorar="avisame">{PORTAL_COPY.avisame}</button>
      </div>
      <div className="ex-lista-orden" role="radiogroup" aria-label={PORTAL_COPY.ordenar}>
        <span>{PORTAL_COPY.ordenar}:</span>
        {ORDENES.map((o) => <button key={o.id} type="button" role="radio" aria-checked={orden === o.id} className="ex-orden-op" onClick={() => alOrden(o.id)} data-orden={o.id}>{o.etiqueta}</button>)}
      </div>
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
      <button type="button" className="ex-boton-mapa" onClick={alMapa} data-explorar="volver-mapa">{PORTAL_COPY.mapa}</button>
    </section>
  );
}
