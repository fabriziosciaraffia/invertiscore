"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «FILTROS» V2 (02-nov-2026, estado B de docs/puerta-b-mockups/8-filtros-v2-negociar.html; antes, 5b-explorar-portal.html y el
// recorrido real de Fabrizio del 30-oct): en el teléfono una hoja que sube como «¿Cómo se calcula?», en el PC un panel a la
// IZQUIERDA sobre el mapa (la lista va a la derecha). Cada grupo es una TARJETA BLANCA sobre fondo gris, con su título, una línea de
// ayuda y una ⓘ con su tooltip:
//   · «Aplicar mi perfil de búsqueda» (con cuenta): el resumen del perfil ANTES de tocarlo («Providencia · 2D · UF 4.000–6.000 ·
//     pie 20 % · 30 años · tasa del mes») y «Aplicar».
//   · «El depto» —«Qué estás buscando. Cambia cuáles aparecen.»—: comunas, tipología, precio desde y hasta, arriendo tradicional o
//     renta corta, solo con flujo positivo.
//   · «Tu financiamiento» —«Con qué crédito lo calculamos. Cambia el flujo y el veredicto.»—: pie, plazo y la TASA COMO SLIDER, de
//     3,0 a 6,0 de a 0,25 (lo que se calcula: TASAS_ELEGIBLES), con una marca en la tasa del mes y su etiqueta, el valor arriba
//     («4,07 % · promedio del mes»), la línea del Banco Central con su ⓘ y «Usar la del mes», que vuelve a la marca y la deja
//     siguiendo al motor (null). La marca, en tinta (decisión de Fabrizio, 02-nov-2026: el rojo queda para comprar, oferta y regalo).
//   · «Si negocias el precio»: el mismo interruptor del chip de la barra, la ayuda con los chips reales (ChipVeredicto) y los topes
//     «Hasta 5 % de dcto.» y «Hasta 10 % de dcto.». Sin capa con estos supuestos (otra tasa, pie, plazo o renta corta), lo dice.
//   · «Otros»: publicados (y la zona del mapa, si hay una).
// El botón de abajo separa las dos cuentas: «Ver 201 + 48 si negocias». Se cuenta en el navegador sobre lo cargado (`contar`,
// `contarNegociados`); con otro pie, otro plazo o renta corta, lo que falte se pide al tiro. NO TOCA EL PERFIL: lo elegido queda en
// la página y en la URL. SIN CUENTA, pie, plazo, tasa y «Solo flujo positivo» piden registro (29-oct-2026, decisión de Fabrizio).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { COMUNAS_DESTACADAS, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";
import { PIES_EXPLORAR, PLAZOS_EXPLORAR } from "@/lib/explorar/explorar";
import { botonVer, FILTROS_GLOBALES, PORTAL_COPY, PUBLICADOS, resumenPerfil, tasaTexto, urlDePortal, validarPortal, type FiltrosPortal, type TasaDelMotor } from "@/lib/explorar/portal";
import { botonVerConNegociados, capaNegociarDisponible, NEGOCIAR_COPY, TOPE_NEGOCIAR_POR_DEFECTO, TOPES_NEGOCIAR } from "@/lib/explorar/capa-negociar";
import { TASAS_ELEGIBLES } from "@/lib/deptos/estandar";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { Info } from "./info";

const H = PORTAL_COPY.hoja;
const V = PORTAL_COPY.v2;
const DESTACADAS = COMUNAS_DESTACADAS as readonly string[];
const TODAS = COMUNAS_DISPONIBLES as readonly string[];
const TASA_MIN = TASAS_ELEGIBLES[0];
const TASA_MAX = TASAS_ELEGIBLES[TASAS_ELEGIBLES.length - 1];
/** El paso del slider: el de la lista que se calcula (0,25). */
const TASA_PASO = TASAS_ELEGIBLES[1] - TASAS_ELEGIBLES[0];

export function HojaFiltros({ filtros, tasa, miBusqueda = null, contar, contarNegociados = () => 0, asegurar, alAplicar, alCerrar, alPedirRegistro = null, alMoverTasa = () => {} }: {
  filtros: FiltrosPortal;
  /** La tasa del motor, la del mes: «4,07 % · promedio del mes» y la marca del slider. */
  tasa: TasaDelMotor | null;
  /** Con cuenta: «Aplicar mi perfil de búsqueda» con el resumen del perfil (`activa`: los filtros ya son los del perfil). Sin
   *  cuenta, null. */
  miBusqueda?: { activa: boolean; alUsar: () => void; perfil?: FiltrosPortal | null } | null;
  /** Cuántos darían unos filtros sobre lo cargado; null si falta su universo. */
  contar: (f: FiltrosPortal) => number | null;
  /** Cuántos sumaría la capa «Si negocias» con unos filtros: 0 sin capa, null mientras llega. */
  contarNegociados?: (f: FiltrosPortal) => number | null;
  /** Pide lo que falte para unos filtros (otro pie, otro plazo, renta corta, la capa). */
  asegurar: (f: FiltrosPortal) => void;
  alAplicar: (f: FiltrosPortal) => void;
  alCerrar: () => void;
  /** SIN CUENTA (29-oct-2026, decisión de Fabrizio): pie, plazo y tasa quedan en el financiamiento por defecto y «Solo flujo
   *  positivo» depende del flujo; tocarlos abre la hoja de registro (con lo elegido hasta ahí aplicado) en vez de cambiarlos. */
  alPedirRegistro?: ((motivo: "pie-plazo" | "flujo", f: FiltrosPortal) => void) | null;
  /** «explorar_tasa_slider» (02-nov-2026): soltó el slider en una tasa. */
  alMoverTasa?: (tasa: number) => void;
}) {
  const [b, setB] = useState<FiltrosPortal>(filtros);
  const [todas, setTodas] = useState(() => filtros.comunas.some((c) => !DESTACADAS.includes(c)));
  const [desde, setDesde] = useState(filtros.ufMin != null ? String(filtros.ufMin) : "");
  const [hasta, setHasta] = useState(filtros.ufMax != null ? String(filtros.ufMax) : "");
  const [, setTick] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const ultimoTope = useRef(filtros.negociar ?? TOPE_NEGOCIAR_POR_DEFECTO);
  const poner = (parche: Partial<FiltrosPortal>) => setB((x) => validarPortal({ ...x, ...parche }));
  const alternar = (k: "comunas" | "tipologias", v: string) => setB((x) => validarPortal({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));

  // Otro pie, otro plazo, renta corta o la capa: lo que falte se pide ya, y el número aparece cuando llega (se reintenta contar).
  useEffect(() => {
    if (contar(b) != null && contarNegociados(b) != null) return;
    asegurar(b);
    const t = window.setInterval(() => { setTick((n) => n + 1); if (contar(b) != null && contarNegociados(b) != null) window.clearInterval(t); }, 700);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.modalidad, b.pie, b.plazo, b.comunas.join(), b.negociar]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [alCerrar]);

  const n = contar(b);
  const m = contarNegociados(b);
  const comunas = todas ? [...DESTACADAS, ...TODAS.filter((c) => !DESTACADAS.includes(c))] : [...DESTACADAS, ...b.comunas.filter((c) => !DESTACADAS.includes(c))];
  const chip = (activo: boolean) => (activo ? "ex-chip ex-chip-on" : "ex-chip");
  const limpiar = () => { setB({ ...FILTROS_GLOBALES }); setDesde(""); setHasta(""); };
  const perfil = miBusqueda?.perfil ?? null;
  const perfilAplicado = !!perfil && urlDePortal(perfil) === urlDePortal(b);
  // LA TASA: la elegida o, sin elegir, la del mes (la del motor); el slider salta de a 0,25 y la marca queda en la del mes.
  const delMes = tasa?.tasa ?? null;
  const valorTasa = b.tasa ?? delMes ?? TASAS_ELEGIBLES[Math.floor(TASAS_ELEGIBLES.length / 2)];
  const marca = delMes != null ? Math.min(100, Math.max(0, ((delMes - TASA_MIN) / (TASA_MAX - TASA_MIN)) * 100)) : null;
  const soltarTasa = (e: { currentTarget: HTMLInputElement }) => alMoverTasa(Number(e.currentTarget.value));
  const conCapa = capaNegociarDisponible(b);

  return (
    <div className="ex-filtros-velo" data-explorar="hoja-filtros">
      <div className="ex-filtros ex-filtros-v2" role="dialog" aria-modal="true" aria-labelledby="ex-filtros-t" ref={panel} tabIndex={-1}>
        <div className="ex-filtros-cab">
          <h2 id="ex-filtros-t" className="ex-filtros-t">{PORTAL_COPY.filtros}</h2>
          <button type="button" className="ex-x" aria-label={PORTAL_COPY.cerrar} onClick={alCerrar}>×</button>
        </div>
        <div className="ex-filtros-cuerpo">
          {miBusqueda && (
            <section className="ex-card ex-card-perfil" data-explorar="card-perfil">
              <div className="ex-card-perfil-fila">
                <div className="ex-card-perfil-txt">
                  <span className="ex-card-lab">{V.perfil.titulo} <Info etiqueta={V.queEs(V.perfil.titulo)} texto={V.perfil.tooltip} lado="izq" marca="info-perfil" /></span>
                  <span className="ex-ayuda" data-explorar="perfil-resumen">{perfil ? resumenPerfil(perfil) : PORTAL_COPY.sinMiBusqueda}</span>
                </div>
                {perfil && (
                  <button type="button" className="ex-aplicar" data-activo={perfilAplicado || miBusqueda.activa ? "1" : undefined} onClick={miBusqueda.alUsar} data-explorar="mi-busqueda">
                    {perfilAplicado || miBusqueda.activa ? V.perfil.aplicado : V.perfil.aplicar}
                  </button>
                )}
              </div>
            </section>
          )}

          <section className="ex-card" data-explorar="bloque-depto" aria-labelledby="ex-bloque-depto">
            <div className="ex-card-cab"><h3 id="ex-bloque-depto" className="ex-card-t">{PORTAL_COPY.elDepto}</h3><Info etiqueta={V.queEs(PORTAL_COPY.elDepto)} texto={V.depto.tooltip} marca="info-depto" /></div>
            <p className="ex-ayuda">{V.depto.ayuda}</p>
            <fieldset className="ex-grupo">
              <legend className="ex-grupo-t">{H.comunas}</legend>
              <div className="ex-chips">
                {comunas.map((c) => <button key={c} type="button" role="checkbox" aria-checked={b.comunas.includes(c)} className={chip(b.comunas.includes(c))} onClick={() => alternar("comunas", c)} data-comuna={c}>{c}</button>)}
                <button type="button" className="ex-chip ex-chip-mas" onClick={() => setTodas((x) => !x)} data-explorar="mas-comunas">{todas ? H.menosComunas : H.masComunas(TODAS.length - DESTACADAS.length)}</button>
              </div>
            </fieldset>
            <fieldset className="ex-grupo">
              <legend className="ex-grupo-t">{H.tipologia}</legend>
              <div className="ex-chips">
                {TIPOLOGIAS_DEPTOS.map((t) => <button key={t.id} type="button" role="checkbox" aria-checked={b.tipologias.includes(t.id)} className={chip(b.tipologias.includes(t.id))} onClick={() => alternar("tipologias", t.id)}>{t.id === "4" ? "4D+" : t.chip}</button>)}
              </div>
            </fieldset>
            <fieldset className="ex-grupo">
              <legend className="ex-grupo-t">{H.precio}</legend>
              <div className="ex-dos">
                <label className="ex-campo"><span>{H.desde}</span>
                  <input inputMode="numeric" pattern="[0-9.]*" placeholder="1.500" value={desde} aria-label={H.desde}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setDesde(v); poner({ ufMin: v ? Number(v) : null }); }} data-explorar="desde" />
                </label>
                <label className="ex-campo"><span>{H.hasta}</span>
                  <input inputMode="numeric" pattern="[0-9.]*" placeholder="3.000" value={hasta} aria-label={H.hasta}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setHasta(v); poner({ ufMax: v ? Number(v) : null }); }} data-explorar="hasta" />
                </label>
              </div>
            </fieldset>
            <fieldset className="ex-grupo">
              <legend className="ex-grupo-t">{H.arriendo}</legend>
              <div className="ex-seg" role="radiogroup" aria-label={H.arriendo}>
                <button type="button" role="radio" aria-checked={b.modalidad === "ltr"} className={chip(b.modalidad === "ltr")} onClick={() => poner({ modalidad: "ltr" })} data-explorar="tradicional">{H.tradicional}</button>
                <button type="button" role="radio" aria-checked={b.modalidad === "str"} className={chip(b.modalidad === "str")} onClick={() => poner({ modalidad: "str" })} data-explorar="renta-corta">{H.corta}</button>
              </div>
              {b.modalidad === "str" && <p className="ex-nota" data-explorar="nota-corta">{H.cortaNota}</p>}
            </fieldset>
            <label className="ex-interruptor">
              <span>{H.flujo}</span>
              <input type="checkbox" role="switch" checked={b.flujoPositivo} onChange={(e) => { if (alPedirRegistro && e.target.checked) { alPedirRegistro("flujo", b); return; } poner({ flujoPositivo: e.target.checked }); }} data-explorar="flujo-positivo" />
            </label>
          </section>

          <section className="ex-card" data-explorar="bloque-financiamiento" aria-labelledby="ex-bloque-fin">
            <div className="ex-card-cab"><h3 id="ex-bloque-fin" className="ex-card-t">{PORTAL_COPY.tuFinanciamiento}</h3><Info etiqueta={V.queEs(PORTAL_COPY.tuFinanciamiento)} texto={V.financiamiento.tooltip} marca="info-financiamiento" /></div>
            <p className="ex-ayuda">{V.financiamiento.ayuda}</p>
            {alPedirRegistro ? (
              <div className="ex-dos">
                <button type="button" className="ex-campo ex-campo-cerrado" onClick={() => alPedirRegistro("pie-plazo", b)} data-explorar="pie"><span>{H.pie}</span><b>Pie {b.pie} %</b></button>
                <button type="button" className="ex-campo ex-campo-cerrado" onClick={() => alPedirRegistro("pie-plazo", b)} data-explorar="plazo"><span>{H.plazo}</span><b>{b.plazo} años</b></button>
              </div>
            ) : (
              <div className="ex-dos">
                <label className="ex-campo"><span>{H.pie}</span>
                  <select value={b.pie} onChange={(e) => poner({ pie: Number(e.target.value) as FiltrosPortal["pie"] })} aria-label={H.pie} data-explorar="pie">
                    {PIES_EXPLORAR.map((p) => <option key={p} value={p}>Pie {p} %</option>)}
                  </select>
                </label>
                <label className="ex-campo"><span>{H.plazo}</span>
                  <select value={b.plazo} onChange={(e) => poner({ plazo: Number(e.target.value) as FiltrosPortal["plazo"] })} aria-label={H.plazo} data-explorar="plazo">
                    {PLAZOS_EXPLORAR.map((z) => <option key={z} value={z}>{z} años</option>)}
                  </select>
                </label>
              </div>
            )}
            {/* LA TASA (02-nov-2026, Filtros v2): con cuenta, el slider de 3,0 a 6,0 de a 0,25 con la marca en la del mes; «Usar la del
                mes» la deja siguiendo al motor (null, nunca el número del día). Sin cuenta, la del mes, cerrada: tocarla abre el
                registro, como el pie y el plazo. */}
            {alPedirRegistro ? (
              <button type="button" className="ex-campo ex-campo-cerrado ex-campo-fijo" onClick={() => alPedirRegistro("pie-plazo", b)} data-explorar="tasa">
                <span>{PORTAL_COPY.tasa}</span><b>{tasa ? `${tasaTexto(tasa.tasa)} % · ${V.tasa.delMes}` : PORTAL_COPY.tasaHoy(null)}</b>
              </button>
            ) : (
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
                  {marca != null && (
                    <>
                      <span className="ex-slider-marca" aria-hidden="true" data-explorar="tasa-marca" />
                      <span className="ex-slider-etq" aria-hidden="true">{V.tasa.delMes}</span>
                    </>
                  )}
                </div>
                <div className="ex-slider-ext" aria-hidden="true"><span>{V.tasa.extremo(TASA_MIN)}</span><span>{V.tasa.extremo(TASA_MAX)}</span></div>
                <div className="ex-tasa-pie">
                  <span className="ex-ayuda ex-tasa-fuente">{V.tasa.fuente} <Info etiqueta={V.queEs(PORTAL_COPY.tasa)} texto={V.tasa.fuenteTooltip} lado="izq" marca="info-tasa" /></span>
                  <button type="button" className="ex-enlace ex-tasa-mes" onClick={() => poner({ tasa: null })} disabled={b.tasa == null} data-explorar="tasa-del-mes">{V.tasa.usarDelMes}</button>
                </div>
              </div>
            )}
          </section>

          <section className="ex-card" data-explorar="bloque-negociar" aria-labelledby="ex-bloque-neg">
            <label className="ex-card-cab ex-interruptor ex-interruptor-cab">
              <h3 id="ex-bloque-neg" className="ex-card-t">{NEGOCIAR_COPY.tituloGrupo}</h3>
              <input type="checkbox" role="switch" checked={b.negociar != null} onChange={(e) => poner({ negociar: e.target.checked ? ultimoTope.current : null })} data-explorar="negociar" />
            </label>
            <p className="ex-ayuda" data-explorar="ayuda-negociar">
              {NEGOCIAR_COPY.ayuda.antes} <span className="ex-pegado"><ChipVeredicto v="AJUSTA SUPUESTOS" />,</span> {NEGOCIAR_COPY.ayuda.medio} <ChipVeredicto v="COMPRAR" /> {NEGOCIAR_COPY.ayuda.despues}
            </p>
            <div className="ex-seg" role="radiogroup" aria-label={NEGOCIAR_COPY.tituloGrupo}>
              {TOPES_NEGOCIAR.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={b.negociar === t} className={chip(b.negociar === t)} onClick={() => { ultimoTope.current = t; poner({ negociar: t }); }} data-explorar={`tope-${t}`}>{NEGOCIAR_COPY.tope(t)}</button>
              ))}
            </div>
            {b.negociar != null && !conCapa && <p className="ex-nota" data-explorar="sin-capa">{NEGOCIAR_COPY.sinCapa}</p>}
          </section>

          <section className="ex-card" data-explorar="bloque-otros" aria-labelledby="ex-bloque-otros">
            <div className="ex-card-cab"><h3 id="ex-bloque-otros" className="ex-card-t">{V.otros}</h3></div>
            <fieldset className="ex-grupo">
              <legend className="ex-grupo-t">{H.publicados}</legend>
              <div className="ex-chips" role="radiogroup" aria-label={H.publicados}>
                {PUBLICADOS.map((p) => <button key={p.id} type="button" role="radio" aria-checked={b.publicados === p.id} className={chip(b.publicados === p.id)} onClick={() => poner({ publicados: p.id })}>{p.etiqueta}</button>)}
              </div>
            </fieldset>
            {b.zona && (
              <div className="ex-zona-fila" data-explorar="zona-activa">
                <span>{H.zona}</span>
                <button type="button" className="ex-enlace" onClick={() => poner({ zona: null })}>{H.quitarZona}</button>
              </div>
            )}
          </section>
        </div>
        <div className="ex-filtros-pie">
          <button type="button" className="ex-enlace" onClick={limpiar} data-explorar="limpiar">{PORTAL_COPY.limpiar}</button>
          <button type="button" className="ex-ver-n" onClick={() => alAplicar(b)} disabled={n === 0 && !m} data-explorar="ver-n" data-n={n ?? undefined} data-m={m ?? undefined}>{botonVerConNegociados(n, m, botonVer)}</button>
        </div>
      </div>
    </div>
  );
}
