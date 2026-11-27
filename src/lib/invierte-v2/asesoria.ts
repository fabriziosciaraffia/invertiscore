// ─────────────────────────────────────────────────────────────────────────────
// INVIERTE RECIBE LOS DEPTOS DE LA ASESORÍA (tercera vuelta, decisión de Fabrizio del 27-nov-2026). Quien toca «Seguir con estos
// deptos» llega al contacto con `desde=explorar&mas=<los otros>`: el contacto dice «Invierte en tus 3 deptos con Franco», muestra los
// tres en una fila chica y NO pregunta «¿Cuándo piensas comprar?» ni el pie —ya se sabe lo suficiente—, solo el WhatsApp y el permiso.
//   · Los ids valen solo si son de los `elegidos` de SU perfil de la asesoría (nadie arma una lista ajena por la dirección).
//   · La urgencia NO se inventa (cuarta vuelta, 27-nov-2026): queda vacía, sin respuesta (migración 20261127_inv_personas_urgencia_vacia).
//     El pie, de su tope por pie: le alcanza el depto de entrada → sí; si no, lo que dijo (la asesoría guarda «una parte» con menos de
//     UF 300).
// Puro. Tier ASESORIA.
// ─────────────────────────────────────────────────────────────────────────────
import type { PieInvierte } from "@/lib/invierte/invierte";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Los ids del contacto, en el orden del botón (el de la dirección primero), o null si no es la asesoría o hay uno ajeno. */
export function idsDeLaAsesoria(avisoId: string, mas: string | string[] | null | undefined, elegidos: readonly string[]): string[] | null {
  const m = Array.isArray(mas) ? mas[0] : mas;
  if (!m) return null;
  const otros = m.split(",").map((x) => x.trim()).filter(Boolean);
  if (!otros.length || otros.some((x) => !UUID.test(x))) return null;
  const ids = Array.from(new Set([avisoId, ...otros]));
  if (ids.length > 3 || ids.some((x) => !elegidos.includes(x))) return null;
  return ids;
}

export function contactoDeAsesoria(p: { preaprobado: "tengo" | "tramite" | "no"; topePieUF: number | null; pieTiene: PieInvierte | null }, precioEntradaUF: number | null): { pie: PieInvierte } {
  void p.preaprobado;
  const pie: PieInvierte = p.topePieUF != null && precioEntradaUF != null && precioEntradaUF <= p.topePieUF ? "si" : p.pieTiene === "no" ? "no" : "parte";
  return { pie };
}

export interface DeptoAsesoria { avisoId: string; lugar: string; precioUF: number; flujoCLP: number | null }

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
/** «Av. Pajaritos · UF 2.123 · Te deja $314.167 al mes» (con el flujo al plazo de la persona, el mismo de su perfil). */
export function lineaDeptoAsesoria(d: Pick<DeptoAsesoria, "lugar" | "precioUF" | "flujoCLP">): string {
  const flujo = d.flujoCLP == null ? "" : d.flujoCLP >= 0 ? ` · Te deja $${miles(d.flujoCLP)} al mes` : ` · Pones $${miles(-d.flujoCLP)} al mes`;
  return `${d.lugar} · UF ${miles(d.precioUF)}${flujo}`;
}
