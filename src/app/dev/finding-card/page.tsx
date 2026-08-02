// Página DEV — preview aislado de GenericFindingCard con los 6 hallazgos REALES
// del caso ebb7c788 (Ñuñoa · BUSCAR OTRA, los 6 activos — el mismo caso del
// mockup aprobado). Fixture snapshoteado de un recompute real (runAnalysis con la
// mediana del snapshot); NO consume DB en runtime para no arrastrar auth/RLS.
//
// El nivel se asigna A OJO por rango de decisividad (1 al más decisivo, 2 a los
// dos siguientes, 3 al resto) — el ruteo real nivel↔decisividad es del paso
// siguiente (montaje de la pirámide), NO de este. Esto es solo para VER la card.
//
// NO monta la pirámide, NO toca el grid 2×2 ni los drawers. Ruta temporal de dev.

import type { Hallazgo } from "@/lib/types";
import { GenericFindingCard } from "@/components/analysis/GenericFindingCard";

const UF_FIXED = 39000;

// Fixture: 6 hallazgos reales de ebb7c788, ya ordenados por decisividad calibrada
// + desempate por magnitud (sobreprecio > cap_rate > flujo > estructura > plusvalía
// > capex). Capturado con scripts/of-fc-fixture.ts.
const FIXTURE = {
  caso: "ebb7c788-4a0d-46e7-9633-39822510285d",
  comuna: "Ñuñoa",
  veredicto: "BUSCAR OTRA",
  score: 36,
  hallazgos: [
    {
      id: "sobreprecio", tipo: "precio_vs_comuna",
      valor: { sujetoUfM2: 110, medianaComunaUfM2: 58, desviacionPct: 90, sobreprecioUfM2: 52, banda: 30, n: 540, comuna: "Providencia" },
      direccion: "adverso", decisividad: 1, magnitudContinua: 1,
      procedencia: { base: "mediana de precios de PUBLICACIÓN de venta de la comuna (scraped), no transacción", confianza: "media" },
      fraseCanonica: "Tu precio por m² (UF 110,0) está 90% sobre la mediana de la comuna (UF 58,0). Estás pagando caro el metro para esta comuna.",
    },
    {
      id: "cap_rate", tipo: "rentabilidad_operativa",
      valor: { capRatePct: 1.98, capRefPct: 4, gapPts: -2, banda: 2, fuente: "promedio neto residencial Santiago 3–4,5% (Houm/Assetplan, may-2026)", scope: "nacional", modalidad: "ltr" },
      direccion: "adverso", decisividad: 0.88, magnitudContinua: 0.88,
      procedencia: { base: "CAP rate neto (NOI) sobre tu arriendo y precio declarados, neto de gastos operativos", confianza: "baja" },
      fraseCanonica: "Tu CAP rate es 2,0% — 2,0 pts bajo la referencia de mercado (4,0%). Rinde bajo el promedio; el precio pide ajuste o conviene comparar con opciones más rentables en la zona.",
    },
    {
      id: "flujo_mensual", tipo: "aporte_mensual",
      valor: { flujoNetoMensualCLP: -796447, dividendoMensualCLP: 1073035, ratioSobreDividendo: 0.74, modalidad: "ltr" },
      direccion: "adverso", decisividad: 0.85, magnitudContinua: 0.76,
      procedencia: { base: "aporte mensual neto sobre tus datos declarados, tras dividendo y todos los gastos operativos", confianza: "alta" },
      fraseCanonica: "Tienes que poner $796.447 al mes de tu bolsillo — un aporte fuerte respecto al dividendo. Antes de avanzar, confirma que puedes sostenerlo de forma estable mes a mes: es plata que sale de tu bolsillo todos los meses, no del arriendo.",
    },
    {
      id: "estructura_financiamiento", tipo: "salud_financiamiento",
      valor: { overall: "problematico", driver: "pie", pieLevel: "problematico", piePct: 10, tasaLevel: "aceptable", tasaPct: 4.5, tasaMarketPct: 4.1, spreadBps: 40, modalidad: "ltr" },
      direccion: "adverso", decisividad: 0.08, magnitudContinua: 0.08,
      procedencia: { base: "Estructura de financiamiento (pie + tasa) sobre tus datos declarados. El pie se evalúa contra un umbral fijo (25% óptimo, sólido); la tasa se compara contra un promedio de mercado de referencia (UF 4,1%), no en tiempo real — pull manual, puede estar desactualizado.", confianza: "media" },
      fraseCanonica: "Tu estructura de financiamiento tiene un problema de fondo, principalmente por el pie: 10% está muy bajo el óptimo de 25% y dispara el crédito y la cuota. La tasa (4,5%) está en mejor nivel.",
    },
    {
      id: "plusvalia", tipo: "apreciacion_historica",
      valor: { anualizadaPct: 3.2, refPct: 3, gapPts: 0.2, banda: 2, fuente: "umbral de apreciación real de largo plazo sobre inflación en Chile (~3% anual)", scope: "absoluta", tieneData: true, modalidad: "ltr" },
      direccion: "favorable", decisividad: 0, magnitudContinua: 0,
      procedencia: { base: "apreciación histórica de la comuna 2014-2024 (Arenas & Cayo, Tinsa, Propital), no garantía de apreciación futura", confianza: "media" },
      fraseCanonica: "En la última década los departamentos en Ñuñoa se valorizaron 3,2% anual, en línea con el umbral de apreciación real (3,0%). Plusvalía histórica normal: referencia, no garantía futura.",
    },
    {
      id: "capex_puesta_a_punto", tipo: "capex_habilitacion",
      valor: { montoCLP: 6825000, montoUF: 175, ufM2: 3.5, antiguedadAnios: 12, superficieUtilM2: 50, modalidad: "ltr", origen: "derivado", fraccionInversion: 0.20958083832335328 },
      direccion: "adverso", decisividad: 0, magnitudContinua: 0,
      procedencia: { base: "curva por antigüedad", confianza: "media" },
      fraseCanonica: "Departamento de 12 años: para captar arriendo de mercado, considera unos UF 175 ($6.825.000) de puesta a punto — cerca del 21% de tu inversión inicial. No es flipping: es dejarlo en estándar de arriendo.",
    },
  ] as unknown as Hallazgo[],
};

export default function FindingCardDevPage() {
  const h = FIXTURE.hallazgos;
  // Nivel a ojo por rango: 1 = el más decisivo · 2 = los dos siguientes · 3 = el resto.
  const nivel1 = h[0];
  const nivel2 = h.slice(1, 3);
  const nivel3 = h.slice(3);

  return (
    <div style={{ background: "var(--franco-bg)", minHeight: "100vh", color: "var(--franco-text)" }}>
      <div className="mx-auto max-w-[1120px] px-10 py-12">
        <div
          className="font-mono uppercase inline-block mb-8"
          style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--franco-text-tertiary)", border: "1px dashed var(--franco-border-strong)", borderRadius: 4, padding: "6px 10px" }}
        >
          DEV · GenericFindingCard · caso {FIXTURE.comuna} {FIXTURE.veredicto} (score {FIXTURE.score}) · datos reales
        </div>

        <div className="flex flex-col gap-3.5">
          {/* Nivel 1 — decisivo, ancho completo */}
          <GenericFindingCard hallazgo={nivel1} nivel={1} valorUF={UF_FIXED} />

          {/* Nivel 2 — dos siguientes, en fila */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {nivel2.map((hh) => (
              <GenericFindingCard key={hh.id} hallazgo={hh} nivel={2} valorUF={UF_FIXED} />
            ))}
          </div>

          {/* Nivel 3 — el resto, chips */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {nivel3.map((hh) => (
              <GenericFindingCard key={hh.id} hallazgo={hh} nivel={3} valorUF={UF_FIXED} />
            ))}
          </div>
        </div>

        <p className="font-body mt-8" style={{ fontSize: 11, color: "var(--franco-text-muted)" }}>
          Preview aislado. El nivel se asigna a ojo por rango; el ruteo real nivel↔decisividad y el montaje de la pirámide son el paso siguiente.
        </p>
      </div>
    </div>
  );
}
