"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR en el navegador (23-oct-2026, mockup docs/puerta-b-mockups/5-explorar.html).
//   · Arriba, los chips con los filtros (comuna, tipología, rango, pie y plazo), editables ahí mismo: cambiarlos pide
//     los pines de nuevo a /api/explorar y deja los filtros en la URL. NO TOCA EL PERFIL GUARDADO: el único lugar que
//     escribe el perfil es la casilla «Guardar … como mi perfil» del pop-up, y solo si la persona la marca.
//   · El mapa ocupa la pantalla; es interactivo pero carga DESPUÉS del primer pintado (next/dynamic, con la página
//     quieta); mientras tanto la hoja ya muestra las primeras tarjetas que trajo el servidor, y el resto de los pines
//     llega por /api/explorar cuando el mapa se monta.
//   · La píldora «312 convienen · 3 ya analizados»; abajo la hoja deslizable con las tarjetas por puntaje, cada una con
//     «Analizar este», y la línea «Tienes N análisis. Explorar no gasta; analizar sí.».
//   · Al tocar un pin, la hoja muestra el depto: precio, veredicto y puntaje, flujo, cap rate, UF por m², «Revisado con
//     pie X y Y años…» y «Analizar este · usa 1 de tus N», que abre el mismo aviso antes de gastar de la selección, con
//     «Cambiar» el pie y el plazo y el veredicto recalculado. Sin saldo, el aviso ofrece el pack y «Comprar solo 1».
//   · Sin saldo al entrar: el aviso E encima, y el mapa se mira igual.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { botonOcupado, chipOcupado, claveActual, iniciarCarga } from "@/lib/carga-global";
import { cuandoLaPaginaEsteQuieta } from "@/lib/pagina-quieta";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import type { EleccionAnalizar } from "@/components/guia/AvisoAntesDeAnalizar";
import { comprasDeExplorar, lineaTicketConSaldo } from "@/lib/guia/compra-desde-depto";
import { cuandoVenceCorto } from "@/lib/lo-que-sigue/oferta-pack";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { COMUNAS_DESTACADAS, MAX_COMUNAS_PERFIL, RANGOS_UF, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";
import { GUIA } from "@/lib/guia/copy";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import {
  botonAnalizar, cambiarFiltro, capRatePct, esCombinacionDeLaNoche, estadoDeEntrada, etiquetaComunas, etiquetaPie, etiquetaPlazo, etiquetaRango, etiquetaTipologias, EXPLORAR_COPY, flujoTexto, lineaSaldo, marcaDePin,
  pctUno, PIES_EXPLORAR, pildora, PLAZOS_EXPLORAR, textoRevisado, tituloHoja, TOPE_HOJA, ufPorM2, urlDeFiltros, type FiltrosExplorar, type PinExplorar, type Recalculo,
} from "@/lib/explorar/explorar";
import "./explorar.css";

/** Las tarjetas que la hoja abierta dibuja (el mapa tiene todos los pines). */
const TOPE_LISTA = 120;
const ESPERA_EN_CURSO_MS = 4000;
const DESTACADAS = COMUNAS_DESTACADAS as readonly string[];
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

const MapaExplorar = dynamic(() => import("./mapa-explorar"), { ssr: false, loading: () => null });
// Los dos pop-ups no hacen falta para el primer pintado (LCP en el teléfono, medido en producción el 23-oct-2026: el JS que
// baja antes de pintar compite con el mapa quieto por el ancho de banda): entran cuando se abren.
const AvisoAntesDeAnalizar = dynamic(() => import("@/components/guia/AvisoAntesDeAnalizar").then((m) => m.AvisoAntesDeAnalizar), { ssr: false, loading: () => null });
const AvisoSinSaldoExplorar = dynamic(() => import("./aviso-sin-saldo").then((m) => m.AvisoSinSaldoExplorar), { ssr: false, loading: () => null });

export interface DatosExplorarCliente {
  filtros: FiltrosExplorar;
  n: number;
  analizadosN: number;
  pines: PinExplorar[];
  /** `pines` trae todos (n chico) o solo los primeros TOPE_HOJA. */
  completo: boolean;
  analizados: Record<string, string>;
  saldo: EstadoSaldo;
  ticket: boolean;
  cuentaCreadaAt: string | null;
  finanzas: { uf: number | null; tasa: number | null };
  /** Los filtros salieron del perfil (o de la URL); false = el perfil no alcanzaba y abre con la búsqueda de ejemplo. */
  desdePerfil: boolean;
  /** La combinación no es de la noche: el servidor no trajo pines y el navegador los pide enseguida («Calculando con tu pie…»). */
  calculando?: boolean;
}

type Chip = "comuna" | "tipologia" | "rango" | "pie" | "plazo";

export function ExplorarCliente({ inicial, abrir = null, autoAnalizar = null, mapaQuieto = null }: {
  inicial: DatosExplorarCliente;
  abrir?: string | null;
  autoAnalizar?: string | null;
  /** El mapa quieto del primer pintado, dibujado por el servidor (page.tsx): va debajo del mapa real hasta sus teselas. */
  mapaQuieto?: ReactNode;
}) {
  const router = useRouter();
  const [datos, setDatos] = useState(inicial);
  const [filtros, setFiltros] = useState(inicial.filtros);
  const [cargando, setCargando] = useState<Chip | "todo" | null>(null);
  const [fallo, setFallo] = useState(false);
  const [mapaListo, setMapaListo] = useState(false);
  // «teselas»: el mapa real ya dibujó sus teselas; recién ahí se desvanece el mapa quieto del primer pintado.
  const [mapa, setMapa] = useState<"cargando" | "listo" | "teselas" | "fallo">("cargando");
  const [seleccionado, setSeleccionado] = useState<string | null>(abrir);
  const [hoja, setHoja] = useState<"peek" | "abierta">(abrir ? "abierta" : "peek");
  const [pop, setPop] = useState<"comuna" | "tipologia" | null>(null);
  const [confirmar, setConfirmar] = useState<{ it: PinExplorar; sin: boolean; analizando?: boolean } | null>(null);
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
  const [caidos, setCaidos] = useState<string[]>([]);
  const entrada = estadoDeEntrada(inicial.saldo);
  const [avisoSinSaldo, setAvisoSinSaldo] = useState(entrada.aviso);
  const [yendo, setYendo] = useState<"pack" | "suelto" | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const vivo = useRef(true);

  const pines = useMemo(() => datos.pines.filter((p) => !caidos.includes(p.avisoId)), [datos.pines, caidos]);
  // Cuántos convienen: con todos los pines, los que hay; con solo los primeros (antes del mapa), lo que contó el servidor.
  const total = datos.completo ? pines.length : Math.max(0, datos.n - caidos.length);
  const analizadosSet = useMemo(() => new Set(Object.keys(datos.analizados)), [datos.analizados]);
  const elegido = seleccionado ? pines.find((p) => p.avisoId === seleccionado) ?? null : null;
  const consulta = urlDeFiltros(filtros);
  const compras = useCallback((avisoId?: string | null) => comprasDeExplorar({ filtros: consulta, avisoId, ticket: datos.ticket }), [consulta, datos.ticket]);
  const ticketConSaldo = datos.ticket && datos.cuentaCreadaAt && datos.saldo.tipo !== "sin" ? lineaTicketConSaldo(datos.cuentaCreadaAt, compras().pack.href) : null;

  /** Pide los pines de una búsqueda. `evento`: la persona cambió un chip (el servidor deja «explorar_vista»). */
  const cargar = useCallback(async (f: FiltrosExplorar, evento: boolean) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setFallo(false);
    try {
      const res = await fetch(`/api/explorar?${urlDeFiltros(f)}${evento ? "&evento=1" : ""}`, { cache: "no-store", signal: ctrl.signal });
      if (!vivo.current || ctrl.signal.aborted) return;
      if (!res.ok) { setFallo(true); return; }
      const d = (await res.json()) as Omit<DatosExplorarCliente, "analizadosN" | "completo" | "desdePerfil">;
      if (ctrl.signal.aborted) return;
      setDatos((x) => ({ ...x, ...d, filtros: f, analizadosN: d.pines.filter((p) => d.analizados[p.avisoId]).length, completo: true, calculando: false }));
      setCaidos([]);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError") && vivo.current) setFallo(true);
    }
  }, []);

  // El mapa, después del primer pintado; con él, el resto de los pines si el servidor mandó solo los primeros.
  useEffect(() => {
    vivo.current = true;
    // Una combinación que la noche no tiene: se pide ya, sin esperar a que la página esté quieta (el servidor no la calculó).
    if (inicial.calculando) { setCargando("todo"); void cargar(inicial.filtros, false).finally(() => { if (vivo.current) setCargando(null); }); }
    const cancelar = cuandoLaPaginaEsteQuieta(() => {
      setMapaListo(true);
      if (!inicial.completo && !inicial.calculando) void cargar(inicial.filtros, false);
    });
    return () => { vivo.current = false; cancelar(); abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicar(parche: Partial<FiltrosExplorar>, chip: Chip) {
    const f = cambiarFiltro(filtros, parche);
    if (f === filtros) return;
    setFiltros(f);
    setSeleccionado(null);
    try { window.history.replaceState(window.history.state, "", `${window.location.pathname}?${urlDeFiltros(f)}`); } catch { /* sin historial */ }
    setCargando(chip);
    void cargar(f, true).finally(() => { if (vivo.current) setCargando(null); });
  }

  function seleccionar(avisoId: string) {
    setSeleccionado(avisoId);
    setHoja("abierta");
    setError(null);
  }

  async function analizar(it: PinExplorar, eleccion?: EleccionAnalizar) {
    if (generando) return;
    const combinacion = eleccion?.combinacion ?? { piePct: filtros.pie, plazoAnios: filtros.plazo };
    setError(null);
    setGenerando(it.avisoId);
    // El aviso queda abierto, cargando, con la barra del header, hasta que abre el informe (como en la selección).
    const soltar = iniciarCarga(claveActual());
    setConfirmar({ it, sin: false, analizando: true });
    try {
      // La casilla del pop-up: el pie y el plazo nuevos quedan en su perfil (lo único de esta página que lo escribe).
      if (eleccion?.guardarPerfil) {
        await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios }) }).catch(() => null);
      }
      for (let intento = 0; intento < 8; intento++) {
        const res = await fetch("/api/lo-que-sigue/guia/analizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avisoId: it.avisoId, piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios, explorar: true }),
        });
        if (res.status === 409) { await new Promise((ok) => setTimeout(ok, ESPERA_EN_CURSO_MS)); continue; }
        const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (res.ok && d.id) { router.push(`/analisis/${d.id}`); return; }
        // Se dio de baja recién: sale del mapa.
        if (res.status === 410 && d.error === "despublicado") { setConfirmar(null); setCaidos((xs) => [...xs, it.avisoId]); setSeleccionado(null); break; }
        if (d.error === "sin-creditos") { setConfirmar({ it, sin: true }); break; }
        setConfirmar(null);
        setError({ avisoId: it.avisoId, texto: GUIA.error });
        break;
      }
    } catch {
      setConfirmar(null);
      setError({ avisoId: it.avisoId, texto: GUIA.error });
    }
    soltar();
    setGenerando(null);
  }

  // Volvió pagado desde un depto (`a` y `analizar=1`): se abre y se analiza solo, una vez.
  const autoHecho = useRef(false);
  useEffect(() => {
    if (!autoAnalizar || autoHecho.current) return;
    const it = pines.find((p) => p.avisoId === autoAnalizar);
    if (!it) return;
    autoHecho.current = true;
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("analizar");
      window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`);
    } catch { /* igual se analiza una vez */ }
    setSeleccionado(it.avisoId);
    setHoja("abierta");
    if (datos.analizados[it.avisoId]) return;
    if (datos.saldo.tipo === "sin") setConfirmar({ it, sin: true });
    else void analizar(it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnalizar, pines]);

  const recalcular = useCallback(async (avisoId: string, combo: { piePct: number; plazoAnios: number }): Promise<Recalculo | null> => {
    try {
      const res = await fetch("/api/explorar/recalcular", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId, piePct: combo.piePct, plazoAnios: combo.plazoAnios }) });
      if (!res.ok) return null;
      const d = (await res.json()) as Recalculo;
      return d && typeof d.veredicto === "string" ? { veredicto: d.veredicto, score: d.score ?? null, flujo: d.flujo ?? null, cuota: d.cuota ?? null } : null;
    } catch {
      return null;
    }
  }, []);

  // La hoja se arrastra: hacia arriba abre, hacia abajo cierra; un toque alterna.
  const arrastre = useRef<number | null>(null);
  const alSoltar = (e: ReactPointerEvent) => {
    const y0 = arrastre.current;
    arrastre.current = null;
    if (y0 == null) return;
    const dy = e.clientY - y0;
    if (dy < -24) setHoja("abierta"); else if (dy > 24) setHoja("peek"); else setHoja((h) => (h === "peek" ? "abierta" : "peek"));
  };

  const ojoDe = (p: PinExplorar) => [p.comuna, p.tipologia, `${miles(p.m2)} m²`].filter(Boolean).join(" · ");
  const veredictoDe = (p: PinExplorar) => `${etiquetaVeredicto(p.veredicto, "frase")}${p.score != null ? ` · ${p.score}` : ""}`;
  const usa = botonAnalizar(datos.saldo);
  // Una combinación que la noche no tiene, mientras el servidor la calcula: la píldora y la hoja lo dicen.
  const calculando = (cargando !== null || !!datos.calculando) && !esCombinacionDeLaNoche(filtros);
  const visibles = hoja === "abierta" ? pines.slice(0, TOPE_LISTA) : pines.slice(0, TOPE_HOJA);
  const rangoActual = RANGOS_UF.find((r) => (r.min ?? 0) === filtros.ufMin && r.max === filtros.ufMax)?.id ?? "";
  const comunasLibres = (COMUNAS_DISPONIBLES as readonly string[]).filter((c) => !DESTACADAS.includes(c));
  const abrirPop = (p: "comuna" | "tipologia") => setPop((x) => (x === p ? null : p));
  const revisado = textoRevisado(filtros);

  const tarjeta = (p: PinExplorar) => {
    const informe = datos.analizados[p.avisoId];
    const neg = (p.flujo ?? 0) < 0;
    return (
      <article key={p.avisoId} className="ex-tarjeta" data-explorar="tarjeta" data-aviso={p.avisoId} data-sel={p.avisoId === seleccionado ? "1" : undefined} data-analizado={informe ? "1" : undefined}>
        <button type="button" className="ex-tarjeta-cuerpo" onClick={() => seleccionar(p.avisoId)} aria-label={`${ojoDe(p)} · UF ${miles(p.precioUF)}`}>
          <span className="ex-ojo">{ojoDe(p)}</span>
          <span className="ex-fila"><b className="ex-precio">UF {miles(p.precioUF)}</b><span className="ex-ver">{veredictoDe(p)}</span></span>
          <span className={`ex-flujo${neg ? " ex-neg" : ""}`}>{p.flujo != null && <><b>{flujoTexto(p.flujo)}</b> {neg ? EXPLORAR_COPY.saleDeTuBolsillo : EXPLORAR_COPY.teQueda} · </>}{marcaDePin(p).toLowerCase()}</span>
        </button>
        {informe ? (
          <span className="ex-ya" data-explorar="ya-analizado">{EXPLORAR_COPY.yaAnalizado} · <EnlaceCarga href={`/analisis/${informe}`}>{EXPLORAR_COPY.verInforme}</EnlaceCarga></span>
        ) : (
          <button type="button" className="ex-an" onClick={() => { setError(null); setConfirmar({ it: p, sin: datos.saldo.tipo === "sin" }); }} disabled={!!generando} {...botonOcupado(generando === p.avisoId)} data-explorar="analizar">
            {generando === p.avisoId ? GUIA.analizando : EXPLORAR_COPY.analizar}
          </button>
        )}
        {error?.avisoId === p.avisoId && <p className="ex-error" role="alert">{error.texto}</p>}
      </article>
    );
  };

  const detalle = elegido && (() => {
    const p = elegido;
    const informe = datos.analizados[p.avisoId];
    const cap = capRatePct(p.arriendo, p.precioUF, datos.finanzas.uf);
    const m2 = ufPorM2(p.precioUF, p.m2);
    const neg = (p.flujo ?? 0) < 0;
    return (
      <div className="ex-detalle" data-explorar="detalle" data-aviso={p.avisoId}>
        <div className="ex-fila">
          <span className="ex-ojo">{ojoDe(p)} · {marcaDePin(p).toLowerCase()}</span>
          <button type="button" className="ex-x" aria-label={EXPLORAR_COPY.cerrar} onClick={() => setSeleccionado(null)} data-explorar="cerrar-detalle">×</button>
        </div>
        <div className="ex-fila"><b className="ex-precio-g">UF {miles(p.precioUF)}</b><span className="ex-ver ex-ver-g">{veredictoDe(p)}</span></div>
        <dl className="ex-cifras">
          <div><dt>{EXPLORAR_COPY.flujo}</dt><dd data-neg={neg ? "1" : undefined}>{p.flujo != null ? flujoTexto(p.flujo) : "—"}{p.flujo != null && <small>{neg ? EXPLORAR_COPY.saleDeTuBolsillo : EXPLORAR_COPY.teQueda}</small>}</dd></div>
          <div><dt>{EXPLORAR_COPY.capRate}</dt><dd>{cap != null ? pctUno(cap) : "—"}</dd></div>
          <div><dt>{EXPLORAR_COPY.ufM2}</dt><dd>{m2 != null ? `${miles(m2)} UF` : "—"}</dd></div>
        </dl>
        <p className="ex-revisado" data-explorar="revisado">{revisado.antes}<strong>{revisado.enlace}</strong>.</p>
        {informe ? (
          <EnlaceCarga href={`/analisis/${informe}`} className="ex-cta-enlace" data-explorar="ver-informe">{EXPLORAR_COPY.yaAnalizado} · {EXPLORAR_COPY.verInforme}</EnlaceCarga>
        ) : (
          <button type="button" className="ex-cta" onClick={() => { setError(null); setConfirmar({ it: p, sin: datos.saldo.tipo === "sin" }); }} disabled={!!generando} {...botonOcupado(generando === p.avisoId)} data-explorar="analizar-detalle">
            {generando === p.avisoId ? GUIA.analizando : usa}
          </button>
        )}
        {error?.avisoId === p.avisoId && <p className="ex-error" role="alert">{error.texto}</p>}
      </div>
    );
  })();

  return (
    <div className="ex" data-explorar="cliente" data-cargando={cargando ?? undefined}>
      {/* ── los chips ── */}
      <div className="ex-chips" role="group" aria-label="Filtros">
        <button type="button" className="ex-chip" aria-expanded={pop === "comuna"} aria-haspopup="dialog" onClick={() => abrirPop("comuna")} {...chipOcupado(cargando === "comuna")} data-chip="comuna">{etiquetaComunas(filtros.comunas)}</button>
        <button type="button" className="ex-chip" aria-expanded={pop === "tipologia"} aria-haspopup="dialog" onClick={() => abrirPop("tipologia")} {...chipOcupado(cargando === "tipologia")} data-chip="tipologia">{etiquetaTipologias(filtros.tipologias)}</button>
        <label className="ex-chip" {...chipOcupado(cargando === "rango")} data-chip="rango">
          <span aria-hidden="true">{etiquetaRango(filtros)}</span>
          <select aria-label={EXPLORAR_COPY.chips.rango} value={rangoActual} onChange={(e) => { const r = RANGOS_UF.find((x) => x.id === e.target.value); if (r) aplicar({ ufMin: r.min ?? 0, ufMax: r.max }, "rango"); }}>
            {!rangoActual && <option value="">{etiquetaRango(filtros)}</option>}
            {RANGOS_UF.map((r) => <option key={r.id} value={r.id}>{r.chip}</option>)}
          </select>
        </label>
        <label className="ex-chip" data-suave="1" {...chipOcupado(cargando === "pie")} data-chip="pie">
          <span aria-hidden="true">{etiquetaPie(filtros)}</span>
          <select aria-label={EXPLORAR_COPY.chips.pie} value={filtros.pie} onChange={(e) => aplicar({ pie: Number(e.target.value) as FiltrosExplorar["pie"] }, "pie")}>
            {PIES_EXPLORAR.map((p) => <option key={p} value={p}>{etiquetaPie({ pie: p })}</option>)}
          </select>
        </label>
        <label className="ex-chip" data-suave="1" {...chipOcupado(cargando === "plazo")} data-chip="plazo">
          <span aria-hidden="true">{etiquetaPlazo(filtros)}</span>
          <select aria-label={EXPLORAR_COPY.chips.plazo} value={filtros.plazo} onChange={(e) => aplicar({ plazo: Number(e.target.value) as FiltrosExplorar["plazo"] }, "plazo")}>
            {PLAZOS_EXPLORAR.map((z) => <option key={z} value={z}>{etiquetaPlazo({ plazo: z })}</option>)}
          </select>
        </label>
        <span className="ex-chips-fin" aria-hidden="true" />
      </div>
      {pop && (
        <>
          <div className="ex-velo" onClick={() => setPop(null)} aria-hidden="true" />
          <div className="ex-pop" role="dialog" aria-label={pop === "comuna" ? EXPLORAR_COPY.chips.comuna : EXPLORAR_COPY.chips.tipologia} data-explorar={`pop-${pop}`}>
            {pop === "comuna" ? (
              <>
                <p className="ex-pop-t">{EXPLORAR_COPY.chips.comuna}<span className="ex-pop-ayuda">{EXPLORAR_COPY.chips.hasta(MAX_COMUNAS_PERFIL)}</span></p>
                <div className="ex-pop-chips" role="group">
                  {[...filtros.comunas, ...DESTACADAS.filter((c) => !filtros.comunas.includes(c)), ...comunasLibres.filter((c) => !filtros.comunas.includes(c))].map((c) => {
                    const activa = filtros.comunas.includes(c);
                    return (
                      <button key={c} type="button" role="checkbox" aria-checked={activa} className="ex-pop-chip" disabled={!activa && filtros.comunas.length >= MAX_COMUNAS_PERFIL}
                        onClick={() => { const comunas = activa ? filtros.comunas.filter((x) => x !== c) : [...filtros.comunas, c]; if (comunas.length > 0) aplicar({ comunas }, "comuna"); }}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p className="ex-pop-t">{EXPLORAR_COPY.chips.tipologia}</p>
                <div className="ex-pop-chips" role="group">
                  {TIPOLOGIAS_DEPTOS.map((t) => {
                    const activa = filtros.tipologias.includes(t.id);
                    return (
                      <button key={t.id} type="button" role="checkbox" aria-checked={activa} className="ex-pop-chip"
                        onClick={() => { const tipologias = activa ? filtros.tipologias.filter((x) => x !== t.id) : [...filtros.tipologias, t.id]; if (tipologias.length > 0) aplicar({ tipologias }, "tipologia"); }}>
                        {t.chip}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <div className="ex-pop-fin"><button type="button" className="ex-pop-listo" onClick={() => setPop(null)}>{EXPLORAR_COPY.chips.listo}</button></div>
          </div>
        </>
      )}

      <div className="ex-cuerpo">
        {/* ── el mapa (después del primer pintado) ── */}
        <div className="ex-mapa-wrap" data-mapa={mapa}>
          {/* El mapa quieto: lo más grande del primer cuadro (el LCP), dibujado por el servidor; debajo del mapa real. */}
          {mapaQuieto}
          {mapaListo && mapa !== "fallo" && (
            <MapaExplorar pines={pines} analizados={analizadosSet} seleccionado={seleccionado} comuna={filtros.comunas[0] ?? null} onSeleccionar={seleccionar} onEstado={setMapa} />
          )}
          {mapa === "fallo" && <p className="ex-mapa-vacio" data-explorar="sin-mapa">{EXPLORAR_COPY.sinMapa}</p>}
          <div className="ex-pildoras">
            <span className="ex-pildora" data-explorar="pildora" data-cargando={cargando ? "1" : undefined} aria-live="polite">
              {calculando ? EXPLORAR_COPY.calculando : <>{datos.analizadosN > 0 && <span className="ex-punto-azul" aria-hidden="true" />}{pildora(total, datos.analizadosN)}</>}
            </span>
            <EnlaceCarga href="/dashboard" className="ex-pildora" data-explorar="volver">← {EXPLORAR_COPY.volver}</EnlaceCarga>
          </div>
          {!datos.desdePerfil && <p className="ex-aviso-perfil" data-explorar="sin-perfil">{EXPLORAR_COPY.sinPerfil}</p>}
        </div>

        {/* ── la hoja ── */}
        <section className="ex-hoja" data-explorar="hoja" data-hoja={hoja} aria-label={tituloHoja(total)}>
          <button type="button" className="ex-asa-btn" aria-label={hoja === "peek" ? "Abrir la lista" : "Cerrar la lista"} onPointerDown={(e) => { arrastre.current = e.clientY; }} onPointerUp={alSoltar} onPointerCancel={() => { arrastre.current = null; }}>
            <span className="ex-asa" aria-hidden="true" />
          </button>
          {detalle ?? (
            <>
              <div className="ex-hoja-cab">
                <h2 className="ex-hoja-t" data-explorar="titulo-hoja" data-calculando={calculando ? "1" : undefined}>{calculando ? EXPLORAR_COPY.calculando : tituloHoja(total)}</h2>
                <span className="ex-hoja-orden">{EXPLORAR_COPY.ordenados}</span>
              </div>
              {fallo && <p className="ex-error" role="alert" data-explorar="error">{EXPLORAR_COPY.error} <button type="button" className="underline" onClick={() => { setCargando("todo"); void cargar(filtros, false).finally(() => setCargando(null)); }}>{EXPLORAR_COPY.reintentar}</button></p>}
              {pines.length === 0 ? (calculando ? null : <p className="ex-vacia" data-explorar="vacia">{EXPLORAR_COPY.vacia}</p>) : (
                <div className="ex-tarjetas" data-explorar="tarjetas">{visibles.map(tarjeta)}</div>
              )}
              <p className="ex-saldo" data-explorar="saldo">{lineaSaldo(datos.saldo)}</p>
            </>
          )}
        </section>
      </div>

      {confirmar && (
        <AvisoAntesDeAnalizar
          depto={{ comuna: confirmar.it.comuna, tipologia: confirmar.it.tipologia, m2: confirmar.it.m2, precioUF: confirmar.it.precioUF }}
          combinacion={{ piePct: filtros.pie, plazoAnios: filtros.plazo }}
          finanzas={{ tasa: datos.finanzas.tasa, uf: datos.finanzas.uf, arriendo: confirmar.it.arriendo }}
          uso={confirmar.sin ? { tipo: "sin" } : datos.saldo}
          compras={compras(confirmar.it.avisoId)}
          ticketConSaldo={ticketConSaldo}
          rutaCompra={compras(confirmar.it.avisoId).pack.href}
          analizando={!!confirmar.analizando}
          cambio={{ recalcular: (combo) => recalcular(confirmar.it.avisoId, combo), base: { veredicto: confirmar.it.veredicto, score: confirmar.it.score, flujo: confirmar.it.flujo } }}
          alAnalizar={(eleccion) => void analizar(confirmar.it, eleccion)}
          alCancelar={() => { if (!confirmar.analizando) setConfirmar(null); }}
        />
      )}
      {avisoSinSaldo && !confirmar && (
        <AvisoSinSaldoExplorar
          n={total}
          compras={compras()}
          vence={datos.ticket && datos.cuentaCreadaAt ? cuandoVenceCorto(datos.cuentaCreadaAt) : null}
          yendo={yendo}
          alIr={setYendo}
          alCerrar={() => setAvisoSinSaldo(false)}
        />
      )}
    </div>
  );
}
