"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «FILTROS» (25-nov-2026, lámina 6 del canvas «La asesoría en el mapa», decisión 9 de Fabrizio; antes, Filtros v2 del 02-nov): en el
// teléfono una hoja que sube, en el PC un panel a la izquierda sobre el mapa.
//   · TIPO DE ARRIENDO: renta larga o renta corta, con la marca «La renta corta se estima por zona, no por depto.».
//   · LOS SUPUESTOS EN UNA LÍNEA EDITABLE: «Con pie de 20 %, crédito a 30 años y tasa de 4,07 %» · «Cambiar» abre pie, plazo y la tasa
//     (el slider de 3,0 a 6,0 con la marca en la del mes). Sin cuenta, «Cambiar» pide crear la cuenta.
//   · LAS BARRAS CON LA DISTRIBUCIÓN DIBUJADA: precio, arriendo estimado, cap rate, te sobran o pones al mes y UF por m²; 24 tramos con
//     los mismos cortes de la base (mapa-todos.ts), dos tiradores y las cajas «Mínimo» y «Máximo». Mover una barra hace que los pines
//     de Comprar y Ajustar digan esa cifra (decisión 6). Sin cuenta, solo precio; las demás piden crear la cuenta (decisión 8).
//   · DORMITORIOS como botones.
// Se fue del panel (25-nov-2026): las comunas, «Solo flujo positivo», «Publicados», «Aplicar mi perfil» y el descuento máximo de los
// Ajustar (decisión 2: siempre 10 %). Los enlaces que traen comunas o fecha siguen filtrando; «Limpiar» los quita.
// Abajo, «Ver N deptos», contado sobre lo cargado con las tres clases. NO TOCA EL PERFIL: lo elegido queda en la página y en la URL.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";
import { PIES_EXPLORAR, PLAZOS_EXPLORAR } from "@/lib/explorar/explorar";
import { FILTROS_GLOBALES, PORTAL_COPY, tasaTexto, validarPortal, type FiltrosPortal, type TasaDelMotor } from "@/lib/explorar/portal";
import {
  BARRA_COPY, BARRAS_PANEL, BARRAS_SIN_CUENTA, extremosDeRango, N_TRAMOS, PANEL_COPY, precioDeRango, rangoDePrecio, textoExtremo,
  type BarraPanel, type RangoTramos,
} from "@/lib/explorar/mapa-todos";
import { TASAS_ELEGIBLES } from "@/lib/deptos/estandar";
import { Info } from "./info";

const V = PORTAL_COPY.v2;
const TASA_MIN = TASAS_ELEGIBLES[0];
const TASA_MAX = TASAS_ELEGIBLES[TASAS_ELEGIBLES.length - 1];
const TASA_PASO = TASAS_ELEGIBLES[1] - TASAS_ELEGIBLES[0];

/** El rango de una barra en unos filtros (el precio vive en `ufMin`/`ufMax`). */
function rangoDe(f: FiltrosPortal, barra: BarraPanel): RangoTramos {
  if (barra === "precio") return rangoDePrecio(f.ufMin, f.ufMax);
  return f.rangos[barra] ?? [0, N_TRAMOS - 1];
}
/** Pone el rango de una barra en unos filtros, y esa barra pasa a ser la cifra de los pines. */
function conRango(f: FiltrosPortal, barra: BarraPanel, r: RangoTramos): FiltrosPortal {
  if (barra === "precio") return validarPortal({ ...f, ...precioDeRango(r), cifra: "precio" });
  return validarPortal({ ...f, rangos: { ...f.rangos, [barra]: r }, cifra: barra });
}

/** UNA BARRA: la distribución dibujada (los tramos dentro del rango, en azul) y dos tiradores. */
function Barra({ barra, rango, distribucion, alCambiar, bloqueada }: {
  barra: BarraPanel;
  rango: RangoTramos;
  distribucion: number[] | null;
  alCambiar: (r: RangoTramos) => void;
  /** Sin cuenta: la barra no se mueve y pide crear la cuenta. */
  bloqueada: (() => void) | null;
}) {
  const max = Math.max(1, ...(distribucion ?? [1]));
  const e = extremosDeRango(barra, rango);
  const titulo = BARRA_COPY[barra];
  return (
    <fieldset className="ex-barra-f" data-explorar={`barra-${barra}`} data-desde={rango[0]} data-hasta={rango[1]}>
      <legend className="ex-grupo-t">{titulo}</legend>
      {bloqueada ? (
        <button type="button" className="ex-barra-cerrada" onClick={bloqueada} data-explorar={`barra-${barra}-cuenta`}>{PANEL_COPY.conCuenta}</button>
      ) : (
        <>
          <div className="ex-histo" aria-hidden="true">
            {(distribucion ?? new Array<number>(N_TRAMOS).fill(0)).map((n, i) => (
              <span key={i} style={{ height: `${Math.max(2, Math.round((n / max) * 44))}px` }} data-dentro={i >= rango[0] && i <= rango[1] ? "1" : undefined} />
            ))}
          </div>
          <div className="ex-doble">
            <input type="range" min={0} max={N_TRAMOS - 1} step={1} value={rango[0]} aria-label={`${titulo}: ${PANEL_COPY.minimo}`} aria-valuetext={textoExtremo(barra, e.min, "min")}
              onChange={(ev) => alCambiar([Math.min(Number(ev.target.value), rango[1]), rango[1]])} data-explorar={`barra-${barra}-min`} />
            <input type="range" min={0} max={N_TRAMOS - 1} step={1} value={rango[1]} aria-label={`${titulo}: ${PANEL_COPY.maximo}`} aria-valuetext={textoExtremo(barra, e.max, "max")}
              onChange={(ev) => alCambiar([rango[0], Math.max(Number(ev.target.value), rango[0])])} data-explorar={`barra-${barra}-max`} />
          </div>
          <div className="ex-cajas">
            <div className="ex-caja"><span>{PANEL_COPY.minimo}</span><b>{textoExtremo(barra, e.min, "min")}</b></div>
            <div className="ex-caja"><span>{PANEL_COPY.maximo}</span><b>{textoExtremo(barra, e.max, "max")}</b></div>
          </div>
        </>
      )}
    </fieldset>
  );
}

export function HojaFiltros({ filtros, tasa, contarTodos, distribucion, asegurar, alAplicar, alCerrar, alPedirRegistro = null, alMoverTasa = () => {} }: {
  filtros: FiltrosPortal;
  /** La tasa del motor, la del mes: la línea de supuestos y la marca del slider. */
  tasa: TasaDelMotor | null;
  /** Cuántos deptos darían unos filtros, de las tres clases, sobre lo cargado; null si falta su universo. */
  contarTodos: (f: FiltrosPortal) => number | null;
  /** La distribución de una barra con unos filtros (sin el rango de esa misma barra); null si falta el universo. */
  distribucion: (f: FiltrosPortal, barra: BarraPanel) => number[] | null;
  /** Pide lo que falte para unos filtros (otro pie, otro plazo, otra tasa, renta corta). */
  asegurar: (f: FiltrosPortal) => void;
  alAplicar: (f: FiltrosPortal) => void;
  alCerrar: () => void;
  /** SIN CUENTA: los supuestos y las barras de cifras abren la hoja de registro (con lo elegido hasta ahí aplicado). */
  alPedirRegistro?: ((motivo: "pie-plazo" | "flujo", f: FiltrosPortal) => void) | null;
  /** «explorar_tasa_slider»: soltó el slider en una tasa. */
  alMoverTasa?: (tasa: number) => void;
}) {
  const [b, setB] = useState<FiltrosPortal>(filtros);
  const [editando, setEditando] = useState(false);
  const [, setTick] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const poner = (parche: Partial<FiltrosPortal>) => setB((x) => validarPortal({ ...x, ...parche }));

  // Otro pie, otro plazo, otra tasa o renta corta: lo que falte se pide ya, y el número aparece cuando llega.
  useEffect(() => {
    if (contarTodos(b) != null) return;
    asegurar(b);
    const t = window.setInterval(() => { setTick((n) => n + 1); if (contarTodos(b) != null) window.clearInterval(t); }, 700);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.modalidad, b.pie, b.plazo, b.tasa]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [alCerrar]);

  const n = contarTodos(b);
  const chip = (activo: boolean) => (activo ? "ex-chip ex-chip-on" : "ex-chip");
  // «Limpiar» vuelve a la vista global: los chips del contador (las clases apagadas) se quedan como estaban.
  const limpiar = () => setB((x) => ({ ...FILTROS_GLOBALES, ocultar: x.ocultar }));
  const delMes = tasa?.tasa ?? null;
  const valorTasa = b.tasa ?? delMes ?? TASAS_ELEGIBLES[Math.floor(TASAS_ELEGIBLES.length / 2)];
  const marca = delMes != null ? Math.min(100, Math.max(0, ((delMes - TASA_MIN) / (TASA_MAX - TASA_MIN)) * 100)) : null;
  const soltarTasa = (e: { currentTarget: HTMLInputElement }) => alMoverTasa(Number(e.currentTarget.value));
  const tasaLinea = b.tasa != null ? `${tasaTexto(b.tasa)} %` : delMes != null ? `${tasaTexto(delMes)} %` : PORTAL_COPY.tasaHoy(null);
  const sup = PANEL_COPY.supuestos(b.pie, b.plazo, tasaLinea);
  const alternarTipologia = (id: string) => setB((x) => validarPortal({ ...x, tipologias: x.tipologias.includes(id) ? x.tipologias.filter((y) => y !== id) : [...x.tipologias, id] }));

  return (
    <div className="ex-filtros-velo" data-explorar="hoja-filtros">
      <div className="ex-filtros ex-filtros-v3" role="dialog" aria-modal="true" aria-labelledby="ex-filtros-t" ref={panel} tabIndex={-1}>
        <div className="ex-filtros-cab">
          <h2 id="ex-filtros-t" className="ex-filtros-t">{PORTAL_COPY.filtros}</h2>
          <span className="ex-filtros-cab-acc">
            <button type="button" className="ex-enlace" onClick={limpiar} data-explorar="limpiar">{PORTAL_COPY.limpiar}</button>
            <button type="button" className="ex-x" aria-label={PORTAL_COPY.cerrar} onClick={alCerrar}>×</button>
          </span>
        </div>
        <div className="ex-filtros-cuerpo">
          <fieldset className="ex-grupo" data-explorar="tipo-arriendo">
            <legend className="ex-grupo-t">{PANEL_COPY.tipoArriendo}</legend>
            <div className="ex-seg2" role="radiogroup" aria-label={PANEL_COPY.tipoArriendo}>
              <button type="button" role="radio" aria-checked={b.modalidad === "ltr"} data-on={b.modalidad === "ltr" ? "1" : undefined} onClick={() => poner({ modalidad: "ltr" })} data-explorar="tradicional">{PANEL_COPY.rentaLarga}</button>
              <button type="button" role="radio" aria-checked={b.modalidad === "str"} data-on={b.modalidad === "str" ? "1" : undefined} onClick={() => poner({ modalidad: "str" })} data-explorar="renta-corta">{PANEL_COPY.rentaCorta}</button>
            </div>
            <p className="ex-nota" data-explorar="nota-corta">{PANEL_COPY.cortaPorZona}</p>
          </fieldset>

          {/* LOS SUPUESTOS EN UNA LÍNEA (decisión 9): «Cambiar» los abre aquí mismo; sin cuenta, pide crear la cuenta. */}
          <div className="ex-supuestos" data-explorar="supuestos">
            <span>{sup.antes}<b>{sup.pie}</b>{sup.medio}<b>{sup.plazo}</b>{sup.fin}<b>{sup.tasa}</b></span>
            <button type="button" className="ex-enlace" aria-expanded={editando} onClick={() => (alPedirRegistro ? alPedirRegistro("pie-plazo", b) : setEditando((x) => !x))} data-explorar="cambiar-supuestos">
              {editando ? PANEL_COPY.listo : PANEL_COPY.cambiar}
            </button>
          </div>
          {editando && !alPedirRegistro && (
            <div className="ex-supuestos-edicion" data-explorar="supuestos-edicion">
              <div className="ex-dos">
                <label className="ex-campo"><span>{PORTAL_COPY.hoja.pie}</span>
                  <select value={b.pie} onChange={(e) => poner({ pie: Number(e.target.value) as FiltrosPortal["pie"] })} aria-label={PORTAL_COPY.hoja.pie} data-explorar="pie">
                    {PIES_EXPLORAR.map((p) => <option key={p} value={p}>Pie {p} %</option>)}
                  </select>
                </label>
                <label className="ex-campo"><span>{PORTAL_COPY.hoja.plazo}</span>
                  <select value={b.plazo} onChange={(e) => poner({ plazo: Number(e.target.value) as FiltrosPortal["plazo"] })} aria-label={PORTAL_COPY.hoja.plazo} data-explorar="plazo">
                    {PLAZOS_EXPLORAR.map((z) => <option key={z} value={z}>{z} años</option>)}
                  </select>
                </label>
              </div>
              <div className="ex-tasa" data-explorar="tasa-slider">
                <div className="ex-tasa-cab">
                  <span className="ex-grupo-t">{PORTAL_COPY.tasa}</span>
                  <span className="ex-tasa-valor" data-explorar="tasa-valor">
                    {b.tasa == null ? <>{delMes != null ? `${tasaTexto(delMes)} %` : PORTAL_COPY.tasaHoy(null)} <span className="ex-tasa-del-mes">· {V.tasa.delMes}</span></> : `${tasaTexto(b.tasa)} %`}
                  </span>
                </div>
                <div className="ex-slider" style={marca != null ? ({ "--marca-n": String(marca / 100) } as React.CSSProperties) : undefined}>
                  <input type="range" min={TASA_MIN} max={TASA_MAX} step={TASA_PASO} value={valorTasa} aria-label={PORTAL_COPY.tasa}
                    aria-valuetext={b.tasa == null && delMes != null ? `${tasaTexto(delMes)} %, ${V.tasa.delMes}` : `${tasaTexto(valorTasa)} %`}
                    onChange={(e) => poner({ tasa: Number(e.target.value) })} onPointerUp={soltarTasa} onKeyUp={soltarTasa} data-explorar="tasa" />
                  {marca != null && (<><span className="ex-slider-marca" aria-hidden="true" data-explorar="tasa-marca" /><span className="ex-slider-etq" aria-hidden="true">{V.tasa.delMes}</span></>)}
                </div>
                <div className="ex-slider-ext" aria-hidden="true"><span>{V.tasa.extremo(TASA_MIN)}</span><span>{V.tasa.extremo(TASA_MAX)}</span></div>
                <div className="ex-tasa-pie">
                  <span className="ex-ayuda ex-tasa-fuente">{V.tasa.fuente} <Info etiqueta={V.queEs(PORTAL_COPY.tasa)} texto={V.tasa.fuenteTooltip} lado="izq" marca="info-tasa" /></span>
                  <button type="button" className="ex-enlace ex-tasa-mes" onClick={() => poner({ tasa: null })} disabled={b.tasa == null} data-explorar="tasa-del-mes">{V.tasa.usarDelMes}</button>
                </div>
              </div>
            </div>
          )}

          {(alPedirRegistro ? BARRAS_SIN_CUENTA : BARRAS_PANEL).map((barra) => (
            <Barra key={barra} barra={barra} rango={rangoDe(b, barra)} distribucion={distribucion(b, barra)}
              alCambiar={(r) => setB((x) => conRango(x, barra, r))} bloqueada={null} />
          ))}
          {/* SIN CUENTA, UNA SOLA LÍNEA (26-nov-2026; antes cuatro «Crea tu cuenta gratis para filtrar por…»): abre el registro. */}
          {alPedirRegistro && (
            <button type="button" className="ex-barra-cerrada" onClick={() => alPedirRegistro("flujo", b)} data-explorar="barras-con-cuenta">{PANEL_COPY.conCuenta}</button>
          )}

          <fieldset className="ex-grupo" data-explorar="dormitorios">
            <legend className="ex-grupo-t">{PANEL_COPY.dormitorios}</legend>
            <div className="ex-chips">
              {TIPOLOGIAS_DEPTOS.map((t) => (
                <button key={t.id} type="button" role="checkbox" aria-checked={b.tipologias.includes(t.id)} className={chip(b.tipologias.includes(t.id))} onClick={() => alternarTipologia(t.id)} data-tipologia={t.id}>
                  {t.id === "0" ? "Estudio" : t.id === "4" ? "4 o más" : t.id}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="ex-filtros-pie">
          <button type="button" className="ex-ver-n" onClick={() => alAplicar(b)} disabled={n === 0} data-explorar="ver-n" data-n={n ?? undefined}>
            {n == null ? PANEL_COPY.contando : n === 0 ? PANEL_COPY.ninguno : PANEL_COPY.ver(n)}
          </button>
        </div>
      </div>
    </div>
  );
}
