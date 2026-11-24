"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA BARRA DEL RANGO (rediseño del 23-nov-2026, láminas 5.1 y 4.2; reglas del LEEME). Va hasta el precio publicado, que es el tope
// (la raya negra a la derecha). La franja azul es lo que recomienda Franco; la zona rayada gris, donde sale el aviso fuerte. El punto
// es la oferta: negro dentro de la franja, ciruela fuera. Con `onCambio` se mueve arrastrándolo (o con las flechas del teclado);
// sin él (la página del depto) es solo el dibujo, con el recomendado. La escala la decide `escalaBarra` (rango.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { OFERTA_COPY as O, acotarOferta, escalaBarra, topeOferta } from "@/lib/invierte-v2/rango";

const fmt = (n: number) => Math.round(n).toLocaleString("es-CL");
const entre = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function BarraRango({ pisoUF, altoUF, publicadoUF, fuerteUF, montoUF, etiqueta, onCambio, chica = false }: {
  pisoUF: number; altoUF: number; publicadoUF: number; fuerteUF: number; montoUF: number; etiqueta: string;
  onCambio?: (uf: number) => void; chica?: boolean;
}) {
  const { minUF, maxUF } = escalaBarra(pisoUF, altoUF, publicadoUF, fuerteUF);
  const pct = (x: number) => entre(((x - minUF) / (maxUF - minUF)) * 100, 0, 100);
  const dentro = montoUF >= pisoUF && montoUF <= altoUF;
  const pista = useRef<HTMLDivElement>(null);
  const rayada = pct(fuerteUF);
  const ini = pct(pisoUF), fin = pct(altoUF), centro = (ini + fin) / 2;
  // El rótulo del rango no se monta con «Publicado» ni con «Poco probable», también en la barra chica a 360 px.
  const rotuloCentro = entre(centro, 34, 60);
  const desde = (clientX: number) => {
    const r = pista.current?.getBoundingClientRect();
    if (!r || !onCambio) return;
    onCambio(acotarOferta(minUF + entre((clientX - r.left) / r.width, 0, 1) * (maxUF - minUF), publicadoUF));
  };
  const abajo = (e: PointerEvent<HTMLDivElement>) => { if (!onCambio) return; e.currentTarget.setPointerCapture?.(e.pointerId); desde(e.clientX); };
  const mueve = (e: PointerEvent<HTMLDivElement>) => { if (onCambio && e.currentTarget.hasPointerCapture?.(e.pointerId)) desde(e.clientX); };
  const tecla = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (!onCambio) return;
    const paso = e.key === "ArrowRight" || e.key === "ArrowUp" ? 10 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -10 : 0;
    if (paso) { e.preventDefault(); onCambio(acotarOferta(montoUF + paso, publicadoUF)); }
  };
  return (
    <div className={`iv2-barra${chica ? " iv2-barra-chica" : ""}`} data-inv2="barra-rango">
      <div className="iv2-barra-chips">
        <span className={`iv2-barra-chip${dentro ? "" : " iv2-barra-fuera"}`} style={{ left: `clamp(72px, ${pct(montoUF)}%, calc(100% - 72px))` }} data-inv2="barra-chip">{etiqueta}</span>
      </div>
      <div ref={pista} className={`iv2-barra-pista${onCambio ? " iv2-barra-mueve" : ""}`} onPointerDown={abajo} onPointerMove={mueve}>
        <div className="iv2-barra-fondo">
          {rayada > 0 && <span className="iv2-barra-rayada" style={{ width: `${rayada}%` }} />}
          <span className="iv2-barra-franja" style={{ left: `${ini}%`, width: `${Math.max(fin - ini, 2)}%` }} data-inv2="barra-franja" />
          <span className="iv2-barra-tope" aria-hidden="true" />
          <span
            className={`iv2-barra-punto${dentro ? "" : " iv2-barra-fuera"}`} style={{ left: `${pct(montoUF)}%` }} data-inv2="barra-punto" data-dentro={dentro ? "si" : "no"}
            {...(onCambio ? { role: "slider", tabIndex: 0, "aria-label": O.barra, "aria-valuemin": Math.round(minUF), "aria-valuemax": topeOferta(publicadoUF), "aria-valuenow": montoUF, "aria-valuetext": `UF ${fmt(montoUF)}`, onKeyDown: tecla } : { "aria-hidden": true })}
          />
        </div>
      </div>
      {/* Sin redundancia (24-nov-2026, Fabrizio): en «Haz tu oferta» las tres cifras de arriba ya dicen el rango y el publicado; la barra
          chica va sin rótulos. En la pantalla de la oferta los conserva: ahí es el control principal. */}
      {!chica && <div className="iv2-barra-rotulos">
        {rayada >= 12 && rotuloCentro >= 44 && <span className="iv2-barra-poco">{O.poco}</span>}
        <span className="iv2-barra-rec" style={{ left: `${rotuloCentro}%` }}>Franco recomienda<br />{O.entreCorto(pisoUF, altoUF)}</span>
        <span className="iv2-barra-pub">{O.publicado}<br />UF {fmt(publicadoUF)}</span>
      </div>}
    </div>
  );
}
