"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR COMO PORTAL en el navegador (28-oct-2026, mockup docs/puerta-b-mockups/5b-explorar-portal.html).
//   · A · AL ENTRAR, LA VISTA GLOBAL: todo Gran Santiago con los supuestos del número de anoche; bajo el número del mapa,
//     la línea chica con esos supuestos. Arriba una sola fila: «Filtros», «Ordenar» y «Mi búsqueda» (el perfil de una
//     vez). Al mover el mapa, «Buscar en esta zona». Abajo la hoja cerrada: «N deptos que convienen · Ver lista».
//   · B · «FILTROS», una hoja completa (hoja-filtros.tsx): el número de «Ver N deptos» se cuenta acá, sobre el universo
//     cargado, a cada toque. Los filtros viven en la URL; NO TOCAN EL PERFIL.
//   · C · AL TOCAR UN PIN, una tarjeta chica sobre el mapa (tarjeta-pin.tsx), que se desliza entre los cercanos.
//   · D · «VER LISTA» (lista-portal.tsx): ordenable, con miniatura, el corazón, «Avísame de nuevos» y el botón «Mapa».
//   · EL UNIVERSO llega después del primer pintado (el LCP es el mapa quieto que dibuja el servidor): con un pie y un plazo
//     de la noche, todo Gran Santiago en un pedido; si no, de a una comuna, mostrando lo que va llegando.
//   · SIN SALDO SE EXPLORA TODO; el cobro aparece al tocar «Analizar este», con el pop-up de compra de siempre.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { claveActual, iniciarCarga } from "@/lib/carga-global";
import { cuandoLaPaginaEsteQuieta } from "@/lib/pagina-quieta";
import { usePostHog } from "@/lib/posthog-react";
import { comprasDeExplorar, lineaTicketConSaldo } from "@/lib/guia/compra-desde-depto";
import { cuandoVenceCorto } from "@/lib/lo-que-sigue/oferta-pack";
import { GUIA } from "@/lib/guia/copy";
import type { EleccionAnalizar } from "@/components/guia/AvisoAntesDeAnalizar";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import { botonAnalizar, type Recalculo } from "@/lib/explorar/explorar";
import { textoAnalizarIgual } from "@/lib/guia/semanal-str";
import {
  cercanos, claveUniverso, comunasACalcular, descompactar, EVENTOS_PORTAL, etiquetaFiltros, etiquetaOrden, filtrar, filtrosCambiados, lineaPlan, lineaSupuestos,
  numeroDelMapa, ordenar, ORDENES, PORTAL_COPY, propsDeFiltros, tituloLista, universoDeLaNoche, urlDePortal,
  type Caja, type FiltrosPortal, type OrdenPortal, type PinMapa,
} from "@/lib/explorar/portal";
// Solo el tipo (se borra al compilar): la forma de GET /api/explorar, la misma que arma la ruta.
import type { RespuestaUniverso } from "@/lib/explorar/portal-servidor";
import { TarjetaPin } from "./tarjeta-pin";
import "./explorar.css";

const MapaExplorar = dynamic(() => import("./mapa-explorar"), { ssr: false, loading: () => null });
// Lo que no hace falta para el primer pintado entra cuando se abre (LCP en el teléfono).
const HojaFiltros = dynamic(() => import("./hoja-filtros").then((m) => m.HojaFiltros), { ssr: false, loading: () => null });
const ListaPortal = dynamic(() => import("./lista-portal").then((m) => m.ListaPortal), { ssr: false, loading: () => null });
const AvisameDialogo = dynamic(() => import("./avisame-dialogo").then((m) => m.AvisameDialogo), { ssr: false, loading: () => null });
const AvisoAntesDeAnalizar = dynamic(() => import("@/components/guia/AvisoAntesDeAnalizar").then((m) => m.AvisoAntesDeAnalizar), { ssr: false, loading: () => null });
const PopupNoDa = dynamic(() => import("@/components/guia/PopupNoDa").then((m) => m.PopupNoDa), { ssr: false, loading: () => null });

const ESPERA_EN_CURSO_MS = 4000;
/** Comunas que se calculan a la vez (otro pie u otro plazo, o renta corta). */
const COMUNAS_A_LA_VEZ = 3;

/** Lo que el servidor sabe de la cuenta (portal-servidor.ts › CuentaPortal), sin nada que no se pueda mostrar. */
export interface CuentaCliente {
  analizados: Record<string, string>;
  guardados: string[];
  saldo: EstadoSaldo;
  suscrito: boolean;
  ticket: boolean;
  cuentaCreadaAt: string | null;
  finanzas: { uf: number | null; tasa: number | null };
  miBusqueda: FiltrosPortal | null;
  busquedaActual: string | null;
  explorarEnMes: number;
}

export interface InicialPortal {
  filtros: FiltrosPortal;
  orden: OrdenPortal;
  /** Cuántos convienen con estos filtros, contado por el servidor para el primer pintado (null: hay que calcular). */
  n: number | null;
  cuenta: CuentaCliente;
}

type Universo = { comunas: "todas" | string[]; pines: PinMapa[] };

// El mapa quieto del primer pintado (el LCP) NO va acá: es una capa de la página (page.tsx), una sola imagen y antes del header
// en el HTML. El cliente avisa cuándo el mapa real dibujó sus teselas (`data-mapa`) y la capa se desvanece (explorar.css).
export function ExplorarCliente({ inicial, abrir = null, autoAnalizar = null }: {
  inicial: InicialPortal;
  abrir?: string | null;
  autoAnalizar?: string | null;
}) {
  const router = useRouter();
  const posthog = usePostHog();
  const cuenta = inicial.cuenta;
  const [filtros, setFiltros] = useState(inicial.filtros);
  const [orden, setOrden] = useState(inicial.orden);
  const [universos, setUniversos] = useState<Record<string, Universo>>({});
  const universosRef = useRef(universos);
  universosRef.current = universos;
  // Lo que ya se está pidiendo (la noche: su clave; lo calculado: clave|comuna): abrir los filtros antes de que llegue el universo
  // no lo pide de nuevo.
  const enCurso = useRef(new Set<string>());
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [fallo, setFallo] = useState(false);
  const [vista, setVista] = useState<"mapa" | "lista">("mapa");
  const [mapaListo, setMapaListo] = useState(false);
  const [mapa, setMapa] = useState<"cargando" | "listo" | "teselas" | "fallo">("cargando");
  const [sel, setSel] = useState<string | null>(abrir);
  const [carrusel, setCarrusel] = useState<string[]>([]);
  const [hojaFiltros, setHojaFiltros] = useState(false);
  const [menuOrden, setMenuOrden] = useState(false);
  const [zonaPendiente, setZonaPendiente] = useState<Caja | null>(null);
  const [sinBusqueda, setSinBusqueda] = useState(false);
  const [guardados, setGuardados] = useState<Set<string>>(() => new Set(cuenta.guardados));
  const [confirmar, setConfirmar] = useState<{ it: PinMapa; sin: boolean; analizando?: boolean } | null>(null);
  const [noDa, setNoDa] = useState<{ it: PinMapa; porQue: string | null; publicacion: string | null; ocupado?: boolean } | null>(null);
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
  const [caidos, setCaidos] = useState<string[]>([]);
  const [avisame, setAvisame] = useState(false);
  const vivo = useRef(true);
  const uf = cuenta.finanzas.uf;

  // ── el universo ──
  const universoPara = useCallback((f: FiltrosPortal, us: Record<string, Universo>): PinMapa[] | null => {
    const u = us[claveUniverso(f)];
    if (!u) return null;
    if (u.comunas === "todas") return u.pines;
    const hay = new Set(u.comunas);
    return comunasACalcular(f).every((c) => hay.has(c)) ? u.pines : null;
  }, []);

  /** Trae lo que falte para unos filtros: la noche entera en un pedido, o lo calculado de a una comuna. */
  const asegurar = useCallback(async (f: FiltrosPortal) => {
    const clave = claveUniverso(f);
    const base = `/api/explorar?m=${f.modalidad}&p=${f.pie}&z=${f.plazo}`;
    setFallo(false);
    try {
      if (universoDeLaNoche(f)) {
        if (universosRef.current[clave] || enCurso.current.has(clave)) return;
        enCurso.current.add(clave);
        try {
          const res = await fetch(base, { cache: "default" });
          if (!res.ok) throw new Error(String(res.status));
          const d = (await res.json()) as RespuestaUniverso;
          if (vivo.current) setUniversos((us) => ({ ...us, [clave]: { comunas: "todas", pines: descompactar(d.universo) } }));
        } finally {
          enCurso.current.delete(clave);
        }
        return;
      }
      const ya = universosRef.current[clave];
      const tengo = new Set(ya && ya.comunas !== "todas" ? ya.comunas : []);
      const faltan = comunasACalcular(f).filter((c) => !tengo.has(c) && !enCurso.current.has(`${clave}|${c}`));
      for (const c of faltan) enCurso.current.add(`${clave}|${c}`);
      if (faltan.length === 0) return;
      let hechas = 0;
      setProgreso({ hechas, total: faltan.length });
      const cola = [...faltan];
      let errores = 0;
      const trabajador = async () => {
        for (let c = cola.shift(); c; c = cola.shift()) {
          try {
            const res = await fetch(`${base}&c=${encodeURIComponent(c)}`, { cache: "default" });
            if (!res.ok) throw new Error(String(res.status));
            const d = (await res.json()) as RespuestaUniverso;
            const nuevos = descompactar(d.universo);
            const comuna = c;
            if (vivo.current) setUniversos((us) => {
              const prev = us[clave];
              const comunas = prev && prev.comunas !== "todas" ? [...prev.comunas, comuna] : [comuna];
              const ids = new Set((prev?.pines ?? []).map((p) => p.avisoId));
              return { ...us, [clave]: { comunas, pines: [...(prev?.pines ?? []), ...nuevos.filter((p) => !ids.has(p.avisoId))] } };
            });
          } catch {
            errores++;
          }
          enCurso.current.delete(`${clave}|${c}`);
          hechas++;
          if (vivo.current) setProgreso({ hechas, total: faltan.length });
        }
      };
      await Promise.all(Array.from({ length: Math.min(COMUNAS_A_LA_VEZ, faltan.length) }, trabajador));
      if (vivo.current) { setProgreso(null); if (errores) setFallo(true); }
    } catch {
      if (vivo.current) { setProgreso(null); setFallo(true); }
    }
  }, []);

  // El universo de la vista con que se entró: el de la noche, con la página quieta (el LCP es el mapa quieto); uno calculado,
  // enseguida. El mapa interactivo, también con la página quieta.
  useEffect(() => {
    vivo.current = true;
    if (!universoDeLaNoche(inicial.filtros)) void asegurar(inicial.filtros);
    const cancelar = cuandoLaPaginaEsteQuieta(() => {
      setMapaListo(true);
      if (universoDeLaNoche(inicial.filtros)) void asegurar(inicial.filtros);
    });
    return () => { vivo.current = false; cancelar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const universo = universoPara(filtros, universos);
  const visibles = useMemo(() => (universo ? ordenar(filtrar(universo, filtros).filter((p) => !caidos.includes(p.avisoId)), orden, uf) : []), [universo, filtros, orden, uf, caidos]);
  // Antes de que llegue el universo, el número que contó el servidor (solo para los filtros con que se entró).
  const total = universo ? visibles.length : filtros === inicial.filtros ? inicial.n : null;
  const calculando = !universo && (progreso != null || !universoDeLaNoche(filtros));
  const analizadosSet = useMemo(() => new Set(Object.keys(cuenta.analizados)), [cuenta.analizados]);
  /** Cuántos darían unos filtros, sobre lo cargado (la hoja de filtros); null si hay que traer otro universo. */
  const contar = useCallback((f: FiltrosPortal): number | null => {
    const u = universoPara(f, universosRef.current);
    return u ? filtrar(u, f).filter((p) => !caidos.includes(p.avisoId)).length : null;
  }, [universoPara, caidos]);

  // ── los cambios ──
  const ponerEnUrl = (f: FiltrosPortal, o: OrdenPortal) => {
    try { const q = urlDePortal(f, o); window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}`); } catch { /* sin historial */ }
  };
  const vistaCambio = (f: FiltrosPortal, o: OrdenPortal, fuente: string, n: number | null) =>
    posthog?.capture(EVENTOS_PORTAL.vista, { ...propsDeFiltros(f, o), n, fuente });

  /** Aplica unos filtros: la URL, el universo que falte y la medición. No toca el perfil. */
  function aplicar(f: FiltrosPortal, fuente: "filtros" | "mi_busqueda" | "zona" | "limpiar") {
    const cambiados = filtrosCambiados(filtros, f);
    setFiltros(f);
    setSel(null);
    setZonaPendiente(null);
    ponerEnUrl(f, orden);
    void asegurar(f);
    const n = contar(f);
    if (fuente === "filtros" && cambiados.length) posthog?.capture(EVENTOS_PORTAL.filtro, { cambiados, ...propsDeFiltros(f, orden), n });
    vistaCambio(f, orden, fuente, n);
  }
  function cambiarOrden(o: OrdenPortal) {
    setOrden(o);
    setMenuOrden(false);
    ponerEnUrl(filtros, o);
    vistaCambio(filtros, o, "orden", universo ? visibles.length : null);
  }
  function miBusqueda() {
    if (!cuenta.miBusqueda) { setSinBusqueda(true); return; }
    aplicar(cuenta.miBusqueda, "mi_busqueda");
  }
  const enMiBusqueda = !!cuenta.miBusqueda && urlDePortal(cuenta.miBusqueda) === urlDePortal(filtros);

  // «explorar_pin»: tocar un pin del mapa (la tarjeta se desliza entre los cercanos).
  function tocarPin(avisoId: string) {
    posthog?.capture(EVENTOS_PORTAL.pin, { aviso_id: avisoId, modalidad: filtros.modalidad });
    setCarrusel(cercanos(visibles, avisoId).map((p) => p.avisoId));
    setSel(avisoId);
    setError(null);
  }
  const abrirDesdeLista = (avisoId: string) => { setVista("mapa"); tocarPin(avisoId); };

  async function alternarGuardado(avisoId: string, desde: "tarjeta" | "lista") {
    const guardar = !guardados.has(avisoId);
    setGuardados((s) => { const n = new Set(s); if (guardar) n.add(avisoId); else n.delete(avisoId); return n; });
    const ok = await fetch("/api/explorar/guardados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId, guardar, desde }) }).then((r) => r.ok).catch(() => false);
    if (!ok && vivo.current) setGuardados((s) => { const n = new Set(s); if (guardar) n.delete(avisoId); else n.add(avisoId); return n; });
  }

  // ── analizar ──
  const consulta = urlDePortal(filtros, orden);
  const compras = useCallback((avisoId?: string | null) => comprasDeExplorar({ filtros: consulta, avisoId, ticket: cuenta.ticket }), [consulta, cuenta.ticket]);
  const ticketConSaldo = cuenta.ticket && cuenta.cuentaCreadaAt && cuenta.saldo.tipo !== "sin" ? lineaTicketConSaldo(cuenta.cuentaCreadaAt, compras().pack.href) : null;
  const plan = lineaPlan(cuenta.explorarEnMes, cuenta.suscrito);

  function pedirAnalisis(it: PinMapa) {
    setError(null);
    setConfirmar({ it, sin: cuenta.saldo.tipo === "sin" });
    if (plan) posthog?.capture(EVENTOS_PORTAL.planVisto, { hechos: cuenta.explorarEnMes, aviso_id: it.avisoId, sin_saldo: cuenta.saldo.tipo === "sin" });
  }

  async function analizar(it: PinMapa, eleccion?: EleccionAnalizar, igual = false) {
    if (generando) return;
    const combinacion = eleccion?.combinacion ?? { piePct: filtros.pie, plazoAnios: filtros.plazo };
    setError(null);
    setGenerando(it.avisoId);
    const soltar = iniciarCarga(claveActual());
    if (!igual) setConfirmar({ it, sin: false, analizando: true });
    try {
      // La casilla del pop-up: el pie y el plazo nuevos quedan en el perfil (además de «Avísame de nuevos», lo único que lo escribe).
      if (eleccion?.guardarPerfil) {
        await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios }) }).catch(() => null);
      }
      const corta = filtros.modalidad === "str";
      for (let intento = 0; intento < 8; intento++) {
        const res = await fetch(corta ? "/api/semanal/analizar-str" : "/api/lo-que-sigue/guia/analizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avisoId: it.avisoId, piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios, explorar: true, ...(igual ? { igual: true } : {}) }),
        });
        if (res.status === 409) { await new Promise((ok) => setTimeout(ok, ESPERA_EN_CURSO_MS)); continue; }
        const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string; estado?: string; porQue?: string | null; publicacion?: string | null };
        if (res.ok && d.id) { router.push(`/analisis/${d.id}`); return; }
        // Renta corta medida fina que no da: no se cobró; se ofrece analizar igual.
        if (res.ok && d.estado === "no-da") { setConfirmar(null); setNoDa({ it, porQue: d.porQue ?? null, publicacion: d.publicacion ?? null }); break; }
        if (res.status === 410 && d.error === "despublicado") { setConfirmar(null); setNoDa(null); setCaidos((xs) => [...xs, it.avisoId]); setSel(null); break; }
        if (d.error === "sin-creditos") { setNoDa(null); setConfirmar({ it, sin: true }); break; }
        setConfirmar(null);
        setNoDa(null);
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

  // Volvió pagado desde un depto (`a` y `analizar=1`): se abre y se analiza solo, una vez, cuando llega el universo.
  const autoHecho = useRef(false);
  useEffect(() => {
    if (!autoAnalizar || autoHecho.current || !universo) return;
    const it = universo.find((p) => p.avisoId === autoAnalizar);
    if (!it) return;
    autoHecho.current = true;
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("analizar");
      window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`);
    } catch { /* igual se analiza una vez */ }
    setCarrusel([it.avisoId]);
    setSel(it.avisoId);
    if (cuenta.analizados[it.avisoId]) return;
    if (cuenta.saldo.tipo === "sin") setConfirmar({ it, sin: true });
    else void analizar(it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnalizar, universo]);
  // Entró con un depto abierto (`a`): su tarjeta, con los cercanos, cuando llega el universo.
  useEffect(() => {
    if (!abrir || autoAnalizar || !universo || carrusel.length) return;
    if (visibles.some((p) => p.avisoId === abrir)) setCarrusel(cercanos(visibles, abrir).map((p) => p.avisoId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universo]);

  const porId = useMemo(() => new Map((universo ?? []).map((p) => [p.avisoId, p])), [universo]);
  const enCarrusel = carrusel.map((id) => porId.get(id)).filter((p): p is PinMapa => !!p && !caidos.includes(p.avisoId));
  const tarjeta = vista === "mapa" && sel && enCarrusel.some((p) => p.avisoId === sel);

  return (
    <div className="ex" data-explorar="cliente" data-vista={vista} data-calculando={calculando ? "1" : undefined}>
      {/* ── la fila de arriba ── */}
      <div className="ex-barra" role="toolbar" aria-label="Filtros y orden">
        <button type="button" className="ex-boton" data-activo={etiquetaFiltros(filtros) !== PORTAL_COPY.filtros ? "1" : undefined} data-explorar="filtros" onClick={() => setHojaFiltros(true)}>
          <span aria-hidden="true">☰</span> {etiquetaFiltros(filtros)}
        </button>
        <div className="ex-orden">
          <button type="button" className="ex-boton ex-boton-suave" aria-haspopup="menu" aria-expanded={menuOrden} data-explorar="ordenar" onClick={() => setMenuOrden((x) => !x)}>
            {etiquetaOrden(orden)} <span aria-hidden="true">▾</span>
          </button>
          {menuOrden && (
            <>
              <div className="ex-velo" onClick={() => setMenuOrden(false)} aria-hidden="true" />
              <div className="ex-menu" role="menu" data-explorar="menu-orden">
                {ORDENES.map((o) => (
                  <button key={o.id} type="button" role="menuitemradio" aria-checked={orden === o.id} className="ex-menu-op" onClick={() => cambiarOrden(o.id)}>{o.etiqueta}</button>
                ))}
              </div>
            </>
          )}
        </div>
        <button type="button" className="ex-boton ex-boton-suave" data-activo={enMiBusqueda ? "1" : undefined} data-explorar="mi-busqueda" onClick={miBusqueda}>{PORTAL_COPY.miBusqueda}</button>
      </div>
      {sinBusqueda && (
        <p className="ex-aviso" role="status" data-explorar="sin-busqueda">
          {PORTAL_COPY.sinMiBusqueda} <button type="button" className="ex-enlace" onClick={() => setSinBusqueda(false)}>{PORTAL_COPY.cerrar}</button>
        </p>
      )}

      <div className="ex-cuerpo">
        {/* ── el mapa (después del primer pintado) ──
            Con la lista abierta el mapa NO se esconde: la lista lo cubre entero. Escondido (display: none) el mapa de Google se
            queda sin tamaño y al volver se descuadra (QA en WebKit 390, 28-oct-2026: «Buscar en esta zona» quedaba a 50 km). */}
        <div className="ex-mapa-wrap" data-mapa={mapa} aria-hidden={vista === "lista" ? true : undefined}>
          {mapaListo && mapa !== "fallo" && (
            <MapaExplorar
              pines={visibles}
              analizados={analizadosSet}
              seleccionado={tarjeta ? sel : null}
              encuadre={`${claveUniverso(filtros)}|${filtros.comunas.join()}|${filtros.tipologias.join()}|${filtros.ufMin}|${filtros.ufMax}|${filtros.flujoPositivo}|${filtros.publicados}|${universo ? "1" : "0"}`}
              conZona={!!filtros.zona}
              onSeleccionar={tocarPin}
              onTocarMapa={() => setSel(null)}
              onMovido={(c) => setZonaPendiente(c)}
              onEstado={setMapa}
            />
          )}
          {mapa === "fallo" && <p className="ex-mapa-vacio" data-explorar="sin-mapa">{PORTAL_COPY.sinMapa}</p>}
          {zonaPendiente ? (
            <button type="button" className="ex-zona" data-explorar="buscar-zona" onClick={() => aplicar({ ...filtros, zona: zonaPendiente }, "zona")}>{PORTAL_COPY.buscarZona}</button>
          ) : (
            <div className="ex-numero" data-explorar="numero" aria-live="polite">
              <span className="ex-numero-n">{calculando ? (progreso ? PORTAL_COPY.calculandoComunas(progreso.hechas, progreso.total) : PORTAL_COPY.calculando) : total != null ? numeroDelMapa(total, filtros) : PORTAL_COPY.calculando}</span>
              <span className="ex-numero-s" data-explorar="supuestos">{lineaSupuestos(filtros)}</span>
            </div>
          )}
          {fallo && (
            <p className="ex-error ex-error-mapa" role="alert" data-explorar="error">
              {PORTAL_COPY.error} <button type="button" className="ex-enlace" onClick={() => void asegurar(filtros)}>{PORTAL_COPY.reintentar}</button>
            </p>
          )}
          {tarjeta ? (
            <TarjetaPin
              pines={enCarrusel}
              seleccionado={sel!}
              uf={uf}
              analizados={cuenta.analizados}
              guardados={guardados}
              generando={generando}
              error={error}
              alCambiar={setSel}
              alCerrar={() => setSel(null)}
              alGuardar={(id) => void alternarGuardado(id, "tarjeta")}
              alAnalizar={pedirAnalisis}
            />
          ) : (
            <button type="button" className="ex-hoja" data-explorar="hoja" onClick={() => setVista("lista")}>
              <span className="ex-asa" aria-hidden="true" />
              <span className="ex-hoja-fila">
                <span className="ex-hoja-t" data-explorar="titulo-hoja">{calculando || total == null ? PORTAL_COPY.calculando : tituloLista(total)}</span>
                <span className="ex-hoja-ver">{PORTAL_COPY.verLista}</span>
              </span>
            </button>
          )}
        </div>

        {/* ── la lista ── */}
        {vista === "lista" && (
          <ListaPortal
            pines={visibles}
            total={total}
            calculando={calculando}
            orden={orden}
            uf={uf}
            analizados={cuenta.analizados}
            guardados={guardados}
            alOrden={cambiarOrden}
            alAbrir={abrirDesdeLista}
            alGuardar={(id) => void alternarGuardado(id, "lista")}
            alAvisame={() => setAvisame(true)}
            alMapa={() => setVista("mapa")}
          />
        )}
      </div>

      {hojaFiltros && (
        <HojaFiltros
          filtros={filtros}
          contar={contar}
          asegurar={(f) => void asegurar(f)}
          alAplicar={(f) => { setHojaFiltros(false); aplicar(f, "filtros"); }}
          alCerrar={() => setHojaFiltros(false)}
        />
      )}
      {avisame && (
        <AvisameDialogo
          filtros={filtros}
          busquedaActual={cuenta.busquedaActual}
          alElegirComunas={() => { setAvisame(false); setHojaFiltros(true); }}
          alCerrar={() => setAvisame(false)}
        />
      )}

      {confirmar && (
        <AvisoAntesDeAnalizar
          depto={{ comuna: confirmar.it.comuna, tipologia: confirmar.it.tipologia, m2: confirmar.it.m2, precioUF: confirmar.it.precioUF, condicion: confirmar.it.condicion }}
          modalidad={filtros.modalidad}
          combinacion={{ piePct: filtros.pie, plazoAnios: filtros.plazo }}
          finanzas={{ tasa: cuenta.finanzas.tasa, uf: cuenta.finanzas.uf, arriendo: confirmar.it.arriendo }}
          uso={confirmar.sin ? { tipo: "sin" } : cuenta.saldo}
          compras={compras(confirmar.it.avisoId)}
          ticketConSaldo={ticketConSaldo}
          ticketVence={cuenta.ticket && cuenta.cuentaCreadaAt ? cuandoVenceCorto(cuenta.cuentaCreadaAt) : null}
          rutaCompra={compras(confirmar.it.avisoId).pack.href}
          analizando={!!confirmar.analizando}
          planLinea={plan}
          cambio={filtros.modalidad === "str" ? null : { recalcular: (combo) => recalcular(confirmar.it.avisoId, combo), base: { veredicto: confirmar.it.veredicto, score: confirmar.it.score, flujo: confirmar.it.flujo } }}
          alAnalizar={(eleccion) => void analizar(confirmar.it, eleccion)}
          alCancelar={() => { if (!confirmar.analizando) setConfirmar(null); }}
        />
      )}
      {noDa && (
        <PopupNoDa
          parecidos={0}
          publicacion={noDa.publicacion}
          porQue={noDa.porQue}
          analizarIgual={cuenta.saldo.tipo === "sin" ? null : { texto: textoAnalizarIgual(botonAnalizar(cuenta.saldo).split(" · ")[1] ?? null), ocupado: generando === noDa.it.avisoId, alTocar: () => void analizar(noDa.it, undefined, true) }}
          alCerrar={() => { if (!generando) setNoDa(null); }}
        />
      )}
    </div>
  );
}
