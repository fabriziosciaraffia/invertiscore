"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA ASESORÍA EN EL MAPA · ENTREGA 1 (27-nov-2026, láminas P0–P7, Burbuja y Recorrido; decisiones de Fabrizio del 27-nov). Solo
// chips, sin IA ni texto libre. Detrás del interruptor (acceso.ts): la página la monta solo si está habilitada para esta visita.
//   · LA BURBUJA reemplaza a la bienvenida sin cuenta y aparece cuando ya miró deptos (explorar-cliente decide `lista`: 2 tarjetas
//     abiertas, o 20 s con 2 movimientos del mapa). Cerrada, queda chica en la esquina con «Retomar».
//   · LAS SEIS PREGUNTAS: experiencia, objetivo, «Tus números» (una tarjeta y «Listo», después la fórmula), cuánto pone al mes
//     (el slider de altos fijos), dónde y la lupa. P4 (usado o proyecto) está construido pero escondido (PROYECTOS_VISIBLE).
//   · LA BARRA de avance siempre a la vista; UNA pantalla, UN paso: un solo botón principal que dice adónde lleva.
//   · LA CUENTA EN VIVO sobre el mapa («X de 19.056 calzan contigo»), calculada en el navegador: la capacidad no sale de él; al
//     servidor viaja solo el alto del slider (aporte.ts) y él devuelve id con la máscara de los cuatro plazos.
//   · EL CIERRE crea la cuenta con el regalo de siempre (la hoja de registro); con cuenta, el perfil (tipo, capacidad, estrés y
//     avisos) y sus 3 deptos, con «Ver en el mapa» que abre la tarjeta de siempre con su botón.
// Todo con `ph-no-capture` (la grabación de PostHog no ve ni los chips) y eventos sin montos (eventos.ts).
// ─────────────────────────────────────────────────────────────────────────────
import "./asesoria.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePostHog } from "@/lib/posthog-react";
import type { PinMapa } from "@/lib/explorar/portal";
import type { ConteoClases } from "@/lib/explorar/mapa-todos";
import { cargarReferencias, type DatosComunas } from "@/lib/explorar/capas-referencia";
import {
  APORTES, BARRAS_N, BARRAS_PASO, idsDelPlazo, type Aporte, type PlazoMascara, type RespuestaAporte,
} from "@/lib/asesoria/aporte";
import {
  CHIPS_DEUDAS, CHIPS_EDAD, CHIPS_PIE, CHIPS_PREAPROBACION, CHIPS_RENTA, CHIPS_TIPO_RENTA, avisosDelPerfil, capacidad, edadDeChip,
  numerosValidos, type Capacidad, type Numeros, type TipoPerfil,
} from "@/lib/asesoria/capacidad";
import { ASESORIA_COPY as C, fraccion, miles, pesos, uf as fUF } from "@/lib/asesoria/copy";
import {
  ESTADO_INICIAL, PROYECTOS_VISIBLE, avanceBarra, guardarEstado, leerEstado, listoParaPerfil, pedidoPerfil,
  type EstadoAsesoria, type Lupa, type ModoDonde, type Paso,
} from "@/lib/asesoria/estado";
import { EVENTOS_ASESORIA, propsBase, propsPaso } from "@/lib/asesoria/eventos";
import { cercaDe, cercaDelMetro, comunaEn, comunasQueMasRinden, RADIO_PEGA_M } from "@/lib/asesoria/lugar";
import type { MarcasMapa } from "../mapa-explorar";

export interface FiltroAsesoria { ids: Set<string> | null; marcas: MarcasMapa | null }

interface Agregados { rinde: Array<{ comuna: string; cap: number; n: number }>; dist: Record<string, number[]> | null; total: number | null; tasa: number; uf: number }
interface Resultado {
  tipo: TipoPerfil;
  capacidad: Capacidad;
  estres: { subeTasaCLP: number; mesVacioCLP: number | null };
  tres: Array<{ id: string; porQue: "rinde" | "pide_menos" | "distinto" | "otro"; comuna: string; dormitorios: number; precioUF: number; flujo: number | null; cap: number | null }>;
  plazo: number;
  conveniencia: { x: number; y: number } | null;
  palanca: { tipo: "aporte"; aporte: number; n: number } | { tipo: "pie"; pieUF: number; n: number } | null;
}

const almacen = () => (typeof window === "undefined" ? null : window.sessionStorage);
const tipologia = (d: number) => (d === 0 ? "Estudio" : `${d}D`);

export function Asesoria(p: {
  esPrueba: boolean;
  sinCuenta: boolean;
  /** Las tres clases de la vista global (el gancho y «de 19.056»). */
  conteo: ConteoClases | null;
  /** Los Comprar del universo cargado (sin el filtro de la asesoría). */
  comprar: readonly PinMapa[];
  /** Ya miró deptos: puede aparecer la burbuja. */
  lista: boolean;
  /** El último toque del mapa fuera de un pin. */
  toque: { lat: number; lng: number; t: number } | null;
  alFiltrar: (f: FiltroAsesoria | null) => void;
  alRegistrar: (r: { comunas: string[]; topeUF: number }) => void;
  alVerDepto: (avisoId: string) => void;
}) {
  const posthog = usePostHog();
  const [e, setE] = useState<EstadoAsesoria | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState(false);
  const [agregados, setAgregados] = useState<Agregados | null>(null);
  const [respuestas, setRespuestas] = useState<Record<number, RespuestaAporte>>({});
  const [topado, setTopado] = useState(false);
  const [numerosAbiertos, setNumerosAbiertos] = useState(false);
  const [esperandoPega, setEsperandoPega] = useState(false);
  const [comunas, setComunas] = useState<DatosComunas | null>(null);
  const [burbujaVista, setBurbujaVista] = useState(false);
  const pedidas = useRef(new Set<number>());

  // El estado guardado de esta pestaña (después del primer pintado: el servidor no lo sabe).
  useEffect(() => { setE(leerEstado(almacen())); }, []);
  const cambiar = useCallback((f: (x: EstadoAsesoria) => EstadoAsesoria) => {
    setE((x) => { const n = f(x ?? ESTADO_INICIAL); guardarEstado(almacen(), n); return n; });
  }, []);
  const prueba = p.esPrueba;
  const capture = useCallback((ev: string, props: Record<string, string | number | boolean>) => { posthog?.capture(ev, props); }, [posthog]);

  // La burbuja: una vez que ya miró deptos, sin estado previo.
  const visible: "nada" | "burbuja" | "chica" | "abierta" = e ? (e.cerrada ? "chica" : "abierta") : p.lista && p.sinCuenta ? "burbuja" : "nada";
  useEffect(() => {
    if (visible === "burbuja" && !burbujaVista) { setBurbujaVista(true); capture(EVENTOS_ASESORIA.burbujaVista, propsBase(prueba)); }
  }, [visible, burbujaVista, capture, prueba]);

  // Los agregados (cap rate por comuna, la distribución del slider, la tasa y la UF): al abrir.
  useEffect(() => {
    if (visible !== "abierta" || agregados) return;
    let vivo = true;
    void fetch("/api/asesoria/agregados", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (vivo && d) setAgregados(d as Agregados); }).catch(() => {});
    return () => { vivo = false; };
  }, [visible, agregados]);
  // Las comunas del mapa (para tocar en «Dónde»): las mismas de la capa de referencia.
  useEffect(() => { if (e?.paso === "donde" && !comunas) void cargarReferencias().then((r) => setComunas(r.comunas)); }, [e?.paso, comunas]);

  const numeros = e && numerosValidos(e.numeros) ? (e.numeros as Numeros) : null;
  const cap = useMemo(() => (numeros && agregados ? capacidad(numeros, { tasaPct: agregados.tasa, uf: agregados.uf }) : null), [numeros, agregados]);
  const plazo = (numeros ? edadDeChip(numeros.edad).plazo : 30) as PlazoMascara;
  const aporte = e?.aporte ?? null;

  // El aporte: un alto del slider por pedido, con su respuesta recordada.
  useEffect(() => {
    if (aporte == null || respuestas[aporte] || pedidas.current.has(aporte)) return;
    const t = window.setTimeout(() => {
      pedidas.current.add(aporte);
      void fetch("/api/asesoria/aporte", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aporte }) })
        .then(async (r) => {
          if (r.status === 429) { setTopado(true); pedidas.current.delete(aporte); return; }
          if (!r.ok) { pedidas.current.delete(aporte); return; }
          const d = (await r.json()) as RespuestaAporte;
          setTopado(false);
          setRespuestas((x) => ({ ...x, [aporte]: d }));
        }).catch(() => { pedidas.current.delete(aporte); });
    }, 250);
    return () => window.clearTimeout(t);
  }, [aporte, respuestas]);

  // ── LO QUE CALZA, en el navegador ──
  const pasoN = e ? PASO_N[e.paso] : 0;
  const idsAporte = aporte != null && respuestas[aporte] ? idsDelPlazo(respuestas[aporte], plazo) : null;
  const enLugar = useMemo(() => {
    const d = e?.donde;
    if (!d) return null;
    if (d.modo === "metro") return (x: PinMapa) => cercaDelMetro(x);
    if (d.modo === "pega") return d.pega ? (x: PinMapa) => cercaDe(d.pega!)(x) : null;
    return d.comunas.length ? (x: PinMapa) => d.comunas.includes(x.comuna) : null;
  }, [e?.donde]);
  const calzan = useMemo((): PinMapa[] | null => {
    if (!cap || pasoN < PASO_N.formula) return null;
    let xs = p.comprar.filter((x) => x.precioUF <= cap.topeUF);
    if (pasoN >= PASO_N.aporte && idsAporte) xs = xs.filter((x) => idsAporte.has(x.avisoId));
    if (pasoN >= PASO_N.donde && enLugar) xs = xs.filter(enLugar);
    return xs;
  }, [cap, pasoN, p.comprar, idsAporte, enLugar]);
  const convienen = p.conteo?.comprar ?? p.comprar.length;
  const total = p.conteo ? p.conteo.comprar + p.conteo.ajustar + p.conteo.no : null;

  // El filtro del mapa: los que calzan y, en «Dónde», las marcas. En el perfil, sus 3.
  const marcas: MarcasMapa | null = e?.paso === "donde" || (e?.donde && pasoN >= PASO_N.donde && pasoN < PASO_N.perfil)
    ? { todas: e?.paso === "donde", comunas: e?.donde?.modo === "comunas" || e?.donde?.modo === "rinde" ? e.donde.comunas : [], pega: e?.donde?.pega ? { ...e.donde.pega, radioM: RADIO_PEGA_M } : null }
    : null;
  const claveFiltro = visible === "nada" || visible === "burbuja" ? "nada"
    : e?.paso === "perfil" && resultado ? `perfil|${visible}|${resultado.tres.map((t) => t.id).join()}`
    : `${visible}|${calzan ? calzan.length : "-"}|${calzan?.[0]?.avisoId ?? ""}|${JSON.stringify(marcas)}`;
  useEffect(() => {
    if (visible === "nada" || visible === "burbuja") { p.alFiltrar(null); return; }
    if (e?.paso === "perfil") { p.alFiltrar(resultado && visible === "abierta" ? { ids: new Set(resultado.tres.map((t) => t.id)), marcas: null } : null); return; }
    p.alFiltrar({ ids: calzan ? new Set(calzan.map((x) => x.avisoId)) : null, marcas });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveFiltro]);

  // «Dónde»: tocar el mapa elige o quita una comuna, o pone el punto de la pega.
  const ultimoToque = useRef<number>(0);
  useEffect(() => {
    if (!p.toque || p.toque.t === ultimoToque.current || e?.paso !== "donde") return;
    ultimoToque.current = p.toque.t;
    if (esperandoPega) {
      setEsperandoPega(false);
      cambiar((x) => ({ ...x, donde: { modo: "pega", comunas: [], pega: { lat: p.toque!.lat, lng: p.toque!.lng } } }));
      return;
    }
    const c = comunaEn(p.toque.lat, p.toque.lng, comunas);
    if (!c) return;
    cambiar((x) => {
      const ya = x.donde?.modo === "comunas" ? x.donde.comunas : [];
      const nuevas = ya.includes(c) ? ya.filter((y) => y !== c) : [...ya, c];
      return { ...x, donde: nuevas.length ? { modo: "comunas", comunas: nuevas, pega: null } : null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.toque]);

  // ── EL CIERRE: con cuenta, el perfil ──
  const pedirPerfil = useCallback(async (est: EstadoAsesoria) => {
    setCargandoPerfil(true); setErrorPerfil(false);
    try {
      const r = await fetch("/api/asesoria/perfil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedidoPerfil(est)) });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as Resultado;
      setResultado(d);
      // Copiar primero, borrar después: el estado pasa a «perfil» recién con el perfil guardado.
      cambiar((x) => ({ ...x, paso: "perfil", cerrada: false }));
      capture(EVENTOS_ASESORIA.perfil, propsBase(prueba, { tipo: d.tipo }));
      capture(EVENTOS_ASESORIA.deptos, propsBase(prueba, { n: d.tres.length }));
    } catch {
      setErrorPerfil(true);
    } finally {
      setCargandoPerfil(false);
    }
  }, [cambiar, capture, prueba]);
  useEffect(() => {
    if (!e || p.sinCuenta || cargandoPerfil || resultado || errorPerfil) return;
    if ((e.paso === "cierre" || e.paso === "perfil") && listoParaPerfil(e)) void pedirPerfil(e);
  }, [e, p.sinCuenta, cargandoPerfil, resultado, errorPerfil, pedirPerfil]);

  // ── las acciones ──
  const responder = (paso: Paso, respuesta: string | null) => capture(EVENTOS_ASESORIA.paso, propsPaso(paso, respuesta, prueba));
  const partir = () => { cambiar(() => ({ ...ESTADO_INICIAL })); capture(EVENTOS_ASESORIA.abierta, propsBase(prueba)); };
  const cerrar = () => { cambiar((x) => ({ ...x, cerrada: true })); capture(EVENTOS_ASESORIA.cerrada, propsBase(prueba, { paso: e?.paso ?? "burbuja" })); };
  const cerrarBurbuja = () => { cambiar(() => ({ ...ESTADO_INICIAL, cerrada: true })); capture(EVENTOS_ASESORIA.cerrada, propsBase(prueba, { paso: "burbuja" })); };
  const retomar = () => { cambiar((x) => ({ ...x, cerrada: false })); capture(EVENTOS_ASESORIA.retomada, propsBase(prueba, { paso: e?.paso ?? "gancho" })); };

  if (visible === "nada") return null;

  if (visible === "burbuja") {
    return (
      <section className="as-raiz as-burbuja ph-no-capture" data-asesoria="burbuja" aria-label={C.burbuja.titulo}>
        <div className="as-burbuja-cab">
          <p className="as-burbuja-t"><span className="as-avatar" aria-hidden="true">F</span>{C.burbuja.titulo}</p>
          <button type="button" className="as-x" aria-label={C.cerrar} onClick={cerrarBurbuja} data-asesoria="burbuja-cerrar"><X /></button>
        </div>
        <p className="as-burbuja-c">{C.burbuja.cuerpo}</p>
        <button type="button" className="as-principal" onClick={partir} data-asesoria="partir">{C.burbuja.boton}</button>
      </section>
    );
  }

  // La cuenta sobre el mapa (láminas P0–P6): «4.513 de 19.056 convienen» hasta la fórmula; desde ahí, «1.240 de 19.056 calzan
  // contigo» con los que convienen tachados al lado.
  const cuenta = total != null && (
    <p className="as-raiz as-cuenta ph-no-capture" data-asesoria="cuenta" data-n={calzan ? calzan.length : convienen}>
      <span className="as-cuenta-n">{miles(calzan ? calzan.length : convienen)} de {miles(total)}</span>
      {calzan
        ? <span className="as-cuenta-t">{C.calzanContigo}<span className="as-cuenta-antes">{miles(convienen)}</span></span>
        : <span className="as-cuenta-t">{C.convienen}</span>}
    </p>
  );

  if (visible === "chica" || !e) {
    return (
      <>
        {cuenta}
        <button type="button" className="as-raiz as-chica ph-no-capture" onClick={retomar} data-asesoria="retomar"><span className="as-avatar" data-chico="1" aria-hidden="true">F</span>{C.retomar}</button>
      </>
    );
  }

  const av = avanceBarra(e.paso);
  return (
    <>
      {e.paso !== "perfil" && cuenta}
      <section className="as-raiz as-hoja ph-no-capture" data-asesoria="hoja" data-paso={e.paso} aria-label={C.franco}>
        <div className="as-cab">
          <div className="as-quien"><span className="as-avatar" data-chico="1" aria-hidden="true">F</span><p className="as-quien-n" data-asesoria="encabezado"><b>{C.franco}</b> · {C.encabezado}</p></div>
          <button type="button" className="as-x" style={{ margin: 0 }} aria-label={C.cerrar} onClick={cerrar} data-asesoria="cerrar"><X size={18} /></button>
        </div>
        <ol className="as-barra" aria-label="Avance" data-asesoria="barra">
          {C.segmentos.map((s, i) => <li key={s} className="as-seg" data-av={String(av[i])}><i />{s}</li>)}
        </ol>
        {e.paso === "gancho" && <Gancho conteo={p.conteo} alResponder={(x) => { responder("gancho", x); cambiar((s) => ({ ...s, experiencia: x, paso: "objetivo" })); }} />}
        {e.paso === "objetivo" && e.experiencia && <Objetivo experiencia={e.experiencia} alResponder={(x) => { responder("objetivo", x); cambiar((s) => ({ ...s, objetivo: x, paso: "numeros" })); setNumerosAbiertos(false); }} />}
        {e.paso === "numeros" && e.objetivo && !numerosAbiertos && <AntesDeNumeros objetivo={e.objetivo} agregados={agregados} alSeguir={() => setNumerosAbiertos(true)} />}
        {e.paso === "numeros" && numerosAbiertos && (
          <TusNumeros valores={e.numeros} alCambiar={(k, v) => cambiar((s) => ({ ...s, numeros: { ...s.numeros, [k]: v } }))}
            alListo={() => { responder("numeros", null); cambiar((s) => ({ ...s, paso: "formula" })); }} />
        )}
        {e.paso === "formula" && <Formula cap={cap} convienen={convienen} alcanzan={calzan?.length ?? null} plazoCorto={plazoCortoDe(agregados, plazo)} alSeguir={() => { responder("formula", null); cambiar((s) => ({ ...s, paso: PROYECTOS_VISIBLE ? "proyecto" : "aporte", aporte: s.aporte ?? 100_000 })); }} />}
        {e.paso === "aporte" && (
          <AlMes aporte={e.aporte ?? 100_000} dist={agregados?.dist?.[String(plazo)] ?? null} calzan={calzan?.length ?? null} topado={topado}
            alCambiar={(a) => cambiar((s) => ({ ...s, aporte: a }))} alSeguir={() => { responder("aporte", null); cambiar((s) => ({ ...s, paso: "donde" })); }} />
        )}
        {e.paso === "donde" && (
          <Donde aporte={e.aporte ?? 0} donde={e.donde} esperandoPega={esperandoPega}
            alModo={(m) => {
              if (m === "pega") { setEsperandoPega(true); cambiar((s) => ({ ...s, donde: null })); return; }
              setEsperandoPega(false);
              if (m === "metro") { cambiar((s) => ({ ...s, donde: { modo: "metro", comunas: [], pega: null } })); return; }
              // Donde más rinde: las comunas con mayor cap rate medio entre las que tienen deptos que calzan.
              const porComuna = new Map<string, number>();
              for (const x of calzan ?? []) porComuna.set(x.comuna, (porComuna.get(x.comuna) ?? 0) + 1);
              const cs = comunasQueMasRinden(agregados?.rinde ?? [], porComuna);
              cambiar((s) => ({ ...s, donde: cs.length ? { modo: "rinde", comunas: cs, pega: null } : null }));
            }}
            alQuitar={(c) => cambiar((s) => {
              const r = (s.donde?.comunas ?? []).filter((y) => y !== c);
              return { ...s, donde: r.length && s.donde ? { ...s.donde, comunas: r } : null };
            })}
            alListo={() => { responder("donde", e.donde?.modo ?? null); cambiar((s) => ({ ...s, paso: "lupa" })); }} />
        )}
        {e.paso === "lupa" && <LupaPaso lupa={e.lupa} alResponder={(x) => { responder("lupa", x); cambiar((s) => ({ ...s, lupa: x })); }} alSeguir={() => cambiar((s) => ({ ...s, paso: "cierre" }))} />}
        {e.paso === "cierre" && (
          <Cierre sinCuenta={p.sinCuenta} cargando={cargandoPerfil} error={errorPerfil}
            alCrear={() => { capture(EVENTOS_ASESORIA.cuenta, propsBase(prueba, { fase: "hoja" })); p.alRegistrar({ comunas: comunasDelRegistro(e, calzan), topeUF: cap?.topeUF ?? 0 }); }}
            alReintentar={() => { setErrorPerfil(false); }} />
        )}
        {e.paso === "perfil" && (
          resultado
            ? <Perfil r={resultado} numeros={numeros} experiencia={e.experiencia} lupa={e.lupa} aporte={e.aporte ?? 0} pines={p.comprar}
                alVer={(id) => { capture(EVENTOS_ASESORIA.verDepto, propsBase(prueba)); cambiar((x) => ({ ...x, cerrada: true })); p.alVerDepto(id); }} />
            : <Cierre sinCuenta={false} cargando={cargandoPerfil} error={errorPerfil} alCrear={() => {}} alReintentar={() => setErrorPerfil(false)} />
        )}
      </section>
    </>
  );
}

const PASO_N: Record<Paso, number> = { gancho: 0, objetivo: 1, numeros: 2, formula: 3, proyecto: 4, aporte: 5, donde: 6, lupa: 7, cierre: 8, perfil: 9 };

/** Las comunas que guarda el alta (perfil_busqueda del semanal): las elegidas o, con metro o pega, las de los que calzan (máx. 8). */
function comunasDelRegistro(e: EstadoAsesoria, calzan: readonly PinMapa[] | null): string[] {
  if (e.donde && (e.donde.modo === "comunas" || e.donde.modo === "rinde") && e.donde.comunas.length) return e.donde.comunas.slice(0, 8);
  const n = new Map<string, number>();
  for (const x of calzan ?? []) n.set(x.comuna, (n.get(x.comuna) ?? 0) + 1);
  return Array.from(n.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
}

function X({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

// ── P0 · el gancho ──────────────────────────────────────────────────────────
function Gancho({ conteo, alResponder }: { conteo: ConteoClases | null; alResponder: (x: "primera" | "uno" | "varios") => void }) {
  const total = conteo ? conteo.comprar + conteo.ajustar + conteo.no : null;
  return (
    <>
      <div className="as-conv" data-asesoria="paso-gancho">
        {conteo && total ? (
          <>
            <p className="as-bf">{C.gancho.revise(total, fraccion(conteo.comprar, total))}</p>
            <div className="as-tarjeta">
              <p className="as-tarjeta-t">{C.gancho.tarjeta(total)}</p>
              <div className="as-prop" aria-hidden="true">
                <span data-clase="comprar" style={{ width: `${(conteo.comprar / total) * 100}%` }} />
                <span data-clase="ajustar" style={{ width: `${(conteo.ajustar / total) * 100}%` }} />
                <span data-clase="no" />
              </div>
              <div className="as-prop-n">
                <span><b data-clase="comprar">{miles(conteo.comprar)}</b><br />{C.gancho.clases.comprar}</span>
                <span><b data-clase="ajustar">{miles(conteo.ajustar)}</b><br />{C.gancho.clases.ajustar}</span>
                <span style={{ textAlign: "right" }}><b data-clase="no">{miles(conteo.no)}</b><br />{C.gancho.clases.no}</span>
              </div>
            </div>
          </>
        ) : null}
        <p className="as-bf">{C.gancho.pregunta}</p>
      </div>
      <div className="as-chips">
        {C.experiencia.map((o) => <button key={o.id} type="button" className="as-chip" onClick={() => alResponder(o.id)} data-asesoria={`exp-${o.id}`}>{o.texto}</button>)}
      </div>
    </>
  );
}

// ── P1 · la experiencia ─────────────────────────────────────────────────────
function Objetivo({ experiencia, alResponder }: { experiencia: "primera" | "uno" | "varios"; alResponder: (x: "arriendo" | "plusvalia" | "ambas" | "no_se") => void }) {
  const texto = C.experiencia.find((o) => o.id === experiencia)!.texto;
  const P = C.primerDepto;
  return (
    <>
      <div className="as-conv" data-asesoria="paso-objetivo">
        <p className="as-bu">{texto}</p>
        <p className="as-bf">{C.reaccionExperiencia[experiencia]}</p>
        {experiencia === "primera" && (
          <div className="as-tarjeta">
            <p className="as-tarjeta-t">{P.titulo}</p>
            <div className="as-tres">
              <div><b>{P.pie}</b><span className="as-k">{P.pieK}</span></div>
              <div><b>{P.gastos}</b><span className="as-k">{P.gastosK}</span></div>
              <div><b>{P.colchon}</b><span className="as-k">{P.colchonK}</span></div>
            </div>
          </div>
        )}
        <p className="as-bf">{C.preguntaObjetivo}</p>
      </div>
      <div className="as-chips">
        {C.objetivo.map((o) => <button key={o.id} type="button" className="as-chip" onClick={() => alResponder(o.id)} data-asesoria={`obj-${o.id}`}>{o.texto}</button>)}
      </div>
    </>
  );
}

// ── P2 · el objetivo ────────────────────────────────────────────────────────
function AntesDeNumeros({ objetivo, agregados, alSeguir }: { objetivo: "arriendo" | "plusvalia" | "ambas" | "no_se"; agregados: Agregados | null; alSeguir: () => void }) {
  const texto = C.objetivo.find((o) => o.id === objetivo)!.texto;
  // Las tres comunas que más rinden y, en gris, la de más avisos (la referencia), con un número por comuna.
  const filas = useMemo(() => {
    if (!agregados?.rinde.length) return [];
    const top = agregados.rinde.slice(0, 3);
    const masAvisos = [...agregados.rinde].sort((a, b) => b.n - a.n).find((r) => !top.some((t) => t.comuna === r.comuna));
    const xs = [...top.map((r) => ({ ...r, gris: false })), ...(masAvisos ? [{ ...masAvisos, gris: true }] : [])];
    const max = Math.max(...xs.map((x) => x.cap));
    return xs.map((x) => ({ ...x, ancho: Math.round((x.cap / max) * 92) }));
  }, [agregados]);
  const pct = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  return (
    <>
      <div className="as-conv" data-asesoria="paso-numeros-antes">
        <p className="as-bu">{texto}</p>
        <p className="as-bf">{C.reaccionObjetivo[objetivo]}</p>
        {objetivo !== "plusvalia" && filas.length > 0 && (
          <div className="as-tarjeta" data-asesoria="cap-rate">
            <div className="as-formula"><b>{C.capRate.nombre}</b><span>=</span><em>{C.capRate.arriendo}</em><span>÷</span><em>{C.capRate.precio}</em></div>
            <span className="as-k">{C.capRate.bajada}</span>
            {filas.map((f) => (
              <div key={f.comuna} className="as-fila-cap" data-gris={f.gris ? "1" : undefined}><span>{f.comuna}</span><i><span style={{ width: `${f.ancho}%` }} /></i><b>{pct(f.cap)}</b></div>
            ))}
          </div>
        )}
        <p className="as-bf">{C.antesDeNumeros}</p>
      </div>
      <div className="as-pie"><button type="button" className="as-principal" onClick={alSeguir} data-asesoria="llenar-numeros">{C.llenarNumeros}</button></div>
    </>
  );
}

// ── P3 · tus números ────────────────────────────────────────────────────────
function TusNumeros({ valores, alCambiar, alListo }: { valores: Partial<Numeros>; alCambiar: (k: keyof Numeros, v: string) => void; alListo: () => void }) {
  const N = C.numeros;
  const n = Object.keys(valores).length;
  const fila = (k: keyof Numeros, titulo: string, ops: ReadonlyArray<{ id: string; texto: string }>) => (
    <div className="as-num" role="group" aria-label={titulo}>
      <span className="as-num-l">{titulo}</span>
      <div className="as-ops">
        {ops.map((o) => <button key={o.id} type="button" className="as-op" aria-pressed={valores[k] === o.id} onClick={() => alCambiar(k, o.id)} data-asesoria={`num-${k}-${o.id}`}>{o.texto}</button>)}
      </div>
    </div>
  );
  return (
    <div className="as-conv" data-asesoria="paso-numeros">
      <div className="as-tarjeta" data-fuerte="1" style={{ gap: 11 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><b style={{ fontSize: 15 }}>{N.titulo}</b><span className="as-k">{n} de 6</span></div>
        {fila("renta", N.renta, CHIPS_RENTA)}
        {fila("tipoRenta", N.tipoRenta, CHIPS_TIPO_RENTA)}
        {(valores.tipoRenta === "boletas" || valores.tipoRenta === "ambas") && <p className="as-nota" data-asesoria="nota-boletas">{C.boletas}</p>}
        {fila("edad", N.edad, CHIPS_EDAD)}
        {fila("pie", N.pie, CHIPS_PIE)}
        {fila("deudas", N.deudas, CHIPS_DEUDAS)}
        {fila("preaprobado", N.preaprobacion, CHIPS_PREAPROBACION)}
        <button type="button" className="as-principal" disabled={n < 6} onClick={alListo} data-asesoria="numeros-listo">{N.listo}</button>
      </div>
    </div>
  );
}

// ── P3 · la fórmula ─────────────────────────────────────────────────────────
/** «Con tu plazo de 20 años, convienen X de los Y»: de los agregados (cuántos, nunca cuáles). null con 30 años o sin datos. */
function plazoCortoDe(a: Agregados | null, plazo: number): { plazo: number; x: number; y: number } | null {
  const d = a?.dist?.[String(plazo)];
  if (plazo >= 30 || !d || a?.total == null) return null;
  return { plazo, x: d.reduce((s, n) => s + n, 0), y: a.total };
}

function Formula({ cap, convienen, alcanzan, plazoCorto, alSeguir }: { cap: Capacidad | null; convienen: number; alcanzan: number | null; plazoCorto: { plazo: number; x: number; y: number } | null; alSeguir: () => void }) {
  const F = C.formula;
  if (!cap) return <div className="as-conv"><p className="as-bf">…</p></div>;
  const tasa = cap.tasaPct.toLocaleString("es-CL", { maximumFractionDigits: 2 });
  const cero = cap.topeUF <= 0;
  return (
    <>
      <div className="as-conv" data-asesoria="paso-formula">
        <div className="as-tarjeta">
          <p className="as-tarjeta-t">{F.titulo}</p>
          <div className="as-paso"><span className="as-paso-n">1</span><div className="as-paso-c">
            <span>{F.porRenta({ renta: cap.rentaCLP, computable: cap.rentaComputableCLP, pctComputable: cap.rentaComputablePct, plazo: cap.plazo, tasa })}</span>
            <b>{F.porRentaCifra(cap.creditoUF, cap.pieUF, cap.porRentaUF)}</b>
          </div></div>
          <div className="as-paso"><span className="as-paso-n">2</span><div className="as-paso-c">
            <span>{cap.pieUF == null ? F.sinPie : F.porPie}</span>
            {cap.pieUF != null && cap.porPieUF != null && <b>{F.porPieCifra(cap.pieUF, cap.porPieUF)}</b>}
          </div></div>
          <div className="as-paso"><span className="as-paso-n">3</span><div className="as-paso-c">
            <span>{cero ? F.sinCuota(cap.cargaMaxPct) : F.deudas(cap.cargaPct, cap.cargaMaxPct)}</span>
            <b>{cero ? F.noPasa : F.pasa}</b>
          </div></div>
          <span className="as-k">{F.rangos}</span>
        </div>
        {cero ? <p className="as-bf">{F.cero}</p> : cap.pieUF == null ? (
          <div className="as-tarjeta" data-fuerte="1" style={{ gap: 2 }} data-asesoria="tope">
            <span className="as-k">{F.sinPieTope(cap.topeUF, cap.pieNecesarioUF ?? 0)}</span>
            <span className="as-grande">{fUF(cap.topeUF)}</span>
            <span className="as-k">{F.sujeto}</span>
          </div>
        ) : (
          <div className="as-tarjeta" data-fuerte="1" style={{ gap: 2 }} data-asesoria="tope">
            <span className="as-k">{F.manda[cap.limita]}</span>
            <span className="as-grande">{fUF(cap.topeUF)}</span>
            <span className="as-k">{F.sujeto}</span>
          </div>
        )}
        {!cero && plazoCorto && <p className="as-bf" data-asesoria="plazo-corto">{F.plazoCorto(plazoCorto.plazo, plazoCorto.x, plazoCorto.y)} {F.plazoPorQue}</p>}
        {!cero && alcanzan != null && <p className="as-bf">{F.filtre(convienen, alcanzan)}</p>}
      </div>
      <div className="as-pie"><button type="button" className="as-principal" onClick={alSeguir} data-asesoria="formula-seguir">{F.seguir}</button></div>
    </>
  );
}

// ── P5 · al mes ─────────────────────────────────────────────────────────────
const TOPE_SLIDER = APORTES[APORTES.length - 1];
const altoMasCercano = (v: number): Aporte => APORTES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), APORTES[0]);
const BARRAS_VISIBLES = TOPE_SLIDER / BARRAS_PASO + 1; // 0 (me sobra) y una cada 25 mil hasta 300 mil; la última junta lo de más

function AlMes({ aporte, dist, calzan, topado, alCambiar, alSeguir }: { aporte: Aporte; dist: number[] | null; calzan: number | null; topado: boolean; alCambiar: (a: Aporte) => void; alSeguir: () => void }) {
  const A = C.alMes;
  const barras = useMemo(() => {
    if (!dist) return null;
    const b = dist.slice(0, BARRAS_VISIBLES);
    b[BARRAS_VISIBLES - 1] = dist.slice(BARRAS_VISIBLES - 1, BARRAS_N).reduce((s, x) => s + x, 0);
    const max = Math.max(1, ...b);
    return b.map((x) => Math.max(2, Math.round((x / max) * 44)));
  }, [dist]);
  return (
    <>
      <div className="as-conv" data-asesoria="paso-aporte">
        <p className="as-bf">{A.pregunta}</p>
        <div className="as-tarjeta" data-fuerte="1" style={{ gap: 10 }}>
          <div className="as-slider-cab"><span className="as-tarjeta-t">{A.titulo}</span><b data-asesoria="aporte-valor">{aporte === 0 ? A.cero : pesos(aporte)}</b></div>
          <div>
            {barras && <div className="as-histo" aria-hidden="true">{barras.map((h, k) => <span key={k} style={{ height: h }} data-dentro={k * BARRAS_PASO <= aporte ? "1" : undefined} />)}</div>}
            <input type="range" className="as-rango" min={0} max={TOPE_SLIDER} step={BARRAS_PASO} value={aporte} aria-label={A.titulo} aria-valuetext={A.hasta(aporte)}
              onChange={(ev) => alCambiar(altoMasCercano(Number(ev.target.value)))} data-asesoria="slider" />
          </div>
          <div className="as-rango-lados as-k"><span>{A.izq}</span><span>{A.der}</span></div>
          <div className="as-calzan"><span>{A.calzan}</span><b data-asesoria="aporte-calzan">{calzan == null ? "…" : A.usados(calzan)}</b></div>
          {topado && <p className="as-error" role="status">{A.tope}</p>}
        </div>
      </div>
      <div className="as-pie"><button type="button" className="as-principal" onClick={alSeguir} data-asesoria="aporte-seguir">{A.seguir}</button></div>
    </>
  );
}

// ── P6 · dónde ──────────────────────────────────────────────────────────────
function Donde({ aporte, donde, esperandoPega, alModo, alQuitar, alListo }: {
  aporte: number; donde: EstadoAsesoria["donde"]; esperandoPega: boolean;
  alModo: (m: Exclude<ModoDonde, "comunas">) => void; alQuitar: (c: string) => void; alListo: () => void;
}) {
  const D = C.donde;
  return (
    <>
      <div className="as-conv" data-asesoria="paso-donde">
        <p className="as-bu">{C.alMes.hasta(aporte)}</p>
        <p className="as-bf">{D.pregunta}</p>
        {esperandoPega && <p className="as-bf">{D.tocaPega}</p>}
        {donde?.modo === "rinde" && <p className="as-bf">{D.rindeElegidas(donde.comunas)}</p>}
      </div>
      {donde && (donde.modo === "comunas" || donde.modo === "rinde") && donde.comunas.length > 0 && (
        <div className="as-elegidas" data-asesoria="comunas-elegidas">
          {donde.comunas.map((c) => <button key={c} type="button" className="as-elegida" onClick={() => alQuitar(c)} aria-label={`Quitar ${c}`}>{c} <X size={12} /></button>)}
        </div>
      )}
      <div className="as-chips" style={{ paddingBottom: 8 }}>
        <button type="button" className="as-chip" aria-pressed={donde?.modo === "metro"} onClick={() => alModo("metro")} data-asesoria="donde-metro">{D.metro}</button>
        <button type="button" className="as-chip" aria-pressed={donde?.modo === "rinde"} onClick={() => alModo("rinde")} data-asesoria="donde-rinde">{D.rinde}</button>
        <button type="button" className="as-chip" aria-pressed={donde?.modo === "pega" || esperandoPega} onClick={() => alModo("pega")} data-asesoria="donde-pega">{D.pega}</button>
      </div>
      <div className="as-pie"><button type="button" className="as-principal" disabled={!donde} onClick={alListo} data-asesoria="donde-listo">{D.listo}</button></div>
    </>
  );
}

// ── P7 · la lupa ────────────────────────────────────────────────────────────
function LupaPaso({ lupa, alResponder, alSeguir }: { lupa: Lupa | null; alResponder: (x: Lupa) => void; alSeguir: () => void }) {
  const L = C.lupa;
  const texto = lupa === "si" ? L.si : lupa === "no" ? L.no : lupa === "prefiero" ? L.prefiero : null;
  return (
    <>
      <div className="as-conv" data-asesoria="paso-lupa">
        <p className="as-bf">{L.pregunta}</p>
        {texto && <p className="as-bu">{texto}</p>}
        {lupa === "si" && (
          <>
            <p className="as-bf">{L.reaccionSi}</p>
            <div className="as-tarjeta" data-asesoria="lupa-pasos">
              <p className="as-tarjeta-t">{L.pasosTitulo}</p>
              {L.pasos.map((x, i) => <div key={x} className="as-lupa-paso"><i>{i + 1}</i><span>{x}</span></div>)}
            </div>
          </>
        )}
      </div>
      {lupa == null ? (
        <div className="as-chips">
          <button type="button" className="as-chip" onClick={() => alResponder("no")} data-asesoria="lupa-no">{L.no}</button>
          <button type="button" className="as-chip" onClick={() => alResponder("si")} data-asesoria="lupa-si">{L.si}</button>
          <button type="button" className="as-chip" onClick={() => alResponder("prefiero")} data-asesoria="lupa-prefiero">{L.prefiero}</button>
        </div>
      ) : (
        <div className="as-pie"><button type="button" className="as-principal" onClick={alSeguir} data-asesoria="lupa-ver">{L.ver}</button></div>
      )}
    </>
  );
}

// ── el cierre ───────────────────────────────────────────────────────────────
function Cierre({ sinCuenta, cargando, error, alCrear, alReintentar }: { sinCuenta: boolean; cargando: boolean; error: boolean; alCrear: () => void; alReintentar: () => void }) {
  if (!sinCuenta) {
    return (
      <div className="as-conv" data-asesoria="paso-cierre">
        {error ? (
          <><p className="as-error" role="alert">{C.perfil.error}</p><button type="button" className="as-principal" onClick={alReintentar}>{C.perfil.reintentar}</button></>
        ) : <p className="as-bf">{cargando ? C.perfil.cargando : C.perfil.cargando}</p>}
      </div>
    );
  }
  return (
    <>
      <div className="as-conv" data-asesoria="paso-cierre">
        <p className="as-bf">{C.cierre.titulo}</p>
        <p className="as-bf">{C.cierre.cuerpo}</p>
      </div>
      <div className="as-pie"><button type="button" className="as-principal" onClick={alCrear} data-asesoria="crear-cuenta">Crear mi cuenta</button></div>
    </>
  );
}

// ── el perfil ───────────────────────────────────────────────────────────────
function Perfil({ r, numeros, experiencia, lupa, aporte, pines, alVer }: {
  r: Resultado; numeros: Numeros | null; experiencia: EstadoAsesoria["experiencia"]; lupa: Lupa | null; aporte: number; pines: readonly PinMapa[]; alVer: (id: string) => void;
}) {
  const P = C.perfil;
  const avisos = numeros && experiencia ? avisosDelPerfil({ tipoRenta: numeros.tipoRenta, experiencia }) : (["estimacion"] as const);
  const m2De = new Map(pines.map((x) => [x.avisoId, x.m2]));
  return (
    <div className="as-conv" data-asesoria="perfil">
      <div className="as-tarjeta" data-fuerte="1">
        <span className="as-k">{P.titulo}</span>
        <p className="as-perfil-tipo" data-asesoria="perfil-tipo">{P.tipo[r.tipo]}</p>
        <span>{P.lineaTipo[r.tipo]}</span>
        <span className="as-k" style={{ marginTop: 6 }}>{P.capacidad}</span>
        <span className="as-grande" data-asesoria="perfil-tope">{fUF(r.capacidad.topeUF)}</span>
        <span className="as-k">{P.aporte(aporte)} · {P.plazo(r.plazo)}</span>
      </div>
      <div className="as-tarjeta">
        <p className="as-tarjeta-t">{P.estresTitulo}</p>
        <span>{P.subeTasa(r.estres.subeTasaCLP)}</span>
        {r.estres.mesVacioCLP != null && <span>{P.mesVacio(r.estres.mesVacioCLP)}</span>}
      </div>
      {avisos.map((a) => <p key={a} className="as-aviso">{P.avisos[a]}</p>)}
      {lupa === "si" && (
        <div className="as-tarjeta">
          <p className="as-tarjeta-t">{P.lupa}</p>
          {C.lupa.pasos.map((x, i) => <div key={x} className="as-lupa-paso"><i>{i + 1}</i><span>{x}</span></div>)}
        </div>
      )}
      <p className="as-tarjeta-t" style={{ marginTop: 6 }}>{P.tresTitulo}</p>
      {r.conveniencia && <p className="as-bf" data-asesoria="perfil-plazo-corto">{C.formula.plazoCorto(r.plazo, r.conveniencia.x, r.conveniencia.y)} {C.formula.plazoPorQue}</p>}
      {r.tres.length < 3 && <p className="as-bf" data-asesoria="perfil-menos">{r.tres.length === 0 ? P.ninguno : P.menos(r.tres.length)}</p>}
      {r.tres.length < 3 && <p className="as-bf" data-asesoria="perfil-palanca">{!r.palanca ? P.sinPalanca : r.palanca.tipo === "aporte" ? P.palancaAporte(r.palanca.aporte, r.palanca.n) : P.palancaPie(r.palanca.pieUF, r.palanca.n)}</p>}
      {r.tres.map((t) => (
        <div key={t.id} className="as-depto" data-asesoria="depto" data-aviso={t.id}>
          <span className="as-depto-por">{P.porQue[t.porQue]}</span>
          <span className="as-depto-l">{t.comuna} · {tipologia(t.dormitorios)}{m2De.get(t.id) ? ` · ${miles(m2De.get(t.id)!)} m²` : ""} · {fUF(t.precioUF)}</span>
          {t.flujo != null && <span className="as-depto-c">{P.flujo(t.flujo, r.plazo)}</span>}
          {t.cap != null && <span className="as-depto-c">{P.cap(t.cap)}</span>}
          <button type="button" className="as-depto-ver" onClick={() => alVer(t.id)} data-asesoria="ver-depto">{P.ver}</button>
        </div>
      ))}
    </div>
  );
}
