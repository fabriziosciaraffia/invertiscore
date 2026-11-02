// ─────────────────────────────────────────────────────────────────────────────
// UN NEGOCIADO COMPARTIDO, CON LOS DATOS DE HOY (03-nov-2026, goal «el negociado se comparte con su verdad completa»). Cuando
// se abre el enlace de un depto de la capa «Si negocias», el precio negociado que guardó la noche se verifica igual que antes
// de cobrar «Analizar a UF 2.950» (avisos/negociar.ts › verificarNegociado, la ruta POST /api/lo-que-sigue/guia/analizar): el
// informe a ese precio, con los comparables y la mediana de hoy, tiene que dar Comprar; si no, el descuento mínimo de hoy
// hasta el tope; si ni el tope llega, no llega. Con el financiamiento del enlace —pie 20 %, 30 años, la tasa del motor—, el
// origen sintético de Explorar y SIN leer la ficha del aviso (la regla de TocToc en CLAUDE.md: la antigüedad sale de lo
// guardado o se suponen los años de siempre). No cobra ni escribe nada. La llama compartir-servidor.ts, en caché.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAnalysis, sondaConPatch } from "@/lib/analysis";
import { METHODOLOGY_VERSION_ACTUAL } from "@/lib/modelo-costos";
import { getUFValue } from "@/lib/uf";
import { readVeredicto } from "@/lib/results-helpers";
import { redondearPiePct } from "@/lib/analysis/pie-input-data";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";
import { leerConfigGuia, origenSintetico } from "@/lib/guia/guia-servidor";
import { antiguedadDelAviso, cuerpoDelAviso, leerAvisoGuia } from "@/lib/guia/analizar-servidor";
import { verificarNegociado, type VerificacionNegociado } from "@/lib/avisos/negociar";
import { PIE_POR_DEFECTO, PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";

/** Cómo se verifica un negociado (se inyecta para probar la ficha sin motor ni comparables). */
export type VerificarNegociado = (avisoId: string, negociadoUF: number, tope: number) => Promise<VerificacionNegociado>;

/** SIN VERIFICAR: lo que guardó la noche. Para el TEXTO de quien comparte (GET /api/explorar/compartido): con cuenta ya sale
 *  del pin, que trae el de la noche, y la verificación lee comparables —haría esperar a la hoja del sistema, que se abre en
 *  el mismo toque o no se abre—. La verificación de hoy es de quien abre el enlace y de la vista previa. */
export const segunLaNoche: VerificarNegociado = async () => ({ estado: "sigue" });

/** La verificación de hoy, con el cliente de service role de quien la llama (lee `config`, los avisos y los comparables). */
export function verificarNegociadoDeHoy(admin: SupabaseClient): VerificarNegociado {
  return async (avisoId, negociadoUF, tope) => verificarConDatosDeHoy(admin, avisoId, negociadoUF, tope);
}

async function verificarConDatosDeHoy(admin: SupabaseClient, avisoId: string, negociadoUF: number, tope: number): Promise<VerificacionNegociado> {
  const [cfg, ufValue] = await Promise.all([leerConfigGuia(admin), getUFValue()]);
  const combinacion = { piePct: PIE_POR_DEFECTO, plazoAnios: PLAZO_POR_DEFECTO };
  const origen = origenSintetico("", { ...combinacion, comunas: [], dormitorios: [] }, cfg);
  const aviso = await leerAvisoGuia(admin, avisoId, origen);
  if (!aviso) return { estado: "no-llega" };
  // Sin lectura de la ficha (la edad, la guardada o la del edificio; sin ellas, los años supuestos).
  const antiguedad = await antiguedadDelAviso(admin, aviso, { leida: false, anio: null });
  const cuerpo = async (precioUF: number) => {
    const c = await cuerpoDelAviso({ ...aviso, precioUF }, origen, combinacion, antiguedad, { uf: ufValue, tasa: cfg.tasa });
    if (!c) return null;
    if (Number.isFinite(c.piePct)) c.piePct = redondearPiePct(c.piePct);
    c.methodologyVersion = METHODOLOGY_VERSION_ACTUAL;
    return c;
  };
  const body = await cuerpo(negociadoUF);
  if (!body) return { estado: "no-llega" };
  const mediana = await prefetchMedianaComunaVenta(admin, body, ufValue);
  const asOf = new Date();
  const informeEn = async (precioUF: number) => {
    const c = precioUF === negociadoUF ? body : await cuerpo(precioUF);
    if (!c) return { veredicto: null, score: null, flujo: null };
    const r = runAnalysis(c, ufValue, mediana);
    return { veredicto: readVeredicto(r) ?? null, score: r.score ?? null, flujo: r.metrics?.flujoNetoMensual ?? null };
  };
  return verificarNegociado({ publicadoUF: aviso.precioUF, negociadoUF, tope, comprarEn: (precioUF) => sondaConPatch(body, ufValue, mediana, asOf, { precio: precioUF }).veredicto === "COMPRAR", informeEn });
}
