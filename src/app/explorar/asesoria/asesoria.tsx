"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA ASESORÍA EN EL MAPA (27-nov-2026, láminas P0–P7, Burbuja y Recorrido; segunda vuelta del 27-nov con la lámina «Con punch, sin
// abusar»). Solo chips, sin IA ni texto libre. Detrás del interruptor (acceso.ts): la página la monta solo si está habilitada.
//   · LA BURBUJA reemplaza a la bienvenida sin cuenta y aparece cuando ya miró deptos (explorar-cliente decide `lista`). Parte con el
//     número —«4.512 de 19.037 convienen»— en la banda del degradado. Cerrada, queda chica en la esquina con «Retomar».
//   · LAS PREGUNTAS: experiencia, objetivo, «Tus números» (una tarjeta y «Listo», después la fórmula), cuánto pone al mes, dónde y la
//     lupa. EL APORTE (C7): si con 0 al mes calzan al menos 8 de cada 10 de los que le alcanzan, la buena noticia en vez del slider.
//   · EL DEGRADADO va SOLO en la burbuja y en la tarjeta del tope; el rojo, solo en «Partir» y «Seguir con estos deptos».
//   · CADA PANTALLA ABRE CON SU PRIMER MENSAJE NUEVO ARRIBA (E15): la hoja se lee desde ahí, también en el teléfono.
//   · LA CUENTA EN VIVO sobre el mapa, calculada en el navegador: la capacidad no sale de él; al servidor viaja solo el alto del slider.
//   · EL CIERRE crea la cuenta con el regalo de siempre; con cuenta, el perfil y sus deptos —ordenados por lo que dejan al mes, con la
//     vista de la calle— y «Seguir con estos deptos», que lleva a Invierte con Franco con los tres.
// Todo con `ph-no-capture` (la grabación de PostHog no ve ni los chips) y eventos sin montos (eventos.ts).
// ─────────────────────────────────────────────────────────────────────────────
import "./asesoria.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePostHog } from "@/lib/posthog-react";
import type { PinMapa } from "@/lib/explorar/portal";
import type { ConteoClases } from "@/lib/explorar/mapa-todos";
import { cargarReferencias, type DatosComunas } from "@/lib/explorar/capas-referencia";
import { ImagenDepto, useCalle } from "@/components/guia/ImagenDepto";
import {
  APORTES, BARRAS_N, BARRAS_PASO, idsDelPlazo, sePaganSolos, type Aporte, type PlazoMascara, type RespuestaAporte,
} from "@/lib/asesoria/aporte";
import {
  CHIPS_DEUDAS, CHIPS_EDAD, CHIPS_PIE, CHIPS_PREAPROBACION, CHIPS_RENTA, CHIPS_TIPO_RENTA, avisosDelPerfil, capacidad, edadDeChip,
  numerosValidos, topeConMasPie, type Capacidad, type Numeros, type TipoPerfil,
} from "@/lib/asesoria/capacidad";
import { ASESORIA_COPY as C, fraccion, miles, pesos, uf as fUF } from "@/lib/asesoria/copy";
import {
  ESTADO_INICIAL, PROYECTOS_VISIBLE, avanceBarra, guardarEstado, leerEstado, listoParaPerfil, pedidoPerfil,
  type EstadoAsesoria, type Lupa, type ModoDonde, type Paso,
} from "@/lib/asesoria/estado";
import { EVENTOS_ASESORIA, propsBase, propsPaso } from "@/lib/asesoria/eventos";
import { cercaDelMetro, comunaEn, comunasQueMasRinden } from "@/lib/asesoria/lugar";
import { palancaFormula } from "@/lib/asesoria/palanca";
import type { TarjetaDepto } from "@/lib/asesoria/tarjetas";
import type { MarcasMapa } from "../mapa-explorar";

/** `quieto`: en «Dónde» el mapa no se reencuadra mientras se tocan comunas (saltaría bajo el dedo). `cerrada`: la hoja está cerrada y
 *  el filtro sigue puesto (el botón Filtros lo muestra y deja quitarlo, F22). */
export interface FiltroAsesoria { ids: Set<string> | null; marcas: MarcasMapa | null; quieto?: boolean; cerrada?: boolean }

interface Agregados { rinde: Array<{ comuna: string; cap: number; n: number }>; santiago: number | null; dist: Record<string, number[]> | null; total: number | null; tasa: number; uf: number }
interface Resultado {
  tipo: TipoPerfil;
  capacidad: Capacidad;
  tres: TarjetaDepto[];
  plazo: number;
  conveniencia: { x: number; y: number } | null;
  palanca: { tipo: "aporte"; aporte: number; n: number } | { tipo: "pie"; pieUF: number; n: number } | null;
}

const almacen = () => (typeof window === "undefined" ? null : window.sessionStorage);
const tipologia = (d: number) => (d === 0 ? "Estudio" : `${d}D`);
const pct1 = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

/** «Seguir con estos deptos» (D14): el primero en la dirección y los otros dos en `mas` (se suman solos al firmar la orden). */
export const urlSeguirDeptos = (ids: readonly string[]): string =>
  `/invierte/${ids[0]}?${new URLSearchParams({ desde: "explorar", ...(ids.length > 1 ? { mas: ids.slice(1).join(",") } : {}) })}`;

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
  /** La tarjeta de un depto está abierta: «Retomar» se esconde para no tapar sus botones (F23). */
  tapado?: boolean;
  /** Cambia cada vez que la persona quita el filtro de su perfil desde el botón Filtros (F22). */
  quitarFiltro?: number;
  alFiltrar: (f: FiltroAsesoria | null) => void;
  alRegistrar: (r: { comunas: string[]; topeUF: number; deptos: number }) => void;
  alVerDepto: (avisoId: string) => void;
  /** Lo que tapa la hoja sobre el mapa (para que el encuadre deje los pines a la vista); null sin hoja. */
  alTapar?: (a: { abajo: number; derecha: number } | null) => void;
}) {
  const posthog = usePostHog();
  const hojaRef = useRef<HTMLElement>(null);
  const [e, setE] = useState<EstadoAsesoria | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState(false);
  const [agregados, setAgregados] = useState<Agregados | null>(null);
  const [respuestas, setRespuestas] = useState<Record<number, RespuestaAporte>>({});
  const [topado, setTopado] = useState(false);
  const [numerosAbiertos, setNumerosAbiertos] = useState(false);
  // «Puedo poner algo al mes» (C7): abre el slider aunque la buena noticia diga que no hace falta.
  const [sliderAbierto, setSliderAbierto] = useState(false);
  const [comunas, setComunas] = useState<DatosComunas | null>(null);
  const [burbujaVista, setBurbujaVista] = useState(false);
  const pedidas = useRef(new Set<number>());
  // EL AVISO DE COOKIES (paseo del 27-nov-2026): es fijo abajo y tapaba el botón principal. Mientras se vea, la asesoría sube lo que mide.
  const [abajo, setAbajo] = useState(0);
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const medir = () => {
      const el = document.querySelector<HTMLElement>('[data-cookies="aviso"]');
      setAbajo(el ? Math.round(el.getBoundingClientRect().height) : 0);
      if (el && !ro && typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(medir); ro.observe(el); }
      if (!el && ro) { ro.disconnect(); ro = null; }
    };
    medir();
    // E18 (medición del teléfono, 27-nov-2026): el mapa agrega cientos de nodos al cargar, y medir en cada mutación forzaba un layout
    // por nodo. Ahora se mira una vez por frame, y solo se mide si el aviso apareció o desapareció (su tamaño lo sigue el ResizeObserver).
    let previo: Element | null = document.querySelector('[data-cookies="aviso"]');
    let cuadro = 0;
    const revisar = () => {
      if (cuadro) return;
      cuadro = window.requestAnimationFrame(() => {
        cuadro = 0;
        const ahora = document.querySelector('[data-cookies="aviso"]');
        if (ahora === previo) return;
        previo = ahora;
        medir();
      });
    };
    const mo = new MutationObserver(revisar);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); ro?.disconnect(); if (cuadro) window.cancelAnimationFrame(cuadro); };
  }, []);

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

  // Quitar el filtro desde el botón Filtros (F22): el mapa vuelve entero hasta «Retomar».
  const quitarVisto = useRef(p.quitarFiltro ?? 0);
  useEffect(() => {
    if (!p.quitarFiltro || p.quitarFiltro === quitarVisto.current) return;
    quitarVisto.current = p.quitarFiltro;
    cambiar((x) => ({ ...x, sinFiltro: true }));
  }, [p.quitarFiltro, cambiar]);

  const numeros = e && numerosValidos(e.numeros) ? (e.numeros as Numeros) : null;
  const cap = useMemo(() => (numeros && agregados ? capacidad(numeros, { tasaPct: agregados.tasa, uf: agregados.uf }) : null), [numeros, agregados]);
  const plazo = (numeros ? edadDeChip(numeros.edad).plazo : 30) as PlazoMascara;
  const aporte = e?.aporte ?? null;
  const pasoN = e ? PASO_N[e.paso] : 0;
  // EL ALTO QUE SE PIDE: desde el aporte, el elegido (0 mientras no abra el slider). En la fórmula, con plazo menor a 30 años, el más
  // alto del slider: así «te alcanzan» ya cuenta solo los que son Comprar a SU plazo. Sigue viajando uno de los altos fijos.
  const altoPedido: Aporte | null = pasoN >= PASO_N.aporte ? aporte : pasoN >= PASO_N.formula && plazo < 30 ? ALTO_MAXIMO : null;
  // En el aporte hace falta además el alto máximo (los que «te alcanzan», para la buena noticia).
  const altoAlcanzan: Aporte | null = e?.paso === "aporte" && plazo < 30 ? ALTO_MAXIMO : null;

  // El aporte: un alto del slider por pedido, con su respuesta recordada.
  useEffect(() => {
    const faltan = [altoPedido, altoAlcanzan].filter((a): a is Aporte => a != null && !respuestas[a] && !pedidas.current.has(a));
    if (!faltan.length) return;
    const t = window.setTimeout(() => {
      for (const alto of faltan) {
        pedidas.current.add(alto);
        void fetch("/api/asesoria/aporte", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aporte: alto }) })
          .then(async (r) => {
            if (r.status === 429) { setTopado(true); pedidas.current.delete(alto); return; }
            if (!r.ok) { pedidas.current.delete(alto); return; }
            const d = (await r.json()) as RespuestaAporte;
            setTopado(false);
            setRespuestas((x) => ({ ...x, [alto]: d }));
          }).catch(() => { pedidas.current.delete(alto); });
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [altoPedido, altoAlcanzan, respuestas]);

  // ── LO QUE CALZA, en el navegador ──
  const idsAporte = altoPedido != null && respuestas[altoPedido] ? idsDelPlazo(respuestas[altoPedido], plazo) : null;
  const enLugar = useMemo(() => {
    const d = e?.donde;
    if (!d) return null;
    if (d.modo === "metro") return (x: PinMapa) => cercaDelMetro(x);
    return d.comunas.length ? (x: PinMapa) => d.comunas.includes(x.comuna) : null;
  }, [e?.donde]);
  const calzan = useMemo((): PinMapa[] | null => {
    if (!cap || pasoN < PASO_N.formula) return null;
    let xs = p.comprar.filter((x) => x.precioUF <= cap.topeUF);
    if (idsAporte) xs = xs.filter((x) => idsAporte.has(x.avisoId));
    if (pasoN >= PASO_N.donde && enLugar) xs = xs.filter(enLugar);
    return xs;
  }, [cap, pasoN, p.comprar, idsAporte, enLugar]);
  // LOS QUE TE ALCANZAN en el aporte (los mismos de la fórmula: tope y, con plazo corto, Comprar a su plazo): la base de «X de cada 10».
  const idsAlcanzan = altoAlcanzan != null && respuestas[altoAlcanzan] ? idsDelPlazo(respuestas[altoAlcanzan], plazo) : null;
  const alcanzanAporte = useMemo((): number | null => {
    if (e?.paso !== "aporte" || !cap) return null;
    if (altoAlcanzan != null && !idsAlcanzan) return null;
    return p.comprar.filter((x) => x.precioUF <= cap.topeUF && (!idsAlcanzan || idsAlcanzan.has(x.avisoId))).length;
  }, [e?.paso, cap, altoAlcanzan, idsAlcanzan, p.comprar]);
  // Mientras no llega la respuesta del alto elegido, «Calzan» dice «…»: la cifra anterior no es la de este alto (paseo del 27-nov-2026).
  const aportePendiente = altoPedido != null && !respuestas[altoPedido];
  const convienen = p.conteo?.comprar ?? p.comprar.length;
  // Con 0 que le alcanzan, la palanca en la misma fórmula (el pie siguiente que hace aparecer alguno).
  const palancaCero = useMemo(() => (e?.paso === "formula" && cap && numeros && agregados && !aportePendiente && calzan && calzan.length === 0
    ? palancaFormula(p.comprar, numeros, { tasaPct: agregados.tasa, uf: agregados.uf }, idsAporte) : null),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [e?.paso, cap, numeros, agregados, aportePendiente, calzan, p.comprar]);
  const total = p.conteo ? p.conteo.comprar + p.conteo.ajustar + p.conteo.no : null;
  // LA BUENA NOTICIA DEL APORTE (C7): con 0 al mes (antes de abrir el slider), ¿cuántos de los que le alcanzan se pagan solos?
  const solos = e?.paso === "aporte" && !sliderAbierto && aporte === 0 && !aportePendiente && calzan && alcanzanAporte != null
    ? { ...sePaganSolos(alcanzanAporte, calzan.length), n: calzan.length, m: alcanzanAporte } : null;
  // Sin la buena noticia, el slider queda abierto: moverlo ya no vuelve a decidir (la decisión se toma una vez, con 0 al mes).
  const sinBuenaNoticia = solos != null && !solos.mostrar;
  useEffect(() => { if (sinBuenaNoticia && !sliderAbierto) setSliderAbierto(true); }, [sinBuenaNoticia, sliderAbierto]);

  // El filtro del mapa: los que calzan y, en «Dónde», las marcas. En el perfil, sus deptos. Sin filtro si la persona lo quitó (F22).
  const filtroQuitado = e?.sinFiltro === true && visible === "chica";
  const marcas: MarcasMapa | null = e?.paso === "donde" || (e?.donde && pasoN >= PASO_N.donde && pasoN < PASO_N.perfil)
    ? { todas: e?.paso === "donde", comunas: e?.donde?.modo === "comunas" || e?.donde?.modo === "rinde" ? e.donde.comunas : [] }
    : null;
  const claveFiltro = visible === "nada" || visible === "burbuja" || filtroQuitado ? "nada"
    : e?.paso === "perfil" && resultado ? `perfil|${visible}|${resultado.tres.map((t) => t.id).join()}`
    : `${visible}|${calzan ? calzan.length : "-"}|${calzan?.[0]?.avisoId ?? ""}|${JSON.stringify(marcas)}`;
  useEffect(() => {
    if (visible === "nada" || visible === "burbuja" || filtroQuitado) { p.alFiltrar(null); return; }
    if (e?.paso === "perfil") { p.alFiltrar(resultado && visible === "abierta" ? { ids: new Set(resultado.tres.map((t) => t.id)), marcas: null } : null); return; }
    p.alFiltrar({ ids: calzan ? new Set(calzan.map((x) => x.avisoId)) : null, marcas, quieto: e?.paso === "donde", cerrada: visible === "chica" && !!calzan });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveFiltro]);

  // «Dónde»: tocar el mapa elige o quita una comuna.
  const ultimoToque = useRef<number>(0);
  useEffect(() => {
    if (!p.toque || p.toque.t === ultimoToque.current || e?.paso !== "donde") return;
    ultimoToque.current = p.toque.t;
    const c = comunaEn(p.toque.lat, p.toque.lng, comunas);
    if (!c) return;
    cambiar((x) => {
      const ya = x.donde?.modo === "comunas" ? x.donde.comunas : [];
      const nuevas = ya.includes(c) ? ya.filter((y) => y !== c) : [...ya, c];
      return { ...x, donde: nuevas.length ? { modo: "comunas", comunas: nuevas } : null };
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

  // CADA PANTALLA ABRE CON SU PRIMER MENSAJE NUEVO ARRIBA (E15, decisión de Fabrizio del 27-nov-2026; reemplaza a «la conversación baja
  // sola»): el primer mensaje de Franco de lo nuevo —el marcado `data-inicio`, el último de los marcados si hay varios— queda arriba de
  // la hoja. Si todo cabe, no se mueve nada.
  const pasoVisto = `${e?.paso ?? ""}|${numerosAbiertos}|${e?.lupa ?? ""}|${resultado ? 1 : 0}|${e?.cerrada ? 1 : 0}|${sliderAbierto ? 1 : 0}|${solos ? 1 : 0}`;
  useEffect(() => {
    const conv = hojaRef.current?.querySelector<HTMLElement>(".as-conv");
    if (!conv) return;
    const t = window.setTimeout(() => { conv.scrollTop = scrollAlInicio(conv); }, 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasoVisto, agregados]);

  // LO QUE TAPA LA HOJA (paseo del 27-nov-2026: las comunas elegidas quedaban fuera de la franja del mapa que se ve).
  const alTaparRef = useRef(p.alTapar);
  alTaparRef.current = p.alTapar;
  const hayHoja = visible === "abierta";
  useEffect(() => {
    const hoja = hojaRef.current, envoltura = hoja?.offsetParent as HTMLElement | null;
    if (!hayHoja || !hoja || !envoltura) { alTaparRef.current?.(null); return; }
    const medir = () => {
      const h = hoja.getBoundingClientRect(), w = envoltura.getBoundingClientRect();
      const deLado = h.width < w.width * 0.8;
      const a = deLado ? { abajo: 0, derecha: Math.round(w.right - h.left) } : { abajo: Math.round(w.bottom - h.top), derecha: 0 };
      alTaparRef.current?.(a);
    };
    medir();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    ro?.observe(hoja);
    return () => { ro?.disconnect(); alTaparRef.current?.(null); };
  }, [hayHoja, e?.paso]);

  // «Avísame» de los nuevos: queda en el estado (viaja al crear el perfil) y, con perfil ya creado, se guarda al momento. Sin correos.
  const avisarNuevos = () => {
    cambiar((x) => ({ ...x, interesNuevos: true }));
    capture(EVENTOS_ASESORIA.nuevos, propsBase(prueba, { paso: e?.paso ?? "formula" }));
    if (!p.sinCuenta && e?.paso === "perfil") void fetch("/api/asesoria/interes-nuevos", { method: "POST" }).catch(() => {});
  };

  // ── las acciones ──
  const responder = (paso: Paso, respuesta: string | null) => capture(EVENTOS_ASESORIA.paso, propsPaso(paso, respuesta, prueba));
  const partir = () => { cambiar(() => ({ ...ESTADO_INICIAL })); capture(EVENTOS_ASESORIA.abierta, propsBase(prueba)); };
  const cerrar = () => { cambiar((x) => ({ ...x, cerrada: true })); capture(EVENTOS_ASESORIA.cerrada, propsBase(prueba, { paso: e?.paso ?? "burbuja" })); };
  const cerrarBurbuja = () => { cambiar(() => ({ ...ESTADO_INICIAL, cerrada: true })); capture(EVENTOS_ASESORIA.cerrada, propsBase(prueba, { paso: "burbuja" })); };
  const retomar = () => { cambiar((x) => ({ ...x, cerrada: false, sinFiltro: false })); capture(EVENTOS_ASESORIA.retomada, propsBase(prueba, { paso: e?.paso ?? "gancho" })); };

  if (visible === "nada") return null;

  if (visible === "burbuja") {
    const n = p.conteo && total ? C.burbuja.numero(p.conteo.comprar, total) : null;
    return (
      <section className="as-raiz as-burbuja ph-no-capture" data-asesoria="burbuja" aria-label={C.burbuja.titulo} style={{ ["--as-abajo" as string]: `${abajo}px` }}>
        <div className="as-banda" data-asesoria="burbuja-banda">
          <button type="button" className="as-x as-x-claro" aria-label={C.cerrar} onClick={cerrarBurbuja} data-asesoria="burbuja-cerrar"><X /></button>
          {n && p.conteo && total ? (
            <>
              <p className="as-banda-n"><b data-asesoria="burbuja-numero">{n.n}</b><span>{n.de}</span></p>
              <div className="as-banda-barra" aria-hidden="true"><i style={{ width: `${(p.conteo.comprar / total) * 100}%` }} /><i data-clase="ajustar" style={{ width: `${(p.conteo.ajustar / total) * 100}%` }} /></div>
              <p className="as-banda-k">{C.burbuja.revisados}</p>
            </>
          ) : <p className="as-banda-k">{C.burbuja.revisados}</p>}
        </div>
        <div className="as-burbuja-cuerpo">
          <p className="as-burbuja-t"><Icono />{C.burbuja.titulo}</p>
          <p className="as-burbuja-c">{C.burbuja.cuerpo}</p>
          <button type="button" className="as-principal" data-rojo="1" onClick={partir} data-asesoria="partir">{C.burbuja.boton}</button>
        </div>
      </section>
    );
  }

  // La cuenta sobre el mapa: «4.512 de 19.037 convienen» hasta la fórmula; desde ahí, «3.624 de los 4.512 que convienen te calzan» (F19).
  // Mientras llega la respuesta del alto, la pastilla vuelve a «convienen»: la cifra anterior no es la de este alto.
  const calzanVisto = aportePendiente ? null : calzan;
  const cuenta = total != null && (
    <p className="as-raiz as-cuenta ph-no-capture" data-asesoria="cuenta" data-n={calzanVisto ? calzanVisto.length : convienen}>
      {calzanVisto
        ? <span className="as-cuenta-t" data-asesoria="cuenta-calzan">{C.calzanDe(calzanVisto.length, convienen)}</span>
        : <><span className="as-cuenta-n">{miles(convienen)} de {miles(total)}</span><span className="as-cuenta-t">{C.convienen}</span></>}
    </p>
  );

  if (visible === "chica" || !e) {
    // Cerrada: la cuenta solo si el filtro sigue puesto (en el perfil, o quitado, el mapa ya muestra su propio contador: F23), y
    // «Retomar» se esconde mientras la tarjeta de un depto está abierta (tapaba sus botones, F23).
    const conCuenta = !!e && e.paso !== "perfil" && !filtroQuitado && !!calzan;
    return (
      <>
        {conCuenta && cuenta}
        {!p.tapado && <button type="button" className="as-raiz as-chica ph-no-capture" onClick={retomar} data-asesoria="retomar" style={{ ["--as-abajo" as string]: `${abajo}px` }}><Icono chico />{C.retomar}</button>}
      </>
    );
  }

  const av = avanceBarra(e.paso);
  return (
    <>
      {e.paso !== "perfil" && cuenta}
      <section ref={hojaRef} className="as-raiz as-hoja ph-no-capture" data-asesoria="hoja" data-paso={e.paso} aria-label={C.franco} style={{ ["--as-abajo" as string]: `${abajo}px` }}>
        <div className="as-cab">
          <div className="as-quien"><Icono chico /><p className="as-quien-n" data-asesoria="encabezado"><b>{C.franco}</b> · {C.encabezado}</p></div>
          <button type="button" className="as-x" style={{ margin: 0 }} aria-label={C.cerrar} onClick={cerrar} data-asesoria="cerrar"><X size={18} /></button>
        </div>
        {e.paso !== "perfil" && (
          <ol className="as-barra" aria-label="Avance" data-asesoria="barra">
            {C.segmentos.map((s, i) => <li key={s} className="as-seg" data-av={String(av[i])}><i />{s}</li>)}
          </ol>
        )}
        {e.paso === "gancho" && <Gancho conteo={p.conteo} alResponder={(x) => { responder("gancho", x); cambiar((s) => ({ ...s, experiencia: x, paso: "objetivo" })); }} />}
        {e.paso === "objetivo" && e.experiencia && <Objetivo experiencia={e.experiencia} alResponder={(x) => { responder("objetivo", x); cambiar((s) => ({ ...s, objetivo: x, paso: "numeros" })); setNumerosAbiertos(false); }} />}
        {e.paso === "numeros" && e.objetivo && !numerosAbiertos && <AntesDeNumeros objetivo={e.objetivo} agregados={agregados} alSeguir={() => setNumerosAbiertos(true)} />}
        {e.paso === "numeros" && numerosAbiertos && (
          <TusNumeros valores={e.numeros} alCambiar={(k, v) => cambiar((s) => ({ ...s, numeros: { ...s.numeros, [k]: v } }))}
            alListo={() => { responder("numeros", null); cambiar((s) => ({ ...s, paso: "formula" })); }} />
        )}
        {e.paso === "formula" && <Formula cap={cap} alcanzan={aportePendiente ? null : calzan?.length ?? null} plazoCorto={plazoCortoDe(agregados, plazo)} palanca={palancaCero}
            frena={cap ? topeConMasPie(cap) : null} interesNuevos={e.interesNuevos === true} alAvisar={avisarNuevos}
            alAjustar={() => { responder("formula", "ajustar"); setNumerosAbiertos(true); cambiar((s) => ({ ...s, paso: "numeros" })); }}
            alSeguir={() => { responder("formula", null); setSliderAbierto(false); cambiar((s) => ({ ...s, paso: PROYECTOS_VISIBLE ? "proyecto" : "aporte", aporte: 0 })); }} />}
        {e.paso === "aporte" && (
          solos?.mostrar && !sliderAbierto ? (
            <BuenaNoticia k={solos.k} n={solos.n} m={solos.m}
              alPoner={() => { setSliderAbierto(true); cambiar((s) => ({ ...s, aporte: 100_000 })); }}
              alSeguir={() => { responder("aporte", "solos"); cambiar((s) => ({ ...s, aporte: 0, paso: "donde" })); }} />
          ) : solos || sliderAbierto ? (
            <AlMes aporte={e.aporte ?? 0} dist={agregados?.dist?.[String(plazo)] ?? null} calzan={aportePendiente ? null : calzan?.length ?? null} topado={topado}
              alCambiar={(a) => cambiar((s) => ({ ...s, aporte: a }))} alSeguir={() => { responder("aporte", null); cambiar((s) => ({ ...s, paso: "donde" })); }} />
          ) : <div className="as-conv" data-asesoria="paso-aporte-cargando"><p className="as-bf" data-inicio="1">…</p></div>
        )}
        {e.paso === "donde" && (
          <Donde aporte={e.aporte ?? 0} donde={e.donde}
            alModo={(m) => {
              if (m === "metro") { cambiar((s) => ({ ...s, donde: { modo: "metro", comunas: [] } })); return; }
              // Donde más rinde: las comunas con mayor cap rate (la mediana) entre las que tienen deptos que calzan.
              const porComuna = new Map<string, number>();
              for (const x of calzan ?? []) porComuna.set(x.comuna, (porComuna.get(x.comuna) ?? 0) + 1);
              const cs = comunasQueMasRinden(agregados?.rinde ?? [], porComuna);
              cambiar((s) => ({ ...s, donde: cs.length ? { modo: "rinde", comunas: cs } : null }));
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
            alCrear={() => { capture(EVENTOS_ASESORIA.cuenta, propsBase(prueba, { fase: "hoja" })); p.alRegistrar({ comunas: comunasDelRegistro(e, calzan), topeUF: cap?.topeUF ?? 0, deptos: Math.min(3, calzan?.length ?? 0) }); }}
            alReintentar={() => { setErrorPerfil(false); }} />
        )}
        {e.paso === "perfil" && (
          resultado
            ? <Perfil r={resultado} numeros={numeros} experiencia={e.experiencia} lupa={e.lupa} aporte={e.aporte ?? 0} pines={p.comprar} interesNuevos={e.interesNuevos === true} alAvisar={avisarNuevos}
                alVer={(id) => { capture(EVENTOS_ASESORIA.verDepto, propsBase(prueba)); cambiar((x) => ({ ...x, cerrada: true })); p.alVerDepto(id); }}
                alSeguir={() => capture(EVENTOS_ASESORIA.seguirDeptos, propsBase(prueba, { n: resultado.tres.length }))} />
            : <Cierre sinCuenta={false} cargando={cargandoPerfil} error={errorPerfil} alCrear={() => {}} alReintentar={() => setErrorPerfil(false)} />
        )}
      </section>
    </>
  );
}

const PASO_N: Record<Paso, number> = { gancho: 0, objetivo: 1, numeros: 2, formula: 3, proyecto: 4, aporte: 5, donde: 6, lupa: 7, cierre: 8, perfil: 9 };

/** Dónde queda el scroll al abrir una pantalla (E15): el último `data-inicio` arriba, con 8 px de aire; sin marca, el primer mensaje
 *  de Franco. Exportada para el tier ASESORIA. */
export function scrollAlInicio(conv: HTMLElement): number {
  const marcas = conv.querySelectorAll<HTMLElement>("[data-inicio]");
  const el = marcas.length ? marcas[marcas.length - 1] : conv.querySelector<HTMLElement>(".as-bf, .as-tarjeta");
  if (!el) return 0;
  return Math.max(0, Math.round(el.getBoundingClientRect().top - conv.getBoundingClientRect().top + conv.scrollTop - 8));
}

/** Las comunas que guarda el alta (perfil_busqueda del semanal): las elegidas o, con metro, las de los que calzan (máx. 8). */
function comunasDelRegistro(e: EstadoAsesoria, calzan: readonly PinMapa[] | null): string[] {
  if (e.donde && (e.donde.modo === "comunas" || e.donde.modo === "rinde") && e.donde.comunas.length) return e.donde.comunas.slice(0, 8);
  const n = new Map<string, number>();
  for (const x of calzan ?? []) n.set(x.comuna, (n.get(x.comuna) ?? 0) + 1);
  return Array.from(n.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
}

function X({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

/** El ícono de Franco (G24: reemplaza a la F negra). */
function Icono({ chico = false }: { chico?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="as-avatar" data-chico={chico ? "1" : undefined} src="/icon.png" alt="" width={chico ? 32 : 36} height={chico ? 32 : 36} aria-hidden="true" />;
}

// ── P0 · el gancho ──────────────────────────────────────────────────────────
function Gancho({ conteo, alResponder }: { conteo: ConteoClases | null; alResponder: (x: "primera" | "uno" | "varios") => void }) {
  const total = conteo ? conteo.comprar + conteo.ajustar + conteo.no : null;
  return (
    <>
      <div className="as-conv" data-asesoria="paso-gancho">
        {conteo && total ? (
          <>
            <p className="as-bf" data-asesoria="gancho-revise">{C.gancho.revise(total, fraccion(conteo.comprar, total))}</p>
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
        <p className="as-bf" data-inicio="1">{C.reaccionExperiencia[experiencia]}</p>
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
  // Las tres comunas que más rinden (la mediana, sin los cap rate sobre 12 % y con al menos 15 deptos) y, en gris, todo Santiago.
  const filas = useMemo(() => {
    if (!agregados?.rinde.length) return [];
    const top = agregados.rinde.slice(0, 3).map((r) => ({ comuna: r.comuna, cap: r.cap, gris: false }));
    const xs = agregados.santiago != null ? [...top, { comuna: C.capRate.santiago, cap: agregados.santiago, gris: true }] : top;
    const max = Math.max(...xs.map((x) => x.cap));
    return xs.map((x) => ({ ...x, ancho: Math.round((x.cap / max) * 92) }));
  }, [agregados]);
  return (
    <>
      <div className="as-conv" data-asesoria="paso-numeros-antes">
        <p className="as-bu">{texto}</p>
        <p className="as-bf" data-inicio="1">{C.reaccionObjetivo[objetivo]}</p>
        {objetivo !== "plusvalia" && filas.length > 0 && (
          <div className="as-tarjeta" data-asesoria="cap-rate">
            <div className="as-formula"><b>{C.capRate.nombre}</b><span>=</span><em>{C.capRate.arriendo}</em><span>÷</span><em>{C.capRate.precio}</em></div>
            <span className="as-k">{C.capRate.bajada}</span>
            {filas.map((f) => (
              <div key={f.comuna} className="as-fila-cap" data-gris={f.gris ? "1" : undefined} data-asesoria={f.gris ? "cap-santiago" : undefined}><span>{f.comuna}</span><i><span style={{ width: `${f.ancho}%` }} /></i><b>{pct1(f.cap)}</b></div>
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
      <div className="as-tarjeta" data-fuerte="1" data-inicio="1" style={{ gap: 11 }}>
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

/** «Avísame» de los nuevos (27-nov-2026): una salida —no una pregunta— solo cuando calzan menos de 3 (C11); se guarda en el perfil. */
function OfertaNuevos({ dicho, alAvisar }: { dicho: boolean; alAvisar: () => void }) {
  if (dicho) return <p className="as-bf" data-asesoria="nuevos-listo">{C.nuevos.listo}</p>;
  return (
    <div className="as-oferta" data-asesoria="nuevos">
      <p className="as-bf">{C.nuevos.oferta}</p>
      <button type="button" className="as-depto-ver" onClick={alAvisar} data-asesoria="nuevos-avisame">{C.nuevos.boton}</button>
    </div>
  );
}

/** LA TARJETA DEL TOPE (G24): la cifra grande en la banda del degradado y, debajo, los dos límites como barras; el que manda, en azul. */
function TarjetaTope({ cap }: { cap: Capacidad }) {
  const F = C.formula;
  const filas = [
    { clave: "renta", etiqueta: cap.limita === "deudas" ? F.barraRenta.deudas : F.barraRenta.renta, valor: cap.topeRentaUF },
    ...(cap.pieUF != null && cap.topePieUF != null ? [{ clave: "pie", etiqueta: F.barraPie(cap.pieUF), valor: cap.topePieUF }] : []),
  ];
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <div className="as-tope" data-asesoria="tope">
      <div className="as-banda">
        <span className="as-banda-k">{F.puedes}</span>
        <span className="as-banda-grande" data-asesoria="tope-cifra">{fUF(cap.topeUF)}</span>
        <span className="as-banda-k">{F.sujeto}</span>
      </div>
      <div className="as-tope-filas">
        {filas.map((f) => (
          <div key={f.clave} className="as-tope-fila" data-asesoria={`tope-${f.clave}`} data-manda={f.valor === cap.topeUF ? "1" : undefined}>
            <div className="as-tope-l"><span>{f.etiqueta}</span><b>{fUF(f.valor)}</b></div>
            <i className="as-tope-barra"><span style={{ width: `${Math.round((f.valor / max) * 100)}%` }} /></i>
          </div>
        ))}
        {cap.pieUF == null && <span className="as-k" data-asesoria="tope-sin-pie">{F.sinPieTope(cap.topeUF, cap.pieNecesarioUF ?? 0)}</span>}
      </div>
    </div>
  );
}

function Formula({ cap, alcanzan, plazoCorto, palanca, frena, interesNuevos, alAvisar, alAjustar, alSeguir }: { cap: Capacidad | null; alcanzan: number | null; plazoCorto: { plazo: number; x: number; y: number } | null; palanca: { pieUF: number; n: number } | null; frena: number | null; interesNuevos: boolean; alAvisar: () => void; alAjustar: () => void; alSeguir: () => void }) {
  const F = C.formula;
  if (!cap) return <div className="as-conv"><p className="as-bf">…</p></div>;
  const tasa = cap.tasaPct.toLocaleString("es-CL", { maximumFractionDigits: 2 });
  const cero = cap.topeUF <= 0;
  return (
    <>
      <div className="as-conv" data-asesoria="paso-formula">
        <div className="as-tarjeta" data-inicio="1">
          <p className="as-tarjeta-t">{F.titulo}</p>
          <div className="as-paso"><span className="as-paso-n">1</span><div className="as-paso-c">
            <span>{F.porRenta({ renta: cap.rentaCLP, computable: cap.rentaComputableCLP, pctComputable: cap.rentaComputablePct, plazo: cap.plazo, tasa })}</span>
            <b data-asesoria="formula-renta">{F.porRentaCifra(cap.creditoUF, cap.pieUF, cap.porRentaUF)}</b>
          </div></div>
          <div className="as-paso"><span className="as-paso-n">2</span><div className="as-paso-c">
            <span>{cap.pieUF == null ? F.sinPie : F.porPie}</span>
            {cap.pieUF != null && cap.porPieUF != null && <b data-asesoria="formula-pie">{F.porPieCifra(cap.pieUF, cap.porPieUF)}</b>}
          </div></div>
          <div className="as-paso"><span className="as-paso-n">3</span><div className="as-paso-c">
            <span>{cero ? F.sinCuota(cap.cargaMaxPct) : F.deudas(cap.cargaPct, cap.cargaMaxPct)}</span>
            <b>{cero ? F.noPasa : F.pasa}</b>
          </div></div>
          <span className="as-k">{F.rangos}</span>
        </div>
        {cero ? <p className="as-bf">{F.cero}</p> : <TarjetaTope cap={cap} />}
        {!cero && frena != null && frena > cap.topeUF && <p className="as-bf" data-asesoria="formula-frena">{F.frenaPie(frena)}</p>}
        {!cero && plazoCorto && <p className="as-bf" data-asesoria="plazo-corto">{F.plazoCorto(plazoCorto.plazo, plazoCorto.x, plazoCorto.y)} {F.plazoPorQue}</p>}
        {!cero && alcanzan != null && alcanzan > 0 && <p className="as-bf" data-asesoria="formula-alcanzan">{F.filtre(alcanzan)}</p>}
        {!cero && alcanzan === 0 && <p className="as-bf" data-asesoria="formula-cero">{F.ceroDeptos}</p>}
        {!cero && alcanzan === 0 && palanca && <p className="as-bf" data-asesoria="formula-palanca">{C.perfil.palancaPie(palanca.pieUF, palanca.n)}</p>}
        {!cero && alcanzan != null && alcanzan < 3 && <OfertaNuevos dicho={interesNuevos} alAvisar={alAvisar} />}
      </div>
      {/* Con 0 que le alcanzan (o sin cuota por las deudas): dos salidas, «Ajustar mis números» (principal) y «Seguir igual». */}
      {cero || alcanzan === 0 ? (
        <div className="as-pie as-pie-dos">
          <button type="button" className="as-principal" onClick={alAjustar} data-asesoria="formula-ajustar">{F.ajustar}</button>
          <button type="button" className="as-secundario" onClick={alSeguir} data-asesoria="formula-seguir-igual">{F.seguirIgual}</button>
        </div>
      ) : (
        <div className="as-pie"><button type="button" className="as-principal" onClick={alSeguir} data-asesoria="formula-seguir">{F.seguir}</button></div>
      )}
    </>
  );
}

// ── P5 · al mes ─────────────────────────────────────────────────────────────
const TOPE_SLIDER = APORTES[APORTES.length - 1];
const ALTO_MAXIMO: Aporte = TOPE_SLIDER;
const altoMasCercano = (v: number): Aporte => APORTES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), APORTES[0]);
const BARRAS_VISIBLES = TOPE_SLIDER / BARRAS_PASO + 1; // 0 (nada) y una cada 25 mil hasta 300 mil; la última junta lo de más

/** LA BUENA NOTICIA (C7, lámina 4): la tarjeta azul suave con el anillo; «Seguir» principal y «Puedo poner algo al mes» aparte. */
function BuenaNoticia({ k, n, m, alPoner, alSeguir }: { k: number; n: number; m: number; alPoner: () => void; alSeguir: () => void }) {
  const A = C.alMes;
  const s = A.solos(k);
  const R = 26, L = 2 * Math.PI * R;
  return (
    <>
      <div className="as-conv" data-asesoria="paso-aporte-solos">
        <div className="as-buena" data-inicio="1">
          <div className="as-buena-cab">
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="as-anillo">
              <circle cx="32" cy="32" r={R} fill="none" strokeWidth="9" data-fondo="1" />
              <circle cx="32" cy="32" r={R} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${((L * k) / 10).toFixed(1)} ${L.toFixed(1)}`} transform="rotate(-90 32 32)" />
            </svg>
            <div><b className="as-buena-n" data-asesoria="solos-k">{s.grande}</b><span>{s.chico}</span></div>
          </div>
          <p className="as-buena-l" data-asesoria="solos-linea">{A.solosLinea(n, m)}</p>
        </div>
        <p className="as-bf">{A.noPones}</p>
      </div>
      <div className="as-pie as-pie-dos">
        <button type="button" className="as-secundario" data-azul="1" onClick={alPoner} data-asesoria="aporte-poner">{A.puedoPoner}</button>
        <button type="button" className="as-principal" onClick={alSeguir} data-asesoria="aporte-seguir">{A.seguir}</button>
      </div>
    </>
  );
}

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
        <p className="as-bf" data-inicio="1">{A.pregunta}</p>
        <div className="as-tarjeta" data-fuerte="1" style={{ gap: 10 }}>
          <div className="as-slider-cab"><span className="as-tarjeta-t">{A.titulo}</span><b data-asesoria="aporte-valor">{aporte === 0 ? A.cero : pesos(aporte)}</b></div>
          <div>
            {barras && <div className="as-histo" aria-hidden="true">{barras.map((h, k) => <span key={k} style={{ height: h }} data-dentro={k * BARRAS_PASO <= aporte ? "1" : undefined} />)}</div>}
            <input type="range" className="as-rango" min={0} max={TOPE_SLIDER} step={BARRAS_PASO} value={aporte} aria-label={A.titulo} aria-valuetext={A.hasta(aporte)}
              onChange={(ev) => alCambiar(altoMasCercano(Number(ev.target.value)))} data-asesoria="slider" />
          </div>
          <div className="as-rango-lados as-k"><span data-asesoria="slider-izq">{A.izq}</span><span>{A.der}</span></div>
          <div className="as-calzan"><span>{A.calzan}</span><b data-asesoria="aporte-calzan">{calzan == null ? "…" : A.usados(calzan)}</b></div>
          {topado && <p className="as-error" role="status">{A.tope}</p>}
        </div>
      </div>
      <div className="as-pie"><button type="button" className="as-principal" onClick={alSeguir} data-asesoria="aporte-seguir">{A.seguir}</button></div>
    </>
  );
}

// ── P6 · dónde ──────────────────────────────────────────────────────────────
function Donde({ aporte, donde, alModo, alQuitar, alListo }: {
  aporte: number; donde: EstadoAsesoria["donde"];
  alModo: (m: Exclude<ModoDonde, "comunas">) => void; alQuitar: (c: string) => void; alListo: () => void;
}) {
  const D = C.donde;
  return (
    <>
      <div className="as-conv" data-asesoria="paso-donde">
        <p className="as-bu">{aporte === 0 ? C.perfil.aporte(0) : C.alMes.hasta(aporte)}</p>
        <p className="as-bf" data-inicio="1">{D.pregunta}</p>
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
        <p className="as-bf" data-inicio="1">{L.pregunta}</p>
        {texto && <p className="as-bu">{texto}</p>}
        {lupa === "si" && (
          <>
            <p className="as-bf" data-inicio="1">{L.reaccionSi}</p>
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
        ) : <p className="as-bf" data-inicio="1">{cargando ? C.perfil.cargando : C.perfil.cargando}</p>}
      </div>
    );
  }
  // El título y la bajada («Tu perfil y tus 3 deptos están listos.») van en la hoja de registro (F21); el chat de atrás no los repite.
  return (
    <>
      <div className="as-conv" data-asesoria="paso-cierre">
        <p className="as-bf" data-inicio="1" data-asesoria="cierre-chat">{C.cierre.chat}</p>
      </div>
      <div className="as-pie"><button type="button" className="as-principal" onClick={alCrear} data-asesoria="crear-cuenta">{C.cierre.boton}</button></div>
    </>
  );
}

// ── el perfil ───────────────────────────────────────────────────────────────
/** LA FOTO DE UN DEPTO (decisión de Fabrizio, 27-nov-2026): la vista de la calle con su rótulo —o el mapa chico si no hay—, la misma
 *  imagen y la misma caché de la tarjeta del mapa (ImagenDepto). Se pide SOLO cuando la tarjeta entra en pantalla. */
function FotoDepto({ id }: { id: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [enPantalla, setEnPantalla] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || enPantalla) return;
    if (typeof IntersectionObserver === "undefined") { setEnPantalla(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { setEnPantalla(true); io.disconnect(); } }, { root: el.closest(".as-conv"), rootMargin: "80px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [enPantalla]);
  const tipos = useCalle(enPantalla ? [id] : []);
  return (
    <span ref={ref} className="as-foto" data-asesoria="foto" data-en-pantalla={enPantalla ? "1" : undefined}>
      {enPantalla && <ImagenDepto avisoId={id} tipo={tipos[id]} clase="as-foto-img" carga="lazy" />}
      <span className="as-foto-chip">{C.perfil.comprar}</span>
    </span>
  );
}

function Perfil({ r, numeros, experiencia, lupa, aporte, pines, interesNuevos, alAvisar, alVer, alSeguir }: {
  r: Resultado; numeros: Numeros | null; experiencia: EstadoAsesoria["experiencia"]; lupa: Lupa | null; aporte: number; pines: readonly PinMapa[]; interesNuevos: boolean; alAvisar: () => void; alVer: (id: string) => void; alSeguir: () => void;
}) {
  const P = C.perfil;
  const avisos = numeros && experiencia ? avisosDelPerfil({ tipoRenta: numeros.tipoRenta, experiencia }) : (["estimacion"] as const);
  const m2De = new Map(pines.map((x) => [x.avisoId, x.m2]));
  return (
    <>
      <div className="as-conv" data-asesoria="perfil">
        <div className="as-perfil-cab" data-inicio="1">
          <span className="as-k" data-asesoria="perfil-tipo">{P.titulo} · {P.tipo[r.tipo]}</span>
          <p className="as-perfil-tope" data-asesoria="perfil-tope">{P.encabezadoDeptos(r.capacidad.topeUF, r.tres.length)}</p>
          <span className="as-perfil-l">{P.lineaTipo[r.tipo]}</span>
          <span className="as-k">{P.aporte(aporte)} · {P.plazo(r.plazo)}</span>
        </div>
        {numeros && <p className="as-aviso" data-asesoria="perfil-preaprobacion">{P.preaprobacion[numeros.preaprobado]}</p>}
        {avisos.map((a) => <p key={a} className="as-aviso">{P.avisos[a]}</p>)}
        {lupa === "si" && (
          <div className="as-tarjeta">
            <p className="as-tarjeta-t">{P.lupa}</p>
            {C.lupa.pasos.map((x, i) => <div key={x} className="as-lupa-paso"><i>{i + 1}</i><span>{x}</span></div>)}
          </div>
        )}
        {r.conveniencia && <p className="as-bf" data-asesoria="perfil-plazo-corto">{C.formula.plazoCorto(r.plazo, r.conveniencia.x, r.conveniencia.y)} {C.formula.plazoPorQue}</p>}
        {r.tres.length < 3 && <p className="as-bf" data-asesoria="perfil-menos">{r.tres.length === 0 ? P.ninguno : P.menos(r.tres.length)}</p>}
        {r.tres.length < 3 && <p className="as-bf" data-asesoria="perfil-palanca">{!r.palanca ? P.sinPalanca : r.palanca.tipo === "aporte" ? P.palancaAporte(r.palanca.aporte, r.palanca.n) : P.palancaPie(r.palanca.pieUF, r.palanca.n)}</p>}
        {r.tres.length < 3 && <OfertaNuevos dicho={interesNuevos} alAvisar={alAvisar} />}
        {r.tres.map((t) => {
          const m2 = m2De.get(t.id);
          const flujo = t.flujo != null ? P.flujo(t.flujo) : null;
          return (
            <div key={t.id} className="as-depto" data-asesoria="depto" data-aviso={t.id}>
              <FotoDepto id={t.id} />
              <div className="as-depto-d">
                {(t.masBarato || t.metro) && (
                  <span className="as-depto-etq" data-asesoria="depto-etiquetas">
                    {t.masBarato && <span data-asesoria="etq-barato">{P.masBarato}</span>}
                    {t.metro && <span data-asesoria="etq-metro">{P.metro(t.metro.nombre, t.metro.m)}</span>}
                  </span>
                )}
                <b className="as-depto-comuna">{t.comuna.toLocaleUpperCase("es-CL")}</b>
                <span className="as-k">{tipologia(t.dormitorios)}{m2 ? ` · ${miles(m2)} m²` : ""}</span>
                <span className="as-depto-precio">{fUF(t.precioUF)}</span>
                {(flujo || t.cap != null) && (
                  <span className="as-depto-c" data-asesoria="depto-flujo">
                    {flujo && <><b data-pos={t.flujo! >= 0 ? "1" : undefined}>{flujo.fuerte}</b>{flujo.resto}</>}
                    {flujo && t.cap != null && " · "}
                    {t.cap != null && P.cap(t.cap)}
                  </span>
                )}
                {t.tasa && <span className="as-depto-tasa" data-asesoria="depto-tasa">{t.tasa.aguanta ? P.aguanta : P.conPunto(t.tasa.poneCLP)}</span>}
                <button type="button" className="as-depto-ver" onClick={() => alVer(t.id)} data-asesoria="ver-depto">{P.ver}</button>
              </div>
            </div>
          );
        })}
      </div>
      {r.tres.length > 0 && (
        <div className="as-pie">
          <a className="as-principal" data-rojo="1" href={urlSeguirDeptos(r.tres.map((t) => t.id))} onClick={alSeguir} data-asesoria="seguir-deptos">{P.seguirDeptos(r.tres.length)}</a>
        </div>
      )}
    </>
  );
}
