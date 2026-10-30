"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR COMO PORTAL en el navegador (28-oct-2026, mockup docs/puerta-b-mockups/5b-explorar-portal.html).
//   · A · AL ENTRAR, LA VISTA GLOBAL: todo Gran Santiago con el financiamiento por defecto. Desde el 30-oct-2026 (recorrido
//     real de Fabrizio): arriba solo «Filtros» y, a la derecha y en texto, «ⓘ ¿Cómo se calcula?»; sin la tarjeta del número
//     sobre el mapa. Al mover el mapa, «Buscar en esta zona». Abajo, «N deptos ✓ Comprar · Ver lista»; en el PC, una píldora
//     negra flotante al centro, «Ver lista · N ✓ Comprar», espejo del botón «Mapa» de la lista. «Mi búsqueda» vive en Filtros.
//   · B · «FILTROS», una hoja completa (hoja-filtros.tsx): el número de «Ver N deptos» se cuenta acá, sobre el universo
//     cargado, a cada toque. Los filtros viven en la URL; NO TOCAN EL PERFIL.
//   · C · AL TOCAR UN PIN, una tarjeta chica sobre el mapa (tarjeta-pin.tsx), que se desliza entre los cercanos.
//   · D · «VER LISTA» (lista-portal.tsx): una hoja en el teléfono, un panel a la derecha en el PC; «Ordenar» vive solo ahí.
//   · EL UNIVERSO llega después del primer pintado (el LCP es el mapa quieto que dibuja el servidor): con un pie y un plazo
//     de la noche, todo Gran Santiago en un pedido; si no, de a una comuna, mostrando lo que va llegando.
//   · SIN SALDO SE EXPLORA TODO; el cobro aparece al tocar «Analizar este», con el pop-up de compra de siempre.
//   · SIN CUENTA (29-oct-2026, la puerta E, mockup 6-puerta-e): la primera vez, la bienvenida; el universo llega SIN CIFRAS
//     (/api/explorar/abierto) y la tarjeta y la lista las muestran borrosas; pie y plazo en el financiamiento por defecto. «Regístrate gratis
//     para ver este depto», el corazón, «Avísame de nuevos», pie y plazo, «Solo flujo positivo» y ordenar por flujo o cap rate
//     abren la hoja de registro (hoja-registro.tsx), y al terminar el alta se hace eso mismo, en el mismo pin
//     (abierto.ts › accionDeVuelta). Con Google o el enlace del correo, el alta corre acá al volver.
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
  cercanos, claveUniverso, COMO_SE_CALCULA, comunasACalcular, deptosN, descompactar, EVENTOS_PORTAL, etiquetaFiltros, filtrar, filtrosCambiados, lineaPlan, pildoraLista,
  lineaBusqueda, ordenar, perfilDeFiltros, PORTAL_COPY, propsDeFiltros, universoDeLaNoche, urlDePortal,
  type Caja, type FiltrosPortal, type OrdenPortal, type PinMapa, type TasaDelMotor,
} from "@/lib/explorar/portal";
// Solo el tipo (se borra al compilar): la forma de GET /api/explorar, la misma que arma la ruta.
import type { RespuestaUniverso } from "@/lib/explorar/portal-servidor";
import { TarjetaPin } from "./tarjeta-pin";
import { ChipVeredicto, ChipVeredictoTokens } from "@/components/analysis/shared/ChipVeredicto";
import {
  accionDeVuelta, bienvenidaVista, EVENTOS_ABIERTO, filtrosAbiertos, marcarBienvenida, ORDENES_CON_CIFRAS,
  type MotivoRegistro, type OrigenExplorar, type PedidoRegistro,
} from "@/lib/explorar/abierto";
import { claveDeDestino } from "@/lib/deptos/respuesta";
import { conTopeYReintento } from "@/lib/deptos/entrada";
import { PASO_REGALO_MS, TOPE_ESPERA_REGALO_MS } from "@/lib/deptos/alta-orden";
import { avisarLead } from "@/lib/meta/lead-cliente";
import "./explorar.css";

const MapaExplorar = dynamic(() => import("./mapa-explorar"), { ssr: false, loading: () => null });
// Lo que no hace falta para el primer pintado entra cuando se abre (LCP en el teléfono).
const HojaFiltros = dynamic(() => import("./hoja-filtros").then((m) => m.HojaFiltros), { ssr: false, loading: () => null });
const ListaPortal = dynamic(() => import("./lista-portal").then((m) => m.ListaPortal), { ssr: false, loading: () => null });
const AvisameDialogo = dynamic(() => import("./avisame-dialogo").then((m) => m.AvisameDialogo), { ssr: false, loading: () => null });
const AvisoAntesDeAnalizar = dynamic(() => import("@/components/guia/AvisoAntesDeAnalizar").then((m) => m.AvisoAntesDeAnalizar), { ssr: false, loading: () => null });
const PopupNoDa = dynamic(() => import("@/components/guia/PopupNoDa").then((m) => m.PopupNoDa), { ssr: false, loading: () => null });
const HojaRegistro = dynamic(() => import("./hoja-registro").then((m) => m.HojaRegistro), { ssr: false, loading: () => null });
const Bienvenida = dynamic(() => import("./bienvenida").then((m) => m.Bienvenida), { ssr: false, loading: () => null });
const HojaCalculo = dynamic(() => import("./hoja-calculo").then((m) => m.HojaCalculo), { ssr: false, loading: () => null });

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
  /** null: SIN CUENTA (la puerta E). */
  cuenta: CuentaCliente | null;
  /** La tasa del motor (portal-cache.ts › tasaDelMotor), para la línea bajo el número y «¿Cómo se calcula?»; null si no se leyó. */
  tasa: TasaDelMotor | null;
  /** El número de «convienen» de todo el sitio (portal-cache.ts › convienenHoy), para la bienvenida; solo sin cuenta. */
  convienen: number | null;
}

/** Lo que se muestra sin cuenta: nada de la persona, sin saldo. */
const CUENTA_VACIA: CuentaCliente = {
  analizados: {}, guardados: [], saldo: { tipo: "sin" }, suscrito: false, ticket: false, cuentaCreadaAt: null,
  finanzas: { uf: null, tasa: null }, miBusqueda: null, busquedaActual: null, explorarEnMes: 0,
};
/** El pop-up que usa el regalo habla solo del regalo (ofertas de a una, 29-oct-2026): sin la línea del ticket. */
const usaRegalo = (s: EstadoSaldo): boolean => s.tipo === "regalo" || (s.tipo === "con" && !!s.proximoRegalo);

type Universo = { comunas: "todas" | string[]; pines: PinMapa[] };

// El mapa quieto del primer pintado (el LCP) NO va acá: es una capa de la página (page.tsx), una sola imagen y antes del header
// en el HTML. El cliente avisa cuándo el mapa real dibujó sus teselas (`data-mapa`) y la capa se desvanece (explorar.css).
export function ExplorarCliente({ inicial, abrir = null, autoAnalizar = null, origen = "directo", correo = null }: {
  inicial: InicialPortal;
  abrir?: string | null;
  autoAnalizar?: string | null;
  /** Sin cuenta: de dónde llegó (la landing o directo), el detalle de la puerta E. */
  origen?: OrigenExplorar;
  /** Con cuenta: el correo, para el Lead al volver de Google (recién ahí se sabe). */
  correo?: string | null;
}) {
  const router = useRouter();
  const posthog = usePostHog();
  // La cuenta se refresca al volver del alta (Google o el enlace): el regalo recién otorgado tiene que estar en el saldo.
  const [cuentaViva, setCuentaViva] = useState<CuentaCliente | null>(inicial.cuenta);
  const sinCuenta = cuentaViva == null;
  const cuenta = cuentaViva ?? CUENTA_VACIA;
  const [filtros, setFiltros] = useState(inicial.filtros);
  const [orden, setOrden] = useState(inicial.orden);
  const [universos, setUniversos] = useState<Record<string, Universo>>({});
  const universosRef = useRef(universos);
  universosRef.current = universos;
  // Lo que ya se está pidiendo (la noche: su clave; lo calculado: clave|comuna): abrir los filtros antes de que llegue el universo
  // no lo pide de nuevo.
  const enCurso = useRef(new Set<string>());
  const sinCuentaRef = useRef(sinCuenta);
  sinCuentaRef.current = sinCuenta;
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [fallo, setFallo] = useState(false);
  const [vista, setVista] = useState<"mapa" | "lista">("mapa");
  const [mapaListo, setMapaListo] = useState(false);
  const [mapa, setMapa] = useState<"cargando" | "listo" | "teselas" | "fallo">("cargando");
  const [sel, setSel] = useState<string | null>(abrir);
  const [carrusel, setCarrusel] = useState<string[]>([]);
  const [hojaFiltros, setHojaFiltros] = useState(false);
  const [zonaPendiente, setZonaPendiente] = useState<Caja | null>(null);
  const [sinBusqueda, setSinBusqueda] = useState(false);
  const [guardados, setGuardados] = useState<Set<string>>(() => new Set(cuenta.guardados));
  const [confirmar, setConfirmar] = useState<{ it: PinMapa; sin: boolean; analizando?: boolean } | null>(null);
  const [noDa, setNoDa] = useState<{ it: PinMapa; porQue: string | null; publicacion: string | null; ocupado?: boolean } | null>(null);
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
  const [caidos, setCaidos] = useState<string[]>([]);
  const [avisame, setAvisame] = useState(false);
  const [registro, setRegistro] = useState<{ pedido: PedidoRegistro; filtros: FiltrosPortal; orden: OrdenPortal } | null>(null);
  const [bienvenida, setBienvenida] = useState(false);
  // «¿Cómo se calcula?» (30-oct-2026): la hoja corta del enlace de la barra de arriba, con y sin cuenta.
  const [calculo, setCalculo] = useState(false);
  const abrirCalculo = () => {
    setCalculo(true);
    posthog?.capture(EVENTOS_PORTAL.comoSeCalcula, { sin_cuenta: sinCuenta, pie: filtros.pie, plazo: filtros.plazo, modalidad: filtros.modalidad, tasa: inicial.tasa?.tasa ?? null });
  };
  const [aviso, setAviso] = useState<string | null>(null);
  // Recién registrada desde un pin (30-oct-2026): esa tarjeta vuelve desbloqueada, con su banda; el pop-up lo abre la persona.
  const [recien, setRecien] = useState<{ avisoId: string; regalo: boolean } | null>(null);
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
    // Sin cuenta, el universo sin cifras (el financiamiento por defecto): otra ruta, pública y en la caché del CDN.
    const base = sinCuentaRef.current ? `/api/explorar/abierto?m=${f.modalidad}` : `/api/explorar?m=${f.modalidad}&p=${f.pie}&z=${f.plazo}`;
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
  function aplicar(f0: FiltrosPortal, fuente: "filtros" | "mi_busqueda" | "zona" | "limpiar") {
    // Sin cuenta, el financiamiento por defecto, y sin «Solo flujo positivo» (piden registro).
    const f = sinCuenta ? filtrosAbiertos(f0) : f0;
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
    // Sin cuenta, ordenar por mayor flujo o cap rate pide registro; al terminar, se ordena así.
    if (sinCuenta && ORDENES_CON_CIFRAS.includes(o)) { pedirRegistro("orden", visibles[0] ?? null, { orden: o }); return; }
    setOrden(o);
    ponerEnUrl(filtros, o);
    vistaCambio(filtros, o, "orden", universo ? visibles.length : null);
  }
  function miBusqueda() {
    setHojaFiltros(false);
    if (!cuenta.miBusqueda) { setSinBusqueda(true); return; }
    aplicar(cuenta.miBusqueda, "mi_busqueda");
  }
  const enMiBusqueda = !!cuenta.miBusqueda && urlDePortal(cuenta.miBusqueda) === urlDePortal(filtros);

  // ── LA HOJA DE REGISTRO (sin cuenta) ──
  /** Abre la hoja con lo que se tocó. El perfil nace del pin (o, en «Avísame», de los filtros); al terminar, se hace eso. */
  function pedirRegistro(motivo: MotivoRegistro, pin: PinMapa | null, extra: { orden?: OrdenPortal; filtros?: FiltrosPortal } = {}) {
    const f = extra.filtros ?? filtros;
    setRegistro({ pedido: { motivo, pin, ...(extra.orden ? { orden: extra.orden } : {}) }, filtros: f, orden });
    posthog?.capture(EVENTOS_ABIERTO.registroAbierto, { motivo, aviso_id: pin?.avisoId ?? null, modalidad: f.modalidad, llegada_explorar: origen });
  }

  // La bienvenida, sin cuenta y solo la primera vez (en este navegador), con el número de la noche.
  useEffect(() => {
    if (!sinCuenta || inicial.n == null) return;
    let almacen: Storage | null = null;
    try { almacen = window.localStorage; } catch { /* sin almacenamiento: no se muestra */ }
    if (bienvenidaVista(almacen)) return;
    marcarBienvenida(almacen);
    setBienvenida(true);
    posthog?.capture(EVENTOS_ABIERTO.bienvenida, { n: inicial.n, llegada_explorar: origen });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // «explorar_pin»: tocar un pin del mapa (la tarjeta se desliza entre los cercanos).
  function tocarPin(avisoId: string) {
    // Sin cuenta, la hoja de registro se precarga al tocar un pin: abre al instante aunque las imágenes de la calle de los
    // cercanos ocupen la red (QA en local, 29-oct-2026: el chunk quedaba detrás de ocho imágenes y la hoja tardaba segundos).
    if (sinCuenta) void import("./hoja-registro");
    posthog?.capture(EVENTOS_PORTAL.pin, { aviso_id: avisoId, modalidad: filtros.modalidad, ...(sinCuenta ? { sin_cuenta: true, llegada_explorar: origen } : {}) });
    setCarrusel(cercanos(visibles, avisoId).map((p) => p.avisoId));
    setSel(avisoId);
    setError(null);
  }
  const abrirDesdeLista = (avisoId: string) => { setVista("mapa"); tocarPin(avisoId); };

  // «Avísame de nuevos»: sin cuenta y con comunas, la hoja de registro (el perfil nace de estos filtros); sin comunas, el
  // diálogo de siempre, que pide elegirlas antes.
  function alAvisame() {
    if (sinCuenta && perfilDeFiltros(filtrosAbiertos(filtros)).ok) { pedirRegistro("avisame", null); return; }
    setAvisame(true);
  }

  async function alternarGuardado(avisoId: string, desde: "tarjeta" | "lista") {
    if (sinCuenta) { pedirRegistro("guardar", porId.get(avisoId) ?? null); return; }
    const guardar = !guardados.has(avisoId);
    setGuardados((s) => { const n = new Set(s); if (guardar) n.add(avisoId); else n.delete(avisoId); return n; });
    const ok = await fetch("/api/explorar/guardados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId, guardar, desde }) }).then((r) => r.ok).catch(() => false);
    if (!ok && vivo.current) setGuardados((s) => { const n = new Set(s); if (guardar) n.delete(avisoId); else n.add(avisoId); return n; });
  }

  // ── analizar ──
  const consulta = urlDePortal(filtros, orden);
  const compras = useCallback((avisoId?: string | null) => comprasDeExplorar({ filtros: consulta, avisoId, ticket: cuenta.ticket }), [consulta, cuenta.ticket]);
  // Con el regalo, el pop-up habla solo del regalo: el ticket aparece recién cuando se usó (ofertas de a una, 29-oct-2026).
  const ticketConSaldo = cuenta.ticket && cuenta.cuentaCreadaAt && cuenta.saldo.tipo !== "sin" && !usaRegalo(cuenta.saldo) ? lineaTicketConSaldo(cuenta.cuentaCreadaAt, compras().pack.href) : null;
  const plan = lineaPlan(cuenta.explorarEnMes, cuenta.suscrito);

  function pedirAnalisis(it: PinMapa) {
    if (sinCuenta) { pedirRegistro("analizar", it); return; }
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
        if (res.ok && d.id) {
          // El embudo de la puerta E: «regalo usado» (el análisis salió con el regalo de alta).
          if (usaRegalo(cuenta.saldo)) posthog?.capture(EVENTOS_ABIERTO.regaloUsado, { aviso_id: it.avisoId, analysis_id: d.id, modalidad: filtros.modalidad });
          router.push(`/analisis/${d.id}`);
          return;
        }
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

  // ── LA VUELTA DEL ALTA (con cuenta) ──
  // Con Google o el enlace del correo, la URL trae `entro`: el alta corre acá (la misma de /deptos), se espera el regalo y se
  // refresca la cuenta. Por código, el alta ya corrió en la hoja y la URL solo trae `hacer`. Después, UNA vez y con el
  // universo cargado, se hace lo que había tocado, en el mismo pin.
  const vuelta = useRef<{ motivo: MotivoRegistro; avisoId: string | null } | null>(null);
  const [listaVuelta, setListaVuelta] = useState(false);
  useEffect(() => {
    if (sinCuenta) return;
    const sp = new URLSearchParams(window.location.search);
    const v = accionDeVuelta(sp);
    const entro = sp.get("entro");
    if (!v && !entro) return;
    vuelta.current = v;
    const clave = entro === "google" ? claveDeDestino(`${window.location.pathname}${window.location.search}`) : null;
    for (const k of ["entro", "p", "hacer"]) sp.delete(k);
    try { window.history.replaceState(window.history.state, "", `${window.location.pathname}${sp.toString() ? `?${sp}` : ""}`); } catch { /* sin historial */ }
    if (!entro) { setListaVuelta(true); return; }
    if (entro === "google" && correo) void avisarLead(correo.toLowerCase(), "explorar", "E");
    void (async () => {
      const r = await conTopeYReintento(async (senal) => {
        const res = await fetch("/api/deptos/alta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clave ? { p: clave } : {}), signal: senal });
        return (await res.json().catch(() => ({}))) as { estado?: string; regalo?: string; regaloVence?: string | null };
      });
      if (r.ok && r.valor.estado === "nueva" && !r.valor.regaloVence && r.valor.regalo === "pendiente") {
        const t0 = Date.now();
        while (Date.now() - t0 < TOPE_ESPERA_REGALO_MS) {
          const d = await fetch("/api/deptos/regalo", { cache: "no-store" }).then((x) => x.json()).catch(() => ({})) as { vence?: string | null; decidido?: boolean };
          if (d.vence || d.decidido) break;
          await new Promise((ok) => setTimeout(ok, PASO_REGALO_MS));
        }
      }
      const c = await fetch("/api/explorar/cuenta", { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null) as CuentaCliente | null;
      if (!vivo.current) return;
      if (c) { setCuentaViva(c); setGuardados(new Set(c.guardados)); }
      router.refresh();
      setListaVuelta(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const v = vuelta.current;
    if (!listaVuelta || !v || !universo) return;
    vuelta.current = null;
    const it = v.avisoId ? universo.find((p) => p.avisoId === v.avisoId) ?? null : null;
    if (it) { setCarrusel(cercanos(visibles, it.avisoId).map((p) => p.avisoId)); setSel(it.avisoId); }
    // (30-oct-2026, recorrido real de Fabrizio) Desde un pin vuelve a SU tarjeta, desbloqueada y con la banda; el pop-up de
    // «Analizar este» no se abre solo: lo abre la persona.
    if (it && (v.motivo === "analizar" || v.motivo === "guardar")) setRecien({ avisoId: it.avisoId, regalo: usaRegalo(cuenta.saldo) });
    if (v.motivo === "guardar" && it && !guardados.has(it.avisoId)) void alternarGuardado(it.avisoId, "tarjeta");
    if (v.motivo === "pie-plazo") setHojaFiltros(true);
    // «Avísame»: la cuenta nueva ya nació con estos filtros como búsqueda; si la cuenta ya existía, se confirma el reemplazo.
    if (v.motivo === "avisame") {
      const p = perfilDeFiltros(filtros);
      if (p.ok && cuenta.busquedaActual === lineaBusqueda(p.cambios)) setAviso(PORTAL_COPY.aviso.listo);
      else setAvisame(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaVuelta, universo]);
  const enCarrusel = carrusel.map((id) => porId.get(id)).filter((p): p is PinMapa => !!p && !caidos.includes(p.avisoId));
  // Lo de abajo: «N deptos» con el chip; mientras se calcula, el avance (antes lo decía la tarjeta del número).
  const numeroAbajo = calculando ? (progreso ? PORTAL_COPY.calculandoComunas(progreso.hechas, progreso.total) : PORTAL_COPY.calculando) : total == null ? PORTAL_COPY.calculando : deptosN(total);
  const conChip = !calculando && total != null && total > 0;
  const tarjeta = vista === "mapa" && sel && enCarrusel.some((p) => p.avisoId === sel);

  return (
    <div className="ex" data-explorar="cliente" data-vista={vista} data-calculando={calculando ? "1" : undefined}>
      {/* ── la fila de arriba: «Filtros» y, a la derecha y en texto, «¿Cómo se calcula?» (30-oct-2026) ── */}
      <ChipVeredictoTokens />
      <div className="ex-barra" role="toolbar" aria-label="Filtros">
        <button type="button" className="ex-boton" data-activo={etiquetaFiltros(filtros) !== PORTAL_COPY.filtros ? "1" : undefined} data-explorar="filtros" onClick={() => setHojaFiltros(true)}>
          <span aria-hidden="true">☰</span> {etiquetaFiltros(filtros)}
        </button>
        <button type="button" className="ex-como" data-explorar="como-se-calcula" onClick={abrirCalculo}>
          <span className="ex-como-i" aria-hidden="true">ⓘ</span> {COMO_SE_CALCULA.enlace}
        </button>
      </div>
      {aviso && (
        <p className="ex-aviso" role="status" data-explorar="aviso">
          {aviso} <button type="button" className="ex-enlace" onClick={() => setAviso(null)}>{PORTAL_COPY.cerrar}</button>
        </p>
      )}
      {sinBusqueda && (
        <p className="ex-aviso" role="status" data-explorar="sin-busqueda">
          {PORTAL_COPY.sinMiBusqueda} <button type="button" className="ex-enlace" onClick={() => setSinBusqueda(false)}>{PORTAL_COPY.cerrar}</button>
        </p>
      )}

      <div className="ex-cuerpo">
        {/* ── el mapa (después del primer pintado) ──
            Con la lista abierta el mapa NO se esconde: en el teléfono la hoja lo cubre casi entero y en el PC sigue a la vista y
            se puede usar. Escondido (display: none) el mapa de Google se queda sin tamaño y al volver se descuadra (QA en WebKit
            390, 28-oct-2026: «Buscar en esta zona» quedaba a 50 km). */}
        <div className="ex-mapa-wrap" data-mapa={mapa}>
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
              sinCifras={sinCuenta}
            />
          )}
          {mapa === "fallo" && <p className="ex-mapa-vacio" data-explorar="sin-mapa">{PORTAL_COPY.sinMapa}</p>}
          {zonaPendiente && (
            <button type="button" className="ex-zona" data-explorar="buscar-zona" onClick={() => aplicar({ ...filtros, zona: zonaPendiente }, "zona")}>{PORTAL_COPY.buscarZona}</button>
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
              sinCuenta={sinCuenta}
              recien={recien}
            />
          ) : vista === "mapa" && (
            <>
              <button type="button" className="ex-hoja" data-explorar="hoja" onClick={() => setVista("lista")}>
                <span className="ex-asa" aria-hidden="true" />
                <span className="ex-hoja-fila">
                  <span className="ex-hoja-t" data-explorar="titulo-hoja">{numeroAbajo}{conChip && <> <ChipVeredicto v="COMPRAR" /></>}</span>
                  <span className="ex-hoja-ver">{PORTAL_COPY.verLista}</span>
                </span>
              </button>
              <button type="button" className="ex-pildora-lista" data-explorar="ver-lista" onClick={() => setVista("lista")}>
                {conChip ? pildoraLista(total!) : `${PORTAL_COPY.verLista} · ${numeroAbajo}`}{conChip && <> <ChipVeredicto v="COMPRAR" variante="sobre-fondo" /></>}
              </button>
            </>
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
            alAvisame={alAvisame}
            alCerrar={() => setVista("mapa")}
            sinCuenta={sinCuenta}
          />
        )}
      </div>

      {hojaFiltros && (
        <HojaFiltros
          filtros={filtros}
          tasa={inicial.tasa}
          miBusqueda={sinCuenta ? null : { activa: enMiBusqueda, alUsar: miBusqueda }}
          contar={contar}
          asegurar={(f) => void asegurar(f)}
          alAplicar={(f) => { setHojaFiltros(false); aplicar(f, "filtros"); }}
          alCerrar={() => setHojaFiltros(false)}
          alPedirRegistro={sinCuenta ? (motivo, f) => {
            // Lo elegido hasta ahí se aplica; «Solo flujo positivo» vuelve prendido después del alta (va en la URL de vuelta).
            setHojaFiltros(false);
            aplicar(f, "filtros");
            pedirRegistro(motivo, visibles[0] ?? null, { filtros: motivo === "flujo" ? { ...filtrosAbiertos(f), flujoPositivo: true } : filtrosAbiertos(f) });
          } : null}
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

      {registro && (
        <HojaRegistro pedido={registro.pedido} filtros={registro.filtros} orden={registro.orden} origen={origen} alCerrar={() => setRegistro(null)} />
      )}
      {bienvenida && total != null && <Bienvenida n={inicial.convienen ?? inicial.n ?? total} alCerrar={() => setBienvenida(false)} />}
      {calculo && <HojaCalculo tasa={inicial.tasa} sinCuenta={sinCuenta} alCerrar={() => setCalculo(false)} />}

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
          avisoId={confirmar.it.avisoId}
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
