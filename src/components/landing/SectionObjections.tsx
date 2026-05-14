/**
 * Sección 06 · Objeciones — fondo Ink 900 (dark editorial).
 * 4 bloques alternados con numeral fantasma 320px Signal Red 0.06.
 */
export default function SectionObjections() {
  return (
    <section className="bg-[#0F0F0F] text-[#FAFAF8]">
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-14 md:pb-[72px] md:pt-[72px]">
        {/* Header */}
        <div className="max-w-[820px]">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#FAFAF8]/55">
            06 · Lo que vas a pensar
          </span>
          <h2 className="mt-4 font-heading text-[32px] font-bold leading-[1.1] tracking-[-0.01em] text-[#FAFAF8] md:text-[40px]">
            Cuatro razones para confiar antes de hacer click.
          </h2>
        </div>

        {/* Bloques */}
        <div className="mt-10">
          <ObjectionBlock
            n="01"
            ghostSide="right"
            label="01 · Datos"
            quote="¿De dónde sacan los números?"
            title="Del mercado real, no de promedios."
            body="Cruzamos tu caso con propiedades en venta, arriendo largo, datos de Airbnb (ADR y ocupación por zona), estaciones de metro, clínicas, universidades y comercio. 24 comunas del Gran Santiago, actualizado semanal."
            visualSide="right"
            visual={<DataCardsGrid />}
          />
          <ObjectionBlock
            n="02"
            ghostSide="left"
            label="02 · Facilidad"
            quote="No tengo todos los datos a mano."
            title="Pon precio y comuna. Franco completa el resto."
            body="Si no sabes el arriendo esperado, los gastos comunes o las contribuciones, Franco usa la mediana real de la zona. Tú confirmas o ajustas si tienes el dato. 5 minutos, veredicto en 30 segundos."
            visualSide="left"
            visual={<SmartFormMock />}
          />
          <ObjectionBlock
            n="03"
            ghostSide="right"
            label="03 · Costo"
            quote="¿Cuánto cuesta?"
            title="Lo que cuestan dos cafés."
            body="Y el primero es gratis, sin tarjeta. Antes de firmar 25 años de hipoteca, el costo se paga solo. Ahorrarte un error de compra equivale a miles de análisis."
            visualSide="right"
            visual={<CostHero />}
          />
          <ObjectionBlock
            n="04"
            ghostSide="left"
            label="04 · IA"
            quote="Y si no conviene, ¿qué hago?"
            title="Franco interpreta con IA, no solo calcula."
            body="No es una calculadora — es un asesor. La IA identifica el problema real y propone alternativas concretas: hasta dónde negociar, cómo reestructurar el financiamiento, qué modalidad de arriendo optimiza el flujo, qué riesgos vigilar."
            visualSide="left"
            visual={<AIRecommendations />}
            isLast
          />
        </div>
      </div>
    </section>
  );
}

function ObjectionBlock({
  n,
  ghostSide,
  label,
  quote,
  title,
  body,
  visualSide,
  visual,
  isLast = false,
}: {
  n: string;
  ghostSide: "left" | "right";
  label: string;
  quote: string;
  title: string;
  body: string;
  visualSide: "left" | "right";
  visual: React.ReactNode;
  isLast?: boolean;
}) {
  const copyBlock = (
    <div className="max-w-[520px]">
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#FAFAF8]/55">
        {label}
      </span>
      <p className="mt-3 font-body text-[16px] italic leading-[1.4] text-[#FAFAF8]/55">
        &ldquo;{quote}&rdquo;
      </p>
      <h3 className="mt-4 font-heading text-[24px] font-bold leading-[1.2] tracking-[-0.005em] text-[#FAFAF8] md:text-[28px]">
        {title}
      </h3>
      <p className="mt-4 font-body text-[15px] leading-[1.65] text-[#FAFAF8]/70">
        {body}
      </p>
    </div>
  );

  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderTop: "0.5px solid rgba(250,250,248,0.10)",
        borderBottom: isLast ? "0.5px solid rgba(250,250,248,0.10)" : undefined,
      }}
    >
      {/* Numeral fantasma */}
      <span
        className="pointer-events-none absolute select-none font-heading font-bold leading-none tracking-[-0.04em]"
        style={{
          color: "rgba(200,50,60,0.06)",
          fontSize: "clamp(180px, 26vw, 320px)",
          top: "50%",
          [ghostSide]: "-2vw",
          transform: "translateY(-50%)",
        }}
        aria-hidden="true"
      >
        {n}
      </span>

      <div className="relative grid grid-cols-1 items-center gap-10 px-2 py-12 md:min-h-[80vh] md:grid-cols-2 md:gap-14 md:py-14">
        {visualSide === "left" ? (
          <>
            <div className="order-2 md:order-1">{visual}</div>
            <div className="order-1 md:order-2">{copyBlock}</div>
          </>
        ) : (
          <>
            <div>{copyBlock}</div>
            <div>{visual}</div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────── Bloque 01 · DATOS — 2x2 grid mini cards ───────────── */

function DataCardsGrid() {
  const items: Array<{ label: string; big: string; sub: string }> = [
    { label: "Venta", big: "12.944", sub: "deptos comparables" },
    { label: "Arriendo largo", big: "6.506", sub: "arriendos vivos" },
    { label: "Airbnb", big: "ADR + Occ", sub: "por zona y banda" },
    { label: "Atractores", big: "195+", sub: "metros · POIs · clínicas" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-md border border-[rgba(250,250,248,0.08)] bg-[rgba(250,250,248,0.03)] px-4 py-5"
        >
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[#FAFAF8]/55">
            {it.label}
          </p>
          <p className="mt-2 font-mono text-[20px] font-semibold text-[#FAFAF8]">
            {it.big}
          </p>
          <p className="mt-1 font-body text-[12px] leading-[1.4] text-[#FAFAF8]/55">
            {it.sub}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ───────────── Bloque 02 · FACILIDAD — Form mock ───────────── */

function SmartFormMock() {
  type Row = { label: string; value: string; tag: "tú" | "Franco" };
  const rows: Row[] = [
    { label: "Precio", value: "UF 5.500", tag: "tú" },
    { label: "Comuna", value: "Providencia", tag: "tú" },
    { label: "Arriendo esperado", value: "$950.000", tag: "Franco" },
    { label: "Gastos comunes", value: "$110.000", tag: "Franco" },
    { label: "Contribuciones", value: "$80.000", tag: "Franco" },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-[rgba(250,250,248,0.10)] bg-[#1A1A1A] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.4)]">
      <div className="border-b border-[rgba(250,250,248,0.08)] bg-[#0F0F0F] px-5 py-3">
        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[#FAFAF8]/55">
          Nuevo análisis · paso 1 de 3
        </p>
      </div>
      <div className="p-5">
        <ul className="space-y-3">
          {rows.map((r) => {
            const isFranco = r.tag === "Franco";
            return (
              <li
                key={r.label}
                className="flex items-center gap-3 rounded-md border px-4 py-3"
                style={{
                  borderColor: isFranco ? "rgba(200,50,60,0.25)" : "rgba(250,250,248,0.08)",
                  background: isFranco ? "rgba(200,50,60,0.06)" : "rgba(250,250,248,0.02)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[#FAFAF8]/55">
                    {r.label}
                  </p>
                  <p className="mt-1 font-mono text-[14px] font-semibold text-[#FAFAF8]">
                    {r.value}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-sm px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.1em]"
                  style={{
                    background: isFranco ? "#C8323C" : "rgba(250,250,248,0.10)",
                    color: isFranco ? "#FFFFFF" : "rgba(250,250,248,0.65)",
                  }}
                >
                  {r.tag}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ───────────── Bloque 03 · COSTO — $0 hero ───────────── */

function CostHero() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(250,250,248,0.08)] bg-[rgba(250,250,248,0.02)] px-6 py-12">
      <p
        className="font-heading font-bold leading-none tracking-[-0.04em] text-[#C8323C]"
        style={{ fontSize: "clamp(80px, 14vw, 128px)" }}
      >
        $0
      </p>
      <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FAFAF8]">
        Primer análisis
      </p>
      <p className="mt-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#FAFAF8]/55">
        Sin tarjeta · sin compromiso
      </p>
    </div>
  );
}

/* ───────────── Bloque 04 · IA — 4 recomendaciones ───────────── */

function AIRecommendations() {
  const items = [
    { verb: "Negocia", body: "Hasta UF 4.900. Argumento: el precio/m² está 11% sobre la mediana de zona." },
    { verb: "Reestructura", body: "Sube pie a 30% o extiende plazo a 30 años. Los números empiezan a cuadrar." },
    { verb: "Opera", body: "En Airbnb. Rinde $148K/mes más que arriendo tradicional en esta zona." },
    { verb: "Vigila", body: "3 riesgos detectados: vacancia mayor a la zona, gasto común alto, tope de aporte." },
  ];
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div
          key={it.verb}
          className="rounded-r-md py-3 pl-4 pr-4"
          style={{
            borderLeft: "2px solid #C8323C",
            background: "rgba(250,250,248,0.03)",
          }}
        >
          <p className="font-body text-[14px] leading-[1.55] text-[#FAFAF8]/85">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C8323C]">
              {it.verb}
            </span>
            <span className="ml-2 font-body italic">{it.body}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
