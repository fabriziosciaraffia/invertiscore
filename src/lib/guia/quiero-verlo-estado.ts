// ─────────────────────────────────────────────────────────────────────────────
// El estado de envío de «Quiero verlo» (17-oct-2026, decisión de Fabrizio: es lo que la persona pagó y pasaba
// desapercibido). Puro: lo usa InformeDeAviso y lo prueba el tier GUIA-BUSQUEDA.
//   quieto → (toca) → enviando → listo (con el correo) · ya (había salido antes) · despublicado · error → (Reintentar) → enviando…
// Sin recargar la página: la respuesta de POST /api/lo-que-sigue/quiero-verlo decide el estado siguiente.
// «ya» (19-oct-2026): el aviso sale una sola vez por informe, así que un segundo toque —otro día, tras recargar— no manda
// nada. La pantalla dice cuándo salió y con qué asunto, en vez de «Listo: te lo mandamos» (el caso de fsm@ en 7b777de6:
// salió el 17-oct, volvió a tocar el 19 y la pantalla afirmó un envío que no hubo).
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoQuieroVerlo =
  | { tipo: "quieto" }
  | { tipo: "enviando" }
  | { tipo: "listo"; correo: string | null }
  | { tipo: "ya"; correo: string | null; enviadoAt: string | null; asunto: string | null }
  | { tipo: "despublicado" }
  | { tipo: "error" };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * El estado que deja la respuesta: 200 = listo (con el correo al que salió, si vino), o «ya» si el aviso había salido
 * antes (`ya: true`, con la fecha y el asunto de ese envío); 410 = el aviso ya no está publicado; cualquier otra cosa
 * —el correo no salió (502), no se pudo chequear la ficha (503), un error, sin red (`null`)— es un error que se puede
 * reintentar.
 */
export function estadoTrasRespuesta(r: { status: number; cuerpo: unknown } | null): EstadoQuieroVerlo {
  if (!r) return { tipo: "error" };
  if (r.status === 410) return { tipo: "despublicado" };
  if (r.status < 200 || r.status >= 300) return { tipo: "error" };
  const c = (r.cuerpo ?? {}) as { correo?: unknown; ya?: unknown; enviadoAt?: unknown; asunto?: unknown };
  const correo = typeof c.correo === "string" && CORREO.test(c.correo) ? c.correo : null;
  if (c.ya === true) {
    return {
      tipo: "ya",
      correo,
      enviadoAt: typeof c.enviadoAt === "string" ? c.enviadoAt : null,
      asunto: typeof c.asunto === "string" && c.asunto.trim() ? c.asunto : null,
    };
  }
  return { tipo: "listo", correo };
}

/** ¿El botón hace algo? Antes de mandar y después de un error (Reintentar); no mientras manda ni después. */
export function sePuedeTocar(e: EstadoQuieroVerlo): boolean {
  return e.tipo === "quieto" || e.tipo === "error";
}

const ZONA = "America/Santiago";
const DIA = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
const DIA_MES = new Intl.DateTimeFormat("es-CL", { timeZone: ZONA, day: "numeric", month: "long" });

/** Cuándo salió el aviso, en la hora de Chile: «hoy», «ayer» o «el 17 de octubre». null sin una fecha válida. */
export function cuandoSeEnvio(iso: string | null, ahora: Date = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dia = DIA.format(d);
  if (dia === DIA.format(ahora)) return "hoy";
  if (dia === DIA.format(new Date(ahora.getTime() - 24 * 3600 * 1000))) return "ayer";
  return `el ${DIA_MES.format(d)}`;
}

/** «Este depto conviene con tus números» solo con COMPRAR: el banner no afirma lo que el informe no dice. */
export function dicesQueConviene(veredicto: string | null | undefined): boolean {
  return veredicto === "COMPRAR";
}
