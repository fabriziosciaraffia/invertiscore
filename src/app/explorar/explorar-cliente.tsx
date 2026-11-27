"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR COMO PORTAL en el navegador (28-oct-2026, mockup docs/puerta-b-mockups/5b-explorar-portal.html).
//   · A · AL ENTRAR, LA VISTA GLOBAL: todo Gran Santiago con el financiamiento por defecto. Desde el 30-oct-2026 (recorrido
//     real de Fabrizio): sin la tarjeta del número sobre el mapa. Al mover el mapa, «Buscar en esta zona». «Mi búsqueda» vive en
//     Filtros. LA PASADA REAL DEL 03-NOV-2026: de entrada, los ✓ Comprar y los − Ajustar que llegan con hasta 10 % (el mismo
//     pedido del mapa); arriba, «Filtros», el chip «Ver solo [✓ Comprar]» y «¿Cómo se calcula?», que abre la hoja directo; abajo,
//     en el teléfono y en el PC, el desglose (desglose.tsx: «10.040 deptos», «6.802 [✓ Comprar] al precio publicado», «3.238
//     [− Ajustar] requieren negociar el precio») con «Ver lista»; la píldora negra del PC se retiró.
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
//   · FILTROS V2 Y LOS − AJUSTAR (02-nov-2026, mockup 8-filtros-v2-negociar.html; de entrada desde el 03-nov-2026): los que dan
//     Ajustar al precio publicado y llegan a Comprar con un descuento van en su CAPA APARTE (capa-negociar.ts): su pin en la ciruela
//     del chip Ajustar (colores-pin.ts), su línea en el desglose (nunca sumada a «convienen»), después de los ✓ Comprar en la lista,
//     y los dos veredictos en la tarjeta y el pop-up con «Analizar a UF 2.950». En Filtros, «Descuento máximo para − Ajustar».
//   · COMPARTIR (02-nov-2026, goal «Compartir un depto desde Explorar», lib/explorar/compartir.ts): «Compartir» en la tarjeta y
//     en cada fila de la lista, con y sin cuenta. En el teléfono, la hoja del sistema (sin ella, WhatsApp); en el PC copia el
//     enlace y lo dice. El enlace lleva el código de invitación de quien tiene cuenta (pedido al abrir la primera tarjeta o
//     la lista: la hoja tiene que abrirse en el mismo toque). EL ENLACE abre esta página en ese pin, con la tarjeta abierta y
//     el mapa centrado; si el aviso ya no está, la tarjeta de «ya no está» con los parecidos que sí dan (compartido-caido.tsx).
//     DESDE EL 04-NOV-2026 (la pasada de Fabrizio), en una hoja como la de bienvenida, «Te compartieron este depto», con la tarjeta
//     grande del depto o, si ya no está, lo que pasó y los parecidos (compartido-hoja.tsx); sin la tarjeta del carrusel.
//     UN NEGOCIADO (03-nov-2026) se comparte con su precio negociado y su descuento, y su enlace lleva el tope de la capa: abre
//     con «Si negocias» prendido, en ese pin, con la tarjeta de los dos veredictos —con el precio de hoy si se movió—; si con
//     los datos de hoy ya no llega dentro del tope, la tarjeta de «ya no llega» con parecidos.
//     LA FIRMA (03-nov-2026): el enlace lleva la firma del servidor para ese aviso y el código de quien comparte, que trae el
//     mismo pedido (POST /api/explorar/compartido, con su tope de 60 por hora); sin firma no hay enlace, y se dice.
// ─────────────────────────────────────────────────────────────────────────────
import { PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { claveActual, iniciarCarga } from "@/lib/carga-global";
import { cuandoLaPaginaEsteQuieta } from "@/lib/pagina-quieta";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { usePostHog } from "@/lib/posthog-react";
import { comprasDeExplorar, lineaTicketConSaldo, nombreDelDepto } from "@/lib/guia/compra-desde-depto";
import { alCerrarQueda, informeCambio, informeFallo, informeGenerando, informeListo, type PasoInforme, type VeredictoVisto } from "@/lib/guia/informe-en-camino";
import { InformeListoAviso } from "@/components/guia/InformeEnCamino";
import { cuandoVenceCorto } from "@/lib/lo-que-sigue/oferta-pack";
import type { EleccionAnalizar } from "@/components/guia/AvisoAntesDeAnalizar";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import { botonAnalizar, type Recalculo } from "@/lib/explorar/explorar";
import { textoAnalizarIgual } from "@/lib/guia/semanal-str";
import {
  cercanos, claveUniverso, COMO_SE_CALCULA, comunasACalcular, descompactar, desgloseBarra, EVENTOS_PORTAL, etiquetaFiltros, filtrar, filtrosCambiados, lineaPlan, propsDeTasa,
  lineaBusqueda, ordenar, perfilDeFiltros, PORTAL_COPY, propsDeFiltros, textoRecalculo, universoDeLaNoche, urlDePortal, validarPortal,
  type FiltrosPortal, type OrdenPortal, type PinMapa, type TasaDelMotor,
} from "@/lib/explorar/portal";
// Solo el tipo (se borra al compilar): la forma de GET /api/explorar, la misma que arma la ruta.
import type { RespuestaUniverso } from "@/lib/explorar/portal-servidor";
import { conParteBase, conParteNo, conSello, urlUniverso } from "@/lib/explorar/url-noche";
import { TarjetaPin } from "./tarjeta-pin";
import { ChipVeredictoTokens } from "@/components/analysis/shared/ChipVeredicto";
import type { ResumenInforme } from "@/lib/informe-propio";
import type { MotivoSinRegalo } from "@/lib/regalo-alta";
import {
  capaDeLaNoche, capaVisible, claseDePin, conCifrasNegociado, descompactarNegociados, esNegociado, EVENTO_NEGOCIAR, EVENTO_SOLO_COMPRAR, negociadosVisibles, ordenarNegociados, propsNegociar,
  propsSoloComprar, type Negociacion, type NegociadosCompactos, type PinNegociado,
} from "@/lib/explorar/capa-negociar";
import { NEGOCIADO_COPY } from "@/lib/precio-publicado";
import { Contador } from "./contador";
import { histograma, PROYECTOS_VISIBLE, SELECTOR_COPY, textoCifraPin, type BarraPanel, type ClaseMapa, type ConteoClases } from "@/lib/explorar/mapa-todos";
import type { ItemCapa } from "@/lib/explorar/capa-canvas";
import {
  accionDeVuelta, bienvenidaVista, EVENTOS_ABIERTO, filtrosAbiertos, marcarBienvenida, ORDENES_CON_CIFRAS, PIE_ABIERTO,
  type MotivoRegistro, type OrigenExplorar, type PedidoRegistro,
} from "@/lib/explorar/abierto";
import { claveDeDestino } from "@/lib/deptos/respuesta";
import { conTopeYReintento } from "@/lib/deptos/entrada";
import { PASO_REGALO_MS, TOPE_ESPERA_REGALO_MS } from "@/lib/deptos/alta-orden";
import { avisarLead } from "@/lib/meta/lead-cliente";
import {
  aperturaCompartida, COMPARTIR_COPY, deptoDePin, esVistaEstandar, EVENTOS_COMPARTIR, mensajeCompartir, pideAlServidor, textoCompartir, topeDelEnlace, veredictoDelPin,
  type DeptoCompartido, type EstadoCaido, type MetodoCompartir, type OrigenCompartir, type VeredictoCompartido,
} from "@/lib/explorar/compartir";
import { enlaceCompartido, PARAMS_DE_UNA_VEZ } from "@/lib/explorar/enlace-compartido";
import { analizadosDeLaPestana, anotarVolver, hrefDelMapa } from "@/lib/explorar/volver-al-mapa";
import { recalcularEnCola, respaldoDelFusible, respuestaDeComuna, type AvanceRecalculo } from "@/lib/explorar/cola-recalculo";
import type { CasoCompartido } from "./compartido-hoja";
import { useInscritos } from "@/components/invierte/inscritos";
import { INVIERTE_COPY, type DeptoInvierte } from "@/lib/invierte/invierte";
import { URL_INVIERTE, destinoBoton } from "@/lib/invierte-v2/destino";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { SUMAR_COPY, urlSumar } from "@/lib/invierte-v2/base";
import { lineaDepto } from "@/lib/guia/linea-depto";
import "./explorar.css";
import { PARAM_ASESORIA, SIN_ASESORIA, type AccesoAsesoria } from "@/lib/asesoria/acceso";
import { MIRO_MOVIMIENTOS, MIRO_MS, MIRO_TARJETAS } from "@/lib/asesoria/estado";
import type { FiltroAsesoria } from "./asesoria/asesoria";

/** El filtro de la asesoría como filtro activo de la barra (F22). */
const FILTRO_PERFIL_COPY = { etiqueta: "Tu perfil", quitar: "Quitar el filtro de tu perfil" } as const;
import "@/components/invierte/invierte.css";

const MapaExplorar = dynamic(() => import("./mapa-explorar"), { ssr: false, loading: () => null });
// Lo que no hace falta para el primer pintado entra cuando se abre (LCP en el teléfono).
const HojaFiltros = dynamic(() => import("./hoja-filtros").then((m) => m.HojaFiltros), { ssr: false, loading: () => null });
const ListaPortal = dynamic(() => import("./lista-portal").then((m) => m.ListaPortal), { ssr: false, loading: () => null });
const AvisameDialogo = dynamic(() => import("./avisame-dialogo").then((m) => m.AvisameDialogo), { ssr: false, loading: () => null });
const AvisoAntesDeAnalizar = dynamic(() => import("@/components/guia/AvisoAntesDeAnalizar").then((m) => m.AvisoAntesDeAnalizar), { ssr: false, loading: () => null });
const PopupNoDa = dynamic(() => import("@/components/guia/PopupNoDa").then((m) => m.PopupNoDa), { ssr: false, loading: () => null });
const HojaRegistro = dynamic(() => import("./hoja-registro").then((m) => m.HojaRegistro), { ssr: false, loading: () => null });
const Bienvenida = dynamic(() => import("./bienvenida").then((m) => m.Bienvenida), { ssr: false, loading: () => null });
// LA ASESORÍA EN EL MAPA (27-nov-2026, entrega 1): detrás del interruptor (lib/asesoria/acceso.ts); su código baja solo si está habilitada.
const Asesoria = dynamic(() => import("./asesoria/asesoria").then((m) => m.Asesoria), { ssr: false, loading: () => null });
const HojaCalculo = dynamic(() => import("./hoja-calculo").then((m) => m.HojaCalculo), { ssr: false, loading: () => null });
const HojaCompartida = dynamic(() => import("./compartido-hoja").then((m) => m.HojaCompartida), { ssr: false, loading: () => null });
const PopupRecalculo = dynamic(() => import("./recalculo").then((m) => m.PopupRecalculo), { ssr: false, loading: () => null });
const HojaInvierte = dynamic(() => import("@/components/invierte/HojaInvierte").then((m) => m.HojaInvierte), { ssr: false, loading: () => null });
// Invierte con Franco, comprador (18-nov-2026): la hoja de contacto del flujo nuevo, solo con acceso y un usado.
const HojaContacto = dynamic(() => import("@/components/invierte-v2/HojaContacto").then((m) => m.HojaContacto), { ssr: false, loading: () => null });

/** El depto de «Invierte con Franco» desde un pin (11-nov-2026): la línea, el precio publicado y el chip (Ajustar si es negociable). */
const deptoInvierteDePin = (p: PinMapa): DeptoInvierte => ({ avisoId: p.avisoId, linea: lineaDepto(p), precioUF: p.precioUF, veredicto: esNegociado(p) ? "AJUSTA SUPUESTOS" : p.veredicto, score: esNegociado(p) ? null : p.score });

const ESPERA_EN_CURSO_MS = 4000;
// Las comunas que se calculan (otro pie u otro plazo, o renta corta) van DE A UNA desde el 04-nov-2026 (eran 3 y, desde el 02-nov,
// 2): la cola vive en cola-recalculo.ts, y el tope de todo el sitio, en el servidor (turnos-recalculo.ts).

/** Lo que el servidor sabe de la cuenta (portal-servidor.ts › CuentaPortal), sin nada que no se pueda mostrar. */
export interface CuentaCliente {
  analizados: Record<string, string>;
  /** El resumen de cada informe propio, por id (05-nov-2026, lib/informe-propio.ts). */
  resumenes: Record<string, ResumenInforme>;
  guardados: string[];
  saldo: EstadoSaldo;
  suscrito: boolean;
  ticket: boolean;
  cuentaCreadaAt: string | null;
  finanzas: { uf: number | null; tasa: number | null };
  miBusqueda: FiltrosPortal | null;
  busquedaActual: string | null;
  explorarEnMes: number;
  /** Por qué no tiene regalo (05-nov-2026): la banda de la vuelta lo dice. */
  sinRegalo?: MotivoSinRegalo | null;
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
  /** El número de «convienen» de todo el sitio (el universo de la vista global, contado en page.tsx), para la bienvenida; solo sin cuenta. */
  convienen: number | null;
  /** Los − Ajustar de la vista global (03-nov-2026), aparte, para «y 3.238 más si negocias el precio» de la bienvenida; solo sin cuenta. */
  negociadosGlobal: number | null;
  /** Los − Ajustar con estos filtros, contados por el servidor para el primer pintado de la barra (null: hay que esperar la capa). */
  nAjustar: number | null;
  /** Los No conviene con estos filtros (25-nov-2026), para el primer pintado del contador; null: hay que esperar el universo. */
  nNo?: number | null;
  /** El sello de la noche que contó estas cifras (03-nov-2026, portal-cache.ts › nocheExplorar); null si no se leyó la noche. */
  sello: string | null;
}

/** Un pedido de la noche o de la capa, con el sello de la noche que contó la página (la API lee esa misma). */
// La dirección del pedido (y su sello) sale de url-noche.ts: la misma que la página pide por adelantado.

/** EL ENLACE COMPARTIDO con que se entró (page.tsx › compartidoDe): el aviso; «despublicado» si el servidor sabe que ya no
 *  está publicado (si da Comprar lo dice el universo que se carga); y el depto, para la tarjeta de «ya no está». El de un
 *  negociado (03-nov-2026) trae el tope de la capa y, verificado con los datos de hoy, «no-llega» o el negociado de hoy, que
 *  reemplaza al de la noche: con cuenta si se movió; sin cuenta siempre, así su precio negociado se ve nítido (el flujo no
 *  viaja). */
export interface CompartidoCliente {
  avisoId: string;
  estado: "despublicado" | "no-llega" | null;
  depto: DeptoCompartido | null;
  tope?: number | null;
  neg?: Negociacion | null;
}

/** Lo que trae el pedido de «Compartir» (POST /api/explorar/compartido): la firma, el código de quien comparte y lo que dice
 *  el servidor del aviso; o por qué no hay firma. */
type EnlacePreparado = { firma: string; codigo: string | null; ver: VeredictoCompartido } | { error: "tope" | "sin-firma" };

/** Copia al portapapeles; sin la API (un contexto sin https, un navegador viejo), con un campo escondido. */
async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); return true; }
  } catch { /* sin permiso: se intenta a la antigua */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
const TOAST_MS = 2400;

/** Lo que se muestra sin cuenta: nada de la persona, sin saldo. */
const CUENTA_VACIA: CuentaCliente = {
  analizados: {}, resumenes: {}, guardados: [], saldo: { tipo: "sin" }, suscrito: false, ticket: false, cuentaCreadaAt: null,
  finanzas: { uf: null, tasa: null }, miBusqueda: null, busquedaActual: null, explorarEnMes: 0,
};
/** El pop-up que usa el regalo habla solo del regalo (ofertas de a una, 29-oct-2026): sin la línea del ticket. */
const usaRegalo = (s: EstadoSaldo): boolean => s.tipo === "regalo" || (s.tipo === "con" && !!s.proximoRegalo);

// `no` (25-nov-2026, el mapa con todos los deptos): los No conviene de ese universo, sin cifras (solo sus tramos).
type Universo = { comunas: "todas" | string[]; pines: PinMapa[]; no?: PinMapa[] };
/** Los No conviene de una respuesta: descompactados, con el veredicto de su clase (llegan en el formato del universo). */
const noDe = (u: RespuestaUniverso["noConviene"]): PinMapa[] => descompactar(u).map((p) => ({ ...p, veredicto: "BUSCAR OTRA", score: null, flujo: null, arriendo: null }));
/** La capa calculada de una combinación (04-nov-2026): las comunas que ya llegaron y sus − Ajustar. */
type CapaCalculada = { comunas: string[]; pines: PinNegociado[] };
/** Suma los − Ajustar de una comuna a la capa calculada de una clave (una comuna llega una vez). */
const agregarCapa = (cs: Record<string, CapaCalculada>, clave: string, comuna: string, nuevos: PinNegociado[]): Record<string, CapaCalculada> => {
  const prev = cs[clave];
  if (prev?.comunas.includes(comuna)) return cs;
  const ids = new Set((prev?.pines ?? []).map((x) => x.avisoId));
  return { ...cs, [clave]: { comunas: [...(prev?.comunas ?? []), comuna], pines: [...(prev?.pines ?? []), ...nuevos.filter((x) => !ids.has(x.avisoId))] } };
};

// El mapa quieto del primer pintado (el LCP) NO va acá: es una capa de la página (page.tsx), una sola imagen y antes del header
// en el HTML. El cliente avisa cuándo el mapa real dibujó sus teselas (`data-mapa`) y la capa se desvanece (explorar.css).
export function ExplorarCliente({ inicial, abrir: abrirProp = null, autoAnalizar = null, origen = "directo", correo = null, compartido = null, invierteV2 = false, invierteFirmo = false, misDeptos = [], asesoria = SIN_ASESORIA, plazoPerfil = null }: {
  inicial: InicialPortal;
  abrir?: string | null;
  autoAnalizar?: string | null;
  /** Entró por el enlace de un depto compartido (02-nov-2026). */
  compartido?: CompartidoCliente | null;
  /** Sin cuenta: de dónde llegó (la landing o directo), el detalle de la puerta E. */
  origen?: OrigenExplorar;
  /** Con cuenta: el correo, para el Lead al volver de Google (recién ahí se sabe). */
  correo?: string | null;
  /** Invierte con Franco, comprador (18-nov-2026): el interruptor de esta persona, decidido en el servidor. Sin él, Pronto. */
  invierteV2?: boolean;
  /** Ya firmó la orden de Invierte con Franco (20-nov-2026): el botón de un usado dice «Sumar a mis opciones de inversión» y lleva
   *  directo a esa pantalla, sin la hoja de contacto. */
  invierteFirmo?: boolean;
  /** Los deptos que ya sigue en Invierte con Franco (19-nov-2026): en su tarjeta, «Mi inversión». */
  misDeptos?: string[];
  /** La asesoría en el mapa (27-nov-2026): si esta visita la ve (el interruptor, decidido en el servidor) y si es de prueba. */
  asesoria?: AccesoAsesoria;
  /** El plazo del perfil de la cuenta (tercera vuelta de la asesoría): la tarjeta muestra el flujo a ese plazo. */
  plazoPerfil?: number | null;
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
  /** Las claves cuya segunda parte (los No conviene de la noche) está en camino. */
  const enCursoNo = useRef(new Set<string>());
  const sinCuentaRef = useRef(sinCuenta);
  sinCuentaRef.current = sinCuenta;
  const [progreso, setProgreso] = useState<AvanceRecalculo | null>(null);
  const [fallo, setFallo] = useState(false);
  /** Las comunas que no cargaron en el último cálculo (02-nov-2026), con la clave del universo al que pertenecen. */
  const [fallidas, setFallidas] = useState<{ clave: string; comunas: string[] } | null>(null);
  const [vista, setVista] = useState<"mapa" | "lista">("mapa");
  const [mapaListo, setMapaListo] = useState(false);
  const [mapa, setMapa] = useState<"cargando" | "listo" | "teselas" | "fallo">("cargando");
  // El pin abierto: el de la página (`a`) o, al volver del informe con «atrás», el que quedó en la barra (volver-al-mapa.ts).
  const [abrir, setAbrir] = useState<string | null>(abrirProp);
  const [sel, setSel] = useState<string | null>(abrirProp);
  const [carrusel, setCarrusel] = useState<string[]>([]);
  const [hojaFiltros, setHojaFiltros] = useState(false);
  // «Buscar en esta zona» se fue (26-nov-2026): el mapa ya trae todos los deptos. Una zona que venga en la URL sigue filtrando.
  const [sinBusqueda, setSinBusqueda] = useState(false);
  const [guardados, setGuardados] = useState<Set<string>>(() => new Set(cuenta.guardados));
  const [confirmar, setConfirmar] = useState<{ it: PinMapa; sin: boolean; analizando?: boolean; movido?: string } | null>(null);
  /** El precio negociado que la ruta verificó con los datos de hoy (02-nov-2026): el nuevo, o fuera de la capa si ya no llega. */
  const [movidos, setMovidos] = useState<Record<string, Negociacion>>({});
  // LO DE HOY (23-nov-2026, decisión de Fabrizio): cuando «Analizar» dice que el depto cambió, la tarjeta pasa a mostrar el veredicto,
  // el puntaje y el flujo de hoy (la fila guardada también se actualiza en el servidor, para todos).
  const [hoyAqui, setHoyAqui] = useState<Record<string, { veredicto: string; score: number | null; flujo: number | null }>>({});
  const [noLlegan, setNoLlegan] = useState<string[]>([]);
  const [noDa, setNoDa] = useState<{ it: PinMapa; porQue: string | null; publicacion: string | null; ocupado?: boolean } | null>(null);
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
  // DESPUÉS DE «ANALIZAR» (03-nov-2026, lib/guia/informe-en-camino.ts): lo que pasa con el informe, en el mismo pop-up; el aviso
  // de arriba si quedó listo sin abrirse; y los analizados de esta visita (la tarjeta dice «Ya lo analizaste · Ver informe»).
  const [informe, setInforme] = useState<PasoInforme | null>(null);
  const [listoSinAbrir, setListoSinAbrir] = useState<{ id: string; ruta: string; depto: string; t0: number } | null>(null);
  const [analizadosAqui, setAnalizadosAqui] = useState<Record<string, string>>({});
  // El resumen de los informes hechos en esta visita (05-nov-2026): lo que respondió la ruta al crearlo.
  const [resumenesAqui, setResumenesAqui] = useState<Record<string, ResumenInforme>>({});
  const ultimoAnalisis = useRef<{ it: PinMapa; eleccion?: EleccionAnalizar } | null>(null);
  const soltarCarga = useRef<(() => void) | null>(null);
  const [caidos, setCaidos] = useState<string[]>([]);
  const [avisame, setAvisame] = useState(false);
  const [registro, setRegistro] = useState<{ pedido: PedidoRegistro; filtros: FiltrosPortal; orden: OrdenPortal } | null>(null);
  // «Invierte con Franco» (11-nov-2026): la hoja de inscripción del pin; `retomar` al volver del registro con lo contestado.
  const [invierte, setInvierte] = useState<{ pin: PinMapa; retomar: boolean } | null>(null);
  const [contactoV2, setContactoV2] = useState<PinMapa | null>(null);
  const inscritos = useInscritos(!sinCuenta);
  const [bienvenida, setBienvenida] = useState(false);
  // LA ASESORÍA (27-nov-2026): el filtro que pone sobre el mapa (los que calzan y, en «Dónde», las marcas), el último toque del mapa
  // fuera de un pin y cuándo ya miró deptos (2 tarjetas, o 20 s con 2 movimientos del mapa): recién ahí aparece la burbuja.
  const [filtroAsesoria, setFiltroAsesoria] = useState<FiltroAsesoria | null>(null);
  const [toqueMapa, setToqueMapa] = useState<{ lat: number; lng: number; t: number } | null>(null);
  const [aireAsesoria, setAireAsesoria] = useState<{ abajo: number; derecha: number } | null>(null);
  // Quitar el filtro del perfil desde el botón Filtros, con la hoja cerrada (F22): la asesoría lo apaga hasta «Retomar».
  const [quitarAsesoria, setQuitarAsesoria] = useState(0);
  // Con la burbuja de la asesoría a la vista, el contador del mapa se esconde (tercera vuelta, 27-nov-2026).
  const [burbujaAsesoria, setBurbujaAsesoria] = useState(false);
  const [miro, setMiro] = useState({ tarjetas: 0, movimientos: 0, veinte: false });
  useEffect(() => {
    if (!asesoria.habilitada) return;
    // Desde /deptos (`?asesoria=1`) la burbuja sale de entrada: esa puerta ya era la de quien busca qué comprar.
    if (new URLSearchParams(window.location.search).get(PARAM_ASESORIA) === "1") setMiro((m) => ({ ...m, tarjetas: MIRO_TARJETAS }));
    const t = window.setTimeout(() => setMiro((m) => ({ ...m, veinte: true })), MIRO_MS);
    return () => window.clearTimeout(t);
  }, [asesoria.habilitada]);
  const yaMiro = miro.tarjetas >= MIRO_TARJETAS || (miro.veinte && miro.movimientos >= MIRO_MOVIMIENTOS);
  // El encuadre con la asesoría: se reencuadra al abrir la hoja y cuando cambian los que calzan; en «Dónde» queda quieto.
  const claveEncuadreAsesoria = !filtroAsesoria ? "" : filtroAsesoria.quieto ? "|as:quieto" : "|as:" + (filtroAsesoria.ids?.size ?? "todos") + ":" + (aireAsesoria?.abajo ?? 0) + ":" + (aireAsesoria?.derecha ?? 0);
  // «¿Cómo se calcula?» (30-oct-2026): la hoja corta del enlace de la barra de arriba, con y sin cuenta. Abre directo (03-nov-2026).
  const [calculo, setCalculo] = useState(false);
  // EN EL TELÉFONO, «Cómo se calcula» al lado del botón redondo SI CABE (03-nov-2026): se mide lo que dejan libre «Filtros» y el
  // chip (cambian de ancho con «Filtros · 3» y con la letra); si no cabe entero, va solo el botón —nunca cortado—.
  const barra = useRef<HTMLDivElement>(null);
  const comoTexto = useRef<HTMLSpanElement>(null);
  const [comoCabe, setComoCabe] = useState(false);
  useEffect(() => {
    const b = barra.current, t = comoTexto.current;
    if (!b || !t || typeof ResizeObserver === "undefined") return;
    const medir = () => {
      const e = getComputedStyle(b);
      const gap = parseFloat(e.columnGap) || 0;
      const libre = b.clientWidth - (parseFloat(e.paddingLeft) || 0) - (parseFloat(e.paddingRight) || 0);
      const hijos = Array.from(b.children) as HTMLElement[];
      const texto = t.getBoundingClientRect().width;
      const gapComo = parseFloat(getComputedStyle(t.parentElement ?? t).columnGap) || 0;
      const enLinea = getComputedStyle(t).position !== "absolute";
      // Lo que ocupan los botones sin el texto, más los espacios entre ellos.
      const usado = hijos.reduce((s, h) => s + h.getBoundingClientRect().width, 0) - (enLinea ? texto + gapComo : 0) + gap * Math.max(0, hijos.length - 1);
      setComoCabe(texto > 0 && libre - usado >= texto + gapComo);
    };
    medir();
    const o = new ResizeObserver(medir);
    o.observe(b);
    for (const h of Array.from(b.children)) o.observe(h);
    return () => o.disconnect();
  }, []);
  const abrirCalculo = () => {
    setCalculo(true);
    posthog?.capture(EVENTOS_PORTAL.comoSeCalcula, { sin_cuenta: sinCuenta, pie: filtros.pie, plazo: filtros.plazo, modalidad: filtros.modalidad, tasa: inicial.tasa?.tasa ?? null });
  };
  const [aviso, setAviso] = useState<string | null>(null);
  // Recién registrada desde un pin (30-oct-2026): esa tarjeta vuelve desbloqueada, con su banda; el pop-up lo abre la persona.
  const [recien, setRecien] = useState<{ avisoId: string; regalo: boolean; sinRegalo?: MotivoSinRegalo | null } | null>(null);
  // EL ENLACE COMPARTIDO (02-nov-2026): la tarjeta de «ya no está» y si el mapa ya se centró en el depto.
  // LA HOJA DEL COMPARTIDO (04-nov-2026, compartido-hoja.tsx): el pin del enlace (su tarjeta grande) o, si ya no está, lo que pasó.
  // El teléfono (bajo 768 px, el corte de explorar.css): lo usa el contador para plegarse con la tarjeta abierta. Sigue al ancho.
  const [esTelefono, setEsTelefono] = useState(false);
  const [altoTarjeta, setAltoTarjeta] = useState(0);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const m = window.matchMedia("(max-width: 767px)");
    const f = () => setEsTelefono(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  const [hojaComp, setHojaComp] = useState<{ tipo: "pin"; avisoId: string } | { tipo: "caido"; estado: EstadoCaido; depto: DeptoCompartido | null; parecidos: PinMapa[] } | null>(null);
  /** La capa «Si negocias» no llegó: el enlace de un negociado no la espera más (03-nov-2026). */
  const [capaFallo, setCapaFallo] = useState(false);
  const [focoUsado, setFocoUsado] = useState(!compartido && !abrirProp);
  const compartidoResuelto = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const vivo = useRef(true);
  const uf = cuenta.finanzas.uf;
  // LA CAPA DE LOS − AJUSTAR (02-nov-2026; de entrada desde el 03-nov-2026): por pie, lo que guardó la noche. Llega en el mismo
  // pedido del universo de la noche; si ese pedido no la trajo, se pide aparte.
  const [negociados, setNegociados] = useState<Record<number, PinNegociado[]>>({});
  const negociadosRef = useRef(negociados);
  negociadosRef.current = negociados;
  const enCursoNeg = useRef(new Set<number>());
  // LA CAPA CALCULADA (04-nov-2026, la pasada de Fabrizio): con otra tasa, pie o plazo, los − Ajustar de cada comuna, por la clave
  // del universo (como lo calculado). Llegan en el mismo pedido de cada comuna del universo calculado; con pie 20 % o 30 % a 25 años,
  // cuyo universo sí es de la noche, aparte (asegurarCapaCalculada).
  const [capasCalc, setCapasCalc] = useState<Record<string, CapaCalculada>>({});
  const capasCalcRef = useRef(capasCalc);
  capasCalcRef.current = capasCalc;
  // EL SELLO DE LA NOCHE (03-nov-2026, portal-cache.ts › nocheExplorar): el de la noche que contó la página. Va en cada pedido de
  // la noche y de la capa, así la API trae esa misma aunque entretanto haya otra: en esta carga, la página, el mapa y la barra
  // dicen lo mismo. Si la página no lo trajo, el del primer pedido que conteste.
  const selloRef = useRef(inicial.sello);

  // ── el universo ──
  const universoPara = useCallback((f: FiltrosPortal, us: Record<string, Universo>, parcial = false): PinMapa[] | null => {
    const u = us[claveUniverso(f)];
    if (!u) return null;
    if (u.comunas === "todas") return u.pines;
    const hay = new Set(u.comunas);
    const pedidas = comunasACalcular(f);
    if (pedidas.every((c) => hay.has(c))) return u.pines;
    // LO QUE SÍ CARGÓ (02-nov-2026): con `parcial`, si llegó alguna comuna, sus pines; las que fallaron se reintentan aparte.
    return parcial && pedidas.some((c) => hay.has(c)) ? u.pines : null;
  }, []);

  /** La capa calculada de unos filtros: la de sus comunas, si llegaron todas (con `parcial`, lo que llegó). */
  const capaCalculadaPara = useCallback((f: FiltrosPortal, cs: Record<string, CapaCalculada>, parcial = false): PinNegociado[] | null => {
    const c = cs[claveUniverso(f)];
    if (!c) return null;
    const hay = new Set(c.comunas);
    const pedidas = comunasACalcular(f);
    if (pedidas.every((x) => hay.has(x))) return c.pines;
    return parcial && pedidas.some((x) => hay.has(x)) ? c.pines : null;
  }, []);

  /** LA CAPA CALCULADA APARTE (04-nov-2026): la de pie 20 % o 30 % a 25 años —su universo sale de la noche, su capa no—, de a una
   *  comuna (GET /api/explorar/negociar con `z`, `ta` y `c`), con el mismo avance y el mismo pop-up que un universo calculado. */
  const asegurarCapaCalculada = useCallback(async (f: FiltrosPortal) => {
    const clave = claveUniverso(f);
    const ya = capasCalcRef.current[clave];
    const tengo = new Set(ya ? ya.comunas : []);
    const faltan = comunasACalcular(f).filter((c) => !tengo.has(c) && !enCurso.current.has(`capa|${clave}|${c}`));
    if (faltan.length === 0) return;
    for (const c of faltan) enCurso.current.add(`capa|${clave}|${c}`);
    const base = `/api/explorar/negociar?p=${f.pie}&z=${f.plazo}${f.tasa != null ? `&ta=${f.tasa}` : ""}`;
    // De a una comuna (04-nov-2026, cola-recalculo.ts): «ocupado» espera y reintenta; «pausado» para la cola.
    const { perdidas, pausado } = await recalcularEnCola<{ negociados: NegociadosCompactos }>({
      comunas: faltan,
      pedir: async (c) => respuestaDeComuna(await fetch(`${base}&c=${encodeURIComponent(c)}`, { cache: "default" })),
      alListo: (comuna, d) => {
        const negs = descompactarNegociados(d.negociados);
        if (vivo.current) setCapasCalc((cs) => agregarCapa(cs, clave, comuna, negs));
      },
      alAvance: (a) => { if (vivo.current) setProgreso(a); },
      vivo: () => vivo.current,
    });
    for (const c of faltan) enCurso.current.delete(`capa|${clave}|${c}`);
    if (vivo.current) { if (pausado) setFallidas({ clave, comunas: perdidas }); else { setProgreso(null); if (perdidas.length) { setFallo(true); setFallidas({ clave, comunas: perdidas }); } } }
  }, []);

  /** LA CAPA APARTE, de respaldo: solo si el pedido del universo de la noche no la trajo (con pie 20 % o 30 % a 30 años la trae
   *  siempre; si su lectura falló en el servidor, sale sin ella). Una vez por pie. */
  const asegurarNegociados = useCallback(async (f: FiltrosPortal) => {
    if (!capaDeLaNoche(f)) return;
    const pie = sinCuentaRef.current ? PIE_ABIERTO : f.pie;
    if (negociadosRef.current[pie] || enCursoNeg.current.has(pie)) return;
    enCursoNeg.current.add(pie);
    try {
      const res = await fetch(conSello(sinCuentaRef.current ? "/api/explorar/abierto/negociar" : `/api/explorar/negociar?p=${pie}`, selloRef.current), { cache: "default" });
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as { negociados: NegociadosCompactos; sello?: string | null };
      if (d.sello) selloRef.current = d.sello;
      if (vivo.current) setNegociados((ns) => ({ ...ns, [pie]: descompactarNegociados(d.negociados) }));
    } catch {
      // Sin la capa, el mapa sigue con los que convienen: la capa es aparte.
      if (vivo.current) setCapaFallo(true);
    } finally {
      enCursoNeg.current.delete(pie);
    }
  }, []);

  /** LA SEGUNDA PARTE DEL PEDIDO (26-nov-2026, entrega 2 › A): los No conviene de la noche, pedidos después de que el navegador pintó
   *  los primeros pines (un cuadro y una vuelta del bucle), con el mismo sello. Se suman sin mover el mapa: el encuadre ya se hizo con la
   *  primera parte y no depende de ellos. Si falla, quedan pendientes (el contador sigue con los números del HTML) y se reintenta una vez. */
  const asegurarNoConviene = useCallback(async (clave: string, base: string) => {
    if (enCursoNo.current.has(clave)) return;
    enCursoNo.current.add(clave);
    try {
      await new Promise<void>((listo) => requestAnimationFrame(() => setTimeout(listo, 0)));
      for (let intento = 0; intento < 2; intento++) {
        try {
          const res = await fetch(conSello(conParteNo(base), selloRef.current), { cache: "default" });
          if (!res.ok) throw new Error(String(res.status));
          const d = (await res.json()) as RespuestaUniverso;
          if (vivo.current) setUniversos((us) => (us[clave] ? { ...us, [clave]: { ...us[clave], no: noDe(d.noConviene) } } : us));
          return;
        } catch { /* un reintento */ }
      }
    } finally {
      enCursoNo.current.delete(clave);
    }
  }, []);

  /** Trae lo que falte para unos filtros: la noche entera en un pedido —con los − Ajustar en el mismo, desde el 03-nov-2026—, o
   *  lo calculado de a una comuna. */
  const asegurar = useCallback(async (f: FiltrosPortal) => {
    const clave = claveUniverso(f);
    // Sin cuenta, el universo sin cifras (el financiamiento por defecto): otra ruta, pública y en la caché del CDN.
    const base = urlUniverso(f, sinCuentaRef.current);
    setFallo(false);
    setFallidas(null);
    try {
      if (universoDeLaNoche(f)) {
        // La capa que la noche no guarda (pie 20 % o 30 % a 25 años, 04-nov-2026): por comuna, mientras llega el universo.
        if (capaVisible(f) && !capaDeLaNoche(f)) void asegurarCapaCalculada(f);
        // Ya cargado: si a su pie le falta la capa (otro plazo antes, o no llegó), se pide aparte.
        // Si la segunda parte quedó pendiente (falló), se pide de nuevo al volver a estos filtros.
        if (universosRef.current[clave]) { void asegurarNegociados(f); if (!universosRef.current[clave].no) void asegurarNoConviene(clave, base); return; }
        if (enCurso.current.has(clave)) return;
        enCurso.current.add(clave);
        const conCapa = capaDeLaNoche(f);
        const pieNeg = sinCuentaRef.current ? PIE_ABIERTO : f.pie;
        // La capa viene en este mismo pedido: nadie la pide aparte mientras tanto.
        if (conCapa) enCursoNeg.current.add(pieNeg);
        let trajoCapa = false;
        try {
          const res = await fetch(conSello(conParteBase(base), selloRef.current), { cache: "default" });
          if (!res.ok) throw new Error(String(res.status));
          const d = (await res.json()) as RespuestaUniverso;
          if (d.sello) selloRef.current = d.sello;
          if (vivo.current) {
            // EL PEDIDO PARTIDO (26-nov-2026): esta parte trae ✓ Comprar y − Ajustar; los No conviene quedan PENDIENTES (`no` sin definir:
            // el contador sigue con los números del HTML) y llegan en la segunda, después de dibujar los primeros pines.
            setUniversos((us) => ({ ...us, [clave]: { comunas: "todas", pines: descompactar(d.universo), no: d.noConviene ? noDe(d.noConviene) : undefined } }));
            if (conCapa && d.negociados) {
              trajoCapa = true;
              const ns = descompactarNegociados(d.negociados);
              setNegociados((x) => ({ ...x, [pieNeg]: ns }));
            }
          }
        } finally {
          enCurso.current.delete(clave);
          if (conCapa) enCursoNeg.current.delete(pieNeg);
        }
        if (conCapa && !trajoCapa) void asegurarNegociados(f);
        // La segunda parte: los No conviene, después del primer dibujo.
        if (vivo.current) void asegurarNoConviene(clave, base);
        return;
      }
      const ya = universosRef.current[clave];
      const tengo = new Set(ya && ya.comunas !== "todas" ? ya.comunas : []);
      const faltan = comunasACalcular(f).filter((c) => !tengo.has(c) && !enCurso.current.has(`${clave}|${c}`));
      for (const c of faltan) enCurso.current.add(`${clave}|${c}`);
      if (faltan.length === 0) return;
      // DE A UNA COMUNA (04-nov-2026, después de la caída de la base; cola-recalculo.ts): la siguiente sale cuando la anterior
      // respondió, y el servidor responde después de guardar. «Ocupado» espera y reintenta; «pausado» para la cola y el pop-up
      // ofrece la tasa del mes.
      const { perdidas, pausado } = await recalcularEnCola<RespuestaUniverso>({
        comunas: faltan,
        pedir: async (c) => respuestaDeComuna(await fetch(`${base}&c=${encodeURIComponent(c)}`, { cache: "default" })),
        alListo: (comuna, d) => {
          const nuevos = descompactar(d.universo);
          const nuevosNo = noDe(d.noConviene);
          // Los − Ajustar de esta comuna con esta combinación (renta larga, 04-nov-2026), en el mismo pedido.
          const negs = d.negociados ? descompactarNegociados(d.negociados) : null;
          if (vivo.current && negs) setCapasCalc((cs) => agregarCapa(cs, clave, comuna, negs));
          if (vivo.current) setUniversos((us) => {
            const prev = us[clave];
            const comunas = prev && prev.comunas !== "todas" ? [...prev.comunas, comuna] : [comuna];
            const ids = new Set((prev?.pines ?? []).map((p) => p.avisoId));
            const idsNo = new Set((prev?.no ?? []).map((p) => p.avisoId));
            return { ...us, [clave]: { comunas, pines: [...(prev?.pines ?? []), ...nuevos.filter((p) => !ids.has(p.avisoId))], no: [...(prev?.no ?? []), ...nuevosNo.filter((p) => !idsNo.has(p.avisoId))] } };
          });
        },
        alAvance: (a) => { if (vivo.current) setProgreso(a); },
        vivo: () => vivo.current,
      });
      for (const c of faltan) enCurso.current.delete(`${clave}|${c}`);
      if (vivo.current) { if (pausado) setFallidas({ clave, comunas: perdidas }); else { setProgreso(null); if (perdidas.length) { setFallo(true); setFallidas({ clave, comunas: perdidas }); } } }
    } catch {
      if (vivo.current) { setProgreso(null); setFallo(true); }
    }
  }, [asegurarNegociados, asegurarCapaCalculada, asegurarNoConviene]);

  // El universo de la vista con que se entró: el de la noche (con la capa en el mismo pedido), con la página quieta (el LCP es
  // el mapa quieto); uno calculado, enseguida. El mapa interactivo, también con la página quieta.
  useEffect(() => {
    vivo.current = true;
    if (!universoDeLaNoche(inicial.filtros)) void asegurar(inicial.filtros);
    const cancelar = cuandoLaPaginaEsteQuieta(() => {
      setMapaListo(true);
      if (universoDeLaNoche(inicial.filtros)) void asegurar(inicial.filtros);
      // EL CÓDIGO DEL MAPA Y GOOGLE MAPS, A LA VEZ (27-nov-2026, opción C): antes Maps se pedía recién cuando el código del mapa
      // (next/dynamic) había bajado y montado; ahora se pide en el mismo momento ocioso, junto con ese código.
      void loadGoogleMaps();
      // «¿Cómo se calcula?» abre directo (03-nov-2026): su hoja ya está bajada cuando se toca.
      void import("./hoja-calculo");
      // El pop-up del recálculo (04-nov-2026): ya bajado cuando se elige otra tasa, pie o plazo.
      void import("./recalculo");
    });
    return () => { vivo.current = false; cancelar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Las comunas de ESTA vista que fallaron en su último cálculo; con alguna, el mapa muestra lo que sí llegó (02-nov-2026).
  const fallidasAqui = fallidas && fallidas.clave === claveUniverso(filtros) ? fallidas.comunas.filter((c) => comunasACalcular(filtros).includes(c)) : [];
  const universo = universoPara(filtros, universos) ?? (progreso == null && fallidasAqui.length > 0 ? universoPara(filtros, universos, true) : null);
  const visibles = useMemo(() => (universo ? ordenar(filtrar(universo, filtros).filter((p) => !caidos.includes(p.avisoId)).map((p) => (hoyAqui[p.avisoId] ? { ...p, ...hoyAqui[p.avisoId], flujo: hoyAqui[p.avisoId].flujo ?? p.flujo } : p)), orden, uf) : []), [universo, filtros, orden, uf, caidos, hoyAqui]);
  // LAS DOS CLASES (03-nov-2026): de entrada, los ✓ Comprar y, aparte, los − Ajustar de la noche con este pie que pasan los filtros
  // y el descuento máximo, sin los que ya convienen; «Ver solo ✓ Comprar» deja la primera (capa-negociar.ts › negociadosVisibles).
  const capa = capaVisible(filtros);
  // La de la noche (por pie) o, con otra combinación, la calculada (por comuna; si alguna falló, lo que llegó).
  // Sin cuenta, la capa de la noche solo con la combinación de la noche (25-nov-2026: en renta corta, la calculada por comuna).
  const negociadosDelPie = capaDeLaNoche(filtros) ? negociados[sinCuenta ? PIE_ABIERTO : filtros.pie]
    : capaCalculadaPara(filtros, capasCalc) ?? (progreso == null && fallidasAqui.length > 0 ? capaCalculadaPara(filtros, capasCalc, true) : null);
  const idsComprar = useMemo(() => new Set((universo ?? []).map((p) => p.avisoId)), [universo]);
  const visiblesNeg = useMemo(
    () => ordenarNegociados(negociadosVisibles(negociadosDelPie, filtros, idsComprar).filter((p) => !caidos.includes(p.avisoId) && !noLlegan.includes(p.avisoId)).map((p) => (movidos[p.avisoId] ? { ...p, neg: movidos[p.avisoId] } : p))),
    [negociadosDelPie, filtros, idsComprar, caidos, movidos, noLlegan],
  );
  // LOS NO CONVIENE (25-nov-2026, el mapa con todos los deptos): los del mismo universo que pasan los filtros (sus barras miran los
  // tramos; sus cifras no viajan).
  const universoNo = useMemo(() => {
    const u = universos[claveUniverso(filtros)];
    // Pendientes (la segunda parte no llegó): null, no una lista vacía —si no, el contador diría «No conviene · 0»—.
    return universo && u && u.no ? u.no : null;
  }, [universos, filtros, universo]);
  const visiblesNo = useMemo(() => (universoNo ? filtrar(universoNo, filtros).filter((p) => !caidos.includes(p.avisoId)) : []), [universoNo, filtros, caidos]);
  /** Las clases que se ven en el mapa (los chips del contador apagan las otras). */
  const seVe = (c: ClaseMapa) => !filtros.ocultar.includes(c);
  /** Los que se ven, de las tres clases, para la tarjeta (se desliza entre los cercanos) y la lista. */
  const todos = useMemo((): PinMapa[] => {
    // LA ASESORÍA (27-nov-2026): con su filtro puesto, el mapa muestra solo los Comprar que calzan con la persona.
    const ids = filtroAsesoria?.ids;
    if (ids) return visibles.filter((p) => ids.has(p.avisoId));
    return [...(seVe("comprar") ? visibles : []), ...(seVe("ajustar") ? visiblesNeg : []), ...(seVe("no") ? visiblesNo : [])];
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibles, visiblesNeg, visiblesNo, filtros.ocultar, filtroAsesoria]);
  /** LOS PINES DEL CANVAS (25-nov-2026, capa-canvas.ts): cada uno con su clase, su cifra (el precio, o la barra que se movió) y su
   *  puntaje (el que decide quién conserva la cifra si dos chocan). */
  const items = useMemo((): ItemCapa[] => todos.map((p) => {
    const clase = claseDePin(p);
    return { id: p.avisoId, lat: p.lat, lng: p.lng, clase, texto: textoCifraPin(p, clase, filtros.cifra, uf, sinCuenta), puntaje: clase === "no" ? null : p.score };
  }), [todos, filtros.cifra, uf, sinCuenta]);
  // Antes de que llegue el universo, el número que contó el servidor (solo para los filtros con que se entró).
  const total = universo ? visibles.length : filtros === inicial.filtros ? inicial.n : null;
  /** EL CONTADOR (25-nov-2026): las tres clases con los filtros (apagar un chip no cambia la cuenta). Antes de que llegue el universo,
   *  lo que contó el servidor para los filtros con que se entró; null mientras falte algo. */
  const conteo: ConteoClases | null = universo && universoNo && negociadosDelPie
    ? { comprar: visibles.length, ajustar: visiblesNeg.length, no: visiblesNo.length }
    : filtros === inicial.filtros && inicial.n != null && inicial.nAjustar != null && inicial.nNo != null ? { comprar: inicial.n, ajustar: inicial.nAjustar, no: inicial.nNo } : null;
  const calculando = !universo && (progreso != null || !universoDeLaNoche(filtros));
  // Los analizados de la cuenta y los de esta visita (un informe listo que no se abrió).
  const analizadosVivos = useMemo(() => ({ ...cuenta.analizados, ...analizadosAqui }), [cuenta.analizados, analizadosAqui]);
  const resumenesVivos = useMemo(() => ({ ...(cuenta.resumenes ?? {}), ...resumenesAqui }), [cuenta.resumenes, resumenesAqui]);
  /** Cuántos darían unos filtros, sobre lo cargado (la hoja de filtros); null si hay que traer otro universo. */
  const contar = useCallback((f: FiltrosPortal): number | null => {
    const u = universoPara(f, universosRef.current);
    return u ? filtrar(u, f).filter((p) => !caidos.includes(p.avisoId)).length : null;
  }, [universoPara, caidos]);
  /** Cuántos − Ajustar se verían con unos filtros (el botón «Ver 6.802 ✓ Comprar + 3.238 − Ajustar»): 0 si la capa no se ve con
   *  ellos, null mientras llega. */
  const contarNegociados = useCallback((f: FiltrosPortal): number | null => {
    if (!capaVisible(f)) return 0;
    const ns = capaDeLaNoche(f) ? negociadosRef.current[sinCuentaRef.current ? PIE_ABIERTO : f.pie] : capaCalculadaPara(f, capasCalcRef.current);
    if (!ns) return null;
    const u = universoPara(f, universosRef.current);
    return negociadosVisibles(ns, f, new Set((u ?? []).map((p) => p.avisoId))).filter((p) => !caidos.includes(p.avisoId)).length;
  }, [universoPara, capaCalculadaPara, caidos]);

  /** Los No conviene que darían unos filtros, sobre lo cargado; null si falta su universo. */
  const contarNo = useCallback((f: FiltrosPortal): number | null => {
    const u = universoPara(f, universosRef.current);
    const no = u ? universosRef.current[claveUniverso(f)]?.no ?? null : null;
    return no ? filtrar(no, f).filter((p) => !caidos.includes(p.avisoId)).length : null;
  }, [universoPara, caidos]);
  /** «Ver N deptos» del panel (25-nov-2026): las tres clases con unos filtros; null mientras falte algo. */
  const contarTodos = useCallback((f: FiltrosPortal): number | null => {
    const a = contar(f), b = contarNegociados(f), c = contarNo(f);
    return a == null || b == null || c == null ? null : a + b + c;
  }, [contar, contarNegociados, contarNo]);
  /** LA DISTRIBUCIÓN DIBUJADA DE UNA BARRA (25-nov-2026, lámina 6): los deptos de las tres clases que pasan los OTROS filtros, por
   *  tramo de esa barra (sin su propio rango: la barra muestra todo lo que hay a los lados). Null si falta el universo. */
  const distribucion = useCallback((f: FiltrosPortal, barra: BarraPanel): number[] | null => {
    const u = universoPara(f, universosRef.current);
    if (!u) return null;
    const sinEsta = validarPortal(barra === "precio" ? { ...f, ufMin: null, ufMax: null } : { ...f, rangos: { ...f.rangos, [barra]: undefined } });
    const no = universosRef.current[claveUniverso(f)]?.no ?? [];
    const ns = capaDeLaNoche(f) ? negociadosRef.current[sinCuentaRef.current ? PIE_ABIERTO : f.pie] : capaCalculadaPara(f, capasCalcRef.current);
    const negs = negociadosVisibles(ns ?? [], sinEsta, new Set(u.map((p) => p.avisoId)));
    return histograma([...filtrar(u, sinEsta), ...negs, ...filtrar(no, sinEsta)].filter((p) => !caidos.includes(p.avisoId)), barra);
  }, [universoPara, capaCalculadaPara, caidos]);

  // ── los cambios ──
  const ponerEnUrl = (f: FiltrosPortal, o: OrdenPortal) => {
    try { const q = urlDePortal(f, o); window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}`); } catch { /* sin historial */ }
  };
  const vistaCambio = (f: FiltrosPortal, o: OrdenPortal, fuente: string, n: number | null) =>
    posthog?.capture(EVENTOS_PORTAL.vista, { ...propsDeFiltros(f, o), n, fuente });

  /** Aplica unos filtros: la URL, el universo que falte y la medición. No toca el perfil. */
  function aplicar(f0: FiltrosPortal, fuente: "filtros" | "mi_busqueda" | "zona" | "limpiar" | "solo_comprar" | "fusible" | "chips") {
    // Sin cuenta, el financiamiento por defecto, y sin «Solo flujo positivo» (piden registro).
    const f = sinCuenta ? filtrosAbiertos(f0) : f0;
    const cambiados = filtrosCambiados(filtros, f);
    // «explorar_tasa» (30-oct-2026): eligió otra tasa en Filtros (o volvió a la de hoy).
    if (fuente === "filtros" && f.tasa !== filtros.tasa) posthog?.capture(EVENTOS_PORTAL.tasa, propsDeTasa(f.tasa, inicial.tasa?.tasa ?? null, "filtros"));
    // «explorar_negociar» (02-nov-2026; desde el 03-nov solo eso): cambió el descuento máximo en Filtros.
    if (fuente === "filtros" && f.negociar !== filtros.negociar) posthog?.capture(EVENTO_NEGOCIAR, propsNegociar(f.negociar, "filtros", contarNegociados(f)));
    setFiltros(f);
    setSel(null);
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
  /** LOS CHIPS DEL CONTADOR (25-nov-2026, decisión 5; reemplazan a «Ver solo ✓ Comprar»): tocar uno apaga esa clase en el mapa, y
   *  otra vez la prende. Apagar «Ajustar» y «No conviene» es lo que hacía «Ver solo ✓ Comprar»: se mide con el mismo evento. */
  function alternarClase(c: ClaseMapa) {
    const ocultar = filtros.ocultar.includes(c) ? filtros.ocultar.filter((x) => x !== c) : [...filtros.ocultar, c];
    const f = validarPortal({ ...filtros, ocultar });
    if (f.ocultar.includes("ajustar") && f.ocultar.includes("no") && !filtros.ocultar.includes(c)) posthog?.capture(EVENTO_SOLO_COMPRAR, propsSoloComprar(filtros.negociar, universo ? visibles.length : null, negociadosDelPie ? visiblesNeg.length : null, sinCuenta));
    aplicar(f, "chips");
  }
  // «Aplicar mi perfil de búsqueda» se fue del panel (25-nov-2026, lámina 6): los supuestos van en una línea editable y las barras
  // filtran el resto. El perfil sigue siendo el de la selección semanal; «Avísame de nuevos» (la lista) lo escribe.

  // ── LA HOJA DE REGISTRO (sin cuenta) ──
  /** Abre la hoja con lo que se tocó. El perfil nace del pin (o, en «Avísame», de los filtros); al terminar, se hace eso. */
  function pedirRegistro(motivo: MotivoRegistro, pin: PinMapa | null, extra: { orden?: OrdenPortal; filtros?: FiltrosPortal } = {}) {
    const f = extra.filtros ?? filtros;
    setRegistro({ pedido: { motivo, pin, ...(extra.orden ? { orden: extra.orden } : {}) }, filtros: f, orden });
    posthog?.capture(EVENTOS_ABIERTO.registroAbierto, { motivo, aviso_id: pin?.avisoId ?? null, modalidad: f.modalidad, llegada_explorar: origen });
  }

  // La bienvenida, sin cuenta y solo la primera vez (en este navegador), con el número de la noche.
  useEffect(() => {
    // Por un depto compartido no: vino a ver ESE depto (la tarjeta se abre sola), y la bienvenida la taparía.
    if (!sinCuenta || inicial.n == null || compartido) return;
    // Con la asesoría habilitada, la burbuja reemplaza a la bienvenida (27-nov-2026).
    if (asesoria.habilitada) return;
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
    if (asesoria.habilitada) setMiro((m) => ({ ...m, tarjetas: m.tarjetas + 1 }));
    setCarrusel(cercanos(todos, avisoId).map((p) => p.avisoId));
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

  async function analizar(it: PinMapa, eleccion?: EleccionAnalizar, igual = false, aceptoCambio = false) {
    if (generando) return;
    const combinacion = eleccion?.combinacion ?? { piePct: filtros.pie, plazoAnios: filtros.plazo, tasaPct: filtros.tasa };
    // La tasa (30-oct-2026): la del pop-up si la tocó; si no, la de Filtros. null = la de hoy.
    const tasaPct = combinacion.tasaPct !== undefined ? combinacion.tasaPct : filtros.tasa;
    if (eleccion && tasaPct !== filtros.tasa) posthog?.capture(EVENTOS_PORTAL.tasa, propsDeTasa(tasaPct, inicial.tasa?.tasa ?? null, "popup"));
    setError(null);
    setGenerando(it.avisoId);
    const soltar = iniciarCarga(claveActual());
    soltarCarga.current = soltar;
    ultimoAnalisis.current = { it, eleccion };
    // DESPUÉS DE «ANALIZAR» (03-nov-2026): el pop-up no se cierra, pasa a «Generando el informe de [depto]…». Lo que vio al tocar
    // «Analizar»: lo del pop-up si cambió el pie o el plazo; si no, la tarjeta (un negociado, a su precio negociado).
    const esperado: VeredictoVisto | null = eleccion?.vista ?? (esNegociado(it) && conCifrasNegociado(it) ? { veredicto: "COMPRAR", score: it.neg.s } : { veredicto: it.veredicto, score: it.score });
    const paso0 = informeGenerando(nombreDelDepto(it), esperado);
    if (!igual) { setConfirmar({ it, sin: false, analizando: true }); setInforme(paso0); }
    // No salió (no se cobró): el pop-up lo dice con palabras; nunca se vuelve al mapa en silencio.
    const fallar = (motivo: "error" | "despublicado") => { setNoDa(null); setConfirmar({ it, sin: false }); setInforme(informeFallo(paso0, motivo)); };
    try {
      // La casilla del pop-up: el pie y el plazo nuevos quedan en el perfil (además de «Avísame de nuevos», lo único que lo escribe).
      if (eleccion?.guardarPerfil) {
        await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios, tasaPct }) }).catch(() => null);
      }
      const corta = filtros.modalidad === "str";
      for (let intento = 0; intento < 8; intento++) {
        const res = await fetch(corta ? "/api/semanal/analizar-str" : "/api/lo-que-sigue/guia/analizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Un negociado (02-nov-2026): el precio negociado y el tope elegido; la ruta lo acepta con el piso del tope.
          body: JSON.stringify({ avisoId: it.avisoId, piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios, tasaPct, explorar: true, ...(!corta && esNegociado(it) && conCifrasNegociado(it) && filtros.negociar != null ? { precioNegociadoUF: it.neg.p, topeNegociar: filtros.negociar } : {}), ...(igual ? { igual: true } : {}), ...(aceptoCambio ? { aceptoCambio: true } : {}) }),
        });
        if (res.status === 409) {
          if (intento === 7) { fallar("error"); break; }
          await new Promise((ok) => setTimeout(ok, ESPERA_EN_CURSO_MS));
          continue;
        }
        const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string; estado?: string; porQue?: string | null; publicacion?: string | null; negociado?: Negociacion & { p: number }; tope?: number; veredicto?: string | null; score?: number | null; devuelto?: boolean; ahora?: { veredicto: string | null; score: number | null; flujo?: number | null } };
        if (res.ok && d.id) {
          const nuevo = d.id;
          setResumenesAqui((m) => ({ ...m, [nuevo]: { veredicto: d.veredicto ?? null, score: d.score ?? null, fecha: new Date().toISOString() } }));
          // El embudo de la puerta E: «regalo usado» (el análisis salió con el regalo de alta).
          if (usaRegalo(cuenta.saldo)) posthog?.capture(EVENTOS_ABIERTO.regaloUsado, { aviso_id: it.avisoId, analysis_id: d.id, modalidad: filtros.modalidad });
          // Listo: el pop-up lo abre solo (InformeEnCamino); si con los datos de hoy salió otro veredicto, lo dice primero.
          const listo = informeListo(paso0, { id: d.id, ruta: `/analisis/${d.id}`, veredicto: d.veredicto ?? null, score: d.score ?? null, devuelto: d.devuelto ?? null });
          // Antes de ir al informe: «atrás» y «← Volver al mapa» vuelven a este mapa, a este pin y a su tarjeta (04-nov-2026).
          recordarVuelta(it.avisoId, d.id);
          setNoDa(null);
          setConfirmar({ it, sin: false, analizando: true });
          setInforme(listo);
          if (listo.paso === "distinto") { soltar(); setGenerando(null); }
          return;
        }
        // CAMBIÓ DESDE QUE SE MOSTRÓ (23-nov-2026, guia/cobro-mostrado.ts): no se cobró; el pop-up pregunta si lo analiza igual.
        if (res.ok && d.estado === "cambio" && d.ahora?.veredicto) { const ahora = { veredicto: d.ahora.veredicto, score: d.ahora.score ?? null, flujo: d.ahora.flujo ?? null }; setHoyAqui((m) => ({ ...m, [it.avisoId]: ahora })); setNoDa(null); setConfirmar({ it, sin: false, analizando: true }); setInforme(informeCambio(paso0, { veredicto: ahora.veredicto, score: ahora.score })); break; }
        // Renta corta medida fina que no da: no se cobró; se ofrece analizar igual.
        if (res.ok && d.estado === "no-da") { setInforme(null); setConfirmar(null); setNoDa({ it, porQue: d.porQue ?? null, publicacion: d.publicacion ?? null }); break; }
        // EL PRECIO NEGOCIADO, VERIFICADO CON LOS DATOS DE HOY (02-nov-2026): no se cobró nada. Si se movió, el pop-up muestra el
        // nuevo y la persona confirma; si ya no llega dentro del tope, sale de la capa y el pop-up ofrece el precio publicado.
        if (res.status === 412 && d.error === "precio-movido" && d.negociado && esNegociado(it) && conCifrasNegociado(it)) {
          const nuevo = d.negociado;
          setMovidos((m) => ({ ...m, [it.avisoId]: nuevo }));
          setInforme(null);
          setConfirmar({ it: { ...it, neg: nuevo } as PinNegociado, sin: false, movido: NEGOCIADO_COPY.movido(nuevo.p, nuevo.d, it.neg.p) });
          break;
        }
        if (res.status === 412 && d.error === "no-llega" && esNegociado(it)) {
          const { neg: _neg, ...alPublicado } = it;
          void _neg;
          setNoLlegan((xs) => [...xs, it.avisoId]);
          setInforme(null);
          setConfirmar({ it: alPublicado, sin: false, movido: NEGOCIADO_COPY.noLlega(d.tope ?? filtros.negociar) });
          break;
        }
        // Se dio de baja recién (el caso de fsm@, 03-nov-2026: la ficha dio 404 al analizar): sale del mapa y el pop-up lo dice.
        if (res.status === 410 && d.error === "despublicado") { setCaidos((xs) => [...xs, it.avisoId]); setSel(null); fallar("despublicado"); break; }
        if (d.error === "sin-creditos") { setInforme(null); setNoDa(null); setConfirmar({ it, sin: true }); break; }
        fallar("error");
        break;
      }
    } catch {
      fallar("error");
    }
    soltar();
    setGenerando(null);
  }

  // Cerrar el pop-up del informe (solo cuando se puede, lib/guia/informe-en-camino.ts › cerrable). Si el informe quedó listo sin
  // abrirse, la tarjeta dice «Ya lo analizaste · Ver informe» y arriba del mapa queda «Tu informe de [depto] está listo · Abrirlo».
  function cerrarInforme() {
    const queda = informe ? alCerrarQueda(informe) : null;
    const it = confirmar?.it;
    if (queda && it && informe) {
      setAnalizadosAqui((m) => ({ ...m, [it.avisoId]: queda.id }));
      setListoSinAbrir({ ...queda, t0: informe.t0 });
    }
    soltarCarga.current?.();
    setInforme(null);
    setConfirmar(null);
    setGenerando(null);
  }
  // Tras un fallo, «Reintentar» analiza otra vez lo mismo.
  function reintentarInforme() {
    const u = ultimoAnalisis.current;
    setInforme(null);
    if (u) void analizar(u.it, u.eleccion);
  }
  // «Analizarlo igual» tras el aviso de cambio (23-nov-2026): lo mismo, con `aceptoCambio` (se cobra normal).
  function analizarIgualInforme() {
    const u = ultimoAnalisis.current;
    if (u) void analizar(u.it, u.eleccion, false, true);
  }

  const recalcular = useCallback(async (avisoId: string, combo: { piePct: number; plazoAnios: number; tasaPct?: number | null }): Promise<Recalculo | null> => {
    try {
      const res = await fetch("/api/explorar/recalcular", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId, piePct: combo.piePct, plazoAnios: combo.plazoAnios, tasaPct: combo.tasaPct ?? null }) });
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
    if (analizadosVivos[it.avisoId]) return;
    if (cuenta.saldo.tipo === "sin") setConfirmar({ it, sin: true });
    else void analizar(it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnalizar, universo]);
  // Entró con un depto abierto (`a`): su tarjeta, con los cercanos, cuando llega el universo. Por un ENLACE COMPARTIDO
  // (02-nov-2026), una vez: la tarjeta de ese pin si está entre los que convienen, o la de «ya no está» con los parecidos.
  // El de un NEGOCIADO (03-nov-2026) espera también la capa «Si negocias» (el pin está en ella), salvo que el servidor ya
  // sepa que no está o que no llega; si con los datos de hoy el precio se movió, la tarjeta dice el de hoy (y sin cuenta, que
  // en la capa no trae el precio, dice el de hoy nítido: es el depto que le compartieron).
  const esperaCapa = !!compartido && compartido.tope != null && compartido.estado == null && !negociadosDelPie && !capaFallo;
  useEffect(() => {
    if (!abrir || autoAnalizar || !universo || carrusel.length) return;
    if (compartido) {
      if (compartidoResuelto.current || esperaCapa) return;
      compartidoResuelto.current = true;
      if (compartido.estado === "no-llega") setNoLlegan((xs) => [...xs, compartido.avisoId]);
      const ap = aperturaCompartida({ avisoId: compartido.avisoId, estado: compartido.estado, depto: compartido.depto, visibles, negociados: visiblesNeg });
      if (ap.tipo === "pin") {
        const hoy = compartido.neg;
        if (hoy && visiblesNeg.some((p) => p.avisoId === ap.avisoId && p.neg.p !== hoy.p)) setMovidos((m) => ({ ...m, [ap.avisoId]: hoy }));
        // La hoja con la tarjeta grande (04-nov-2026); el pin queda elegido en el mapa, sin la tarjeta del carrusel.
        setSel(ap.avisoId);
        setHojaComp({ tipo: "pin", avisoId: ap.avisoId });
        return;
      }
      setSel(null);
      setHojaComp({ tipo: "caido", estado: ap.estado, depto: ap.depto, parecidos: ap.parecidos });
      posthog?.capture(EVENTOS_COMPARTIR.caido, { aviso_id: compartido.avisoId, estado: ap.estado, parecidos: ap.parecidos.length, modalidad: filtros.modalidad, sin_cuenta: sinCuenta, tope_negociar: compartido.tope ?? null });
      return;
    }
    // El pin abierto, de cualquiera de las clases (04-nov-2026: un − Ajustar analizado vuelve a su tarjeta cuando llega la capa).
    // 26-nov-2026 (regresión del pedido partido, vista en producción): los No conviene llegan en el SEGUNDO pedido, así que el efecto
    // también corre cuando llegan; sin esto, el enlace `?a=` de un No conviene —«Volver al mapa» desde su informe— no abría la tarjeta.
    if (todos.some((p) => p.avisoId === abrir)) setCarrusel(cercanos(todos, abrir).map((p) => p.avisoId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universo, esperaCapa, abrir, visiblesNeg.length, visiblesNo.length]);
  // VOLVER AL MAPA (04-nov-2026, volver-al-mapa.ts): los pines analizados en esta pestaña se suman a los de la cuenta —al volver con
  // «atrás», la página puede venir del caché, con la cuenta de antes—, y si la página no trajo el pin abierto, el que quedó en la
  // barra antes de ir al informe: su tarjeta se abre y el mapa se centra en él.
  useEffect(() => {
    let almacen: Storage | null = null;
    try { almacen = window.sessionStorage; } catch { /* sin almacenamiento */ }
    const deLaPestana = analizadosDeLaPestana(almacen);
    if (Object.keys(deLaPestana).length) setAnalizadosAqui((m) => ({ ...deLaPestana, ...m }));
    if (abrirProp || compartido) return;
    const a = new URLSearchParams(window.location.search).get("a");
    if (a) { setAbrir(a); setSel(a); setFocoUsado(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Antes de ir a un informe desde un pin: esta entrada del historial queda con el pin (`a=`) y la pestaña anota de qué pin salió;
   *  así «atrás» y «← Volver al mapa» vuelven a este mapa, a este pin y a su tarjeta (volver-al-mapa.ts). */
  const recordarVuelta = (avisoId: string, informeId: string) => {
    try {
      const href = hrefDelMapa(window.location.pathname, window.location.search, avisoId);
      window.history.replaceState(window.history.state, "", href);
      anotarVolver(window.sessionStorage, { informeId, avisoId, href });
    } catch { /* sin historial ni almacenamiento: el informe va sin «Volver al mapa» */ }
  };

  // Lo que el enlace compartido trae una sola vez (la llegada y el código) sale de la barra apenas carga: una recarga no
  // vuelve a contar la vista, y quien copie la barra no reparte el código de otro.
  useEffect(() => {
    if (!compartido) return;
    try {
      const u = new URL(window.location.href);
      for (const k of PARAMS_DE_UNA_VEZ) u.searchParams.delete(k);
      window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`);
    } catch { /* sin historial */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const porId = useMemo(() => new Map<string, PinMapa>(todos.map((p) => [p.avisoId, p])), [todos]);
  // El mapa se centra en el depto compartido cuando el universo dice dónde está (o, si ya no está, donde estaba), una vez.
  const foco = useMemo(() => {
    // El depto compartido o, desde el 04-nov-2026, el pin abierto (al volver del informe, el mapa se centra en él).
    const id = compartido?.avisoId ?? abrir;
    if (focoUsado || !id || !universo) return null;
    // El pin, entre los que convienen o en la capa «Si negocias».
    const p = porId.get(id);
    if (p) return { lat: p.lat, lng: p.lng };
    return compartido?.depto?.lat != null && compartido.depto.lng != null ? { lat: compartido.depto.lat, lng: compartido.depto.lng } : null;
  }, [focoUsado, compartido, abrir, universo, porId]);

  // ── COMPARTIR (02-nov-2026) ──
  // EL ENLACE FIRMADO (03-nov-2026): un pedido trae la firma del servidor para ese aviso, el código de invitación de quien
  // tiene cuenta (va en la firma) y lo que dice el servidor del aviso con lo de por defecto —para quien mira con otro pie,
  // plazo o tasa, y el precio negociado de un negociado sin cuenta, que no viajó al navegador—. Se pide al apoyar el dedo en
  // «Compartir» (la hoja del sistema se abre en el mismo toque o no se abre) y no antes: cada firma cuenta para el tope de 60
  // por hora. Lo firmado se guarda por aviso; una falla no, para poder reintentar.
  const claveServidor = (p: PinMapa) => `${filtros.modalidad}|${filtros.negociar}|${p.avisoId}`;
  const estandar = useRef(new Map<string, Promise<EnlacePreparado>>());
  const resueltos = useRef(new Map<string, EnlacePreparado>());
  const prepararEnlace = useCallback((p: PinMapa): Promise<EnlacePreparado> => {
    const clave = claveServidor(p);
    let v = estandar.current.get(clave);
    if (!v) {
      v = fetch("/api/explorar/compartido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: p.avisoId, m: filtros.modalidad, ...(filtros.modalidad === "str" ? {} : { n: filtros.negociar }) }),
      })
        .then(async (r): Promise<EnlacePreparado> => {
          const d = (await r.json().catch(() => null)) as { firma?: string; codigo?: string | null; estado?: string; score?: number | null; neg?: { p: number; d: number } | null; error?: string } | null;
          if (r.status === 429) return { error: "tope" };
          if (!r.ok || !d?.firma) return { error: "sin-firma" };
          const ver: VeredictoCompartido = d.estado === "comprar" ? { comprar: true, score: d.score ?? null } : d.estado === "negociado" && d.neg ? { comprar: false, score: null, negociado: d.neg } : { comprar: false, score: null };
          return { firma: d.firma, codigo: d.codigo ?? null, ver };
        })
        .catch((): EnlacePreparado => ({ error: "sin-firma" }));
      estandar.current.set(clave, v);
      void v.then((x) => {
        if ("error" in x) estandar.current.delete(clave);
        else resueltos.current.set(clave, x);
      });
    }
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);
  const prepararCompartir = useCallback((p: PinMapa) => { void prepararEnlace(p); }, [prepararEnlace]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  /** «Compartir»: en el teléfono la hoja del sistema (sin ella, WhatsApp); en el PC, copia el enlace y lo dice. */
  async function compartir(p: PinMapa, origenToque: OrigenCompartir) {
    const estd = esVistaEstandar(filtros);
    // La firma (y lo que dice el servidor) sin esperar si ya llegó —se pidió al apoyar el dedo—; si no, se espera. Sin firma no
    // hay enlace: el tope de la hora, o el servidor que no pudo; se dice y no se comparte nada.
    const prep = resueltos.current.get(claveServidor(p)) ?? await prepararEnlace(p);
    if ("error" in prep) {
      posthog?.capture(EVENTOS_COMPARTIR.sinFirma, { motivo: prep.error, origen: origenToque, sin_cuenta: sinCuenta, aviso_id: p.avisoId, modalidad: filtros.modalidad });
      setToast(prep.error === "tope" ? COMPARTIR_COPY.tope : COMPARTIR_COPY.sinFirma);
      return;
    }
    // En la vista de por defecto, el del pin (un negociado, con su precio negociado); si no, lo que dijo el servidor.
    const ver = !pideAlServidor(p, filtros) ? veredictoDelPin(p) : prep.ver;
    // Un negociado: el enlace lleva el tope de la capa y abre con «Si negocias» prendido.
    const tope = ver.negociado ? topeDelEnlace(filtros.negociar, ver.negociado.d) : null;
    const url = enlaceCompartido(window.location.origin, { avisoId: p.avisoId, modalidad: filtros.modalidad, comuna: p.comuna, codigo: prep.codigo, tope, firma: prep.firma });
    const texto = textoCompartir(deptoDePin(p), ver);
    const telefono = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    const metodo: MetodoCompartir = telefono ? (typeof navigator.share === "function" ? "hoja" : "whatsapp") : "copiar";
    posthog?.capture(EVENTOS_COMPARTIR.compartir, {
      origen: origenToque, sin_cuenta: sinCuenta, aviso_id: p.avisoId, modalidad: filtros.modalidad, metodo, con_codigo: !!prep.codigo, vista_estandar: estd,
      negociado: !!ver.negociado, tope_negociar: tope, con_firma: true,
      ...(sinCuenta ? { llegada_explorar: origen } : {}),
    });
    if (metodo === "hoja") {
      try {
        await navigator.share({ title: ver.comprar ? COMPARTIR_COPY.tituloHoja : ver.negociado ? COMPARTIR_COPY.negociado.tituloHoja : COMPARTIR_COPY.tituloHojaSinVeredicto, text: texto, url });
      } catch (e) {
        // Cerrar la hoja no es un error; si el teléfono no la dejó abrir, el enlace queda copiado.
        if ((e as { name?: string } | null)?.name !== "AbortError") setToast((await copiarAlPortapapeles(url)) ? COMPARTIR_COPY.copiado : COMPARTIR_COPY.noCopiado);
      }
      return;
    }
    if (metodo === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(mensajeCompartir(texto, url))}`, "_blank", "noopener");
      return;
    }
    setToast((await copiarAlPortapapeles(url)) ? COMPARTIR_COPY.copiado : COMPARTIR_COPY.noCopiado);
  }

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
    if (it && v.motivo === "invierte") setInvierte({ pin: it, retomar: true });
    if (it && (v.motivo === "analizar" || v.motivo === "guardar" || v.motivo === "invierte")) setRecien({ avisoId: it.avisoId, regalo: usaRegalo(cuenta.saldo), sinRegalo: cuenta.sinRegalo ?? null });
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
  // Lo de abajo: «N deptos» con el chip; mientras llega el universo, «Calculando…» (con una tasa elegida, «Calculando con tu tasa…»).
  // EL AVANCE POR COMUNAS VA EN EL POP-UP DEL RECÁLCULO (04-nov-2026, la pasada de Fabrizio): mientras hay avance, abajo no va nada.
  const conTasa = filtros.tasa != null;
  const enCalculo = conTasa ? PORTAL_COPY.calculandoTasa : PORTAL_COPY.calculando;
  // EL DESGLOSE (03-nov-2026): los ✓ Comprar y, aparte, los − Ajustar (0 sin capa). Antes de que llegue la capa, los que contó el
  // servidor con los filtros con que se entró; si la capa no llegó, sin ella. Mientras falte alguno, el avance.
  const nAjustar = !capa ? 0 : negociadosDelPie ? visiblesNeg.length : filtros === inicial.filtros && inicial.nAjustar != null ? inicial.nAjustar : capaFallo ? 0 : null;
  const enCalculoAbajo = progreso == null && (calculando || total == null || nAjustar == null) ? enCalculo : null;
  const desglose = enCalculoAbajo == null && total != null && nAjustar != null ? desgloseBarra(total, nAjustar, capa ? filtros.negociar : null) : null;
  const tarjeta = vista === "mapa" && sel && enCarrusel.some((p) => p.avisoId === sel);
  // La hoja del compartido con el pin de hoy (con el precio negociado de hoy si se movió): el de `todos`.
  const pinComp = hojaComp?.tipo === "pin" ? porId.get(hojaComp.avisoId) ?? null : null;
  const casoComp: CasoCompartido | null = !hojaComp ? null : hojaComp.tipo === "caido" ? hojaComp : pinComp ? { tipo: "pin", pin: pinComp } : null;
  /** Analizar (o registrarse) desde la hoja: se cierra, el pin abre su tarjeta y sigue el camino de siempre. */
  const analizarDesdeHoja = (p: PinMapa) => {
    setHojaComp(null);
    setCarrusel(cercanos(todos, p.avisoId).map((x) => x.avisoId));
    setSel(p.avisoId);
    pedirAnalisis(p);
  };

  return (
    <div className="ex" data-explorar="cliente" data-vista={vista} data-calculando={calculando ? "1" : undefined}>
      {/* ── la fila de arriba: «Filtros» y, a la derecha y en texto, «¿Cómo se calcula?» (30-oct-2026) ── */}
      <ChipVeredictoTokens />
      {/* La barra de arriba (03-nov-2026, la pasada real de Fabrizio): «Filtros», el chip «Ver solo [✓ Comprar]» con su interruptor
          —apagado de entrada: se ven las dos clases— y, a la derecha, «¿Cómo se calcula?», que ABRE LA HOJA DIRECTO en el teléfono y
          en el PC, sin tooltip: en el PC «ⓘ ¿Cómo se calcula?» en texto; en el teléfono un botón redondo en tinta con la ⓘ en blanco,
          más grande que un chip, con «Cómo se calcula» al lado si cabe (`comoCabe`, medido). Un solo botón para los dos. */}
      <div className="ex-barra" role="toolbar" aria-label="Filtros" ref={barra} data-como-cabe={comoCabe ? "1" : undefined}>
        {/* LA BARRA (25-nov-2026, lámina 5, opción B): solo Usados o Proyectos, y Filtros. PROYECTOS QUEDA ESCONDIDO hasta que haya
            nuevos evaluados (hoy no hay precio por unidad): el selector lleva solo «Usados». La (i) de «¿Cómo se calcula?» pasó a la
            tarjeta del contador. */}
        {/* Sin Proyectos, el selector no se muestra en ningún tamaño (26-nov-2026): una sola opción no elige nada. Vuelve con los proyectos. */}
        <div className="ex-selector" role="radiogroup" aria-label={SELECTOR_COPY.grupo} data-explorar="selector" data-una-opcion={PROYECTOS_VISIBLE ? undefined : "1"}>
          <button type="button" role="radio" aria-checked="true" className="ex-selector-op" data-on="1" data-explorar="usados">{SELECTOR_COPY.usados}</button>
          {PROYECTOS_VISIBLE && <button type="button" role="radio" aria-checked="false" className="ex-selector-op" data-explorar="proyectos">{SELECTOR_COPY.proyectos}</button>}
        </div>
        <button type="button" className="ex-boton" data-activo={etiquetaFiltros(filtros) !== PORTAL_COPY.filtros || filtroAsesoria?.cerrada ? "1" : undefined} data-explorar="filtros" onClick={() => setHojaFiltros(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg> {etiquetaFiltros(filtros)}
        </button>
        {/* EL FILTRO DE LA ASESORÍA, CON LA HOJA CERRADA (F22, 27-nov-2026): se ve como un filtro activo y se quita con la X. */}
        {filtroAsesoria?.cerrada && (
          <button type="button" className="ex-boton" data-activo="1" data-explorar="filtro-perfil" aria-label={FILTRO_PERFIL_COPY.quitar} onClick={() => setQuitarAsesoria((n) => n + 1)}>
            {FILTRO_PERFIL_COPY.etiqueta}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
        {/* «¿CÓMO SE CALCULA?» VUELVE A LA BARRA (26-nov-2026, lámina 5d): con el ícono en el PC; en el teléfono, solo el ícono. */}
        <button type="button" className="ex-como2" data-explorar="como-se-calcula" aria-label={COMO_SE_CALCULA.enlace} onClick={abrirCalculo}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
          <span className="ex-como2-t">{COMO_SE_CALCULA.enlace}</span>
        </button>

      </div>
      {toast && <p className="ex-toast" role="status" data-explorar="toast">{toast}</p>}
      {aviso && (
        <p className="ex-aviso" role="status" data-explorar="aviso">
          {aviso} <button type="button" className="ex-enlace" onClick={() => setAviso(null)}>{PORTAL_COPY.cerrar}</button>
        </p>
      )}
      {/* El informe quedó listo y no se abrió (03-nov-2026): el aviso queda arriba del mapa hasta que la persona lo quite. */}
      {listoSinAbrir && (
        <div className="ex-aviso-informe">
          <InformeListoAviso depto={listoSinAbrir.depto} ruta={listoSinAbrir.ruta} id={listoSinAbrir.id} t0={listoSinAbrir.t0} alCerrar={() => setListoSinAbrir(null)} />
        </div>
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
              items={items}
              seleccionado={tarjeta ? sel : null}
              encuadre={`${claveUniverso(filtros)}|${filtros.comunas.join()}|${filtros.tipologias.join()}|${filtros.ufMin}|${filtros.ufMax}|${filtros.flujoPositivo}|${filtros.publicados}|${universo ? "1" : "0"}${claveEncuadreAsesoria}`}
              /* Las barras y los chips no reencuadran: la persona mira dónde estaba y ve qué queda. */
              conZona={!!filtros.zona}
              onSeleccionar={tocarPin}
              onTocarMapa={() => setSel(null)}
              onTocarPunto={asesoria.habilitada ? (lat, lng) => setToqueMapa({ lat, lng, t: Date.now() }) : undefined}
              onMovido={asesoria.habilitada ? () => setMiro((m) => ({ ...m, movimientos: m.movimientos + 1 })) : undefined}
              marcas={filtroAsesoria?.marcas ?? null}
              aire={filtroAsesoria ? aireAsesoria : null}
              onEstado={setMapa}
              foco={foco}
              onFoco={() => setFocoUsado(true)}
              // En el teléfono la tarjeta es una hoja abajo: el pin elegido tiene que quedar visible arriba de ella (26-nov-2026).
              tapaAbajo={esTelefono && tarjeta ? altoTarjeta : 0}
            />
          )}
          {mapa === "fallo" && <p className="ex-mapa-vacio" data-explorar="sin-mapa">{PORTAL_COPY.sinMapa}</p>}
          {vista === "mapa" && !filtroAsesoria && !burbujaAsesoria && (
            // CON LA TARJETA DE UN DEPTO ABIERTA, EN EL TELÉFONO (26-nov-2026): el contador se pliega solo, sin tocar lo que eligió la persona;
            // al cerrarla vuelve como estaba. «Ver lista» no va mientras la tarjeta está abierta (abajo).
            <Contador conteo={conteo} ocultar={filtros.ocultar} calculando={progreso == null && conteo == null ? enCalculo : null} alAlternar={alternarClase} plegarPorTarjeta={!!tarjeta && esTelefono} />
          )}
          {asesoria.habilitada && vista === "mapa" && (
            <Asesoria
              esPrueba={asesoria.prueba}
              sinCuenta={sinCuenta}
              conteo={conteo}
              comprar={visibles}
              lista={yaMiro && !compartido}
              toque={toqueMapa}
              tapado={!!tarjeta}
              quitarFiltro={quitarAsesoria}
              alBurbuja={setBurbujaAsesoria}
              alFiltrar={setFiltroAsesoria}
              alTapar={setAireAsesoria}
              alRegistrar={({ comunas, topeUF, deptos }) => {
                void import("./hoja-registro");
                setRegistro({ pedido: { motivo: "asesoria", pin: null, deptosAsesoria: deptos, filtrosPerfil: { ...filtrosAbiertos(filtros), comunas, ufMax: topeUF > 0 ? topeUF : null } }, filtros, orden });
              }}
              alVerDepto={(id) => { setCarrusel(cercanos(visibles, id).map((p) => p.avisoId)); setSel(id); }}
            />
          )}
          {fallo && (
            <p className="ex-error ex-error-mapa" role="alert" data-explorar="error">
              {universo && fallidasAqui.length > 0 ? PORTAL_COPY.errorComunas(fallidasAqui) : PORTAL_COPY.error} <button type="button" className="ex-enlace" onClick={() => void asegurar(filtros)}>{PORTAL_COPY.reintentar}</button>
            </p>
          )}
          {tarjeta ? (
            <TarjetaPin
              pines={enCarrusel}
              seleccionado={sel!}
              uf={uf}
              analizados={analizadosVivos}
              resumenes={resumenesVivos}
              guardados={guardados}
              generando={generando}
              error={error}
              alCambiar={setSel}
              alCerrar={() => setSel(null)}
              alGuardar={(id) => void alternarGuardado(id, "tarjeta")}
              alAnalizar={pedirAnalisis}
              alCompartir={(p) => void compartir(p, "tarjeta")}
              alVerInforme={recordarVuelta}
              alPrepararCompartir={prepararCompartir}
              alMedir={setAltoTarjeta}
              // El flujo al plazo del perfil solo con el mapa en su plazo por defecto: si eligió otro en Filtros, vale ese (y lo dice).
              plazo={plazoPerfil != null && plazoPerfil < PLAZO_POR_DEFECTO && filtros.plazo === PLAZO_POR_DEFECTO ? plazoPerfil : null}
              plazoMapa={filtros.plazo}
              sinCuenta={sinCuenta}
              recien={recien}
              inscritos={invierteV2 ? undefined : inscritos}
              etiquetaInvertir={(p) => (invierteFirmo && destinoBoton({ acceso: invierteV2, condicion: p.condicion }) === "v2" ? (misDeptos.includes(p.avisoId) ? FLUJO_COPY.miInversion : SUMAR_COPY.botonMapa) : undefined)}
              alInvertir={(p) => {
                // Con acceso y un usado, el flujo nuevo; si no, la hoja de Pronto de siempre (invierte-v2/destino.ts). Quien ya firmó
                // va directo a «Súmalo a tus opciones de inversión».
                if (destinoBoton({ acceso: invierteV2, condicion: p.condicion }) === "v2") {
                  // Uno de sus deptos (19-nov-2026): «Mi inversión» lleva a /invierte, que decide.
                  if (invierteFirmo && misDeptos.includes(p.avisoId)) { router.push(URL_INVIERTE); return; }
                  if (invierteFirmo) { router.push(`${urlSumar(p.avisoId)}?desde=explorar`); return; }
                  setContactoV2(p); return;
                }
                if (sinCuenta) void import("./hoja-registro");
                setInvierte({ pin: p, retomar: false });
              }}
            />
          ) : vista === "mapa" && (
            // «VER LISTA» FLOTA ABAJO AL CENTRO (26-nov-2026, lámina 5d): botón negro con el ícono de lista. Es la vía del teclado y del
            // lector de pantalla al mapa (un canvas). Con la tarjeta de un depto abierta, no va: la tarjeta ocupa ese lugar.
            <button type="button" className="ex-ver-lista" data-explorar="ver-lista" onClick={() => setVista("lista")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>
              {PORTAL_COPY.verLista}
            </button>
          )}
        </div>

        {/* ── la lista ── */}
        {vista === "lista" && (
          <ListaPortal
            // La lista lleva lo mismo que el mapa (25-nov-2026): las tres clases, sin las apagadas en los chips del contador.
            pines={seVe("comprar") ? visibles : []}
            negociados={seVe("ajustar") ? visiblesNeg : []}
            noConviene={seVe("no") ? ordenar(visiblesNo, "precio", uf) : []}
            tope={capa ? filtros.negociar : null}
            desglose={desglose}
            calculando={enCalculoAbajo}
            orden={orden}
            uf={uf}
            analizados={analizadosVivos}
            resumenes={resumenesVivos}
            guardados={guardados}
            alOrden={cambiarOrden}
            alAbrir={abrirDesdeLista}
            alGuardar={(id) => void alternarGuardado(id, "lista")}
            alCompartir={(p) => void compartir(p, "lista")}
            alPrepararCompartir={prepararCompartir}
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
          contarTodos={contarTodos}
          distribucion={distribucion}
          asegurar={(f) => { void asegurar(f); }}
          alMoverTasa={(t) => posthog?.capture(EVENTOS_PORTAL.tasaSlider, propsDeTasa(t, inicial.tasa?.tasa ?? null, "filtros"))}
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

      {contactoV2 && (
        <HojaContacto depto={deptoInvierteDePin(contactoV2)} origen="explorar" sinSesion={sinCuenta} alCerrar={() => setContactoV2(null)} />
      )}
      {invierte && (
        <HojaInvierte
          depto={deptoInvierteDePin(invierte.pin)}
          origen="explorar"
          sinCuenta={sinCuenta}
          retomar={invierte.retomar}
          volver={INVIERTE_COPY.listo.volverMapa}
          alPedirRegistro={() => { const pin = invierte.pin; setInvierte(null); pedirRegistro("invierte", pin); }}
          alCerrar={() => setInvierte(null)}
        />
      )}
      {registro && (
        <HojaRegistro pedido={registro.pedido} filtros={registro.filtros} orden={registro.orden} origen={origen} alCerrar={() => setRegistro(null)} />
      )}
      {/* RECALCULAR CON OTRA TASA, PIE O PLAZO (04-nov-2026, la pasada de Fabrizio): el avance en un pop-up centrado, como el de
          «Analizar», con un spinner; se cierra solo al terminar. Antes era la línea «Calculando con tu tasa… 9 de 25 comunas» de abajo. */}
      {/* EL DEPTO COMPARTIDO COMO PROTAGONISTA (04-nov-2026): la hoja sobre el mapa centrado en el pin, sin la bienvenida encima. */}
      {casoComp && (
        <HojaCompartida
          caso={casoComp}
          tope={compartido?.tope ?? null}
          sinCuenta={sinCuenta}
          informe={casoComp.tipo === "pin" ? analizadosVivos[casoComp.pin.avisoId] ?? null : null}
          resumenes={resumenesVivos}
          generando={generando}
          alAnalizar={analizarDesdeHoja}
          alVerInforme={recordarVuelta}
          alAbrirParecido={(id) => { setHojaComp(null); tocarPin(id); }}
          alCerrar={() => setHojaComp(null)}
        />
      )}
      {progreso && (
        <PopupRecalculo texto={textoRecalculo(filtros)} hechas={progreso.hechas} total={progreso.total} estado={progreso.estado}
          respaldo={respaldoDelFusible(filtros)?.etiqueta ?? null}
          alRespaldo={() => { const r = respaldoDelFusible(filtros); setProgreso(null); setFallidas(null); if (r) aplicar(r.filtros, "fusible"); }}
          alCerrar={() => { setProgreso(null); setFallo(true); }}
          alReintentar={() => { setProgreso(null); void asegurar(filtros); }} />
      )}
      {bienvenida && total != null && <Bienvenida n={inicial.convienen ?? inicial.n ?? total} negociados={inicial.negociadosGlobal} alCerrar={() => setBienvenida(false)} />}
      {calculo && <HojaCalculo tasa={inicial.tasa} elegida={filtros.tasa} sinCuenta={sinCuenta} alCerrar={() => setCalculo(false)} />}

      {confirmar && (
        <AvisoAntesDeAnalizar
          depto={{ comuna: confirmar.it.comuna, tipologia: confirmar.it.tipologia, m2: confirmar.it.m2, precioUF: confirmar.it.precioUF, condicion: confirmar.it.condicion }}
          veredictoImagen={claseDePin(confirmar.it)}
          negociado={filtros.modalidad === "ltr" && esNegociado(confirmar.it) && conCifrasNegociado(confirmar.it) ? { precioUF: confirmar.it.neg.p, descuentoPct: confirmar.it.neg.d, score: confirmar.it.neg.s } : null}
          modalidad={filtros.modalidad}
          combinacion={{ piePct: filtros.pie, plazoAnios: filtros.plazo, tasaPct: filtros.tasa }}
          finanzas={{ tasa: cuenta.finanzas.tasa, uf: cuenta.finanzas.uf, arriendo: confirmar.it.arriendo }}
          uso={confirmar.sin ? { tipo: "sin" } : cuenta.saldo}
          compras={compras(confirmar.it.avisoId)}
          ticketConSaldo={ticketConSaldo}
          ticketVence={cuenta.ticket && cuenta.cuentaCreadaAt ? cuandoVenceCorto(cuenta.cuentaCreadaAt) : null}
          rutaCompra={compras(confirmar.it.avisoId).pack.href}
          analizando={!!confirmar.analizando}
          movido={confirmar.movido ?? null}
          planLinea={plan}
          cambio={filtros.modalidad === "str" || esNegociado(confirmar.it) ? null : { recalcular: (combo) => recalcular(confirmar.it.avisoId, combo), base: { veredicto: confirmar.it.veredicto, score: confirmar.it.score, flujo: confirmar.it.flujo } }}
          alAnalizar={(eleccion) => void analizar(confirmar.it, eleccion)}
          alCancelar={() => { if (!confirmar.analizando) setConfirmar(null); }}
          informe={informe}
          alCerrarInforme={cerrarInforme}
          alReintentarInforme={reintentarInforme}
          alAnalizarIgualInforme={analizarIgualInforme}
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
