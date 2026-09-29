// ─────────────────────────────────────────────────────────────────────────────
// El código de entrada (29-sep-2026): Supabase lo manda con el largo que diga su panel
// («Email OTP Length»). Hoy son 6 dígitos y el copy dice 6, pero el formulario acepta de 6 a 8: si el
// panel cambia (pasó: estuvo en 8 y nadie podía escribir el código), el registro no se rompe.
// Puro: lo prueba el tier LO-QUE-SIGUE.
// ─────────────────────────────────────────────────────────────────────────────

export const CODIGO_MIN = 6;
export const CODIGO_MAX = 8;

/** Lo que queda en el campo al escribir o pegar: solo dígitos, hasta el máximo. */
export function limpiarCodigo(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, CODIGO_MAX);
}

/** ¿Se puede mandar a verificar? De 6 a 8 dígitos. */
export function codigoValido(codigo: string): boolean {
  return /^\d+$/.test(codigo) && codigo.length >= CODIGO_MIN && codigo.length <= CODIGO_MAX;
}
