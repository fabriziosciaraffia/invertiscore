// ─────────────────────────────────────────────────────────────────────────────
// UNA SOLA ENTRADA: EL CÓDIGO (01-oct-2026, decisión de Fabrizio). Las cuentas nacen por código
// (`signInWithOtp` → `verifyOtp`), así que entrar también es por código: /entrar pide el correo,
// manda el código y lo verifica en la misma pantalla. /login (correo + contraseña) queda solo para las
// cuentas viejas, enlazado chico desde abajo.
//
// Módulo PURO (sin React ni Supabase): el copy por contexto, la validación del destino y el href que
// arma el header. Lo prueba el tier ENTRADA-CÓDIGO.
//
// LOS CONTEXTOS (`?ctx=`):
//   · generico — desde el header o cualquier enlace sin contexto.
//   · pack     — quien pagó el pack sin cuenta (/payments/return, el correo del pago).
//   · informe  — el dueño anónimo de un informe. Solo vale si `next` ES un informe: sin informe, el
//                formulario nunca dice «este informe» (cae a genérico).
//   · semanal  — desde el correo semanal de deptos.
// ─────────────────────────────────────────────────────────────────────────────
import { esDestinoSeguro } from "@/lib/auth-next";

export type ContextoEntrada = "generico" | "pack" | "informe" | "semanal";

export const RUTA_ENTRAR = "/entrar";
const DESTINO_POR_DEFECTO = "/dashboard";

export const ENTRAR = {
  placeholderCorreo: "tu@correo.cl",
  mandarCodigo: "Mandar el código",
  o: "o",
  google: "Seguir con Google",
  conContrasenaPregunta: "¿Tu cuenta es de antes y tiene contraseña?",
  conContrasenaEnlace: "Entra con contraseña",
  enviadoTitulo: "Revisa tu correo",
  // El largo del código lo dice el panel de Supabase; hoy son 6 y el formulario acepta de 6 a 8
  // (lib/lo-que-sigue/codigo.ts). El copy dice 6, con el mismo criterio que el registro del informe.
  enviadoCuerpo: (correo: string) => `Mandamos un código de 6 dígitos a ${correo}. Escríbelo acá y vuelves a donde estabas.`,
  placeholderCodigo: "Código",
  entrar: "Entrar",
  noLlego: "¿No llegó? Revisa spam o",
  mandarDeNuevo: "mándalo de nuevo",
  otroCorreo: "Usar otro correo",
  reenviado: "Listo, va otro código.",
} as const;

/** Título y bajada de cada contexto. Literales aprobados (01-oct-2026). */
export const ENTRAR_CONTEXTO: Record<ContextoEntrada, { titulo: string; bajada: string }> = {
  generico: { titulo: "Entra a Franco", bajada: "Te mandamos un código a tu correo. Sin contraseña." },
  pack: { titulo: "Entra con el correo con que pagaste", bajada: "Ahí están tus 3 análisis y los deptos que Franco revisó para ti. Te mandamos un código." },
  informe: { titulo: "Guarda este informe en tu cuenta.", bajada: "Te mandamos un código; el informe queda en tu cuenta." },
  semanal: { titulo: "Entra para analizarlo.", bajada: "El depto que elegiste te espera." },
};

/** ¿El destino es un informe? Solo así el copy puede hablar de «este informe». */
export function esRutaDeInforme(next: string | null | undefined): boolean {
  return typeof next === "string" && /^\/analisis\/(renta-corta\/)?[0-9a-f-]{8,}(\/|\?|#|$)/i.test(next);
}

/**
 * Adónde se vuelve después de entrar: solo rutas internas (empiezan con «/», nunca «//» ni `/\`),
 * y nunca otra pantalla de auth (sería un bucle). Sin destino válido → /dashboard.
 */
export function destinoTrasEntrar(next: string | null | undefined): string {
  if (!esDestinoSeguro(next) || next.startsWith("//")) return DESTINO_POR_DEFECTO;
  const ruta = next.split(/[?#]/)[0];
  if (ruta === RUTA_ENTRAR || ruta === "/login" || ruta === "/registro" || ruta === "/register") return DESTINO_POR_DEFECTO;
  return next;
}

/** El contexto que se muestra: el pedido, salvo «informe» sin un informe de destino. */
export function contextoEntrada(ctx: string | null | undefined, next: string | null | undefined): ContextoEntrada {
  if (ctx === "pack" || ctx === "semanal") return ctx;
  if (ctx === "informe" && esRutaDeInforme(next)) return "informe";
  return "generico";
}

/** El enlace a /entrar con su `next` (y el contexto, si no es el genérico). */
export function hrefEntrar(next: string | null | undefined, ctx: ContextoEntrada = "generico"): string {
  const p = new URLSearchParams();
  p.set("next", destinoTrasEntrar(next));
  if (ctx !== "generico") p.set("ctx", ctx);
  return `${RUTA_ENTRAR}?${p.toString()}`;
}

/** El enlace a /login (cuentas viejas con contraseña), conservando el `next`. */
export function hrefConContrasena(next: string | null | undefined): string {
  return `/login?next=${encodeURIComponent(destinoTrasEntrar(next))}`;
}

/** ¿La cuenta se acaba de crear? (para medir alta vs. entrada; 10 minutos, como el callback). */
export function esCuentaNueva(createdAt: string | null | undefined, ahora: number = Date.now()): boolean {
  if (!createdAt) return false;
  const edad = ahora - new Date(createdAt).getTime();
  return edad >= 0 && edad < 10 * 60 * 1000;
}
