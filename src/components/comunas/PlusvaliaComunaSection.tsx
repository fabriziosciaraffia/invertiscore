// ─────────────────────────────────────────────────────────────────────────────
// PlusvaliaComunaSection — bloque de plusvalía de /comunas/[slug] (F1).
//
// ANCLA · mockup comunas enriquecido (assets-export/mockup-comunas-enriquecido.html,
// contrato e1c574c): esta sección usa su patrón de sección (eyebrow mono
// uppercase + h2 serif + nota de procedencia). El goal del enriquecido v1 la
// absorbe tal cual — el mockup dejó el hueco "Plusvalía · pendiente" que este
// bloque llena; el bloqueo que anotaba (par A&C inconsistente en Providencia/
// Ñuñoa) quedó resuelto porque esas comunas se sirven con serie GFK, no A&C.
//
// Data: SOLO el módulo generado plusvalia-estimado.gen.ts (fuente única F0/F1).
// Cero I/O en runtime; la tabla plusvalia_fuentes_raw es forensics y no se lee.
// Cascada de procedencia (enum coberturaPlusvaliaDe):
//   trayectoria_gfk → serie anual 2015-2024 + gráfico + CAGR (GFK, deptos nuevos)
//   nivel_mas_ac    → nivel GFK fresco + trayectoria A&C 2014-2024 (2 puntos)
//   solo_nivel      → nivel GFK + declaración honesta de que no hay serie propia
//   solo_ac/sin_dato→ degradación honesta, sin inventar
// La fuente se declara UNA vez, como línea única al pie del bloque (decisión
// F1 26-ago); el detalle metodológico por fuente se difiere a la página de
// metodología v2 (F2). La procedencia POR COMUNA (fuente + rango) sigue viva
// en el módulo generado aunque la UI no la verbalice — F2 la necesita.
// DOCTRINA del tramo estimado (F2, implementada): el 2025 es cierre de año
// terminado y se dibuja SÓLIDO, sin marca propia (F2.1); el 2026 entraría como
// proyección y ahí sí PUNTEADO. Solo el tramo no transcurrido lleva punteado.
// Server component puro (SVG server-side, patrón PatrimonioChartSVG).
// ─────────────────────────────────────────────────────────────────────────────

import {
  GFK_SERIE,
  GFK_NIVEL,
  PLUSVALIA_ESTIMADO,
  PLUSVALIA_ESTIMADO_2025,
  ANIO_ESTIMADO,
  coberturaPlusvaliaDe,
} from "@/lib/plusvalia-estimado.gen";

const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");

// ── Gráfico de la serie GFK — SVG puro server-side ──────────────────────────
// Misma doctrina que PatrimonioChartSVG: viewBox fijo, escala normalizada,
// clamps, cero librerías. Línea en Ink (dato neutro — la plusvalía no es un
// egreso), dots por año, gridlines sutiles, labels mono.
const VB_W = 640;
const VB_H = 240;
const PAD_L = 46;
const PAD_R = 16;
const PLOT_TOP = 16;
const BASELINE = 200;
const LABEL_Y = 222;
const PLOT_X0 = PAD_L;
const PLOT_X1 = VB_W - PAD_R;
const PLOT_W = PLOT_X1 - PLOT_X0;
const PLOT_H = BASELINE - PLOT_TOP;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function SerieGfkSVG({
  comuna,
  desde,
  valores,
  estimado,
}: {
  comuna: string;
  desde: number;
  valores: number[];
  /**
   * Cierre del año siguiente al último observado (F2). Es un año TERMINADO
   * compuesto de trimestres observados, no una proyección — por eso su tramo y
   * su punto van SÓLIDOS e idénticos al resto de la serie, sin distintivo
   * propio (F2.1): toda la serie es construcción de Franco sobre fuentes
   * públicas, y la línea de fuente al pie ya lo declara para el conjunto.
   * El punteado está reservado para el tramo NO transcurrido (2026 en
   * adelante), que hoy no se dibuja porque no hay data por comuna.
   */
  estimado?: { ufM2: number; bandaMin: number; bandaMax: number } | null;
}) {
  // Guarda path-plano: con <2 puntos o serie degenerada (todos iguales, rango 0)
  // no hay curva que dibujar — se omite el gráfico en vez de renderizar una
  // línea horizontal que aparenta medición.
  if (valores.length < 2) return null;
  // El estimado entra al dominio de la escala (con su banda) para que no se
  // salga del área de plot.
  const todos = estimado ? [...valores, estimado.bandaMin, estimado.bandaMax] : valores;
  const vMin = Math.min(...todos);
  const vMax = Math.max(...todos);
  if (vMax - vMin <= 0) return null;

  // Escala con piso bajo el mínimo (10% del rango) para que la curva no nazca
  // pegada al eje; el eje Y declara sus valores, así que no es un truco de escala.
  const pad = (vMax - vMin) * 0.12;
  const yLo = Math.max(0, vMin - pad);
  const yHi = vMax + pad;
  const span = yHi - yLo || 1;
  const yFor = (v: number) => clamp(BASELINE - ((v - yLo) / span) * PLOT_H, PLOT_TOP, BASELINE);
  // El eje X cuenta un punto más cuando hay estimado (el año de cierre).
  const nPuntos = valores.length + (estimado ? 1 : 0);
  const xFor = (i: number) => PLOT_X0 + (PLOT_W * i) / (nPuntos - 1);

  const pts = valores.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ");
  const grid = [yLo + span * 0.0, yLo + span * 0.5, yLo + span * 1.0];
  // Labels de año: primero, medio y último. Con estimado, el último observado se
  // omite: cae pegado al punto estimado (son años consecutivos) y los dos textos
  // se pisaban. El eje queda 2015 · 2019 · 2025, que es la lectura completa.
  const labelIdx = estimado
    ? [0, Math.floor((valores.length - 1) / 2)]
    : [0, Math.floor((valores.length - 1) / 2), valores.length - 1];
  const iEst = valores.length; // índice del punto estimado en el eje
  const anioEst = desde + valores.length;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      role="img"
      aria-label={`Precio UF/m² de departamentos nuevos en ${comuna}, ${desde} a ${desde + valores.length - 1}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {grid.map((g, i) => (
        <g key={i}>
          <line x1={PLOT_X0} x2={PLOT_X1} y1={yFor(g)} y2={yFor(g)} stroke="var(--franco-border)" strokeWidth={1} />
          <text x={PLOT_X0 - 8} y={yFor(g) + 3.5} textAnchor="end" fontSize={11} fontFamily="var(--font-mono, monospace)" fill="var(--franco-text-muted)">
            {Math.round(g)}
          </text>
        </g>
      ))}
      {/* Banda del estimado: rectángulo sutil que muestra el rango, detrás de la línea. */}
      {estimado && (
        <rect
          x={xFor(iEst) - 5}
          y={yFor(estimado.bandaMax)}
          width={10}
          height={Math.max(1, yFor(estimado.bandaMin) - yFor(estimado.bandaMax))}
          fill="var(--franco-text)"
          fillOpacity={0.12}
        />
      )}
      <polyline points={pts} fill="none" stroke="var(--franco-text)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* Tramo hasta el cierre estimado: SÓLIDO (año terminado, compuesto de
          observado). El punteado queda reservado al tramo no transcurrido. */}
      {estimado && (
        <polyline
          points={`${xFor(valores.length - 1).toFixed(1)},${yFor(valores[valores.length - 1]).toFixed(1)} ${xFor(iEst).toFixed(1)},${yFor(estimado.ufM2).toFixed(1)}`}
          fill="none"
          stroke="var(--franco-text)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
      {valores.map((v, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(v)} r={3} fill="var(--franco-card)" stroke="var(--franco-text)" strokeWidth={1.6} />
      ))}
      {/* Punto del cierre: sólido, idéntico al resto de la serie (F2.1). Toda la
          serie es construcción de Franco a partir de fuentes públicas —la línea
          de fuente al pie lo declara—, así que marcar solo el último punto
          sugería que los demás no lo eran. */}
      {estimado && (
        <circle cx={xFor(iEst)} cy={yFor(estimado.ufM2)} r={3} fill="var(--franco-card)" stroke="var(--franco-text)" strokeWidth={1.6} />
      )}
      {labelIdx.map((i) => (
        <text key={i} x={xFor(i)} y={LABEL_Y} textAnchor="middle" fontSize={11} fontFamily="var(--font-mono, monospace)" fill="var(--franco-text-muted)">
          {desde + i}
        </text>
      ))}
      {/* El último punto cae en el borde derecho del área de plot, así que su
          label se ancla al final: centrado se cortaba fuera del viewBox. Sin
          "est." (F2.1): el año a secas, como los demás del eje. */}
      {estimado && (
        <text x={VB_W - 2} y={LABEL_Y} textAnchor="end" fontSize={11} fontFamily="var(--font-mono, monospace)" fill="var(--franco-text-muted)">
          {anioEst}
        </text>
      )}
      <text x={PLOT_X0 - 8} y={PLOT_TOP - 4} textAnchor="start" fontSize={10} fontFamily="var(--font-mono, monospace)" fill="var(--franco-text-muted)">
        UF/m²
      </text>
    </svg>
  );
}

// ── Piezas compartidas del patrón de sección (mockup e1c574c) ───────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--franco-text-tertiary)]">
      {children}
    </p>
  );
}

function NivelCard({ comuna }: { comuna: string }) {
  const nivel = GFK_NIVEL[comuna];
  if (!nivel) return null;
  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
      <p className="font-body text-xs text-[var(--franco-text-secondary)]">Precio del m² de deptos nuevos · {nivel.periodo}</p>
      <p className="mt-1 font-mono text-xl font-bold text-[var(--franco-text)]">UF {fmt1(nivel.ufM2)}/m²</p>
    </div>
  );
}

export function PlusvaliaComunaSection({ comuna }: { comuna: string }) {
  const cobertura = coberturaPlusvaliaDe(comuna);
  if (cobertura === "sin_dato") return null; // sin dato no hay sección — no se inventa

  const serie = GFK_SERIE[comuna];
  const ac = PLUSVALIA_ESTIMADO[comuna];
  // F2 · cierre estimado del año siguiente al último observado. Solo se dibuja
  // si el job lo produjo para ESTA comuna (las guardas degradan al resto) y si
  // encadena con la serie — un estimado suelto sin serie no se grafica.
  const est = PLUSVALIA_ESTIMADO_2025[comuna];
  const estEncadena = !!serie && !!est && ANIO_ESTIMADO === serie.desde + serie.valores.length;
  const estimadoGrafico = estEncadena ? est : null;

  return (
    <section className="mt-14">
      <Eyebrow>Plusvalía · qué ha hecho el precio</Eyebrow>
      <h2 className="mt-2 font-heading text-2xl font-bold text-[var(--franco-text)]">
        Cuánto se ha valorizado {comuna}
      </h2>

      {cobertura === "trayectoria_gfk" && serie && ac && (
        <div className="mt-4 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {/* F4.1 — la cifra y el período salen de la TRAYECTORIA (`ac`), que es
                la fuente única del producto, no de la serie del gráfico. La página
                calculaba su propia anualizada sobre los puntos observados y por eso
                mostraba 5,8% / "2015-2024" mientras el informe decía 5,0% /
                "2015-2025" para la misma comuna: dos cifras con la misma semántica
                divergen apenas una de las dos incorpora un punto nuevo. GFK_SERIE
                queda para DIBUJAR los puntos y nada más. */}
            <p className="font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
              El m² de departamentos nuevos en {comuna} pasó de UF {fmt1(ac.precioInicio)} a UF {fmt1(ac.precioFin)} entre {ac.rangoHist.replace("-", " y ")}.
            </p>
            <div className="text-right">
              <p className="font-mono text-lg font-bold text-[var(--franco-text)]">
                {fmt1(ac.anualizada)}%<span className="ml-1 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">anual promedio</span>
              </p>
              {GFK_NIVEL[comuna] && (
                <p className="mt-0.5 font-mono text-xs text-[var(--franco-text-secondary)]">
                  UF {fmt1(GFK_NIVEL[comuna].ufM2)}/m² · {GFK_NIVEL[comuna].periodo}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <SerieGfkSVG comuna={comuna} desde={serie.desde} valores={serie.valores} estimado={estimadoGrafico} />
          </div>
          <p className="mt-3 font-body text-xs text-[var(--franco-text-muted)]">
            {/* F2.1 · las dos ramas son parejas: sin "no es proyección" en
                ninguna. El eje ya dice años y la línea de fuente al pie declara
                la construcción; dejar la advertencia solo en la rama con cierre
                hacía parecer que a esa comuna le pasa algo que a la otra no. La
                guarda de histórico ≠ proyección vive donde decide algo: el
                drawer y el informe. */}
            {estimadoGrafico
              ? `Precios observados año a año. El ${ANIO_ESTIMADO} lo cerramos con los trimestres publicados de ese año.`
              : "Precios observados año a año."}
          </p>
        </div>
      )}

      {cobertura === "nivel_mas_ac" && ac && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NivelCard comuna={comuna} />
          <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
            <p className="font-body text-xs text-[var(--franco-text-secondary)]">Valorización observada {ac.rangoHist}</p>
            <p className="mt-1 font-mono text-xl font-bold text-[var(--franco-text)]">
              {ac.plusvalia10a > 0 ? "+" : ""}{ac.plusvalia10a}%
              <span className="ml-2 font-mono text-xs font-medium text-[var(--franco-text-secondary)]">({fmt1(ac.anualizada)}% anual)</span>
            </p>
          </div>
        </div>
      )}

      {cobertura === "solo_nivel" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NivelCard comuna={comuna} />
          <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
            <p className="font-body text-xs text-[var(--franco-text-secondary)]">Trayectoria histórica</p>
            <p className="mt-1 font-mono text-xl font-bold text-[var(--franco-text-muted)]">sin serie propia</p>
            <p className="mt-3 font-body text-xs text-[var(--franco-text-muted)]">
              No hay serie histórica publicada para {comuna} — hay precio actual, no historia propia.
            </p>
          </div>
        </div>
      )}

      {cobertura === "solo_ac" && ac && (
        <div className="mt-4 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6">
          <p className="font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
            Entre {ac.rangoHist.replace("-", " y ")} el precio promedio de departamentos en {comuna} subió {ac.plusvalia10a > 0 ? "+" : ""}{ac.plusvalia10a}% acumulado ({fmt1(ac.anualizada)}% anual).
          </p>
        </div>
      )}

      <p className="mt-3 font-body text-[11px] text-[var(--franco-text-muted)]">
        Fuente: elaboración propia en base a datos públicos de GfK/NielsenIQ, Tinsa, Colliers y Arenas &amp; Cayo.
      </p>
    </section>
  );
}
