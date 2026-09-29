// ─────────────────────────────────────────────────────────────────────────────
// El precio al que CIERRA este depto (30-sep-2026), para la primera línea del ticket del pack:
// «Para que este conviniera, tendría que costar UF [precio]» (Buscar otro) y «Este conviene si te
// lo dejan en UF [precio]» (Ajustar). Sale del MOTOR, del hallazgo de distancia al veredicto: la
// palanca PRECIO sola, con el pie y el plazo que la persona declaró, hasta Comprar. Nunca se deriva
// en el render ni se escribe a mano.
//   · Ajustar  → la vía `precio` hacia Comprar (el objetivo en UF); si no cruza dentro del tope,
//                el mínimo fuera de tope del motor.
//   · Buscar   → la vía `precio` hacia Comprar (salto de dos bandas); si no cruza, el mínimo real
//                fuera de tope (`deltaMinimoComprarFueraDeTope`).
//   · Comprar  → no hay precio que pedir: null (el ticket de Comprar no lleva cifra).
// Sin dato del motor devuelve null y el ticket usa la frase sin cifra.
// ─────────────────────────────────────────────────────────────────────────────
import type { HallazgoDistanciaVeredicto, ViaDistancia } from "@/lib/types";

const precioDeVias = (vias: ViaDistancia[] | null | undefined): number | null => {
  const v = vias?.find((x) => x.palanca === "precio");
  return v && v.estado === "cruza" && v.objetivo > 0 ? v.objetivo : null;
};

/** El precio en UF, redondeado a UF enteras, o null si el motor no lo tiene. */
export function precioQueCierraUF(
  veredicto: string | null | undefined,
  distancia: HallazgoDistanciaVeredicto | null | undefined,
  precioUF: number | null | undefined,
): number | null {
  if (!distancia || !(typeof precioUF === "number" && precioUF > 0)) return null;
  const v = distancia.valor;
  let uf: number | null = null;
  if (veredicto === "AJUSTA SUPUESTOS") {
    uf = precioDeVias(v.vias) ?? v.palancas?.find((p) => p.palanca === "precio")?.objetivo ?? null;
    if (uf == null && v.deltaMinimoFueraDeTope?.palanca === "precio") uf = precioUF * (1 + v.deltaMinimoFueraDeTope.deltaPct / 100);
  } else if (veredicto === "BUSCAR OTRA") {
    uf = precioDeVias(v.viasHastaComprar) ?? v.palancasHastaComprar?.find((p) => p.palanca === "precio")?.objetivo ?? null;
    if (uf == null && v.deltaMinimoComprarFueraDeTope?.palanca === "precio") uf = precioUF * (1 + v.deltaMinimoComprarFueraDeTope.deltaPct / 100);
  }
  if (uf == null || !(uf > 0) || uf >= precioUF) return null;
  return Math.round(uf);
}
