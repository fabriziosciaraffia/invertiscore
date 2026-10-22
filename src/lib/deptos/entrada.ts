// ─────────────────────────────────────────────────────────────────────────────
// «ENTRAR» EN /deptos NO PUEDE QUEDAR GIRANDO (22-oct-2026, QA del recorrido de la puerta B). Una corrida verificó el
// código en Supabase y el navegador nunca pidió el alta: la respuesta del verify no volvió (esa mañana la red del equipo
// cortaba las conexiones HTTPS a supabase.co), el `fetch` de auth-js no tiene tope y el alta solo se pedía después.
//
// Ahora:
//   · el código se verifica EN EL SERVIDOR, junto con el alta, en un solo pedido (POST /api/deptos/entrar): el navegador
//     ya no depende de una conexión a Supabase en ese paso, y el servidor sabe que el código entró;
//   · todo pedido de este paso tiene TOPE (TOPE_ENTRAR_MS): si no responde, se repite solo una vez; si tampoco, el botón
//     dice «No pudimos entrar, intenta de nuevo» y vuelve a estar activo, con el mismo código puesto;
//   · el reintento con el MISMO código no choca con el código ya usado: si ese código entró recién (VENTANA_REPONER_MS),
//     el servidor repone la sesión una vez y devuelve el alta ya hecha, sin correrla dos veces;
//   · una entrada verificada sin alta pasado ESPERA_ALTA_PERDIDA_MS sale a PostHog como `alta_perdida` con la puerta.
// Puro (sin React ni Supabase): lo prueba el tier ENTRADA-ALTA con un alta que no responde.
// ─────────────────────────────────────────────────────────────────────────────

export const TOPE_ENTRAR_MS = 8000;
export const REINTENTOS_ENTRAR = 1;
/** Hasta cuándo el mismo código repone la sesión si la primera respuesta se perdió. */
export const VENTANA_REPONER_MS = 3 * 60_000;
/** Una entrada verificada sin alta pasado esto es un alta perdida. */
export const ESPERA_ALTA_PERDIDA_MS = 60_000;

export const ENTRAR_COPY = {
  /** El botón, cuando ni el pedido ni su reintento respondieron: vuelve a estar activo, con el mismo código. */
  noPudimos: "No pudimos entrar, intenta de nuevo",
} as const;

export type ResultadoConTope<T> = { ok: true; valor: T; intentos: number } | { ok: false; motivo: "tope" | "error"; intentos: number };

/**
 * Pide algo con tope: si no responde en `tope` ms se corta (la señal se aborta y no se espera más, aunque el pedido no
 * la escuche) y se pide de nuevo, `reintentos` veces. Un error de red también se reintenta. Lo que devuelva `pedir`
 * —una respuesta del servidor, aunque sea un error— es un resultado y no se repite.
 */
export async function conTopeYReintento<T>(
  pedir: (senal: AbortSignal) => Promise<T>,
  o: { tope?: number; reintentos?: number; reloj?: { poner: (fn: () => void, ms: number) => unknown; quitar: (h: unknown) => void } } = {},
): Promise<ResultadoConTope<T>> {
  const tope = o.tope ?? TOPE_ENTRAR_MS;
  const reintentos = o.reintentos ?? REINTENTOS_ENTRAR;
  const reloj = o.reloj ?? { poner: (fn: () => void, ms: number) => setTimeout(fn, ms), quitar: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>) };
  let motivo: "tope" | "error" = "tope";
  for (let intento = 1; intento <= reintentos + 1; intento++) {
    const control = new AbortController();
    let h: unknown;
    const corte = new Promise<"tope">((ok) => { h = reloj.poner(() => { control.abort(); ok("tope"); }, tope); });
    try {
      const r = await Promise.race([pedir(control.signal).then((valor) => ({ valor })), corte]);
      if (r !== "tope") return { ok: true, valor: r.valor, intentos: intento };
      motivo = "tope";
    } catch {
      motivo = control.signal.aborted ? "tope" : "error";
    } finally {
      reloj.quitar(h);
    }
  }
  return { ok: false, motivo, intentos: reintentos + 1 };
}

/** Lo que el servidor recuerda de una entrada por código (deptos_entradas). */
export interface EntradaRegistrada {
  id: string;
  userId: string | null;
  codigoHash: string | null;
  verificadoAt: string;
  alta: Record<string, unknown> | null;
  recuperadaAt: string | null;
}

/** ¿Este reintento puede reponer la sesión? El mismo código (hash), dentro de la ventana y una sola vez. */
export function puedeReponer(e: EntradaRegistrada | null, hash: string, ahora: Date): boolean {
  if (!e || !e.codigoHash || e.codigoHash !== hash || e.recuperadaAt) return false;
  const t = Date.parse(e.verificadoAt);
  return Number.isFinite(t) && ahora.getTime() - t <= VENTANA_REPONER_MS;
}

/** Por qué camino entra quien vuelve al callback hacia /deptos (o la página del invitado): el enlace del correo
 *  (`entro=1`) o Google (`entro=google`). null: no es una entrada de /deptos. */
export function metodoDeEntrada(next: string | null | undefined): "enlace" | "google" | null {
  if (!next || !next.startsWith("/")) return null;
  const entro = new URLSearchParams(next.split("?")[1]?.split("#")[0] ?? "").get("entro");
  return entro === "google" ? "google" : entro === "1" ? "enlace" : null;
}

/** ¿Es un alta perdida? Verificada, sin alta pasado el minuto, y todavía sin avisar. */
export function esAltaPerdida(e: { verificadoAt: string; altaAt: string | null; perdidaAvisadaAt: string | null }, ahora: Date): boolean {
  const t = Date.parse(e.verificadoAt);
  return !e.altaAt && !e.perdidaAvisadaAt && Number.isFinite(t) && ahora.getTime() - t >= ESPERA_ALTA_PERDIDA_MS;
}

export interface UsuarioEntrada { id: string; email?: string | null }

/** Lo que necesita la entrada por código; el servidor lo arma con Supabase, el tier con piezas de mentira. */
export interface DepsEntrada {
  /** La sesión que ya trae el pedido (otra pestaña, o un reintento que sí alcanzó a dejar la cookie). */
  sesionActual: () => Promise<UsuarioEntrada | null>;
  verificar: (correo: string, codigo: string) => Promise<UsuarioEntrada | null>;
  hash: (correo: string, codigo: string) => string;
  ultimaEntrada: (correo: string) => Promise<EntradaRegistrada | null>;
  registrar: (p: { correo: string; userId: string; codigoHash: string }) => Promise<void>;
  /** Una sesión nueva para ese correo, sin código (el servidor la emite y la deja en la cookie). */
  reponerSesion: (correo: string) => Promise<UsuarioEntrada | null>;
  marcarRepuesta: (id: string) => Promise<void>;
  alta: (usuario: UsuarioEntrada) => Promise<{ cuerpo: Record<string, unknown>; status?: number }>;
  marcarAlta: (p: { correo: string; userId: string; alta: Record<string, unknown> }) => Promise<void>;
  ahora?: () => Date;
}

export type ResultadoEntrada =
  | { tipo: "alta"; cuerpo: Record<string, unknown>; status?: number; via: "verificado" | "con-sesion" | "repuesta" | "alta-guardada" }
  | { tipo: "codigo" };

/**
 * La entrada por código, en el servidor: verifica (o reconoce la sesión que ya hay), corre el alta y la guarda. Si el
 * código ya se usó porque la respuesta anterior se perdió, el mismo código repone la sesión (puedeReponer) y, si el alta
 * ya estaba hecha, devuelve esa misma respuesta sin correrla otra vez.
 */
export async function entrarConCodigo(correo: string, codigo: string, d: DepsEntrada): Promise<ResultadoEntrada> {
  const ahora = (d.ahora ?? (() => new Date()))();
  const hash = d.hash(correo, codigo);
  let usuario = await d.sesionActual();
  let via: "verificado" | "con-sesion" | "repuesta" = "con-sesion";
  if (!usuario || (usuario.email ?? "").toLowerCase() !== correo) {
    usuario = await d.verificar(correo, codigo);
    via = "verificado";
    if (usuario) {
      await d.registrar({ correo, userId: usuario.id, codigoHash: hash });
    } else {
      const previa = await d.ultimaEntrada(correo);
      if (!puedeReponer(previa, hash, ahora)) return { tipo: "codigo" };
      usuario = await d.reponerSesion(correo);
      if (!usuario) return { tipo: "codigo" };
      await d.marcarRepuesta(previa!.id);
      via = "repuesta";
    }
  }
  // LA ENTRADA YA TERMINÓ EN ALTA (visto en el QA del 22-oct-2026): la respuesta se perdió pero la cookie de la sesión sí
  // llegó (o se repuso recién). Correr el alta otra vez daría «sin-pendiente» —lo elegido ya se usó— y la pantalla se iría
  // al dashboard en vez de «Estás dentro»: se devuelve la misma respuesta, si es de esta cuenta y de recién.
  if (via !== "verificado") {
    const previa = await d.ultimaEntrada(correo);
    const reciente = !!previa && ahora.getTime() - Date.parse(previa.verificadoAt) <= VENTANA_REPONER_MS;
    if (previa?.alta && previa.userId === usuario.id && reciente) return { tipo: "alta", cuerpo: previa.alta, via: "alta-guardada" };
  }
  const r = await d.alta(usuario);
  // Respondió (nueva, existente o sin nada pendiente): la entrada tiene su alta. Un error del alta no se marca: es perdida.
  if (typeof r.cuerpo.estado === "string") await d.marcarAlta({ correo, userId: usuario.id, alta: r.cuerpo });
  return { tipo: "alta", cuerpo: r.cuerpo, status: r.status, via };
}
