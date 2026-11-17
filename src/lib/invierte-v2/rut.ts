// ─────────────────────────────────────────────────────────────────────────────
// EL RUT CHILENO (etapa 1 de Invierte con Franco, 18-nov-2026): módulo 11. En la base va sin puntos y con guion
// («16482317-5»); en la orden, con puntos y guion («16.482.317-5»). Puro: navegador, ruta y tier.
// ─────────────────────────────────────────────────────────────────────────────

/** El dígito verificador de un cuerpo de RUT (solo dígitos). */
export function dvRut(cuerpo: string): string {
  let suma = 0;
  let m = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const r = 11 - (suma % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}

/** El RUT válido en la forma de la base («16482317-5»), o null. Acepta puntos, guion, espacios y k minúscula. */
export function normalizarRut(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const limpio = x.replace(/[.\s-]/g, "").toUpperCase();
  const m = /^(\d{7,8})([\dK])$/.exec(limpio);
  if (!m) return null;
  const cuerpo = m[1].replace(/^0+/, "");
  if (cuerpo.length < 7) return null;
  return dvRut(cuerpo) === m[2] ? `${cuerpo}-${m[2]}` : null;
}

/** «16482317-5» → «16.482.317-5». Si no es un RUT válido, lo devuelve tal cual. */
export function formatearRut(rut: string): string {
  const n = normalizarRut(rut);
  if (!n) return rut;
  const [cuerpo, dv] = n.split("-");
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}
