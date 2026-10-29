// ─────────────────────────────────────────────────────────────────────────────
// EL ORDEN DEL ALTA DE /deptos (25-oct-2026, «Estás dentro» en menos de 2 s). Medido en un preview contra la base real
// (Server-Timing, lib/cronometro.ts): cada consulta a Supabase tarda 150 a 450 ms y el alta hacía unas 18 EN FILA —el
// regalo solo, 6 o 7—; el servidor tardaba 4,5 a 6,3 s y la pantalla aparecía a los 6 o 7 s del toque.
//
// Ahora, ANTES de responder, solo lo que «Estás dentro» necesita, en paralelo:
//   1 · lo elegido en /deptos (la ruta del código lo pide junto con verificar el código);
//   2 · en UNA tanda: el perfil (la búsqueda, solo si no estaba), la fila del correo del día (sin ella «Analizar este» no
//       tiene token), los créditos sin la bienvenida de siempre, la puerta (la invitación) y si es una cuenta de prueba
//       (para el espejo del pixel); el regalo arranca en la misma tanda y entra en la respuesta si alcanza
//       (ESPERA_REGALO_MS); si no, la respuesta dice `regalo: "pendiente"` y la pantalla lo pide apenas llega.
// DESPUÉS de responder (`despues`, el waitUntil de Vercel): la primera vuelta del correo del día, la atribución, Meta, borrar
// lo elegido, PostHog y el resto del regalo. El espejo del pixel sale en la respuesta, calculado con el mismo id y los
// mismos datos que manda el servidor (espejoDeRegistro).
// Puro: las piezas se inyectan. Lo prueba el tier ALTA-ORDEN con piezas de mentira que tardan.
// ─────────────────────────────────────────────────────────────────────────────
import { tipoDeAlta } from "./respuesta";

/** La puerta con que nace la cuenta por esta alta: B (/deptos), C (invitada) o E (Explorar sin cuenta, 29-oct-2026). */
export type PuertaAlta = "B" | "C" | "E";

/** Cuánto espera la respuesta al regalo, después de la tanda: nada (medido, 25-oct-2026: el regalo tarda 1 s más que la
 *  tanda y una espera corta nunca lo alcanzaba). Si ya está, entra; si no, sale «pendiente» y la pantalla lo pide. */
export const ESPERA_REGALO_MS = 0;
/** «Estás dentro» pregunta por el regalo pendiente cada tanto (GET /api/deptos/regalo), hasta que esté decidido o hasta el tope. */
export const PASO_REGALO_MS = 600;
export const TOPE_ESPERA_REGALO_MS = 15_000;

export interface PendienteAlta {
  existe: boolean;
  creadoAt: string;
  perfil: Record<string, unknown>;
}

export interface RegaloAlta {
  estado: string;
  vence: string | null;
}

export interface PiezasAlta {
  // ── antes de responder ──
  /** Lo elegido en /deptos (puede venir pedido de antes). */
  pendiente: () => Promise<PendienteAlta | null>;
  /** Con Google, si el callback no alcanzó a pasar lo elegido al correo: lo pasa (y se vuelve a leer). */
  reclavarGoogle: (() => Promise<boolean>) | null;
  /** El segundo pedido de un alta ya hecha (respuestaDeAltaRepetida): «nueva» con su regalo y su búsqueda, o null. */
  repetida: () => Promise<Record<string, unknown> | null>;
  /** La cuenta que ya existía: las comunas que su perfil no tiene. */
  existente: (pend: PendienteAlta) => Promise<Record<string, unknown>>;
  /** El perfil, SOLO SI NO ESTABA (no pisa uno que ya existe). */
  perfilSiFalta: (perfil: Record<string, unknown>) => Promise<"creado" | "ya-estaba">;
  filaDelDia: () => Promise<unknown>;
  creditos: () => Promise<unknown>;
  /** La puerta (C si la cuenta es invitada; cobra la invitación si viene su cookie; E si lo elegido vino de Explorar). */
  puerta: () => Promise<{ puerta: PuertaAlta; invitacionUsada: boolean }>;
  esPrueba: () => Promise<boolean>;
  /** La puerta llega como promesa: el regalo arranca con la tanda y la usa solo en sus eventos. */
  regalo: (puerta: Promise<PuertaAlta>) => Promise<RegaloAlta>;
  // ── después de responder ──
  vueltaDelDia: () => Promise<unknown>;
  atribucion: (puerta: PuertaAlta) => Promise<unknown>;
  meta: (puerta: PuertaAlta) => Promise<unknown>;
  borrarPendiente: () => Promise<unknown>;
  posthog: (p: { regalo: string; puerta: PuertaAlta }) => Promise<unknown>;
}

export interface EspejoAlta { evento: string; eventId: string; datos?: Record<string, unknown> }

export interface ResultadoOrdenAlta {
  cuerpo: Record<string, unknown>;
  status?: number;
  invitacionUsada: boolean;
  espejos: EspejoAlta[];
}

const nada = () => Promise.resolve(undefined);
/** Lo que corre después de responder nunca rompe nada. */
const seguro = (p: () => Promise<unknown>) => Promise.resolve().then(p).catch(() => undefined);

export async function ordenarAlta(
  piezas: PiezasAlta,
  e: {
    cuentaCreadaAt: string | null | undefined;
    /** La cuenta nació hace minutos (esCuentaNueva). */
    cuentaNueva: boolean;
    /** La búsqueda de «Estás dentro», desde lo elegido. */
    busquedaDe: (perfil: Record<string, unknown>) => unknown;
    /** El espejo del CompleteRegistration (null si es prueba o sin permiso del aviso de cookies). */
    espejoDe: (puerta: PuertaAlta, prueba: boolean) => EspejoAlta | null;
  },
  despues: (p: Promise<unknown>) => void,
  o: { esperaRegaloMs?: number } = {},
): Promise<ResultadoOrdenAlta> {
  let pend = await piezas.pendiente();
  if (!pend && piezas.reclavarGoogle && (await piezas.reclavarGoogle())) pend = await piezas.pendiente();
  if (!pend) {
    const repetida = e.cuentaNueva ? await piezas.repetida() : null;
    return { cuerpo: repetida ?? { estado: "sin-pendiente" }, invitacionUsada: false, espejos: [] };
  }
  const p = pend;
  if (tipoDeAlta({ existiaAlPedir: p.existe, cuentaCreadaAt: e.cuentaCreadaAt, pedidoAt: p.creadoAt }) === "existente") {
    const [cuerpo, puerta] = await Promise.all([piezas.existente(p), piezas.puerta()]);
    despues(seguro(() => piezas.atribucion(puerta.puerta)));
    despues(seguro(piezas.borrarPendiente));
    return { cuerpo: { estado: "existente", ...cuerpo }, invitacionUsada: puerta.invitacionUsada, espejos: [] };
  }

  // ── LA TANDA: todo junto ──
  const puertaP = piezas.puerta();
  const regaloP = piezas.regalo(puertaP.then((x) => x.puerta));
  // El regalo puede terminar después de responder: lo que falta sigue en segundo plano y nunca rompe la respuesta.
  despues(regaloP.catch(() => undefined));
  const [perfil, , , puerta, prueba] = await Promise.all([piezas.perfilSiFalta(p.perfil), piezas.filaDelDia(), piezas.creditos(), puertaP, piezas.esPrueba()]);

  // El perfil ya estaba: si la cuenta es de recién, es un segundo pedido del alta (el primero lo creó): la misma respuesta.
  if (perfil === "ya-estaba") {
    if (e.cuentaNueva) {
      const repetida = await piezas.repetida();
      if (repetida) return { cuerpo: repetida, invitacionUsada: puerta.invitacionUsada, espejos: [] };
    }
    const cuerpo = await piezas.existente(p);
    despues(seguro(piezas.borrarPendiente));
    return { cuerpo: { estado: "existente", ...cuerpo }, invitacionUsada: puerta.invitacionUsada, espejos: [] };
  }

  // El regalo, si alcanza; si no, «pendiente».
  const espera = o.esperaRegaloMs ?? ESPERA_REGALO_MS;
  const regalo = await Promise.race([regaloP.catch(() => null), new Promise<"pendiente">((ok) => setTimeout(() => ok("pendiente"), espera))]);

  // ── DESPUÉS de responder ──
  despues(seguro(piezas.vueltaDelDia));
  despues(seguro(() => piezas.atribucion(puerta.puerta)));
  despues(seguro(() => piezas.meta(puerta.puerta)));
  despues(seguro(piezas.borrarPendiente));
  despues(seguro(async () => { const r = await regaloP.catch(() => null); await piezas.posthog({ regalo: r?.estado ?? "fallo", puerta: puerta.puerta }); }));

  const espejo = e.espejoDe(puerta.puerta, prueba);
  const cuerpo: Record<string, unknown> = regalo === "pendiente"
    ? { estado: "nueva", regaloVence: null, regalo: "pendiente", busqueda: e.busquedaDe(p.perfil) }
    : { estado: "nueva", regaloVence: regalo?.vence ?? null, busqueda: e.busquedaDe(p.perfil) };
  return { cuerpo, invitacionUsada: puerta.invitacionUsada, espejos: espejo ? [espejo] : [] };
}

export { nada as sinPieza };
