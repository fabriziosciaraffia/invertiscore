"use client";

import { StateBox } from "@/components/ui/StateBox";
import { useGuestInsight } from "@/hooks/useGuestInsight";

/**
 * Drawer 06 · Tipo de huésped esperado — paralelo a Drawer 06 Zona LTR
 * (Commit 2c · 2026-05-12).
 *
 * Pregunta que responde: "¿Quién es el huésped más probable de este depto?
 * ¿Cómo amoblar para él?"
 *
 * Estructura interna (paridad Patrón 3 conclusivo del design-system):
 *   1. Narrativa IA top (headline)
 *   2. Card perfil dominante con %share + driver
 *   3. Cards perfiles secundarios (0-2, si pasan umbral)
 *   4. Sección "Cómo amoblar para este perfil" (3 recomendaciones IA)
 *   5. Sección "Estacionalidad esperada" (mes peak/valle por perfil)
 *   6. Tabla POIs relevantes (drivers del scoring)
 *   7. CajaFranco al cierre (obligatoria)
 *
 * Loading state mientras la IA se genera (lazy via useGuestInsight).
 */

export function DrawerTipoHuesped({ analysisId }: { analysisId: string }) {
  const { data, loading, error } = useGuestInsight(analysisId);

  if (loading) {
    return (
      <p className="font-body italic text-[13px] text-[var(--franco-text-secondary)] leading-[1.6] m-0">
        Franco está leyendo la zona desde la perspectiva del huésped…
      </p>
    );
  }

  if (error || !data) {
    return (
      <StateBox variant="left-border" state="attention" label="Insight de huésped no disponible">
        No pudimos generar el análisis del tipo de huésped para esta propiedad. Verifica las coordenadas del depto o regenera el análisis.
      </StateBox>
    );
  }

  const { perfil, insight } = data;

  return (
    <>
      {/* Headline IA */}
      {insight.headline && (
        <p className="font-body text-[14px] text-[var(--franco-text)] leading-[1.65] mb-5 m-0">
          {insight.headline}
        </p>
      )}

      {/* Card perfil dominante */}
      <DrawerSection label="Perfil dominante">
        <PerfilCard
          label={perfil.dominante.label}
          porcentaje={perfil.dominante.porcentaje}
          driver={perfil.dominante.driver}
          descripcionExtendida={insight.perfilDominante.descripcionExtendida}
          implicaciones={insight.perfilDominante.implicaciones}
          highlight
        />
      </DrawerSection>

      {/* Perfiles secundarios */}
      {perfil.secundarios.length > 0 && (
        <DrawerSection label="También llegan, en menor proporción">
          <div className="flex flex-col gap-2.5">
            {perfil.secundarios.map((s) => (
              <PerfilCard
                key={s.perfil}
                label={s.label}
                porcentaje={s.porcentaje}
                driver={s.driver}
              />
            ))}
          </div>
        </DrawerSection>
      )}

      {/* Recomendaciones de habilitación */}
      {insight.recomendacionesHabilitacion.length > 0 && (
        <DrawerSection label="Cómo amoblar para este perfil">
          <ul className="flex flex-col gap-2 m-0 pl-0 list-none">
            {insight.recomendacionesHabilitacion.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-2 font-body text-[13px] text-[var(--franco-text)] leading-[1.55]"
              >
                <span
                  aria-hidden
                  className="font-mono text-[10px] mt-0.5 shrink-0"
                  style={{ color: "var(--franco-text-secondary)" }}
                >
                  ●
                </span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </DrawerSection>
      )}

      {/* Estacionalidad esperada */}
      {insight.estacionalidadEsperada && (
        <DrawerSection label="Estacionalidad esperada">
          <p className="font-body text-[13px] text-[var(--franco-text)] leading-[1.55] m-0">
            {insight.estacionalidadEsperada}
          </p>
        </DrawerSection>
      )}

      {/* POIs relevantes (drivers del scoring del motor) */}
      {perfil.poisRelevantes.length > 0 && (
        <DrawerSection label="Atractores cercanos que mueven la demanda">
          <div className="flex flex-col gap-1">
            {perfil.poisRelevantes.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 border-b-[0.5px] border-[var(--franco-border)]"
              >
                <span className="font-body text-[13px] text-[var(--franco-text)]">
                  <span
                    className="font-mono uppercase mr-2"
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.06em",
                      color: "var(--franco-text-secondary)",
                    }}
                  >
                    {labelCategoria(p.tipo)}
                  </span>
                  {p.nombre}
                </span>
                <span className="font-mono text-[12px] text-[var(--franco-text-secondary)]">
                  {formatDistancia(p.distancia)}
                </span>
              </div>
            ))}
          </div>
        </DrawerSection>
      )}

      {/* Caja Franco — cierre obligatorio */}
      {insight.cajaAccionable && (
        <StateBox
          variant="left-border"
          state="info"
          label="Antes de amoblar, decide:"
          className="mt-5"
        >
          {insight.cajaAccionable}
        </StateBox>
      )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p
        className="font-mono uppercase mb-2"
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          color: "var(--franco-text-secondary)",
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function PerfilCard({
  label,
  porcentaje,
  driver,
  descripcionExtendida,
  implicaciones,
  highlight = false,
}: {
  label: string;
  porcentaje: number;
  driver: string;
  descripcionExtendida?: string;
  implicaciones?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="p-4"
      style={{
        background: highlight
          ? "color-mix(in srgb, var(--franco-text) 5%, transparent)"
          : "color-mix(in srgb, var(--franco-text) 2%, transparent)",
        borderLeft: `3px solid ${highlight ? "var(--franco-text)" : "var(--franco-text-secondary)"}`,
        borderRadius: "0 8px 8px 0",
      }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <p className="font-heading font-bold text-[16px] text-[var(--franco-text)] m-0">
          {label}
        </p>
        <span
          className="font-mono uppercase shrink-0"
          style={{
            fontSize: 11,
            letterSpacing: "0.04em",
            color: highlight ? "var(--franco-text)" : "var(--franco-text-secondary)",
            fontWeight: 600,
          }}
        >
          ~{porcentaje}%
        </span>
      </div>
      <p className="font-mono text-[11px] text-[var(--franco-text-secondary)] m-0 leading-[1.5]">
        {driver}
      </p>
      {descripcionExtendida && (
        <p className="font-body text-[13px] text-[var(--franco-text)] mt-2 m-0 leading-[1.55]">
          {descripcionExtendida}
        </p>
      )}
      {implicaciones && (
        <p
          className="font-body text-[13px] mt-2 m-0 leading-[1.55] font-medium"
          style={{ color: "var(--franco-text)" }}
        >
          {implicaciones}
        </p>
      )}
    </div>
  );
}

function labelCategoria(tipo: string): string {
  switch (tipo) {
    case "metro": return "Metro";
    case "turismo": return "Turismo";
    case "negocios": return "Negocios";
    case "universidad": return "Univ.";
    case "parque": return "Parque";
    case "mall": return "Mall";
    case "clinica": return "Clínica";
    case "tren": return "Tren";
    default: return tipo;
  }
}

function formatDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace(".", ",")} km`;
}
