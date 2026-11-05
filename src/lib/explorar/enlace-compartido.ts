// ─────────────────────────────────────────────────────────────────────────────
// EL ENLACE DE UN DEPTO COMPARTIDO DESDE EXPLORAR (02-nov-2026, goal «Compartir un depto desde Explorar»). La forma del
// enlace y cómo se lee, nada más: SIN DEPENDENCIAS a propósito, porque lo lee el middleware (Edge) además de la página y
// el navegador. Lo demás (el texto, la vista previa, los parecidos) vive en compartir.ts.
//   · Abre /explorar EN ESE PIN: `a` es el aviso; la tarjeta se abre y el mapa se centra en él (explorar-cliente.tsx).
//   · Siempre con el financiamiento por defecto (pie 20 %, 30 años, la tasa de hoy): lo que ve quien entra sin cuenta y lo
//     que dice la vista previa. Por eso el enlace no lleva pie, plazo ni tasa; sí la modalidad (`m=str`) y, en renta corta,
//     la comuna del depto (`c`), que se calcula de a una comuna: sin ella la tarjeta esperaría a todo Gran Santiago.
//   · `n=5` (o 10), cuando lo compartido es un depto de la capa «Si negocias» (03-nov-2026): el tope de la capa, el mismo
//     parámetro de Filtros (portal.ts › portalDeUrl), así que el enlace abre /explorar con la capa prendida. Solo en arriendo
//     tradicional, que es donde la capa existe.
//   · `f=<firma>` (03-nov-2026): la firma del servidor para ese aviso y ese código (firma-compartido.ts). Sin ella, el enlace
//     abre el pin igual, borroso, y su vista previa no trae cifras.
//   · `desde=compartido` marca la llegada (la vista del enlace compartido, la puerta E con su detalle).
//   · `i=CÓDIGO`, cuando quien comparte tiene cuenta: su código de invitación. El middleware lo deja en la cookie de la
//     invitación, marcada «depto», y la cuenta que nazca en ese navegador queda con la puerta C y el detalle `depto:CÓDIGO`
//     (referido.ts): el invitado su regalo de cuenta nueva y quien invita uno con su primer análisis, igual que con /i/CÓDIGO.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizarCodigo } from "@/lib/referido";
import { DESDE_COMPARTIDO_LLEGADA } from "./puertas-landing";

/** La llegada a /explorar desde un enlace compartido (`?desde=compartido`): la misma constante de las llegadas. */
export const DESDE_COMPARTIDO = DESDE_COMPARTIDO_LLEGADA;
/** El parámetro del código de invitación de quien comparte. */
export const PARAM_INVITACION = "i";
/** El parámetro de la firma del servidor. */
export const PARAM_FIRMA = "f";
const FORMA_FIRMA = /^[A-Za-z0-9_-]{16}$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esAvisoId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export interface EnlaceCompartido {
  avisoId: string;
  modalidad: "ltr" | "str";
  /** El código de invitación de quien compartió (null: lo compartió alguien sin cuenta). */
  codigo: string | null;
  /** La firma del enlace, si trae una con la forma de una (si vale lo dice el servidor: firma-compartido.ts). */
  firma: string | null;
}

/** El enlace que viaja: `https://refranco.ai/explorar?a=<aviso>[&m=str&c=<comuna>][&n=<tope>][&i=<CÓDIGO>][&f=<firma>]&desde=compartido`. */
export function enlaceCompartido(sitio: string, p: { avisoId: string; modalidad: "ltr" | "str"; comuna: string; codigo?: string | null; tope?: number | null; firma?: string | null }): string {
  const q = new URLSearchParams();
  q.set("a", p.avisoId);
  if (p.modalidad === "str") { q.set("m", "str"); q.set("c", p.comuna); }
  else if (p.tope != null) q.set("n", String(p.tope));
  const codigo = normalizarCodigo(p.codigo);
  if (codigo) q.set(PARAM_INVITACION, codigo);
  if (p.firma) q.set(PARAM_FIRMA, p.firma);
  q.set("desde", DESDE_COMPARTIDO);
  return `${sitio.replace(/\/$/, "")}/explorar?${q.toString()}`;
}

/** Lo que trae un enlace compartido, o null si la URL no es uno (sin `desde=compartido` o sin un aviso válido). */
export function compartidoDeUrl(sp: { get(k: string): string | null }): EnlaceCompartido | null {
  if (sp.get("desde") !== DESDE_COMPARTIDO) return null;
  const a = sp.get("a");
  if (!esAvisoId(a)) return null;
  const f = sp.get(PARAM_FIRMA);
  return { avisoId: a.toLowerCase(), modalidad: sp.get("m") === "str" ? "str" : "ltr", codigo: normalizarCodigo(sp.get(PARAM_INVITACION)), firma: f && FORMA_FIRMA.test(f) ? f : null };
}

/** El código de invitación de un enlace compartido, para la cookie (lo lee el middleware): solo en /explorar. */
export function codigoDeEnlaceCompartido(pathname: string, search: string): string | null {
  if (pathname !== "/explorar" && pathname !== "/explorar/") return null;
  return compartidoDeUrl(new URLSearchParams(search))?.codigo ?? null;
}

/** Lo que se saca de la URL apenas carga la página: la llegada, el código y la firma ya hicieron lo suyo (una recarga no
 *  vuelve a contar la vista, y quien copie la barra no arrastra el código de otro ni su firma). El aviso (`a`) se queda: es
 *  el pin abierto. */
export const PARAMS_DE_UNA_VEZ = ["desde", PARAM_INVITACION, PARAM_FIRMA] as const;
