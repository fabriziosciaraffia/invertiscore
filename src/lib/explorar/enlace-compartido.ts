// ─────────────────────────────────────────────────────────────────────────────
// EL ENLACE DE UN DEPTO COMPARTIDO DESDE EXPLORAR (02-nov-2026, goal «Compartir un depto desde Explorar»). La forma del
// enlace y cómo se lee, nada más: SIN DEPENDENCIAS a propósito, porque lo lee el middleware (Edge) además de la página y
// el navegador. Lo demás (el texto, la vista previa, los parecidos) vive en compartir.ts.
//   · Abre /explorar EN ESE PIN: `a` es el aviso; la tarjeta se abre y el mapa se centra en él (explorar-cliente.tsx).
//   · Siempre con el financiamiento por defecto (pie 20 %, 30 años, la tasa de hoy): lo que ve quien entra sin cuenta y lo
//     que dice la vista previa. Por eso el enlace no lleva pie, plazo ni tasa; sí la modalidad (`m=str`) y, en renta corta,
//     la comuna del depto (`c`), que se calcula de a una comuna: sin ella la tarjeta esperaría a todo Gran Santiago.
//   · `desde=compartido` marca la llegada (la vista del enlace compartido, la puerta E con su detalle).
//   · `i=CÓDIGO`, cuando quien comparte tiene cuenta: su código de invitación. El middleware lo deja en la cookie de la
//     invitación, marcada «depto», y la cuenta que nazca en ese navegador queda con la puerta C y el detalle `depto:CÓDIGO`
//     (referido.ts): los dos ganan un análisis, igual que con el enlace /i/CÓDIGO.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizarCodigo } from "@/lib/referido";
import { DESDE_COMPARTIDO_LLEGADA } from "./puertas-landing";

/** La llegada a /explorar desde un enlace compartido (`?desde=compartido`): la misma constante de las llegadas. */
export const DESDE_COMPARTIDO = DESDE_COMPARTIDO_LLEGADA;
/** El parámetro del código de invitación de quien comparte. */
export const PARAM_INVITACION = "i";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esAvisoId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export interface EnlaceCompartido {
  avisoId: string;
  modalidad: "ltr" | "str";
  /** El código de invitación de quien compartió (null: lo compartió alguien sin cuenta). */
  codigo: string | null;
}

/** El enlace que viaja: `https://refranco.ai/explorar?a=<aviso>[&m=str&c=<comuna>][&i=<CÓDIGO>]&desde=compartido`. */
export function enlaceCompartido(sitio: string, p: { avisoId: string; modalidad: "ltr" | "str"; comuna: string; codigo?: string | null }): string {
  const q = new URLSearchParams();
  q.set("a", p.avisoId);
  if (p.modalidad === "str") { q.set("m", "str"); q.set("c", p.comuna); }
  const codigo = normalizarCodigo(p.codigo);
  if (codigo) q.set(PARAM_INVITACION, codigo);
  q.set("desde", DESDE_COMPARTIDO);
  return `${sitio.replace(/\/$/, "")}/explorar?${q.toString()}`;
}

/** Lo que trae un enlace compartido, o null si la URL no es uno (sin `desde=compartido` o sin un aviso válido). */
export function compartidoDeUrl(sp: { get(k: string): string | null }): EnlaceCompartido | null {
  if (sp.get("desde") !== DESDE_COMPARTIDO) return null;
  const a = sp.get("a");
  if (!esAvisoId(a)) return null;
  return { avisoId: a.toLowerCase(), modalidad: sp.get("m") === "str" ? "str" : "ltr", codigo: normalizarCodigo(sp.get(PARAM_INVITACION)) };
}

/** El código de invitación de un enlace compartido, para la cookie (lo lee el middleware): solo en /explorar. */
export function codigoDeEnlaceCompartido(pathname: string, search: string): string | null {
  if (pathname !== "/explorar" && pathname !== "/explorar/") return null;
  return compartidoDeUrl(new URLSearchParams(search))?.codigo ?? null;
}

/** Lo que se saca de la URL apenas carga la página: la llegada y el código ya hicieron lo suyo (una recarga no vuelve a
 *  contar la vista, y quien copie la barra no arrastra el código de otro). El aviso (`a`) se queda: es el pin abierto. */
export const PARAMS_DE_UNA_VEZ = ["desde", PARAM_INVITACION] as const;
