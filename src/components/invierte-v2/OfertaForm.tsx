"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA OFERTA QUE RECOMIENDA FRANCO (etapa 3, B3; rediseño del 23-nov-2026, láminas 5.1 y 5.1-avisos). El rango en su tarjeta azul
// (postura en chip, «UF a b», cuánto bajo el publicado y una razón por línea), la barra del rango con el punto de la oferta, y el campo
// con − y + de a UF 10 (con punto de miles). El TOPE DURO es el precio publicado: el +, el campo, la barra y la dirección se detienen
// ahí (acotarOferta), y el servidor lo valida al firmar. Fuera del rango hay aviso de una línea, nunca bloqueo:
//   · bajo el piso, suave: el rojo es «Revisar y firmar por UF X» y «Volver a la recomendada» queda como enlace;
//   · bajo la zona rayada (el piso menos 5 % del publicado), fuerte: el rojo pasa a «Hablarlo con Franco», «Volver a la recomendada»
//     es el secundario y firmar ese monto queda como enlace;
//   · sobre el borde alto, o en un Ajusta supuestos sobre el precio al que vuelve a convenir: el rojo es «Volver a la recomendada» y
//     firmar ese monto queda como enlace.
// Cada vez que el aviso aparece o cambia de nivel se lleva a la vista, por encima de la barra fija de los botones (llevarAvisoALaVista).
// Sin enlace ni texto sobre lo que gana Franco. Aquí no se firma: el botón lleva a «Revisa y firma tu oferta» (5.1b).
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { OFERTA_COPY as O, POSTURA_COPY, acotarOferta, avisoOferta, fuerteDesde, pctBajoPublicado, rangoPctPublicado, topeOferta, type Postura } from "@/lib/invierte-v2/rango";
import { BarraRango } from "./BarraRango";
import { CifrasAOtroPrecio } from "./CuatroCifras";
import { CIFRAS_COPY } from "@/lib/invierte-v2/cifras";
import { cifrasAPrecio, type MotorFijo } from "@/lib/invierte-v2/cifras-motor";

export const URL_API_OFERTA = "/api/invierte-v2/oferta";
const PASO = 10;
const conPuntos = (n: number) => Math.round(n).toLocaleString("es-CL");

/** Lleva el aviso a la vista sin que la barra fija de los botones lo tape: el margen inferior del desplazamiento es el alto de la barra. */
export function llevarAvisoALaVista(aviso: HTMLElement | null, barra: HTMLElement | null) {
  if (!aviso) return;
  aviso.style.scrollMarginBottom = `${(barra?.offsetHeight ?? 0) + 12}px`;
  aviso.style.scrollMarginTop = "12px";
  const quieto = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  aviso.scrollIntoView({ block: "nearest", behavior: quieto ? "auto" : "smooth" });
}

/** La marca de cada razón: la flecha para la bajada de precio; un punto para las demás. */
const marca = (t: string) => (/^Ya bajó/.test(t) ? "↓" : "·");

export function OfertaForm({ avisoId, urlFirmar, postura, pisoUF, recomendadoUF, altoUF, publicadoUF, razones, avisoFuertePct, montoInicial, comprarUF = null, motor = null }: {
  avisoId: string; urlFirmar: string; postura: Postura; pisoUF: number; recomendadoUF: number; altoUF: number; publicadoUF: number; razones: string[]; avisoFuertePct: number; montoInicial: number | null;
  /** En un Ajusta supuestos, el precio al que vuelve a Comprar; null en un Comprar. */
  comprarUF?: number | null;
  /** Los datos fijos del motor del depto (23-nov-2026): «A este precio» sale de la misma sonda, en el navegador, al mover el punto. */
  motor?: MotorFijo | null;
}) {
  const tope = topeOferta(publicadoUF);
  const [monto, setMonto] = useState<number>(acotarOferta(montoInicial && montoInicial > 0 ? montoInicial : recomendadoUF, publicadoUF));
  const [texto, setTexto] = useState(conPuntos(monto));
  const [hablado, setHablado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fijar = (n: number) => { const v = acotarOferta(n, publicadoUF); setMonto(v); setTexto(conPuntos(v)); };
  const aviso = avisoOferta(monto, { pisoUF, altoUF, comprarUF }, publicadoUF, { avisoFuertePct });
  // «A este precio» (lámina 5.1 del 23-nov): el motor con el precio cambiado, nada más; el publicado, una vez.
  const alPublicado = useMemo(() => (motor ? cifrasAPrecio(motor, publicadoUF) : null), [motor, publicadoUF]);
  const aEste = useMemo(() => (motor ? cifrasAPrecio(motor, monto) : null), [motor, monto]);
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
  const sobre = aviso === "sobre_recomendado" || aviso === "sobre_techo";
  const enlaceHablar = <button type="button" className="iv2-enlace-azul iv2-of-enlace" onClick={() => void hablar()} disabled={enviando || hablado} data-inv2="hablar">{hablado ? O.hablarListo : O.hablar}</button>;
  return (
    <div className="iv2-of" data-inv2="oferta-form">
      <section className="iv2-of-recomienda" aria-labelledby="iv2-of-rec" data-inv2="recomienda">
        <div className="iv2-of-rec-cab"><span className="iv2-of-rec-e" id="iv2-of-rec">{O.rotulo}</span><span className="iv2-chip-li" data-inv2="postura">{POSTURA_COPY[postura]}</span></div>
        <span className="iv2-of-entre" data-inv2="rango">{O.entreCorto(pisoUF, altoUF)}</span>
        <span className="iv2-of-rec-pct">{rangoPctPublicado(pisoUF, altoUF, publicadoUF)}</span>
        <ul className="iv2-of-razones" data-inv2="razones">
          {razones.map((t, i) => <li key={i}><span className="iv2-of-marca" aria-hidden="true">{marca(t)}</span><span>{t}</span></li>)}
        </ul>
      </section>
      <BarraRango pisoUF={pisoUF} altoUF={altoUF} publicadoUF={publicadoUF} fuerteUF={fuerteDesde(pisoUF, publicadoUF, { avisoFuertePct })} montoUF={monto} etiqueta={O.tuOferta(monto)} onCambio={fijar} />
      <section className="iv2-of-campo" aria-labelledby="iv2-of-campo-t">
        <label className="iv2-of-rotulo" id="iv2-of-campo-t" htmlFor="iv2-of-monto">{O.campoRotulo}</label>
        <div className="iv2-of-stepper">
          <button type="button" className="iv2-of-paso" aria-label={O.bajar} onClick={() => fijar(monto - PASO)} data-inv2="bajar">−</button>
          <span className="iv2-of-valor">
            <span aria-hidden="true">UF</span>
            <input id="iv2-of-monto" inputMode="numeric" value={texto} data-inv2="monto" aria-describedby="iv2-of-pct"
              onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "").slice(0, 6)); if (!(n > 0)) { setTexto(""); return; } const v = Math.min(n, tope); setMonto(v); setTexto(conPuntos(v)); }}
              onBlur={() => fijar(monto)} />
          </span>
          <button type="button" className="iv2-of-paso" aria-label={O.subir} onClick={() => fijar(monto + PASO)} disabled={monto >= tope} title={monto >= tope ? O.tope : undefined} data-inv2="subir">+</button>
        </div>
        <span className="iv2-of-pct" id="iv2-of-pct" data-inv2="pct">{pctBajoPublicado(monto, publicadoUF)}</span>
      </section>
      {aEste && alPublicado && <CifrasAOtroPrecio clave="a-este-precio" titulo={CIFRAS_COPY.aEstePrecio} a={aEste} publicado={alPublicado} />}
      {aviso !== "ninguno" && (
        <div ref={refAviso} className="iv2-of-aviso" data-inv2="aviso" data-nivel={aviso} role="status">
          {aviso === "sobre_techo" && comprarUF != null ? <b>{O.sobreTecho(comprarUF)}</b>
            : aviso === "sobre_recomendado" ? <><b>{O.sobreT(monto - altoUF)}</b> {O.sobre}</>
            : <><b>{O.bajoT(pisoUF - monto)}</b> {aviso === "bajo_piso_fuerte" ? O.bajoFuerte : O.bajoSuave}</>}
        </div>
      )}
      <div ref={refBarra} className="iv2-acciones iv2-of-acciones">
        {aviso === "bajo_piso_fuerte" ? (
          <>
            <button type="button" className="inv-principal" onClick={() => void hablar()} disabled={enviando || hablado} aria-busy={enviando || undefined} data-inv2="hablar">{hablado ? O.hablarListo : O.hablar}</button>
            <button type="button" className="iv2-secundario iv2-of-sec" onClick={() => fijar(recomendadoUF)} data-inv2="volver-recomendada">{O.volverRecomendada}</button>
            <Link href={firmar} className="iv2-enlace-azul iv2-of-enlace" data-inv2="revisar">{O.firmarIgual(monto)}</Link>
          </>
        ) : sobre ? (
          <>
            <button type="button" className="inv-principal" onClick={() => fijar(recomendadoUF)} data-inv2="volver-recomendada">{O.volverRecomendada}</button>
            <Link href={firmar} className="iv2-enlace-azul iv2-of-enlace" data-inv2="revisar">{O.firmarIgual(monto)}</Link>
          </>
        ) : aviso === "bajo_piso" ? (
          <>
            <Link href={firmar} className="inv-principal" data-inv2="revisar">{O.revisarPor(monto)}</Link>
            <button type="button" className="iv2-enlace-azul iv2-of-enlace" onClick={() => fijar(recomendadoUF)} data-inv2="volver-recomendada">{O.volverRecomendada}</button>
          </>
        ) : (
          <>
            <Link href={firmar} className="inv-principal" data-inv2="revisar">{O.revisar}</Link>
            {enlaceHablar}
          </>
        )}
      </div>
    </div>
  );
}
