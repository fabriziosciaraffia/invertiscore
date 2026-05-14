/**
 * Sección 03 · Qué hace Franco — header ink-200 → Paso 01 ink-200
 * → Paso 02 ink-100 → Paso 03 ink-900 (remate dark).
 * Numerales gigantes 144px (rojo en paso 03).
 */
export default function SectionWhatFrancoDoes() {
  return (
    <section id="que-hace-franco" className="contents">
      {/* Header — ink-200 */}
      <div className="bg-[#E8E6E1]">
        <div className="mx-auto max-w-[1280px] px-6 pb-12 pt-24 md:pb-16 md:pt-32">
          <div className="max-w-[820px]">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#0F0F0F]/55">
              03 · Qué hace Franco
            </span>
            <h2 className="mt-5 font-heading text-[36px] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F0F0F] md:text-[52px]">
              Le hacemos a tu depto las preguntas que tu cotización no responde.
            </h2>
            <p className="mt-5 max-w-[680px] font-body text-[16px] leading-[1.55] text-[#0F0F0F]/72 md:text-[17px]">
              Tres pasos, 30 segundos, una posición clara. Así trabaja Franco con
              el caso del depto en Providencia.
            </p>
          </div>
        </div>
      </div>

      {/* Paso 01 — ink-200 */}
      <Step
        bg="#E8E6E1"
        numeralColor="rgba(15,15,15,0.92)"
        textColor="#0F0F0F"
        secondaryColor="rgba(15,15,15,0.72)"
        labelColor="rgba(15,15,15,0.55)"
        numeral="01"
        title="Cruza tu caso con el mercado."
        body="12.944 propiedades comparables, 195 estaciones de metro, POIs georreferenciados. Tu depto no se evalúa aislado, se ubica en el mapa real del mercado."
        visual={<ZoneDrawerFrame />}
      />

      {/* Paso 02 — ink-100 */}
      <Step
        bg="#FAFAF8"
        numeralColor="rgba(15,15,15,0.92)"
        textColor="#0F0F0F"
        secondaryColor="rgba(15,15,15,0.72)"
        labelColor="rgba(15,15,15,0.55)"
        numeral="02"
        title="Saca todas las cuentas."
        body="Flujo real mes a mes, contemplando gastos que nadie suma. Proyección patrimonial a 10 años con aporte real, valor del depto y patrimonio neto."
        visual={
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <CostoDrawerFrame />
            <PatrimonioDrawerFrame />
          </div>
        }
      />

      {/* Paso 03 — ink-900 (remate dark) */}
      <Step
        bg="#0F0F0F"
        numeralColor="#C8323C"
        textColor="#FAFAF8"
        secondaryColor="rgba(250,250,248,0.72)"
        labelColor="rgba(250,250,248,0.55)"
        numeral="03"
        title="Se la juega."
        body="Score, veredicto, precio sugerido, costo real, riesgos. Sin matices que diluyan la decisión."
        visual={<HeroResultFrame />}
        dark
      />
    </section>
  );
}

function Step({
  bg,
  numeralColor,
  textColor,
  secondaryColor,
  labelColor,
  numeral,
  title,
  body,
  visual,
  dark = false,
}: {
  bg: string;
  numeralColor: string;
  textColor: string;
  secondaryColor: string;
  labelColor: string;
  numeral: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div style={{ background: bg }}>
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-6 py-16 md:grid-cols-[180px_1fr] md:gap-10 md:py-24">
        {/* Numeral */}
        <div className="flex md:block">
          <span
            className="font-heading font-bold leading-[0.85] tracking-[-0.04em]"
            style={{ color: numeralColor, fontSize: "clamp(80px, 14vw, 144px)" }}
            aria-hidden="true"
          >
            {numeral}
          </span>
        </div>

        {/* Contenido */}
        <div className="flex flex-col gap-8 md:gap-10">
          <div className="max-w-[680px]">
            <span
              className="font-mono text-[10px] font-medium uppercase tracking-[0.16em]"
              style={{ color: labelColor }}
            >
              Paso {numeral}
            </span>
            <h3
              className="mt-3 font-heading text-[28px] font-bold leading-[1.15] tracking-[-0.01em] md:text-[36px]"
              style={{ color: textColor }}
            >
              {title}
            </h3>
            <p
              className="mt-4 font-body text-[15px] leading-[1.6] md:text-[16px]"
              style={{ color: secondaryColor }}
            >
              {body}
            </p>
          </div>

          <div className={dark ? "[--frame-bg:#1A1A1A] [--frame-border:rgba(250,250,248,0.10)]" : "[--frame-bg:#FFFFFF] [--frame-border:rgba(15,15,15,0.10)]"}>
            {visual}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Browser frame chrome ───────────────────── */

function BrowserFrame({
  url,
  children,
  dark = false,
}: {
  url: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl shadow-[0_20px_40px_-12px_rgba(15,15,15,0.18)]"
      style={{
        background: "var(--frame-bg)",
        border: "0.5px solid var(--frame-border)",
      }}
    >
      {/* Chrome bar */}
      <div
        className="flex items-center gap-3 px-4 py-2.5"
        style={{
          background: dark ? "#0F0F0F" : "#F0F0EC",
          borderBottom: dark ? "0.5px solid rgba(250,250,248,0.08)" : "0.5px solid rgba(15,15,15,0.06)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#C8323C]" />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: dark ? "rgba(250,250,248,0.18)" : "rgba(15,15,15,0.18)" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: dark ? "rgba(250,250,248,0.18)" : "rgba(15,15,15,0.18)" }} />
        </div>
        <div
          className="ml-2 flex-1 truncate rounded-md px-3 py-1 font-mono text-[10px] font-medium tracking-[0.04em]"
          style={{
            background: dark ? "rgba(250,250,248,0.06)" : "rgba(15,15,15,0.04)",
            color: dark ? "rgba(250,250,248,0.6)" : "rgba(15,15,15,0.5)",
          }}
        >
          {url}
        </div>
      </div>

      {children}
    </div>
  );
}

/* ───────────────────── Paso 01 · Zone Drawer ───────────────────── */

function ZoneDrawerFrame() {
  return (
    <BrowserFrame url="refranco.ai/analisis/providencia/zona">
      <div className="grid grid-cols-1 gap-0 md:grid-cols-[1.1fr_1fr]">
        {/* Mapa */}
        <div className="relative h-[280px] overflow-hidden bg-[#F0F0EC] md:h-[360px]">
          {/* Grid pattern */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <pattern id="zonegrid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(15,15,15,0.06)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#zonegrid)" />
            {/* Streets */}
            <line x1="0" y1="120" x2="100%" y2="120" stroke="rgba(15,15,15,0.10)" strokeWidth="2" />
            <line x1="0" y1="220" x2="100%" y2="220" stroke="rgba(15,15,15,0.10)" strokeWidth="2" />
            <line x1="180" y1="0" x2="180" y2="100%" stroke="rgba(15,15,15,0.10)" strokeWidth="2" />
            <line x1="320" y1="0" x2="320" y2="100%" stroke="rgba(15,15,15,0.10)" strokeWidth="2" />
            {/* POIs (gray dots) */}
            <circle cx="90" cy="80" r="4" fill="#5F5E5A" />
            <circle cx="240" cy="60" r="4" fill="#5F5E5A" />
            <circle cx="280" cy="180" r="4" fill="#5F5E5A" />
            <circle cx="80" cy="200" r="4" fill="#5F5E5A" />
            <circle cx="350" cy="100" r="4" fill="#5F5E5A" />
            <circle cx="150" cy="280" r="4" fill="#5F5E5A" />
            <circle cx="380" cy="280" r="4" fill="#5F5E5A" />
            {/* Subject pin */}
            <g transform="translate(200,170)">
              <circle r="14" fill="rgba(200,50,60,0.18)" />
              <circle r="7" fill="#C8323C" />
              <circle r="3" fill="#FFFFFF" />
            </g>
          </svg>
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-[#0F0F0F]/60">
            <span>20 POIs · 1.2 km radio</span>
            <span>Providencia centro</span>
          </div>
        </div>

        {/* Lateral */}
        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[#0F0F0F]/55">
              06 · Zona
            </p>
            <p className="mt-2 font-heading text-[15px] font-bold leading-tight text-[#0F0F0F]">
              ¿Qué tan demandada está esta zona?
            </p>
          </div>

          {/* AI Insight */}
          <div
            className="rounded-r-md py-3 pl-3 pr-3"
            style={{
              borderLeft: "3px solid #FAFAF8",
              background: "rgba(15,15,15,0.04)",
            }}
          >
            <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-[#0F0F0F]/65">
              ★ Insight Franco IA
            </p>
            <p className="mt-1.5 font-body text-[11px] italic leading-[1.5] text-[#0F0F0F]/80">
              Demanda alta sostenida: 3 universidades, metro a 350m, comercio 24/7
              en 4 cuadras.
            </p>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 gap-2.5">
            <Metric label="Cap rate zona" value="5,2%" />
            <Metric label="Vacancia" value="3,8%" />
            <Metric label="ADR Airbnb" value="$58K" />
            <Metric label="Ocupación" value="78%" />
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[rgba(15,15,15,0.04)] px-2.5 py-2">
      <p className="font-mono text-[8px] font-medium uppercase tracking-[0.12em] text-[#0F0F0F]/55">
        {label}
      </p>
      <p className="mt-1 font-mono text-[13px] font-semibold text-[#0F0F0F]">
        {value}
      </p>
    </div>
  );
}

/* ───────────────────── Paso 02 · Costo + Patrimonio ───────────────────── */

function CostoDrawerFrame() {
  const rows: Array<{ label: string; value: string; pct: number; sign: "+" | "−" }> = [
    { label: "Arriendo bruto", value: "$950.000", pct: 100, sign: "+" },
    { label: "GGCC", value: "−$110.000", pct: 12, sign: "−" },
    { label: "Contribuciones", value: "−$80.000", pct: 8, sign: "−" },
    { label: "Vacancia (8%)", value: "−$76.000", pct: 8, sign: "−" },
    { label: "Comisión admin", value: "−$95.000", pct: 10, sign: "−" },
  ];

  return (
    <BrowserFrame url="refranco.ai/.../costo-mensual">
      <div className="p-5">
        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[#0F0F0F]/55">
          02 · Costo mensual
        </p>
        <p className="mt-2 font-heading text-[15px] font-bold leading-tight text-[#0F0F0F]">
          ¿Cuánto sale de tu bolsillo?
        </p>

        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[1fr_70px_70px] items-center gap-2">
              <span className="truncate font-body text-[11px] text-[#0F0F0F]/80">
                {r.label}
              </span>
              <div className="h-1.5 rounded-full bg-[rgba(15,15,15,0.06)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${r.pct}%`,
                    background: r.sign === "+" ? "#B4B2A9" : "#C8323C",
                  }}
                />
              </div>
              <span className="text-right font-mono text-[10px] font-medium text-[#0F0F0F]">
                {r.value}
              </span>
            </div>
          ))}
        </div>

        <div
          className="mt-5 rounded-r-md py-3 pl-3 pr-3"
          style={{
            borderLeft: "3px solid #C8323C",
            background: "rgba(200,50,60,0.06)",
          }}
        >
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#C8323C]">
            Sale de tu bolsillo
          </p>
          <p className="mt-1 font-mono text-[20px] font-bold text-[#C8323C]">
            −$290.677<span className="text-[12px] text-[#C8323C]/70">/mes</span>
          </p>
        </div>
      </div>
    </BrowserFrame>
  );
}

function PatrimonioDrawerFrame() {
  return (
    <BrowserFrame url="refranco.ai/.../patrimonio">
      <div className="p-5">
        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[#0F0F0F]/55">
          09 · Patrimonio
        </p>
        <p className="mt-2 font-heading text-[15px] font-bold leading-tight text-[#0F0F0F]">
          Patrimonio neto a 10 años
        </p>

        {/* Chart */}
        <div className="mt-4">
          <svg viewBox="0 0 320 140" className="h-[140px] w-full" aria-hidden="true">
            {/* Grid */}
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1="20"
                x2="320"
                y1={20 + i * 30}
                y2={20 + i * 30}
                stroke="rgba(15,15,15,0.06)"
                strokeWidth="1"
              />
            ))}
            {/* Bars */}
            {Array.from({ length: 10 }).map((_, i) => {
              const x = 28 + i * 30;
              const aporteH = 10 + i * 4;
              const valorH = 24 + i * 8;
              return (
                <g key={i}>
                  <rect x={x} y={140 - aporteH} width="14" height={aporteH} fill="#C8323C" />
                  <rect
                    x={x}
                    y={140 - aporteH - valorH}
                    width="14"
                    height={valorH}
                    fill="rgba(15,15,15,0.18)"
                  />
                </g>
              );
            })}
            {/* Net line */}
            <polyline
              points="35,118 65,108 95,96 125,82 155,68 185,54 215,42 245,32 275,24 305,18"
              fill="none"
              stroke="#0F0F0F"
              strokeWidth="1.5"
            />
            {Array.from({ length: 10 }).map((_, i) => {
              const x = 35 + i * 30;
              const ys = [118, 108, 96, 82, 68, 54, 42, 32, 24, 18];
              return <circle key={i} cx={x} cy={ys[i]} r="2" fill="#0F0F0F" />;
            })}
          </svg>
        </div>

        {/* Leyenda */}
        <div className="mt-3 flex flex-wrap gap-3 font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-[#0F0F0F]/65">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#C8323C]" /> Aporte
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[rgba(15,15,15,0.18)]" /> Valor depto
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#0F0F0F]" /> Neto
          </span>
        </div>

        <div
          className="mt-4 rounded-r-md py-3 pl-3 pr-3"
          style={{
            borderLeft: "3px solid #5F5E5A",
            background: "rgba(15,15,15,0.04)",
          }}
        >
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#0F0F0F]/65">
            Patrimonio año 10
          </p>
          <p className="mt-1 font-mono text-[18px] font-bold text-[#0F0F0F]">
            $196.792.800
          </p>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ───────────────────── Paso 03 · Hero result ───────────────────── */

function HeroResultFrame() {
  const score = 66;
  return (
    <BrowserFrame url="refranco.ai/analisis/providencia-2d2b" dark>
      <div className="p-6 md:p-7">
        {/* Header propiedad */}
        <div className="flex items-baseline justify-between border-b border-dashed border-[rgba(250,250,248,0.10)] pb-4">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(250,250,248,0.55)]">
            01 · Veredicto
          </span>
          <span className="font-heading text-[14px] font-bold text-[#FAFAF8]">
            Depto 2D2B Providencia
          </span>
        </div>

        {/* Score row */}
        <div className="mt-5 grid grid-cols-1 items-center gap-5 md:grid-cols-[1fr_1fr]">
          <div>
            <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[rgba(250,250,248,0.55)]">
              Franco Score
            </p>
            <p className="mt-2 font-heading text-[56px] font-bold leading-none tracking-[-0.02em] text-[#FAFAF8]">
              {score}
              <span className="font-heading text-[20px] text-[rgba(250,250,248,0.35)]">/100</span>
            </p>
          </div>
          <div className="md:text-right">
            <span className="inline-flex items-center rounded-md border border-[rgba(200,50,60,0.5)] bg-[rgba(200,50,60,0.10)] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#FF5C66]">
              Ajusta supuestos
            </span>
            <div className="mt-3">
              <div className="relative h-1 w-full rounded-full bg-[rgba(250,250,248,0.08)]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${score}%`,
                    background: "linear-gradient(90deg,#C8323C 0%,#888780 60%,#B4B2A9 100%)",
                  }}
                />
                <div
                  className="absolute -top-[3px] h-[10px] w-[10px] -translate-x-1/2 rounded-full border-2 border-[#FAFAF8] bg-[#0F0F0F]"
                  style={{ left: `${score}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Caja Franco */}
        <div
          className="mt-5 rounded-r-md py-4 pl-4 pr-4"
          style={{
            borderLeft: "3px solid #C8323C",
            background: "rgba(200,50,60,0.10)",
          }}
        >
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#FF5C66]">
            Siendo franco
          </p>
          <p className="mt-2 font-body text-[13px] italic leading-[1.55] text-[rgba(250,250,248,0.88)]">
            &ldquo;Buena ubicación, precio incómodo. Negocia hasta UF 4.900 y opera
            en Airbnb.&rdquo;
          </p>
        </div>

        {/* 3 KPI cards */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <KpiDark label="Aporte mes" value="−$290K" red />
          <KpiDark label="Sugerido" value="UF 4.900" />
          <KpiDark label="Δ Airbnb" value="+$148K" />
        </div>
      </div>
    </BrowserFrame>
  );
}

function KpiDark({ label, value, red = false }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="rounded-md border border-[rgba(250,250,248,0.08)] bg-[rgba(250,250,248,0.03)] px-3 py-2.5">
      <p className="font-mono text-[8px] font-medium uppercase tracking-[0.12em] text-[rgba(250,250,248,0.55)]">
        {label}
      </p>
      <p
        className="mt-1 font-mono text-[13px] font-semibold"
        style={{ color: red ? "#FF5C66" : "#FAFAF8" }}
      >
        {value}
      </p>
    </div>
  );
}
