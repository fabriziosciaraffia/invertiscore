"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL POP-UP DE AJUSTES — LA MATRIZ COMO MAPA (24-sep-2026 · versión final 25-sep-2026)
//
// Contrato visual: docs/wireframes/rediseno-informe/popup-matriz-aprobado.html, en su versión
// final del 25-sep, después de que Fabrizio probó el preview en el teléfono. Las cifras de la
// tabla del mockup son ilustrativas: acá mandan las del motor. El modelo sin React vive en
// `src/lib/matriz-popup.ts`.
//
// QUÉ ES. La grilla de pie × plazo que el motor ya calcula (`mixAComprar` / `mixComprar`).
//
// EN AJUSTAR, EL COLOR DICE QUÉ TAN CERCA ESTÁ DE COMPRAR (25-sep). La primera versión pintaba
// cada celda con su veredicto al precio pedido, y en las filas donde todo es Ajustar la matriz
// quedaba entera ciruela: se leía «nunca llega», cuando cada celda con número llega a Comprar con
// ese descuento. Ahora es una escala toda azul (`escalaCelda`): pleno con letra blanca «ya es
// Comprar», más claro mientras más descuento pide, rayado «fuera de alcance». Sin la palabra del
// veredicto en la celda. El ciruela queda solo para el veredicto de hoy, arriba, y el de cada
// combinación lo dice la frase al tocarla.
//
// EN COMPRAR, sin cambios: el número es cuánto te queda al mes y el color es el veredicto al que
// cae cada combinación (las que caen, con el color del veredicto al que caen).
//
// Ejes didácticos con flechas: más pie hacia abajo y más plazo hacia la derecha en tinta
// (esfuerzo del comprador); más descuento hacia arriba y hacia la izquierda en gris (esfuerzo del
// vendedor). Se marcan SOLO dos celdas, con bordes finos y etiqueta chica en la esquina: la de
// Franco (la recomendación, la misma de la card y de «A qué precio cerrar») y la tuya.
//
// AL TOCAR UNA CELDA (Ajustar): la frase con los dos veredictos —el de esa combinación al precio
// pedido y Comprar con el descuento— y una TABLA Hoy / Así: descuento, precio, pie el día uno,
// cuota, te queda al mes, cash on cash, cap rate neto, TIR y Franco Score. «Hoy» es el análisis
// tal como lo declaraste (`antes`, del hero); «Así» son las cifras que el motor midió para esa
// celda en su descuento mínimo (`CeldaMix.metricas`).
//
// Lo que salió el 24-sep sigue fuera: el menú de tres respuestas, los siete pares y «Un cambio a
// la vez», salvo el arriendo o la tarifa, que quedan en una línea «pero eso depende del mercado».
// El botón «Analízalo a UF X» sigue inerte: conectarlo pide decidir si un re-análisis consume
// crédito.
//
// BUSCAR OTRA NO TIENE POP-UP: la card dice la causa y la distancia (`buscar-otra-copy.ts`).
// ─────────────────────────────────────────────────────────────────────────────

import { useId, useState, type ReactNode } from "react";
import type { CeldaMix, MetricasCelda } from "@/lib/mix-palancas";
import type { HallazgoDistanciaVeredicto, MixPalancas, Veredicto } from "@/lib/types";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";
import { solasAComprar } from "@/lib/mix-a-comprar";
import { ETIQUETA_BANDA_CELDA, ETIQUETA_BANDA_FRASE, ETIQUETA_BANDA_LEYENDA } from "@/lib/banda-esfuerzo";
import { GLOSAS, rotuloCapRate } from "@/lib/glosas-indicadores";
import { celdaFranco, escalaCelda, grillaDelPopup, lecturaCelda, pieDiaUnoUF, type LecturaCelda } from "@/lib/matriz-popup";

export { hayAjustesQueMostrar } from "@/lib/matriz-popup";

type Currency = "CLP" | "UF";

const dec1 = (n: number) => n.toFixed(1).replace(".", ",").replace("-", "−");
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct1 = (n: number) => `${dec1(n)}%`;
const pieTxt = (n: number) => `${dec1(n).replace(",0", "")}%`;
const plata = (clp: number, currency: Currency, valorUF: number) => {
  const signo = clp < 0 ? "−" : "";
  const abs = Math.abs(clp);
  if (currency !== "UF") return `${signo}$${miles(abs)}`;
  // Un precio o un pie van en UF enteras («UF 4.200»); una cuota o un flujo del mes, con un decimal.
  const uf = abs / valorUF;
  return `${signo}UF ${uf >= 100 ? miles(uf) : dec1(uf)}`;
};
const CLASE: Record<Veredicto, "c" | "a" | "b"> = { COMPRAR: "c", "AJUSTA SUPUESTOS": "a", "BUSCAR OTRA": "b" };

/** Las cifras del análisis tal como lo declaraste: la columna «Hoy» de la tabla. */
export type AntesPopup = MetricasCelda & { score: number | null };

export interface PopupAjustesProps {
  veredicto: Veredicto;
  modalidad: "LTR" | "STR";
  /** Hallazgo de distancia del motor. Null en COMPRAR (no hay veredicto superior). */
  distancia?: HallazgoDistanciaVeredicto | null;
  /** La grilla de COMPRAR, que llega por su propia puerta (modo «mejorar»). */
  mixComprar?: MixPalancas | null;
  currency: Currency;
  valorUF: number;
  /** El precio pedido, en UF: la base del precio, del pie del día uno y del botón. */
  precioUF: number;
  /** La columna «Hoy» de la tabla. La arma el hero con las mismas cifras que muestra arriba. */
  antes?: AntesPopup | null;
}

function Pill({ v }: { v: Veredicto }) {
  return (
    <span className={`pjx-v ${CLASE[v]}`}>
      {signoVeredicto(v)} {etiquetaVeredicto(v, "frase")}
    </span>
  );
}

export function PopupAjustes({ veredicto, modalidad, distancia, mixComprar, currency, valorUF, precioUF, antes }: PopupAjustesProps) {
  const grilla = grillaDelPopup({ veredicto, distancia, mixComprar });
  const celdas = grilla?.celdas ?? [];
  const esComprar = veredicto === "COMPRAR";
  const franco = celdaFranco({ veredicto, distancia, grilla });
  const hoy = celdas.find((c) => c.esActual) ?? null;
  const [sel, setSel] = useState<CeldaMix | null>(franco ?? hoy ?? celdas[0] ?? null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (!grilla || celdas.length === 0) return null;

  const tope = distancia?.valor?.topePct ?? 30;
  const pies = Array.from(new Set(celdas.map((c) => c.piePct))).sort((a, b) => a - b);
  const plazos = Array.from(new Set(celdas.map((c) => c.plazoAnios))).sort((a, b) => a - b);
  const pieHoy = grilla.piePct - grilla.piePctDelta;
  const plazoHoy = grilla.plazoAnios - grilla.plazoAniosDelta;
  const mismo = (a: CeldaMix | null, b: CeldaMix | null) => !!a && !!b && a.piePct === b.piePct && a.plazoAnios === b.plazoAnios;
  const conDescuento = !esComprar;

  // EL ARRIENDO O LA TARIFA, APARTE: no están en la matriz porque no dependen del comprador.
  const mercado = !esComprar && distancia?.valor ? solasAComprar(distancia.valor).find((l) => l.palanca === "arriendo" || l.palanca === "adr") ?? null : null;
  // EL BOTÓN, INERTE, con el precio de la recomendación. Solo si pide descuento.
  const precioBoton = franco && franco.descuentoPct && franco.descuentoPct > 0 ? precioUF * (1 - franco.descuentoPct / 100) : null;

  return (
    <div className="pjx">
      <p className="pjx-hoy">
        Hoy <Pill v={veredicto} /> con pie {pieTxt(pieHoy)} y crédito a {plazoHoy} años
      </p>
      {esComprar ? (
        <p className="pjx-preg">
          El color es el veredicto de cada combinación al precio pedido. El número es <strong>lo que te queda al mes</strong>.
        </p>
      ) : (
        <>
          <p className="pjx-preg">
            Cuánto descuento hay que pedir para llegar a <Pill v="COMPRAR" />, según tu pie y tu plazo.
          </p>
          <Escala />
        </>
      )}
      <p className="pjx-tip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 11V6a2 2 0 1 1 4 0v5" />
          <path d="M13 10a2 2 0 1 1 4 0v3a6 6 0 0 1-6 6h-1a6 6 0 0 1-5.2-3l-1.3-2.3a1.6 1.6 0 0 1 2.8-1.6L9 14" />
        </svg>
        {esComprar ? "Toca una celda para ver qué pasa con esa combinación." : "Toca una celda para ver cómo queda."}
      </p>

      <div
        className="pjx-mz"
        style={{
          gridTemplateColumns: `22px 40px repeat(${plazos.length}, minmax(0, 1fr)) ${conDescuento ? "22px" : "0px"}`,
          gridTemplateRows: `24px 18px repeat(${pies.length}, auto)${conDescuento ? " 24px" : ""}`,
        }}
      >
        <Flechas uid={uid} cols={plazos.length} rows={pies.length} descuento={conDescuento} />
        {plazos.map((pl, i) => (
          <div key={`h${pl}`} className="pjx-hcol" style={{ gridColumn: 3 + i, gridRow: 2 }}>
            {pl} años
          </div>
        ))}
        {pies.map((p, r) => (
          <div key={`f${p}`} className="pjx-hfil" style={{ gridRow: 3 + r }}>
            pie {pieTxt(p)}
          </div>
        ))}
        {pies.map((p, r) =>
          plazos.map((pl, i) => {
            const c = celdas.find((x) => x.piePct === p && x.plazoAnios === pl);
            if (!c) return <div key={`${p}-${pl}`} style={{ gridColumn: 3 + i, gridRow: 3 + r }} />;
            const l = lecturaCelda(c, esComprar, tope);
            const esF = mismo(c, franco);
            const esH = !esF && c.esActual;
            const esSel = mismo(c, sel) && !esF && !esH;
            // EL COLOR: en Ajustar la escala de cercanía a Comprar; en Comprar, el veredicto.
            const color = esComprar ? CLASE[l.veredicto] : escalaCelda(c);
            return (
              <button
                key={`${p}-${pl}`}
                type="button"
                className={`pjx-celda ${color}${esF ? " fr" : ""}${esH ? " hoy" : ""}${esSel ? " sel" : ""}`}
                style={{ gridColumn: 3 + i, gridRow: 3 + r }}
                data-pie={c.piePct}
                data-plazo={c.plazoAnios}
                data-veredicto={l.veredicto}
                data-escala={esComprar ? undefined : color}
                aria-pressed={mismo(c, sel)}
                onClick={() => setSel(c)}
              >
                {esF && <span className="pjx-tag fr">Franco</span>}
                {esH && <span className="pjx-tag hoy">hoy</span>}
                {esComprar ? <CeldaComprar l={l} currency={currency} valorUF={valorUF} /> : <CeldaAjustar l={l} />}
              </button>
            );
          }),
        )}
      </div>
      {esComprar && (
        <div className="pjx-ley">
          <Pill v="COMPRAR" />
          <Pill v="AJUSTA SUPUESTOS" />
          <Pill v="BUSCAR OTRA" />
        </div>
      )}

      {sel &&
        (esComprar ? (
          <PanelComprar c={sel} currency={currency} valorUF={valorUF} precioUF={precioUF} tope={tope} />
        ) : (
          <PanelAjustar
            c={sel}
            esFranco={mismo(sel, franco)}
            tope={tope}
            modalidad={modalidad}
            currency={currency}
            valorUF={valorUF}
            precioUF={precioUF}
            pieHoy={pieHoy}
            antes={antes ?? null}
          />
        ))}

      {mercado && (
        <p className="pjx-mercado">
          Con {mercado.palanca === "adr" || modalidad === "STR" ? "la tarifa" : "el arriendo"} {pct1(Math.abs(mercado.deltaPct))} más{" "}
          {mercado.palanca === "adr" || modalidad === "STR" ? "alta" : "alto"} también llega a <Pill v="COMPRAR" />, pero eso depende del mercado.
        </p>
      )}

      {precioBoton !== null && (
        <div className="pjx-cta">
          <p>Si consigues el precio de la recomendación, el informe cambia entero.</p>
          {/* INERTE A PROPÓSITO (13-sep-2026): conectarlo pide que el wizard acepte un precio por
              query y decidir si un re-análisis consume crédito. */}
          <span className="pjx-btn" aria-disabled="true">
            Analízalo a UF {miles(precioBoton)}
          </span>
        </div>
      )}
    </div>
  );
}

/** La leyenda en escala, de izquierda a derecha: fuera de alcance → ya es Comprar. */
function Escala() {
  return (
    <div className="pjx-escala">
      <p className="tit">Mientras más azul, más cerca de Comprar →</p>
      <div className="barra" aria-hidden="true">
        <span className="sw fx" />
        <span className="sw e3" />
        <span className="sw e2" />
        <span className="sw e1" />
        <span className="sw e0" />
      </div>
      <div className="lab">
        <span>fuera de alcance</span>
        <span>{ETIQUETA_BANDA_LEYENDA.dificil}</span>
        <span>{ETIQUETA_BANDA_LEYENDA.con_argumentos}</span>
        <span>{ETIQUETA_BANDA_LEYENDA.factible}</span>
        <span>ya es Comprar</span>
      </div>
    </div>
  );
}

/** La celda de Ajustar: el número que falta y su dificultad. Sin la palabra del veredicto. */
function CeldaAjustar({ l }: { l: LecturaCelda }) {
  const f = l.cifra;
  if (f.tipo === "descuento")
    return (
      <>
        <span className="n">
          −{pct1(f.pct)} <small>dcto.</small>
        </span>
        <span className="sub">{ETIQUETA_BANDA_CELDA[f.banda]}</span>
      </>
    );
  if (f.tipo === "no_llega")
    return (
      <>
        <span className="n">más de {miles(f.topePct)}%</span>
        <span className="sub">fuera de alcance</span>
      </>
    );
  return (
    <>
      <span className="n">sin descuento</span>
      <span className="sub">ya es Comprar</span>
    </>
  );
}

/** La celda de Comprar, como estaba: veredicto al que cae y cuánto te queda al mes. */
function CeldaComprar({ l, currency, valorUF }: { l: LecturaCelda; currency: Currency; valorUF: number }) {
  const cab = (
    <span className="l1">
      {signoVeredicto(l.veredicto)} {etiquetaVeredicto(l.veredicto, "frase")}
    </span>
  );
  const f = l.cifra;
  if (f.tipo === "cae")
    return (
      <>
        {cab}
        <span className="l2 chica">deja de ser</span>
        <span className="l3">Comprar</span>
      </>
    );
  const clpMes = f.tipo === "flujo" ? f.clpMes : null;
  const neg = clpMes != null && clpMes < 0;
  return (
    <>
      {cab}
      <span className={`l2 ${neg ? "neg" : "tinta"}`}>{clpMes == null ? "—" : plata(clpMes, currency, valorUF)}</span>
      <span className="l3 tinta">{neg ? "pones al mes" : "te queda al mes"}</span>
    </>
  );
}

function PanelAjustar({
  c,
  esFranco,
  tope,
  modalidad,
  currency,
  valorUF,
  precioUF,
  pieHoy,
  antes,
}: {
  c: CeldaMix;
  esFranco: boolean;
  tope: number;
  modalidad: "LTR" | "STR";
  currency: Currency;
  valorUF: number;
  precioUF: number;
  pieHoy: number;
  antes: AntesPopup | null;
}) {
  const l = lecturaCelda(c, false, tope);
  const pre = `Con pie ${pieTxt(c.piePct)} y crédito a ${c.plazoAnios} años`;
  const f = l.cifra;
  let frase: ReactNode;
  if (f.tipo === "descuento") {
    frase = (
      <>
        {pre}, si consigues <strong>{pct1(f.pct)} de descuento</strong> ({ETIQUETA_BANDA_FRASE[f.banda]}), pasa de <Pill v={l.veredicto} /> a <Pill v="COMPRAR" />.
      </>
    );
  } else if (f.tipo === "no_llega") {
    frase = (
      <>
        {pre} es <Pill v={l.veredicto} />, y no llega a <Pill v="COMPRAR" /> ni pidiéndole {miles(f.topePct)}% de descuento al vendedor. Prueba con más pie o más plazo.
      </>
    );
  } else {
    frase = (
      <>
        {pre} ya es <Pill v="COMPRAR" />, sin pedirle nada al vendedor.
      </>
    );
  }
  const d = c.descuentoPct ?? 0;
  const m = c.metricas ?? null;
  const $ = (n: number | null | undefined) => (n == null ? "—" : plata(n, currency, valorUF));
  const pc = (n: number | null | undefined) => (n == null ? "—" : pct1(n));
  const neg = (n: number | null | undefined) => n != null && n < 0;
  const filas: { r: string; hoy: string; asi: string; negHoy?: boolean; negAsi?: boolean }[] = [
    { r: "Descuento", hoy: "—", asi: d === 0 ? "ninguno" : pct1(d) },
    { r: "Precio", hoy: plata(precioUF * valorUF, currency, valorUF), asi: plata(precioUF * (1 - d / 100) * valorUF, currency, valorUF) },
    { r: "Pie el día uno", hoy: plata((pieHoy / 100) * precioUF * valorUF, currency, valorUF), asi: plata(pieDiaUnoUF(c, precioUF) * valorUF, currency, valorUF) },
    { r: "Cuota del crédito", hoy: $(antes?.cuotaMensual), asi: $(m?.cuotaMensual) },
    { r: "Te queda al mes", hoy: $(antes?.flujoMensual), asi: $(m?.flujoMensual), negHoy: neg(antes?.flujoMensual), negAsi: neg(m?.flujoMensual) },
    { r: GLOSAS.cashOnCash.nombre, hoy: pc(antes?.cocPct), asi: pc(m?.cocPct), negHoy: neg(antes?.cocPct), negAsi: neg(m?.cocPct) },
    { r: rotuloCapRate(modalidad), hoy: pc(antes?.capRateNetoPct), asi: pc(m?.capRateNetoPct) },
    { r: "TIR a 10 años", hoy: pc(antes?.tirPct), asi: pc(m?.tirPct), negHoy: neg(antes?.tirPct), negAsi: neg(m?.tirPct) },
    { r: "Franco Score", hoy: antes?.score == null ? "—" : String(antes.score), asi: c.score == null ? "—" : String(c.score) },
  ];
  return (
    <div className="pjx-panel">
      <p className="pjx-frase">
        {esFranco && <strong>La recomendación de Franco. </strong>}
        {frase}
      </p>
      {f.tipo !== "no_llega" && (
        <table className="pjx-tab">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Cifra</span>
              </th>
              <th scope="col">Hoy</th>
              <th scope="col" className="asi">
                Así
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((x) => (
              <tr key={x.r}>
                <td>{x.r}</td>
                <td className={`hoy${x.negHoy ? " neg" : ""}`}>{x.hoy}</td>
                <td className={`asi${x.negAsi ? " neg" : ""}`}>{x.asi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PanelComprar({ c, currency, valorUF, precioUF, tope }: { c: CeldaMix; currency: Currency; valorUF: number; precioUF: number; tope: number }) {
  const l = lecturaCelda(c, true, tope);
  const pre = `Con pie ${pieTxt(c.piePct)} y crédito a ${c.plazoAnios} años`;
  const flujo = c.metricas?.flujoMensual ?? null;
  let frase: ReactNode;
  if (l.cifra.tipo === "cae") {
    frase = (
      <>
        {pre} la cuota sube tanto que deja de ser Comprar: pasa a <Pill v={l.veredicto} />.
      </>
    );
  } else if (flujo != null && flujo < 0) {
    frase = (
      <>
        {pre} sigue siendo <Pill v="COMPRAR" />, y pones <strong className="neg">{plata(Math.abs(flujo), currency, valorUF)}</strong> de tu bolsillo cada mes.
      </>
    );
  } else {
    frase = (
      <>
        {pre} sigue siendo <Pill v="COMPRAR" />
        {flujo != null ? (
          <>
            , y te quedan <strong>{plata(flujo, currency, valorUF)}</strong> al mes después de pagar todo.
          </>
        ) : (
          "."
        )}
      </>
    );
  }
  const tir = c.metricas?.tirPct ?? null;
  return (
    <div className="pjx-panel">
      <p className="pjx-frase">{frase}</p>
      <div className="pjx-cifras">
        <div className="pjx-cifra">
          <div className="r">{flujo != null && flujo < 0 ? "Pones al mes" : "Te queda al mes"}</div>
          <div className={`n${flujo != null && flujo < 0 ? " neg" : ""}`}>{flujo == null ? "—" : plata(Math.abs(flujo), currency, valorUF)}</div>
        </div>
        <div className="pjx-cifra">
          <div className="r">Pie el día uno</div>
          <div className="n">{plata(pieDiaUnoUF(c, precioUF) * valorUF, currency, valorUF)}</div>
        </div>
        <div className="pjx-cifra">
          <div className="r">TIR a 10 años</div>
          <div className="n">{tir == null ? "—" : pct1(tir)}</div>
        </div>
        <div className="pjx-cifra">
          <div className="r">Franco Score</div>
          <div className="n">{c.score ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}

/** Las flechas de los ejes, en SVG con degradado. Tinta: lo tuyo. Gris: lo del vendedor. */
function Flechas({ uid, cols, rows, descuento }: { uid: string; cols: number; rows: number; descuento: boolean }) {
  return (
    <>
      <div className="pjx-ax tu" style={{ gridColumn: `3 / ${3 + cols}`, gridRow: 1, height: 24 }}>
        <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}t`}>
              <stop offset="0" stopColor="currentColor" stopOpacity=".08" />
              <stop offset="1" stopColor="currentColor" />
            </linearGradient>
          </defs>
          <rect x="0" y="10.5" width="97" height="3" rx="1.5" fill={`url(#${uid}t)`} />
        </svg>
        <svg viewBox="0 0 24 24" className="pjx-punta der" aria-hidden="true">
          <path d="M11 5 L20 12 L11 19 Z" fill="currentColor" />
        </svg>
        <span>más plazo</span>
      </div>
      <div className="pjx-ax vert tu" style={{ gridColumn: 1, gridRow: `3 / ${3 + rows}` }}>
        <svg viewBox="0 0 22 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}i`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity=".08" />
              <stop offset="1" stopColor="currentColor" />
            </linearGradient>
          </defs>
          <rect x="9.5" y="0" width="3" height="97" rx="1.5" fill={`url(#${uid}i)`} />
        </svg>
        <svg viewBox="0 0 22 22" className="pjx-punta abajo" aria-hidden="true">
          <path d="M4 10 L11 19 L18 10 Z" fill="currentColor" />
        </svg>
        <span>más pie</span>
      </div>
      {descuento && (
        <>
          <div className="pjx-ax vert up ven" style={{ gridColumn: 3 + cols, gridRow: `3 / ${3 + rows}` }}>
            <svg viewBox="0 0 22 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={`${uid}d`} x1="0" x2="0" y1="1" y2="0">
                  <stop offset="0" stopColor="currentColor" stopOpacity=".1" />
                  <stop offset="1" stopColor="currentColor" />
                </linearGradient>
              </defs>
              <rect x="9.5" y="3" width="3" height="97" rx="1.5" fill={`url(#${uid}d)`} />
            </svg>
            <svg viewBox="0 0 22 22" className="pjx-punta arriba" aria-hidden="true">
              <path d="M4 12 L11 3 L18 12 Z" fill="currentColor" />
            </svg>
            <span>más descuento</span>
          </div>
          <div className="pjx-ax ven" style={{ gridColumn: `3 / ${3 + cols}`, gridRow: 3 + rows, height: 24 }}>
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={`${uid}b`} x1="1" x2="0">
                  <stop offset="0" stopColor="currentColor" stopOpacity=".1" />
                  <stop offset="1" stopColor="currentColor" />
                </linearGradient>
              </defs>
              <rect x="3" y="10.5" width="97" height="3" rx="1.5" fill={`url(#${uid}b)`} />
            </svg>
            <svg viewBox="0 0 24 24" className="pjx-punta izq" aria-hidden="true">
              <path d="M13 5 L4 12 L13 19 Z" fill="currentColor" />
            </svg>
            <span>más descuento</span>
          </div>
        </>
      )}
    </>
  );
}
