"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL POP-UP DE AJUSTES — LA MATRIZ COMO MAPA (24-sep-2026)
//
// Contrato visual: docs/wireframes/rediseno-informe/popup-matriz-aprobado.html (aprobado por
// Fabrizio el 24-sep-2026; las cifras que no son de filas reales son ilustrativas: acá mandan
// las del motor). El modelo sin React vive en `src/lib/matriz-popup.ts`.
//
// QUÉ ES. La grilla de pie × plazo que el motor ya calcula (`mixAComprar` / `mixComprar`), con
// cada celda diciendo dos cosas: el COLOR es el veredicto de esa combinación al precio pedido
// (tríada de la portada) y el NÚMERO es lo que falta —el descuento para llegar a Comprar con su
// banda, o en Comprar cuánto te queda al mes—. Ejes didácticos con flechas: más pie hacia abajo
// y más plazo hacia la derecha en tinta (esfuerzo del comprador); más descuento hacia arriba y
// hacia la izquierda en gris (esfuerzo del vendedor). En la matriz se marcan SOLO dos celdas: la
// de Franco (la recomendación, la misma de la card y de «A qué precio cerrar») y la tuya. Al tocar
// una celda, una frase con los dos veredictos y cuatro cifras.
//
// QUÉ SALIÓ, y por qué (decisiones del 24-sep): el menú de tres respuestas (el mapa lo
// reemplaza), los siete pares hoy → después (quedan cuatro cifras de la celda tocada) y «Un cambio
// a la vez» (la columna y la fila de hoy SON esos cambios), salvo el arriendo o la tarifa, que no
// están en la matriz porque los pone el mercado: quedan en una línea. El botón «Analízalo a UF X»
// sigue inerte: conectarlo pide decidir si un re-análisis consume crédito.
//
// BUSCAR OTRA NO TIENE POP-UP: la card dice la causa y la distancia (`buscar-otra-copy.ts`).
// ─────────────────────────────────────────────────────────────────────────────

import { useId, useState, type ReactNode } from "react";
import type { CeldaMix } from "@/lib/mix-palancas";
import type { HallazgoDistanciaVeredicto, MixPalancas, Veredicto } from "@/lib/types";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";
import { solasAComprar } from "@/lib/mix-a-comprar";
import { ETIQUETA_BANDA_CORTA } from "@/lib/banda-esfuerzo";
import { celdaFranco, grillaDelPopup, lecturaCelda, pieDiaUnoUF, type LecturaCelda } from "@/lib/matriz-popup";

export { hayAjustesQueMostrar } from "@/lib/matriz-popup";

type Currency = "CLP" | "UF";

const dec1 = (n: number) => n.toFixed(1).replace(".", ",").replace("-", "−");
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct1 = (n: number) => `${dec1(n)}%`;
const pieTxt = (n: number) => `${dec1(n).replace(",0", "")}%`;
const plata = (clp: number, currency: Currency, valorUF: number) => {
  const signo = clp < 0 ? "−" : "";
  const abs = Math.abs(clp);
  return currency === "UF" ? `${signo}UF ${dec1(abs / valorUF)}` : `${signo}$${miles(abs)}`;
};
const CLASE: Record<Veredicto, "c" | "a" | "b"> = { COMPRAR: "c", "AJUSTA SUPUESTOS": "a", "BUSCAR OTRA": "b" };

export interface PopupAjustesProps {
  veredicto: Veredicto;
  modalidad: "LTR" | "STR";
  /** Hallazgo de distancia del motor. Null en COMPRAR (no hay veredicto superior). */
  distancia?: HallazgoDistanciaVeredicto | null;
  /** La grilla de COMPRAR, que llega por su propia puerta (modo «mejorar»). */
  mixComprar?: MixPalancas | null;
  currency: Currency;
  valorUF: number;
  /** El precio pedido, en UF: la base del pie del día uno y del precio del botón. */
  precioUF: number;
}

function Pill({ v }: { v: Veredicto }) {
  return (
    <span className={`pjx-v ${CLASE[v]}`}>
      {signoVeredicto(v)} {etiquetaVeredicto(v, "frase")}
    </span>
  );
}

export function PopupAjustes({ veredicto, modalidad, distancia, mixComprar, currency, valorUF, precioUF }: PopupAjustesProps) {
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
      <p className="pjx-preg">
        El color es el veredicto de cada combinación al precio pedido.{" "}
        {esComprar ? (
          <>
            El número es <strong>lo que te queda al mes</strong>.
          </>
        ) : (
          <>
            Donde no es Comprar, el número es <strong>el descuento que falta para llegar</strong>.
          </>
        )}
      </p>
      <p className="pjx-tip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 11V6a2 2 0 1 1 4 0v5" />
          <path d="M13 10a2 2 0 1 1 4 0v3a6 6 0 0 1-6 6h-1a6 6 0 0 1-5.2-3l-1.3-2.3a1.6 1.6 0 0 1 2.8-1.6L9 14" />
        </svg>
        Toca una celda para ver qué pasa con esa combinación.
      </p>

      <div
        className="pjx-mz"
        style={{
          gridTemplateColumns: `24px 44px repeat(${plazos.length}, minmax(0, 1fr)) ${conDescuento ? "24px" : "0px"}`,
          gridTemplateRows: `26px 18px repeat(${pies.length}, auto)${conDescuento ? " 26px" : ""}`,
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
            return (
              <button
                key={`${p}-${pl}`}
                type="button"
                className={`pjx-celda ${CLASE[l.veredicto]}${esF ? " fr" : ""}${esH ? " hoy" : ""}${esSel ? " sel" : ""}`}
                style={{ gridColumn: 3 + i, gridRow: 3 + r }}
                data-pie={c.piePct}
                data-plazo={c.plazoAnios}
                data-veredicto={l.veredicto}
                aria-pressed={mismo(c, sel)}
                onClick={() => setSel(c)}
              >
                {esF && <span className="pjx-tag fr">Franco</span>}
                {esH && <span className="pjx-tag hoy">hoy</span>}
                <Celda l={l} currency={currency} valorUF={valorUF} />
              </button>
            );
          }),
        )}
      </div>
      <div className="pjx-ley">
        <Pill v="COMPRAR" />
        <Pill v="AJUSTA SUPUESTOS" />
        <Pill v="BUSCAR OTRA" />
      </div>

      {sel && (
        <Panel c={sel} esFranco={mismo(sel, franco)} esComprar={esComprar} tope={tope} currency={currency} valorUF={valorUF} precioUF={precioUF} />
      )}

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

function Celda({ l, currency, valorUF }: { l: LecturaCelda; currency: Currency; valorUF: number }) {
  const cab = (
    <span className="l1">
      {signoVeredicto(l.veredicto)} {etiquetaVeredicto(l.veredicto, "frase")}
    </span>
  );
  const f = l.cifra;
  if (f.tipo === "sin_descuento")
    return (
      <>
        {cab}
        <span className="l2">sin descuento</span>
      </>
    );
  if (f.tipo === "descuento")
    return (
      <>
        {cab}
        <span className="l2">−{pct1(f.pct)} dcto.</span>
        <span className="l3">{ETIQUETA_BANDA_CORTA[f.banda]}</span>
      </>
    );
  if (f.tipo === "no_llega")
    return (
      <>
        {cab}
        <span className="l2 chica">no llega</span>
        <span className="l3">ni con −{miles(f.topePct)}%</span>
      </>
    );
  if (f.tipo === "cae")
    return (
      <>
        {cab}
        <span className="l2 chica">deja de ser</span>
        <span className="l3">Comprar</span>
      </>
    );
  const neg = f.clpMes != null && f.clpMes < 0;
  return (
    <>
      {cab}
      <span className={`l2 ${neg ? "neg" : "tinta"}`}>{f.clpMes == null ? "—" : plata(f.clpMes, currency, valorUF)}</span>
      <span className="l3 tinta">{neg ? "pones al mes" : "te queda al mes"}</span>
    </>
  );
}

function Panel({
  c,
  esFranco,
  esComprar,
  tope,
  currency,
  valorUF,
  precioUF,
}: {
  c: CeldaMix;
  esFranco: boolean;
  esComprar: boolean;
  tope: number;
  currency: Currency;
  valorUF: number;
  precioUF: number;
}) {
  const l = lecturaCelda(c, esComprar, tope);
  const pre = `Con pie ${pieTxt(c.piePct)} y crédito a ${c.plazoAnios} años`;
  const flujo = c.metricas?.flujoMensual ?? null;
  let frase: ReactNode;
  const f = l.cifra;
  if (f.tipo === "flujo") {
    frase =
      flujo != null && flujo < 0 ? (
        <>
          {pre} sigue siendo <Pill v="COMPRAR" />, y pones <strong className="neg">{plata(Math.abs(flujo), currency, valorUF)}</strong> de tu bolsillo cada mes.
        </>
      ) : (
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
  } else if (f.tipo === "cae") {
    frase = (
      <>
        {pre} la cuota sube tanto que deja de ser Comprar: pasa a <Pill v={l.veredicto} />.
      </>
    );
  } else if (f.tipo === "sin_descuento") {
    frase = (
      <>
        {pre} ya es <Pill v="COMPRAR" /> al precio pedido, sin pedirle nada al vendedor.
      </>
    );
  } else if (f.tipo === "no_llega") {
    frase = (
      <>
        {pre} es <Pill v={l.veredicto} />, y no llega a <Pill v="COMPRAR" /> ni pidiéndole {miles(f.topePct)}% al vendedor.
      </>
    );
  } else {
    frase = (
      <>
        {pre} es <Pill v={l.veredicto} />. Si consigues <strong>−{pct1(f.pct)}</strong> ({ETIQUETA_BANDA_CORTA[f.banda]}), pasa a <Pill v="COMPRAR" />.
      </>
    );
  }
  const conCifras = f.tipo !== "no_llega";
  const tir = c.metricas?.tirPct ?? null;
  return (
    <div className="pjx-panel">
      <p className="pjx-frase">
        {esFranco && <strong>La recomendación de Franco. </strong>}
        {frase}
      </p>
      {conCifras && (
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
      )}
    </div>
  );
}

/** Las flechas de los ejes, en SVG con degradado. Tinta: lo tuyo. Gris: lo del vendedor. */
function Flechas({ uid, cols, rows, descuento }: { uid: string; cols: number; rows: number; descuento: boolean }) {
  return (
    <>
      <div className="pjx-ax tu" style={{ gridColumn: `3 / ${3 + cols}`, gridRow: 1, height: 26 }}>
        <svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}t`}>
              <stop offset="0" stopColor="currentColor" stopOpacity=".08" />
              <stop offset="1" stopColor="currentColor" />
            </linearGradient>
          </defs>
          <rect x="0" y="11.5" width="97" height="3" rx="1.5" fill={`url(#${uid}t)`} />
        </svg>
        <svg viewBox="0 0 26 26" className="pjx-punta der" aria-hidden="true">
          <path d="M12 6 L21 13 L12 20 Z" fill="currentColor" />
        </svg>
        <span>más plazo</span>
      </div>
      <div className="pjx-ax vert tu" style={{ gridColumn: 1, gridRow: `3 / ${3 + rows}` }}>
        <svg viewBox="0 0 24 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}i`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity=".08" />
              <stop offset="1" stopColor="currentColor" />
            </linearGradient>
          </defs>
          <rect x="10.5" y="0" width="3" height="97" rx="1.5" fill={`url(#${uid}i)`} />
        </svg>
        <svg viewBox="0 0 24 24" className="pjx-punta abajo" aria-hidden="true">
          <path d="M5 11 L12 20 L19 11 Z" fill="currentColor" />
        </svg>
        <span>más pie</span>
      </div>
      {descuento && (
        <>
          <div className="pjx-ax vert up ven" style={{ gridColumn: 3 + cols, gridRow: `3 / ${3 + rows}` }}>
            <svg viewBox="0 0 24 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={`${uid}d`} x1="0" x2="0" y1="1" y2="0">
                  <stop offset="0" stopColor="currentColor" stopOpacity=".1" />
                  <stop offset="1" stopColor="currentColor" />
                </linearGradient>
              </defs>
              <rect x="10.5" y="3" width="3" height="97" rx="1.5" fill={`url(#${uid}d)`} />
            </svg>
            <svg viewBox="0 0 24 24" className="pjx-punta arriba" aria-hidden="true">
              <path d="M5 13 L12 4 L19 13 Z" fill="currentColor" />
            </svg>
            <span>más descuento</span>
          </div>
          <div className="pjx-ax ven" style={{ gridColumn: `3 / ${3 + cols}`, gridRow: 3 + rows, height: 26 }}>
            <svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={`${uid}b`} x1="1" x2="0">
                  <stop offset="0" stopColor="currentColor" stopOpacity=".1" />
                  <stop offset="1" stopColor="currentColor" />
                </linearGradient>
              </defs>
              <rect x="3" y="11.5" width="97" height="3" rx="1.5" fill={`url(#${uid}b)`} />
            </svg>
            <svg viewBox="0 0 26 26" className="pjx-punta izq" aria-hidden="true">
              <path d="M14 6 L5 13 L14 20 Z" fill="currentColor" />
            </svg>
            <span>más descuento</span>
          </div>
        </>
      )}
    </>
  );
}
