"use client";

import type { ZoneInsightData } from "@/hooks/useZoneInsight";

function fmtCLP(v: number): string {
  return "$" + Math.round(v).toLocaleString("es-CL");
}

function fmtUF(v: number, valorUF: number): string {
  const uf = valorUF > 0 ? v / valorUF : 0;
  if (uf >= 100) return "UF " + Math.round(uf).toLocaleString("es-CL");
  return "UF " + (Math.round(uf * 10) / 10).toFixed(1).replace(".", ",");
}

function fmtMoney(v: number, currency: "CLP" | "UF", valorUF: number): string {
  return currency === "CLP" ? fmtCLP(v) : fmtUF(v, valorUF);
}

function getPrecisionDisclaimer(precision: string): string {
  switch (precision) {
    case "superficie_amplia":
      return "Oferta comparable usando superficies en ±20%.";
    case "dormitorios_flexibles":
      return "Oferta comparable flexibilizando dormitorios (±1) y superficie (±20%).";
    case "comuna_general":
      return "Oferta comparable a nivel comuna (criterios amplios por baja densidad de datos).";
    default:
      return "";
  }
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "warning";
}

function StatCard({ label, value, sub, tone = "default" }: StatCardProps) {
  const valueColor =
    tone === "positive" ? "#B0BEC5" : tone === "warning" ? "#FBBF24" : "var(--franco-text)";
  return (
    <div
      className="rounded-xl"
      style={{
        background: "var(--franco-bar-track)",
        border: "1px solid var(--franco-border)",
        padding: "14px 18px",
      }}
    >
      <p
        className="font-mono text-[9px] uppercase tracking-[1.5px] m-0 mb-1.5"
        style={{ color: "var(--franco-text-secondary)" }}
      >
        {label}
      </p>
      <p
        className="font-mono text-[20px] md:text-[22px] font-bold m-0 leading-none"
        style={{ color: valueColor }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="font-body text-[10px] md:text-[11px] leading-[1.4] m-0 mt-1.5"
          style={{ color: "var(--franco-text-secondary)" }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

interface ZoneStatsCardsProps {
  stats: ZoneInsightData["stats"];
  currency: "CLP" | "UF";
  comuna: string;
  arriendoUsuarioCLP: number;
  valorUF: number;
}

export function ZoneStatsCards({
  stats,
  currency,
  comuna,
  arriendoUsuarioCLP,
  valorUF,
}: ZoneStatsCardsProps) {
  const plus = stats.plusvaliaHistorica;
  const plusTone = plus.valor >= plus.promedioSantiago ? "positive" : "default";
  const plusSub =
    plus.valor >= plus.promedioSantiago
      ? `Sobre promedio Santiago (${plus.promedioSantiago}%). ${plus.anualizada}%/año.`
      : `Bajo promedio Santiago (${plus.promedioSantiago}%). ${plus.anualizada}%/año.`;

  const precioM2 = stats.precioM2;
  // precioM2 viene en UF; convertir a CLP si el toggle lo pide.
  const fmtM2 = (uf: number): string => {
    if (currency === "UF") return `UF ${uf.toFixed(1).replace(".", ",")}/m²`;
    const clp = uf * (valorUF || 0);
    return `$${Math.round(clp).toLocaleString("es-CL")}/m²`;
  };
  const medianaFmt = precioM2 ? fmtM2(precioM2.medianaComuna) : "";
  const precioSub = precioM2
    ? `Mediana ${comuna}: ${medianaFmt}. ${
        precioM2.diffPct < 0
          ? `${Math.abs(precioM2.diffPct).toFixed(1).replace(".", ",")}% bajo mediana.`
          : `${precioM2.diffPct.toFixed(1).replace(".", ",")}% sobre mediana.`
      }`
    : undefined;

  const oferta = stats.ofertaComparable;
  let percentilTone: "default" | "positive" | "warning" = "default";
  let percentilSub = "";
  if (oferta) {
    const rangoMin = fmtMoney(oferta.rangoArriendoMin, currency, valorUF);
    const rangoMax = fmtMoney(oferta.rangoArriendoMax, currency, valorUF);
    if (oferta.percentilTuDepto === 0) {
      percentilTone = "warning";
      percentilSub = `Tu arriendo ${fmtMoney(arriendoUsuarioCLP, currency, valorUF)} está bajo el rango típico ${rangoMin}–${rangoMax}. Podrías estar subvalorando.`;
    } else if (oferta.percentilTuDepto >= 80) {
      percentilTone = "warning";
      percentilSub = `Tu arriendo está en el tope del rango ${rangoMin}–${rangoMax}. Verifica que sea realista.`;
    } else {
      percentilSub = `Percentil ${oferta.percentilTuDepto} dentro del rango ${rangoMin}–${rangoMax}.`;
    }
  }

  const disclaimer = oferta && oferta.precision !== "exacta" ? getPrecisionDisclaimer(oferta.precision) : "";

  return (
    <section>
      <p
        className="font-mono text-[9px] uppercase tracking-[2px] m-0 mb-3"
        style={{ color: "var(--franco-text-secondary)" }}
      >
        Contexto de {comuna}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
        <StatCard
          label="Plusvalía 10 años"
          value={`+${plus.valor}%`}
          sub={plusSub}
          tone={plusTone}
        />

        {precioM2 ? (
          <StatCard
            label="Precio m²"
            value={fmtM2(precioM2.tuDepto)}
            sub={precioSub}
          />
        ) : (
          <StatCard label="Precio m²" value="—" sub="Sin datos de mercado suficientes" />
        )}

        {oferta ? (
          <StatCard
            label="Oferta comparable"
            value={String(oferta.totalDeptos)}
            sub={`Deptos en arriendo activo en ${comuna}${oferta.precision !== "exacta" ? " · criterios amplios" : ""}`}
          />
        ) : (
          <StatCard
            label="Oferta comparable"
            value="—"
            sub="No hay suficientes publicaciones para estimar."
          />
        )}

        {oferta ? (
          <StatCard
            label="Arriendo estimado"
            value={`P${oferta.percentilTuDepto}`}
            sub={percentilSub}
            tone={percentilTone}
          />
        ) : (
          <StatCard label="Arriendo estimado" value="—" sub="Sin rango comparable disponible." />
        )}
      </div>

      {disclaimer && (
        <p
          className="font-body text-[10px] mt-3 m-0 italic"
          style={{ color: "var(--franco-text-secondary)" }}
        >
          {disclaimer}
        </p>
      )}
    </section>
  );
}
