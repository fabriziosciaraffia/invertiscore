"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA VENTANA DE UN DOCUMENTO (Invierte con Franco, 18-nov-2026; láminas 2.2-ver-mi-orden, 2.2-ver-mi-orden-pc y
// 2.1-preguntas-frecuentes). Todo lo que se «Ver» en el recorrido se abre acá, sobre la página, sin salir de ella: hoy la orden
// firmada y las preguntas frecuentes de la firma; en las etapas siguientes, la oferta, la contraoferta y la preaprobación.
//   · En el CELULAR, hoja que sube desde abajo con la página oscurecida asomando arriba; en el PC, ventana centrada.
//   · Arriba el chip de estado (si hay), el título, `meta` y el ✕; al medio el contenido con su propio scroll —`documento`,
//     en un recuadro gris; `lista`, sobre blanco—; abajo «Abrir PDF» (si hay; en una pestaña nueva) y el botón oscuro: «Cerrar» solo en el PC o,
//     con `accion`, ese texto también en el celular («Volver a la firma»). Escape, el ✕, el botón y un clic en el velo cierran;
//     la página de abajo queda montada y como estaba.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, type ReactNode } from "react";
import type { ParrafoOrden, RegistroFirma } from "@/lib/invierte-v2/orden";
import type { PreguntaInvierte } from "@/lib/invierte-v2/preguntas";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";

const D = FLUJO_COPY.documento;

export function VentanaDocumento({ estado = null, titulo, meta = null, children, pdf = null, accion = null, variante = "documento", alCerrar, nombre, pie = null }: {
  /** El chip de estado («Orden firmada»). */
  estado?: string | null;
  titulo: string;
  /** Quién y cuándo, en líneas cortas. */
  meta?: ReactNode;
  children?: ReactNode;
  /** El PDF del documento: se abre en una pestaña nueva (la página de atrás queda como estaba). */
  pdf?: { href: string; etiqueta?: string } | null;
  /** El botón oscuro con este texto, también en el celular. Sin él, «Cerrar» solo en el PC. */
  accion?: string | null;
  variante?: "documento" | "lista";
  alCerrar: () => void;
  /** Para medir y para las pruebas: `data-inv2="ventana-<nombre>"`. */
  nombre: string;
  /** El pie propio (la acción principal de la ventana, siempre a la vista), en lugar de «Abrir PDF» y «Cerrar». */
  pie?: ReactNode;
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
      <section ref={caja} tabIndex={-1} className={`iv2-doc iv2-doc-${variante}`} role="dialog" aria-modal="true" aria-labelledby="iv2-doc-t">
        <div className="iv2-doc-cab">
          <div className="iv2-doc-id">
            {estado && <span className="iv2-estado">✓ {estado}</span>}
            <h2 className="iv2-doc-t" id="iv2-doc-t">{titulo}</h2>
            {meta && <div className="iv2-doc-meta iv2-solo-pc-doc">{meta}</div>}
          </div>
          <button type="button" className="iv2-doc-x" aria-label={D.cerrar} onClick={alCerrar} data-inv2="ventana-x">✕</button>
        </div>
        {meta && <div className="iv2-doc-meta iv2-solo-movil-doc">{meta}</div>}
        <div className="iv2-doc-texto" tabIndex={0} role="document" aria-label={titulo}>{children}</div>
        <div className="iv2-doc-pie">
          {pie}
          {!pie && pdf && <a href={pdf.href} target="_blank" rel="noopener noreferrer" className="iv2-secundario" data-inv2="ventana-pdf">{pdf.etiqueta ?? D.abrirPdf}</a>}
          {!pie && <button type="button" className={`iv2-doc-cerrar${accion ? " iv2-doc-cerrar-siempre" : ""}`} onClick={alCerrar} data-inv2="ventana-cerrar">{accion ?? D.cerrar}</button>}
        </div>
      </section>
    </div>
  );
}

/** El texto GUARDADO de un documento (el de `partesDeTexto`), sin su título: el de la ventana basta. */
export function TextoDocumento({ parrafos }: { parrafos: ParrafoOrden[] }) {
  const ultimo = parrafos.length - 1;
  return (
    <>
      {parrafos.map((p, i) => (
        <p key={i} className={i === ultimo && !p.n ? "iv2-orden-pie" : undefined}>
          {p.n ? <b>{p.n}. {p.titulo}.</b> : null}{p.n ? " " : null}{p.texto}
        </p>
      ))}
    </>
  );
}

/** El registro de la firma, al final del texto: el mismo del PDF (registroDeFirma). */
export function RegistroDocumento({ registro }: { registro: RegistroFirma }) {
  return (
    <div className="iv2-doc-registro" data-inv2="registro-firma">
      <p className="iv2-doc-registro-t">{registro.titulo}</p>
      <p>{registro.firmadoPor}</p>
      <p>{registro.cuando}</p>
      <p className="iv2-doc-huella">{registro.huella}</p>
    </div>
  );
}

/** Preguntas y respuestas, una debajo de otra (la variante `lista`). */
export function ListaPreguntas({ preguntas }: { preguntas: readonly PreguntaInvierte[] }) {
  return (
    <dl className="iv2-faq" data-inv2="preguntas">
      {preguntas.map((q) => (
        <div key={q.pregunta} className="iv2-faq-q">
          <dt>{q.pregunta}</dt>
          <dd>{q.respuesta}</dd>
        </div>
      ))}
    </dl>
  );
}
