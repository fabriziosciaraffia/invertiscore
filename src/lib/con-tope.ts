/** Espera `trabajo` como mucho `ms`: si no termina, sigue sin él (`listo: false`). El trabajo no se cancela —una
 *  promesa no se puede cortar—, pero quien espera ya no depende de él. Es el techo de los crons que trabajan con
 *  presupuesto (el prechequeo semanal desde el 12-oct-2026 y el pase de unidades desde el 13-oct-2026). */
export async function conTope<T>(trabajo: Promise<T>, ms: number): Promise<{ listo: true; valor: T } | { listo: false }> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<{ listo: false }>((res) => {
    reloj = setTimeout(() => res({ listo: false }), Math.max(0, ms));
  });
  try {
    return await Promise.race([trabajo.then((valor) => ({ listo: true as const, valor })), tope]);
  } finally {
    clearTimeout(reloj);
  }
}
