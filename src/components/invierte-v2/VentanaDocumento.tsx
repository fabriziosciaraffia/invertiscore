"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA VENTANA DE UN DOCUMENTO (Invierte con Franco, 18-nov-2026; láminas 2.2-ver-mi-orden y 2.2-ver-mi-orden-pc). Todo
// documento con «Ver» del recorrido se abre acá, sobre la página, sin salir de ella: hoy la orden firmada; en las etapas
// siguientes, la oferta, la contraoferta y la preaprobación.
//   · En el CELULAR, hoja que sube desde abajo con la página oscurecida asomando arriba; en el PC, ventana centrada.
//   · Arriba el chip de estado, el título, quién y cuándo (`meta`) y el ✕; al medio el texto con su propio scroll; abajo
//     «Descargar PDF» (y «Cerrar» en el PC). Escape, el ✕, «Cerrar» y un clic en el velo cierran; la página de abajo queda
//     como estaba.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, type ReactNode } from "react";
import type { ParrafoOrden } from "@/lib/invierte-v2/orden";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";

const D = FLUJO_COPY.documento;

export function VentanaDocumento({ estado, titulo, meta, children, descargar, alCerrar, nombre }: {
  /** El chip de estado («Orden firmada»). */
  estado: string;
  titulo: string;
  /** Quién y cuándo, en líneas cortas. */
  meta: ReactNode;
  /** El texto del documento. */
  children?: ReactNode;
  descargar: { href: string; etiqueta?: string } | null;
  alCerrar: () => void;
  /** Para medir y para las pruebas: `data-inv2="ventana-<nombre>"`. */
  nombre: string;
}) {
  const caja = useRef<HTMLElement>(null);
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); cerrarRef.current(); } };
    window.addEventListener("keydown", esc, true);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    caja.current?.focus({ preventScroll: true });
    return () => { window.removeEventListener("keydown", esc, true); document.body.style.overflow = antes; };
  }, []);

  return (
    <div className="inv-velo iv2-doc-velo" data-inv2={`ventana-${nombre}`} onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <section ref={caja} tabIndex={-1} className="iv2-doc" role="dialog" aria-modal="true" aria-labelledby="iv2-doc-t">
        <div className="iv2-doc-cab">
          <div className="iv2-doc-id">
            <span className="iv2-estado">✓ {estado}</span>
            <h2 className="iv2-doc-t" id="iv2-doc-t">{titulo}</h2>
            <div className="iv2-doc-meta iv2-solo-pc-doc">{meta}</div>
          </div>
          <button type="button" className="iv2-doc-x" aria-label={D.cerrar} onClick={alCerrar} data-inv2="ventana-x">✕</button>
        </div>
        <div className="iv2-doc-meta iv2-solo-movil-doc">{meta}</div>
        <div className="iv2-doc-texto" tabIndex={0} role="document" aria-label={titulo}>{children}</div>
        <div className="iv2-doc-pie">
          {descargar && <a href={descargar.href} className="iv2-secundario" data-inv2="ventana-descargar">{descargar.etiqueta ?? D.descargar}</a>}
          <button type="button" className="iv2-doc-cerrar" onClick={alCerrar} data-inv2="ventana-cerrar">{D.cerrar}</button>
        </div>
      </section>
    </div>
  );
}

/** Un texto con párrafos y cláusulas numeradas (el de `partesDeTexto`). */
export function TextoDocumento({ titulo, parrafos }: { titulo: string; parrafos: ParrafoOrden[] }) {
  const ultimo = parrafos.length - 1;
  return (
    <>
      <p className="iv2-doc-texto-t">{titulo}</p>
      {parrafos.map((p, i) => (
        <p key={i} className={i === ultimo && !p.n ? "iv2-orden-pie" : undefined}>
          {p.n ? <b>{p.n}. {p.titulo}.</b> : null}{p.n ? " " : null}{p.texto}
        </p>
      ))}
    </>
  );
}
