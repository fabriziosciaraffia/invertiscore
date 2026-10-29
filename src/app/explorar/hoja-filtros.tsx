"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «FILTROS» (28-oct-2026, estado B de 5b-explorar-portal.html): una hoja completa. Comunas (varias), tipología (varias),
// precio desde y hasta, pie y plazo, arriendo tradicional o renta corta («Estimado por zona; se mide al analizar.»), solo con
// flujo positivo y publicados (cualquier fecha, 7 días, hoy). El botón de abajo dice «Ver N deptos» y se actualiza al
// tocar: se cuenta en el navegador sobre el universo cargado (`contar`); con otro pie, otro plazo o renta corta, si ese
// universo todavía no está, se pide al tiro y el botón dice «Ver deptos» mientras tanto. NO TOCA EL PERFIL: lo elegido
// queda en la página y en la URL.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { COMUNAS_DESTACADAS, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";
import { PIES_EXPLORAR, PLAZOS_EXPLORAR } from "@/lib/explorar/explorar";
import { botonVer, FILTROS_GLOBALES, PORTAL_COPY, PUBLICADOS, validarPortal, type FiltrosPortal } from "@/lib/explorar/portal";

const H = PORTAL_COPY.hoja;
const DESTACADAS = COMUNAS_DESTACADAS as readonly string[];
const TODAS = COMUNAS_DISPONIBLES as readonly string[];

export function HojaFiltros({ filtros, contar, asegurar, alAplicar, alCerrar, alPedirRegistro = null }: {
  filtros: FiltrosPortal;
  /** Cuántos darían unos filtros sobre lo cargado; null si falta su universo. */
  contar: (f: FiltrosPortal) => number | null;
  /** Pide el universo que falte para unos filtros (otro pie, otro plazo, renta corta). */
  asegurar: (f: FiltrosPortal) => void;
  alAplicar: (f: FiltrosPortal) => void;
  alCerrar: () => void;
  /** SIN CUENTA (29-oct-2026, decisión de Fabrizio): pie y plazo quedan en 20 % y 25 años y «Solo flujo positivo» depende
   *  del flujo; tocarlos abre la hoja de registro (con lo elegido hasta ahí aplicado) en vez de cambiarlos. */
  alPedirRegistro?: ((motivo: "pie-plazo" | "flujo", f: FiltrosPortal) => void) | null;
}) {
  const [b, setB] = useState<FiltrosPortal>(filtros);
  const [todas, setTodas] = useState(() => filtros.comunas.some((c) => !DESTACADAS.includes(c)));
  const [desde, setDesde] = useState(filtros.ufMin != null ? String(filtros.ufMin) : "");
  const [hasta, setHasta] = useState(filtros.ufMax != null ? String(filtros.ufMax) : "");
  const [, setTick] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const poner = (parche: Partial<FiltrosPortal>) => setB((x) => validarPortal({ ...x, ...parche }));
  const alternar = (k: "comunas" | "tipologias", v: string) => setB((x) => validarPortal({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));

  // Otro pie, otro plazo o renta corta: el universo se pide ya, y el número aparece cuando llega (se reintenta contar).
  useEffect(() => {
    if (contar(b) != null) return;
    asegurar(b);
    // Se vuelve a contar hasta que llega el universo; con el número, se deja de mirar.
    const t = window.setInterval(() => { setTick((n) => n + 1); if (contar(b) != null) window.clearInterval(t); }, 700);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.modalidad, b.pie, b.plazo, b.comunas.join()]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [alCerrar]);

  const n = contar(b);
  const comunas = todas ? [...DESTACADAS, ...TODAS.filter((c) => !DESTACADAS.includes(c))] : [...DESTACADAS, ...b.comunas.filter((c) => !DESTACADAS.includes(c))];
  const chip = (activo: boolean) => (activo ? "ex-chip ex-chip-on" : "ex-chip");
  const limpiar = () => { setB({ ...FILTROS_GLOBALES }); setDesde(""); setHasta(""); };

  return (
    <div className="ex-filtros-velo" data-explorar="hoja-filtros">
      <div className="ex-filtros" role="dialog" aria-modal="true" aria-labelledby="ex-filtros-t" ref={panel} tabIndex={-1}>
        <div className="ex-filtros-cab">
          <h2 id="ex-filtros-t" className="ex-filtros-t">{PORTAL_COPY.filtros}</h2>
          <button type="button" className="ex-x" aria-label={PORTAL_COPY.cerrar} onClick={alCerrar}>×</button>
        </div>
        <div className="ex-filtros-cuerpo">
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
            <legend className="ex-grupo-t">{H.piePlazo}</legend>
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
        </div>
        <div className="ex-filtros-pie">
          <button type="button" className="ex-enlace" onClick={limpiar} data-explorar="limpiar">{PORTAL_COPY.limpiar}</button>
          <button type="button" className="ex-ver-n" onClick={() => alAplicar(b)} disabled={n === 0} data-explorar="ver-n" data-n={n ?? undefined}>{botonVer(n)}</button>
        </div>
      </div>
    </div>
  );
}
