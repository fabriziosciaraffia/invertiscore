// ─────────────────────────────────────────────────────────────────────────────
// LOS CAMBIOS DE LA PUBLICACIÓN EN LOS DEPTOS ELEGIDOS (etapa 2, entrega 2, 18-nov-2026; requisito de Fabrizio). Cada noche se
// compara lo último que la persona sabe de cada depto que eligió (`inv_deptos.vigente`) con lo de hoy, y cada cambio que le
// afecta queda: una línea en el depto en su base, un correo si es relevante (uno por persona al día como mucho) y una tarea
// interna. Sin WhatsApp. Umbrales aprobados por Fabrizio:
//   · PRECIO (en UF): línea desde UMBRAL_LINEA_PCT; correo desde UMBRAL_CORREO_PCT, o si con el precio nuevo deja de alcanzarle
//     (o le alcanza ahora).
//   · DEJÓ DE ESTAR PUBLICADO / VOLVIÓ A PUBLICARSE: línea y correo.
//   · VEREDICTO y LO QUE DEJA AL MES: solo si cambian POR ese cambio de la publicación (precio o vuelta). El veredicto, línea y
//     correo; al mes, línea desde UMBRAL_AL_MES_LINEA y correo si cruza el cero o se mueve UMBRAL_AL_MES_CORREO.
//   · QUIÉN PUBLICA: no se le avisa a la persona; solo crea una tarea interna.
// Puro: lo usan la vigilancia de la noche, la base y el correo (el tier INVIERTE-V2-E2 lo prueba).
// ─────────────────────────────────────────────────────────────────────────────
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";

export const UMBRAL_LINEA_PCT = 0.5;
export const UMBRAL_CORREO_PCT = 2;
export const UMBRAL_AL_MES_LINEA = 10_000;
export const UMBRAL_AL_MES_CORREO = 30_000;

/** Lo último que la persona sabe del depto (se guarda al elegir y se actualiza con cada cambio). */
export interface Vigente {
  precioUF: number | null;
  publicado: boolean;
  veredicto: string | null;
  flujoCLP: number | null;
  alcanza: boolean;
  publicadorId: number | null;
}

export type TipoCambio = "precio_baja" | "precio_sube" | "despublicado" | "republicado" | "veredicto" | "al_mes" | "publicador";

export interface Cambio {
  tipo: TipoCambio;
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
  /** Va en la base (quién publica: no). */
  enBase: boolean;
  /** Va al correo. */
  relevante: boolean;
}

const pct = (a: number, b: number) => (b / a - 1) * 100;

/** Los cambios entre lo que la persona sabe y lo de hoy. `hoy.precioUF`/`veredicto`/`flujoCLP` null = no se sabe (no cambia). */
export function detectarCambios(v: Vigente, hoy: { precioUF: number | null; publicado: boolean | null; veredicto: string | null; flujoCLP: number | null; alcanza: boolean | null; publicadorId: number | null }): Cambio[] {
  const out: Cambio[] = [];
  // La publicación.
  let volvio = false;
  if (hoy.publicado === false && v.publicado) out.push({ tipo: "despublicado", antes: { publicado: true }, despues: { publicado: false }, enBase: true, relevante: true });
  if (hoy.publicado === true && !v.publicado) { volvio = true; out.push({ tipo: "republicado", antes: { publicado: false }, despues: { publicado: true }, enBase: true, relevante: true }); }
  // El precio, en UF.
  let cambioPrecio = false;
  if (hoy.precioUF != null && v.precioUF != null && v.precioUF > 0) {
    const d = pct(v.precioUF, hoy.precioUF);
    if (Math.abs(d) >= UMBRAL_LINEA_PCT) {
      cambioPrecio = true;
      const alcanzaCambia = hoy.alcanza != null && hoy.alcanza !== v.alcanza;
      out.push({
        tipo: d < 0 ? "precio_baja" : "precio_sube",
        antes: { precioUF: v.precioUF, alcanza: v.alcanza },
        despues: { precioUF: hoy.precioUF, alcanza: hoy.alcanza ?? v.alcanza, deltaPct: Math.round(d * 10) / 10 },
        enBase: true,
        relevante: Math.abs(d) >= UMBRAL_CORREO_PCT || alcanzaCambia,
      });
    }
  }
  // El veredicto y lo que deja al mes: solo por ese cambio de la publicación.
  if (cambioPrecio || volvio) {
    if (hoy.veredicto && v.veredicto && hoy.veredicto !== v.veredicto) {
      out.push({ tipo: "veredicto", antes: { veredicto: v.veredicto }, despues: { veredicto: hoy.veredicto }, enBase: true, relevante: true });
    }
    if (hoy.flujoCLP != null && v.flujoCLP != null) {
      const d = hoy.flujoCLP - v.flujoCLP;
      const cruza = (v.flujoCLP > 0) !== (hoy.flujoCLP > 0);
      if (Math.abs(d) >= UMBRAL_AL_MES_LINEA || cruza) {
        out.push({ tipo: "al_mes", antes: { flujoCLP: v.flujoCLP }, despues: { flujoCLP: hoy.flujoCLP }, enBase: true, relevante: cruza || Math.abs(d) >= UMBRAL_AL_MES_CORREO });
      }
    }
  }
  // Quién publica: solo una tarea interna.
  if (hoy.publicadorId != null && v.publicadorId != null && hoy.publicadorId !== v.publicadorId) {
    out.push({ tipo: "publicador", antes: { publicadorId: v.publicadorId }, despues: { publicadorId: hoy.publicadorId }, enBase: false, relevante: false });
  }
  return out;
}

/** Lo que la persona sabe después de estos cambios. */
export function vigenteTras(v: Vigente, hoy: Parameters<typeof detectarCambios>[1]): Vigente {
  return {
    precioUF: hoy.precioUF ?? v.precioUF,
    publicado: hoy.publicado ?? v.publicado,
    veredicto: hoy.veredicto ?? v.veredicto,
    flujoCLP: hoy.flujoCLP ?? v.flujoCLP,
    alcanza: hoy.alcanza ?? v.alcanza,
    publicadorId: hoy.publicadorId ?? v.publicadorId,
  };
}

// ── LOS TEXTOS ───────────────────────────────────────────────────────────────
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** «20 de noviembre» de una fecha «2026-11-20». */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[(m ?? 1) - 1]}`;
}
const uf = (n: number) => Math.round(n).toLocaleString("es-CL");
const clp = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("es-CL")}`;
const num = (o: Record<string, unknown>, k: string) => (typeof o[k] === "number" ? (o[k] as number) : null);

/**
 * El cambio del veredicto con los nombres públicos y lo que significa (decisión de Fabrizio, 18-nov-2026: sin nombres
 * internos). Comprar = conviene al precio publicado; Ajustar = conviene si negocias el precio; Buscar otro = no conviene.
 * Aprobados por Fabrizio el 19-nov-2026, con el nombre de cada veredicto tomado de la misma fuente que el mapa y el informe
 * (`etiquetaVeredicto`, forma «frase»), nunca escrito a mano.
 */
export function textoVeredicto(antes: string, despues: string): string {
  const d = etiquetaVeredicto(despues, "frase");
  if (despues === "COMPRAR") return `Con el precio nuevo, ahora conviene al precio publicado: es ${d}.`;
  if (despues === "AJUSTA SUPUESTOS") return antes === "COMPRAR"
    ? `Con el precio nuevo, ya no conviene al precio publicado: ahora es ${d}, conviene si negocias el precio.`
    : `Con el precio nuevo, ahora conviene si negocias el precio: es ${d}.`;
  return antes === "COMPRAR"
    ? `Con el precio nuevo, ya no conviene: ahora es ${d}.`
    : `Con el precio nuevo, ya no conviene ni negociando: ahora es ${d}.`;
}

/** La línea del depto en la base («Bajó UF 150 el 20 de noviembre»). Null para lo que no va en la base. */
export function lineaCambio(c: { tipo: TipoCambio; antes: Record<string, unknown>; despues: Record<string, unknown> }, fecha: string): string | null {
  const f = fechaCorta(fecha);
  switch (c.tipo) {
    case "precio_baja":
    case "precio_sube": {
      const a = num(c.antes, "precioUF"), b = num(c.despues, "precioUF");
      if (a == null || b == null) return null;
      return `${c.tipo === "precio_baja" ? "Bajó" : "Subió"} UF ${uf(Math.abs(b - a))} el ${f}`;
    }
    case "despublicado": return `Dejó de estar publicado el ${f}`;
    case "republicado": return `Volvió a publicarse el ${f}`;
    case "veredicto": return textoVeredicto(String(c.antes.veredicto ?? ""), String(c.despues.veredicto ?? ""));
    case "al_mes": {
      const b = num(c.despues, "flujoCLP");
      if (b == null) return null;
      return b > 0 ? `Con el precio nuevo, te sobran ${clp(b)} al mes` : `Con el precio nuevo, pones ${clp(b)} al mes`;
    }
    default: return null;
  }
}

// ── EL CORREO (uno por persona al día, con todos sus cambios relevantes) ────
export interface DeptoConCambios {
  avisoId: string;
  comuna: string;
  descripcion: string;   // «2D2B · 58 m²»
  cambios: Array<{ tipo: TipoCambio; antes: Record<string, unknown>; despues: Record<string, unknown>; fecha: string }>;
}

export function asuntoCambios(deptos: readonly DeptoConCambios[]): string {
  if (deptos.length !== 1) return `Cambiaron ${deptos.length} deptos que elegiste`;
  const d = deptos[0];
  const p = d.cambios.find((c) => c.tipo === "precio_baja" || c.tipo === "precio_sube");
  if (p) return `El depto de ${d.comuna} ${(lineaCambio(p, p.fecha) ?? "").replace(/ el .*$/, "").replace(/^B/, "b").replace(/^S/, "s")}`;
  if (d.cambios.some((c) => c.tipo === "despublicado")) return `El depto de ${d.comuna} dejó de estar publicado`;
  if (d.cambios.some((c) => c.tipo === "republicado")) return `El depto de ${d.comuna} volvió a publicarse`;
  return `Cambió el depto de ${d.comuna} que elegiste`;
}

/** Un párrafo por depto: «El depto de Ñuñoa (2D2B · 58 m²) que elegiste bajó UF 150 el 20 de noviembre: ahora está en UF 2.850.
 *  Con ese precio, te sobran $52.000 al mes.» (textos aprobados por Fabrizio, 18-nov-2026). */
export function parrafoDepto(d: DeptoConCambios): string {
  const quien = `El depto de ${d.comuna}${d.descripcion ? ` (${d.descripcion})` : ""} que elegiste`;
  const partes: string[] = [];
  const p = d.cambios.find((c) => c.tipo === "precio_baja" || c.tipo === "precio_sube");
  const fuera = d.cambios.find((c) => c.tipo === "despublicado");
  const vuelta = d.cambios.find((c) => c.tipo === "republicado");
  if (fuera) partes.push(`${quien} dejó de estar publicado el ${fechaCorta(fuera.fecha)}. Lo dejamos marcado en tu base y Franco revisa si se vendió.`);
  else if (vuelta) partes.push(`${quien} volvió a publicarse el ${fechaCorta(vuelta.fecha)}.`);
  if (p) {
    const b = num(p.despues, "precioUF");
    const linea = (lineaCambio(p, p.fecha) ?? "").replace(/^B/, "b").replace(/^S/, "s");
    partes.push(`${fuera || vuelta ? "Además," : quien} ${linea}${b != null ? `: ahora está en UF ${uf(b)}` : ""}.`);
    const alcanzaAntes = p.antes.alcanza, alcanzaHoy = p.despues.alcanza;
    if (alcanzaAntes === true && alcanzaHoy === false) partes.push("Con ese precio, hoy no te alcanza.");
    if (alcanzaAntes === false && alcanzaHoy === true) partes.push("Con ese precio, ahora te alcanza.");
  }
  const m = d.cambios.find((c) => c.tipo === "al_mes");
  if (m) {
    const b = num(m.despues, "flujoCLP");
    if (b != null) partes.push(b > 0 ? `Con ese precio, te sobran ${clp(b)} al mes.` : `Con ese precio, pones ${clp(b)} al mes.`);
  }
  const v = d.cambios.find((c) => c.tipo === "veredicto");
  if (v) partes.push(textoVeredicto(String(v.antes.veredicto ?? ""), String(v.despues.veredicto ?? "")));
  return partes.join(" ");
}

export const BOTON_CAMBIOS = "Ver mi inversión";
