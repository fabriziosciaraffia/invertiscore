// ─────────────────────────────────────────────────────────────────────────────
// LA PUERTA C, EL REFERIDO (16-oct-2026, decisiones de Fabrizio): una persona registrada invita a alguien y, si entra,
// los dos reciben un análisis.
//   · El enlace: cada persona tiene el suyo, «refranco.ai/i/CÓDIGO». Por defecto el invitado ve «Un amigo te invitó a
//     Franco»; con su nombre solo si quien invita lo pide al generar el enlace (es otro enlace, el suyo con nombre).
//   · La cookie: abrir el enlace deja el código guardado 30 días (el middleware); se cobra al registrarse, venga por
//     donde venga —las cuatro preguntas de la página, el informe gratis por dirección, el banner, Google—.
//   · El premio se paga cuando el invitado, con sesión (validó el código), contesta el «cuándo»: a quien invitó, un
//     análisis más vigente 60 días y el correo «Tu invitado entró: tienes un análisis más». El invitado recibe el
//     regalo normal de cuenta nueva, no dos. Tope: cinco por persona. No cuenta si el invitado ya tenía cuenta ni si
//     usa el mismo dispositivo que quien invita.
// Puro (sin Node): lo lee el middleware. La escritura vive en referido-servidor.ts; lo prueba el tier PUERTA-C.
// ─────────────────────────────────────────────────────────────────────────────

export const COOKIE_INVITACION = "franco_invitacion";
/**
 * La invitación ya cobrada (16-oct-2026, visto en el QA): la cookie no se borra, queda «usada». Borrada, el `router.refresh()`
 * de la misma página volvía a pedir /i/CÓDIGO y el middleware la dejaba de nuevo, y otra cuenta creada en ese navegador
 * se habría cobrado el mismo código. Con «usada», el middleware no pone otra: una invitación por navegador.
 */
export const INVITACION_USADA = "usada";
export const DIAS_COOKIE_INVITACION = 30;
export const VIDA_COOKIE_INVITACION_S = DIAS_COOKIE_INVITACION * 24 * 60 * 60;

export const TOPE_PREMIOS_REFERIDO = 5;
export const DIAS_VIGENCIA_PREMIO_REFERIDO = 60;
/** El lote del premio en `credit_grants`. Cuenta como regalo (regalo-alta.ts › FUENTES_REGALO). */
export const FUENTE_PREMIO_REFERIDO = "premio_referido";

/** Seis letras y números sin los que se confunden al dictarlos (I, L, O, 0, 1). */
export const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LARGO_CODIGO = 6;
export const CODIGO_INVITACION = /^[A-HJKMNP-Z2-9]{6}$/;
/** Lo que queda en `user_attribution.puerta_detalle`: la cohorte del panel se corta por este prefijo. */
export const PREFIJO_DETALLE_INVITACION = "invitacion:";

/** El código de una URL o de lo que alguien tipeó, en mayúsculas; null si no es un código. */
export function normalizarCodigo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return CODIGO_INVITACION.test(c) ? c : null;
}

/** Un código al azar; `azar` devuelve enteros uniformes en [0, n). */
export function generarCodigo(azar: (n: number) => number): string {
  let c = "";
  for (let i = 0; i < LARGO_CODIGO; i++) c += ALFABETO_CODIGO[azar(ALFABETO_CODIGO.length)];
  return c;
}

/** Lo que guarda la cookie: el código y cuándo se abrió el enlace (segundos). */
export function valorCookieInvitacion(codigo: string, ahoraMs: number): string {
  return `${codigo}.${Math.floor(ahoraMs / 1000)}`;
}

export function leerCookieInvitacion(v: string | null | undefined): { codigo: string; visitaMs: number | null } | null {
  if (!v) return null;
  const [c, t] = v.split(".");
  const codigo = normalizarCodigo(c);
  if (!codigo) return null;
  const s = Number(t);
  return { codigo, visitaMs: Number.isFinite(s) && s > 0 ? s * 1000 : null };
}

export const rutaInvitacion = (codigo: string) => `/i/${codigo}`;
export const enlaceInvitacion = (sitio: string, codigo: string) => `${sitio.replace(/\/$/, "")}${rutaInvitacion(codigo)}`;
/** El enlace como se lee en un correo o en la pantalla: sin el protocolo. */
export const textoEnlaceInvitacion = (codigo: string) => `refranco.ai${rutaInvitacion(codigo)}`;

/** El margen entre abrir el enlace y que la cuenta exista (relojes, el viaje a Google). */
export const HOLGURA_INVITACION_MS = 60_000;
/** Sin la hora de la visita en la cookie: la cuenta tiene que ser de las últimas dos horas. */
export const VENTANA_SIN_VISITA_MS = 2 * 60 * 60 * 1000;

/**
 * ¿La cuenta es nueva para esta invitación? Nació DESPUÉS de abrir el enlace (con un minuto de holgura) y dentro de los
 * 30 días de la cookie. Una cuenta de antes —ya tenía cuenta— no cuenta.
 */
export function cuentaNuevaParaInvitacion(p: { creadaAt: string | null | undefined; visitaMs: number | null; ahoraMs: number }): boolean {
  if (!p.creadaAt) return false;
  const c = Date.parse(p.creadaAt);
  if (!Number.isFinite(c) || c > p.ahoraMs + HOLGURA_INVITACION_MS) return false;
  if (p.ahoraMs - c > DIAS_COOKIE_INVITACION * 864e5) return false;
  if (p.visitaMs != null) return c >= p.visitaMs - HOLGURA_INVITACION_MS;
  return p.ahoraMs - c <= VENTANA_SIN_VISITA_MS;
}

export type EstadoReferido = "pendiente" | "pagado" | "tope" | "mismo_dispositivo" | "cuenta_previa";
export type DecisionPremio = "pagar" | "tope" | "mismo_dispositivo";

/**
 * Qué se hace con el premio de quien invitó, cuando el invitado contesta el «cuándo». El mismo dispositivo primero: es la
 * señal de que es la misma persona (quien invita abrió su enlace en ese navegador). `pagados` = premios ya pagados a
 * quien invitó.
 */
export function decidirPremio(p: { dispositivoInvitado: string | null; dispositivosInvitador: readonly string[]; pagados: number }): DecisionPremio {
  if (p.dispositivoInvitado && p.dispositivosInvitador.includes(p.dispositivoInvitado)) return "mismo_dispositivo";
  if (p.pagados >= TOPE_PREMIOS_REFERIDO) return "tope";
  return "pagar";
}

/** El nombre que se muestra: el que quien invita escribió, recortado; sin nombre, «un amigo». */
export function nombreInvitacion(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return n.length > 0 ? n : null;
}

const quien = (nombre: string | null) => (nombre ? `${nombre} te invitó a Franco` : "Un amigo te invitó a Franco");

export const REFERIDO_COPY = {
  // ── La página del invitado ──
  titular: "Te invitaron a Franco.",
  bajada: "Tu primer análisis va por cuenta de Franco.",
  /** La vista previa del enlace (WhatsApp, el correo) y la línea de arriba del titular. */
  quien,
  sinDepto: "Elige y Franco te dice cuántos deptos convienen hoy.",
  conDepto: "¿Ya tienes un depto en la mira?",
  conDeptoAccion: "Escribe su dirección y ve su informe",
  conDeptoVolver: "Mejor elijo comuna y precio",
  /** Quien ya tiene cuenta abre un enlace de invitación. */
  yaTienesCuenta: "Ya tienes cuenta en Franco.",
  yaTienesCuentaTexto: "Este enlace es para quien todavía no está. Tus análisis siguen en tu cuenta.",
  irACuenta: "Ir a mi cuenta",
  /** Quien invita abre su propio enlace. */
  tuEnlace: "Este es tu enlace de invitación.",

  // ── Invita a alguien (el dashboard, el menú de compartir, el pie del semanal) ──
  invitaTitulo: "Invita a alguien",
  invitaTexto: "Si entra con tu enlace, los dos reciben un análisis.",
  copiar: "Copiar enlace",
  copiado: "Enlace copiado",
  compartir: "Compartir",
  conNombre: "Que diga mi nombre",
  nombrePlaceholder: "Tu nombre",
  /** Lo que lleva el mensaje al compartir (sin el enlace, para el menú nativo, y con él). */
  textoCompartir: (nombre: string | null) => `${quien(nombre)}: tu primer análisis va por cuenta de Franco.`,
  mensaje: (nombre: string | null, url: string) => `${quien(nombre)}: tu primer análisis va por cuenta de Franco. ${url}`,
  usarNombre: "Usar este nombre",
  error: "No pudimos armar tu enlace. Intenta de nuevo.",
  cuenta: (pagados: number) =>
    pagados >= TOPE_PREMIOS_REFERIDO
      ? `Ya sumaste tus ${TOPE_PREMIOS_REFERIDO} análisis por invitar.`
      : pagados === 0
        ? `Hasta ${TOPE_PREMIOS_REFERIDO} invitados te suman un análisis cada uno, vigente ${DIAS_VIGENCIA_PREMIO_REFERIDO} días.`
        : `Llevas ${pagados} de ${TOPE_PREMIOS_REFERIDO}: cada invitado que entra te suma un análisis, vigente ${DIAS_VIGENCIA_PREMIO_REFERIDO} días.`,
  pieSemanal: "Invita a alguien: si entra con tu enlace, los dos reciben un análisis.",
  menuCompartir: "Invita a alguien",
  menuCompartirNota: "Los dos reciben un análisis",

  // ── El correo a quien invitó ──
  correoAsunto: "Tu invitado entró: tienes un análisis más",
  correoTitular: "Tu invitado entró.",
  correoTexto: "Tienes un análisis más en tu cuenta, para el depto que quieras.",
  /** Lo mismo después del saludo («Hola Camila, tienes…»). */
  correoCuerpo: "tienes un análisis más en tu cuenta, para el depto que quieras.",
  correoQuedan: (pagados: number) =>
    pagados >= TOPE_PREMIOS_REFERIDO
      ? `Con este sumaste los ${TOPE_PREMIOS_REFERIDO} análisis por invitar.`
      : `Llevas ${pagados} de ${TOPE_PREMIOS_REFERIDO} invitados: cada uno que entra te suma otro.`,
  correoBoton: "Analizar un depto",
} as const;
