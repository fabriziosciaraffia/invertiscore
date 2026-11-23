"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA OFERTA QUE RECOMIENDA FRANCO (etapa 3, B3; lámina 5.1). La postura, el rango y sus razones (regla v1); el campo parte en el
// recomendado y la persona lo mueve sin límite, de a UF 10. Fuera del rango hay aviso, nunca bloqueo:
//   · bajo el piso, aviso suave («Es tu decisión: Franco la presenta igual»);
//   · si el piso menos la oferta pasa de 5 % del publicado, aviso fuerte: el botón principal pasa a «Hablarlo con Franco» y revisar y
//     firmar queda como enlace;
//   · sobre el borde alto, que puede partir más abajo;
//   · en un Ajusta supuestos, sobre el precio al que vuelve a Comprar, que ahí deja de convenir (22-nov-2026; tampoco bloquea).
// Cada vez que el aviso aparece o cambia de nivel se lleva a la vista, por encima de la barra fija de los botones (llevarAvisoALaVista):
// meterlo en la zona fija la haría crecer a media pantalla en un celular con el aviso fuerte y sus tres botones.
// Sin enlace ni texto sobre lo que gana Franco. Aquí no se firma: el botón lleva a «Revisa tu oferta antes de firmar» (5.1b).
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OFERTA_COPY as O, POSTURA_COPY, avisoOferta, type Postura } from "@/lib/invierte-v2/rango";
import { partirLinea } from "@/lib/invierte-v2/lectura-franco";

export const URL_API_OFERTA = "/api/invierte-v2/oferta";
const PASO = 10;

/** Lleva el aviso a la vista sin que la barra fija de los botones lo tape: el margen inferior del desplazamiento es el alto de la barra. */
export function llevarAvisoALaVista(aviso: HTMLElement | null, barra: HTMLElement | null) {
  if (!aviso) return;
  aviso.style.scrollMarginBottom = `${(barra?.offsetHeight ?? 0) + 12}px`;
  aviso.style.scrollMarginTop = "12px";
  const quieto = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  aviso.scrollIntoView({ block: "nearest", behavior: quieto ? "auto" : "smooth" });
}

export function OfertaForm({ avisoId, urlFirmar, postura, pisoUF, recomendadoUF, altoUF, publicadoUF, razones, avisoFuertePct, montoInicial, comprarUF = null }: {
  avisoId: string; urlFirmar: string; postura: Postura; pisoUF: number; recomendadoUF: number; altoUF: number; publicadoUF: number; razones: string[]; avisoFuertePct: number; montoInicial: number | null;
  /** En un Ajusta supuestos, el precio al que vuelve a Comprar; null en un Comprar. */
  comprarUF?: number | null;
}) {
  const [monto, setMonto] = useState<number>(montoInicial && montoInicial > 0 ? montoInicial : recomendadoUF);
  const [texto, setTexto] = useState(String(monto));
  const [hablado, setHablado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fijar = (n: number) => { const v = Math.max(1, Math.round(n)); setMonto(v); setTexto(String(v)); };
  const aviso = avisoOferta(monto, { pisoUF, altoUF, comprarUF }, publicadoUF, { avisoFuertePct });
  const refAviso = useRef<HTMLDivElement>(null);
  const refBarra = useRef<HTMLDivElement>(null);
  useEffect(() => { if (aviso !== "ninguno") llevarAvisoALaVista(refAviso.current, refBarra.current); }, [aviso]);
  async function hablar() {
    if (enviando) return;
    setEnviando(true);
    const r = await fetch(URL_API_OFERTA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "hablar", avisoId, montoUF: monto }) }).catch(() => null);
    setEnviando(false);
    if (r?.ok) setHablado(true);
  }
  const firmar = `${urlFirmar}${urlFirmar.includes("?") ? "&" : "?"}monto=${monto}`;
  return (
    <div className="iv2-of" data-inv2="oferta-form">
      <section className="iv2-of-recomienda" aria-labelledby="iv2-of-rec" data-inv2="recomienda">
        <span className="iv2-dp-rotulo" id="iv2-of-rec">{O.rotulo}</span>
        <span className="iv2-of-postura" data-inv2="postura">{POSTURA_COPY[postura]}</span>
        <span className="iv2-of-entre" data-inv2="rango">{O.entre(pisoUF, altoUF)}</span>
        <ul className="iv2-of-razones" data-inv2="razones">
          {razones.map((t, i) => { const p = partirLinea(t); return <li key={i}>{p.fuerte ? <b>{p.fuerte}</b> : null}{p.resto}</li>; })}
        </ul>
      </section>
      <section className="iv2-of-campo" aria-labelledby="iv2-of-campo-t">
        <label className="iv2-dp-rotulo" id="iv2-of-campo-t" htmlFor="iv2-of-monto">{O.campoRotulo}</label>
        <div className="iv2-of-stepper">
          <button type="button" className="iv2-of-paso" aria-label={O.bajar} onClick={() => fijar(monto - PASO)} data-inv2="bajar">−</button>
          <span className="iv2-of-valor">
            <span aria-hidden="true">UF</span>
            <input id="iv2-of-monto" inputMode="numeric" value={texto} onChange={(e) => { const t = e.target.value.replace(/\D/g, "").slice(0, 6); setTexto(t); if (Number(t) > 0) setMonto(Number(t)); }} onBlur={() => fijar(monto)} data-inv2="monto" />
          </span>
          <button type="button" className="iv2-of-paso" aria-label={O.subir} onClick={() => fijar(monto + PASO)} data-inv2="subir">+</button>
        </div>
        <p className="iv2-of-linea">{O.campoLinea}</p>
      </section>
      {(aviso === "bajo_piso" || aviso === "bajo_piso_fuerte") && (
        <div ref={refAviso} className="iv2-of-aviso" data-inv2="aviso" data-nivel={aviso} role="status">
          <b>{O.bajoT(pisoUF - monto)}</b>
          <span>{aviso === "bajo_piso_fuerte" ? O.bajoFuerte : O.bajoSuave}</span>
          <span>{O.esTuDecision}</span>
        </div>
      )}
      {(aviso === "sobre_recomendado" || aviso === "sobre_techo") && (
        <div ref={refAviso} className="iv2-of-aviso" data-inv2="aviso" data-nivel={aviso} role="status">
          {aviso === "sobre_techo" && comprarUF != null ? <b>{O.sobreTecho(comprarUF)}</b> : <span>{O.sobre(monto - altoUF)}</span>}
        </div>
      )}
      <div className="iv2-msj-franco iv2-of-sujeta"><span className="iv2-msj-franco-de">{O.sujetaT}</span>{O.sujeta}</div>
      <div ref={refBarra} className="iv2-acciones iv2-of-acciones">
        {aviso === "bajo_piso_fuerte" ? (
          <>
            <button type="button" className="inv-principal" onClick={() => void hablar()} disabled={enviando || hablado} aria-busy={enviando || undefined} data-inv2="hablar">{hablado ? O.hablarListo : O.hablar}</button>
            <button type="button" className="iv2-secundario" onClick={() => fijar(recomendadoUF)} data-inv2="volver-recomendada">{O.volverRecomendada}</button>
            <Link href={firmar} className="iv2-enlace-azul iv2-of-enlace" data-inv2="revisar">{O.revisarIgual(monto)}</Link>
          </>
        ) : (
          <>
            <Link href={firmar} className="inv-principal" data-inv2="revisar">{aviso === "ninguno" ? O.revisar : O.revisarPor(monto)}</Link>
            {aviso !== "ninguno" && <button type="button" className="iv2-secundario" onClick={() => fijar(recomendadoUF)} data-inv2="volver-recomendada">{O.volverRecomendada}</button>}
            <button type="button" className="iv2-enlace-azul iv2-of-enlace" onClick={() => void hablar()} disabled={enviando || hablado} data-inv2="hablar">{hablado ? O.hablarListo : O.hablar}</button>
          </>
        )}
      </div>
    </div>
  );
}
