"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ACORDEÓN DE HALLAZGOS — la fusión pirámide + drawers (FASE 4, mockup v12).
//
// UNA lista numerada: la línea visible es el resumen (ex-pirámide: numeral serif
// 900 + pregunta + valor mono) y el tap despliega el desarrollo in-place
// (ex-drawer). Muere el chrome del drawer entero — overlay, panel lateral,
// bottom-sheet, header con ✕, navegación prev/next y su `drawerSequence` — y
// mueren los tres niveles de la pirámide: acá todas las filas pesan lo mismo,
// el orden ya dice la jerarquía.
//
// Decisiones congeladas que implementa:
//  1. ACORDEÓN EXCLUSIVO — uno abierto a la vez.
//  2. Al abrir, ANCLA ARRIBA con scroll suave; el encabezado queda visible.
//  3. Cierre DOBLE — el encabezado sigue siendo toggle + botón "↑ Cerrar" al pie
//     (que además devuelve la fila al centro para no dejar al lector perdido).
//  5. Vocabulario único de 4 piezas (ver vocabulario.tsx).
//
// Telemetría: `informe_hallazgo_abierto {n, id_hallazgo, tipo}` pasa a medir
// EXPANSIONES REALES (la serie nació en FASE 1 colgada de la apertura de drawer,
// como línea base). Un disparo por fila por montaje: reabrir la misma fila no
// vuelve a contar, así el % de expansión es de lectores, no de clics.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useState, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";
import type { TipoInforme } from "@/components/analysis/informeTelemetry";

export type FilaHallazgo = {
  /** id del hallazgo (viaja en la telemetría). */
  id: string;
  /** Numeral del orden único ("01"…). */
  numero: string;
  /** La pregunta/resumen — la línea visible. */
  pregunta: string;
  /** Valor mono a la derecha (KPI del hallazgo). */
  valor: string;
  /** El valor pide Signal Red (adverso). */
  valorRojo?: boolean;
  /** Ancla estable para deep-link desde otras superficies. */
  anchorId?: string;
  /** El desarrollo, armado con el vocabulario único. `null` = fila sin cuerpo. */
  cuerpo: ReactNode | null;
};

export function HallazgosAcordeon({
  filas,
  tipo,
  total,
}: {
  filas: FilaHallazgo[];
  tipo: TipoInforme;
  /** Rótulo del pie ("12 hallazgos"). */
  total?: number;
}) {
  const posthog = usePostHog();
  const [abierta, setAbierta] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  // Un disparo por fila por montaje (ver cabecera).
  const medidas = useRef<Set<string>>(new Set());

  const toggle = useCallback(
    (fila: FilaHallazgo, indice: number) => {
      const yaAbierta = abierta === fila.id;
      setAbierta(yaAbierta ? null : fila.id);
      if (yaAbierta) return;

      if (!medidas.current.has(fila.id)) {
        medidas.current.add(fila.id);
        try {
          posthog?.capture("informe_hallazgo_abierto", { n: indice + 1, id_hallazgo: fila.id, tipo });
        } catch {
          /* la telemetría jamás rompe la lectura */
        }
        if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
          (window.__informeEvents ??= []).push({
            name: "informe_hallazgo_abierto",
            props: { n: indice + 1, id_hallazgo: fila.id, tipo },
          });
        }
      }
      // Decisión 2: anclar arriba con scroll suave, dejando el encabezado a la
      // vista. El timeout deja que el cuerpo monte antes de medir la posición.
      setTimeout(() => {
        refs.current[fila.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    },
    [abierta, posthog, tipo],
  );

  const cerrarYVolver = useCallback((fila: FilaHallazgo) => {
    setAbierta(null);
    refs.current[fila.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  if (filas.length === 0) return null;

  return (
    <section className="hall-list">
      <TokensHallazgos />
      <div className="chapters-eyebrow">
        <span>Los hallazgos, en el orden en que pesan ↓</span>
        <span className="h">toca para profundizar</span>
      </div>

      {filas.map((f, i) => {
        const open = abierta === f.id;
        return (
          <div
            key={f.id}
            id={f.anchorId}
            ref={(el) => {
              refs.current[f.id] = el;
            }}
            className={`hall${open ? " open" : ""}`}
          >
            <button
              type="button"
              className="hall-head"
              aria-expanded={open}
              disabled={!f.cuerpo}
              onClick={() => f.cuerpo && toggle(f, i)}
            >
              <span className="num">{f.numero}</span>
              <span className="q">{f.pregunta}</span>
              <span className="val" style={f.valorRojo === false ? { color: "var(--doc-tx2)" } : undefined}>
                {f.valor}
              </span>
              {f.cuerpo && (
                <span className="chev" aria-hidden="true">
                  ↓
                </span>
              )}
            </button>
            {open && f.cuerpo && (
              <div className="hall-body">
                {f.cuerpo}
                <button type="button" className="v-collapse" onClick={() => cerrarYVolver(f)}>
                  ↑ Cerrar
                </button>
              </div>
            )}
          </div>
        );
      })}

      {total != null && <div className="hall-foot">{total} hallazgos</div>}
    </section>
  );
}

/** CSS del acordeón + vocabulario + primitivas. `dangerouslySetInnerHTML` por la
 *  misma razón que DocTokens: un template literal como children hidrata distinto
 *  server/cliente. Los tokens `--doc-*` los aporta el DocumentoFrame. */
function TokensHallazgos() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .hall-list{margin-top:4px}
      .chapters-eyebrow{display:flex;justify-content:space-between;align-items:baseline;gap:10px;
        font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.16em;text-transform:uppercase;
        color:var(--doc-tx3);padding-bottom:10px;border-bottom:1px solid var(--doc-line);margin-bottom:2px}
      .chapters-eyebrow .h{letter-spacing:.06em;color:var(--doc-tx4);text-transform:none;font-size:10.5px}
      .hall-foot{padding-top:14px;font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.1em;
        text-transform:uppercase;color:var(--doc-tx4);text-align:center}

      /* ===== FILA ===== */
      .hall{border-bottom:1px solid var(--doc-line)}
      .hall-head{display:flex;align-items:baseline;gap:16px;padding:15px 0;cursor:pointer;transition:padding-left .15s;
        width:100%;background:none;border:none;text-align:left;color:inherit}
      .hall-head[disabled]{cursor:default}
      .hall-head:hover{padding-left:6px}
      .hall-head[disabled]:hover{padding-left:0}
      .hall-head:focus-visible{outline:2px solid var(--signal-red);outline-offset:2px}
      .hall .num{font-family:var(--font-heading, Georgia, serif);font-size:28px;font-weight:900;color:var(--doc-line2);
        min-width:46px;font-variant-numeric:tabular-nums;transition:color .15s}
      .hall.open .num,.hall-head:not([disabled]):hover .num{color:var(--signal-red)}
      .hall .q{flex:1;font-family:var(--font-heading, Georgia, serif);font-size:16px;font-weight:600;line-height:1.35;color:var(--doc-tx)}
      .hall .val{font-family:var(--font-mono, ui-monospace);font-size:13.5px;font-weight:700;color:var(--signal-red);white-space:nowrap}
      .hall .chev{font-family:var(--font-mono, ui-monospace);font-size:13px;color:var(--doc-tx4);transition:transform .2s}
      .hall.open .chev{transform:rotate(180deg)}
      .hall-body{padding:4px 0 20px 62px;animation:hallFade .22s ease-out}
      @keyframes hallFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
      @media (max-width: 767px){
        .hall .num{font-size:22px;min-width:36px}
        .hall .q{font-size:14.5px}
        .hall-body{padding-left:0}
      }
      @media (prefers-reduced-motion:reduce){.hall-body{animation:none}.hall-head{transition:none}}

      /* ===== VOCABULARIO ÚNICO (4 piezas) ===== */
      .v-prosa{font-size:14px;line-height:1.75;color:var(--doc-tx2);margin-bottom:16px;max-width:60ch}
      .v-prosa p{margin:0 0 12px}
      .v-prosa p:last-child{margin-bottom:0}
      .v-prosa mark,.v-cierre p mark{
        background:linear-gradient(transparent 42%,var(--doc-hl) 42%,var(--doc-hl) 94%,transparent 94%);
        color:var(--doc-hl-tx);padding:0 2px;font-weight:500}
      .v-viz{margin:0 0 18px}
      .v-viz-t{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
        color:var(--doc-tx4);margin-bottom:10px}
      .v-cierre{background:var(--doc-paper2);border:1px solid var(--doc-line);border-left:3px solid var(--signal-red);
        border-radius:3px;padding:16px 18px;margin-top:4px;margin-bottom:4px}
      .v-cierre .t{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;
        color:var(--signal-red);font-weight:700;margin-bottom:8px}
      .v-cierre p{font-family:var(--font-heading, Georgia, serif);font-style:italic;font-size:14.5px;line-height:1.7;
        color:var(--doc-tx2);max-width:58ch;margin:0}
      /* CIERRE ÚNICO: los cuerpos heredados apilaban 2-4 cajas de cierre. Si hay
         una posterior, esta se degrada a prosa — el cierre es el último. */
      .hall-body .v-cierre:has(~ .v-cierre){background:none;border:none;border-left:2px solid var(--doc-line2);
        border-radius:0;padding:0 0 0 14px;margin:0 0 16px}
      .hall-body .v-cierre:has(~ .v-cierre) .t{color:var(--doc-tx4);font-weight:400}
      .hall-body .v-cierre:has(~ .v-cierre) p{font-family:var(--font-body, sans-serif);font-style:normal;font-size:14px;
        line-height:1.75;color:var(--doc-tx2)}
      .v-fuente{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.06em;color:var(--doc-tx4);margin-top:12px}
      .v-collapse{margin-top:18px;width:100%;background:none;border:1px dashed var(--doc-line2);border-radius:3px;padding:10px;
        font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
        color:var(--doc-tx3);cursor:pointer}
      .v-collapse:hover{color:var(--doc-tx);border-color:var(--doc-tx4)}

      /* ===== PRIMITIVAS DE DIAGRAMA ===== */
      .thermo{padding:6px 0 2px}
      .thermo-track{position:relative;height:6px;border-radius:3px;
        background:linear-gradient(90deg,var(--doc-good),var(--doc-warn),var(--signal-red))}
      .thermo-mark{position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:var(--doc-tx);
        border:3px solid var(--doc-paper);transform:translate(-50%,-50%)}
      .thermo-ref{position:absolute;top:-5px;bottom:-5px;width:2px;background:var(--doc-tx3)}
      .thermo-legend{display:flex;justify-content:space-between;margin-top:9px;font-family:var(--font-mono, ui-monospace);
        font-size:9.5px;color:var(--doc-tx4);letter-spacing:.06em}
      .thermo-legend b{color:var(--doc-tx2);display:block;font-size:12px;margin-top:2px}
      .fall-visual{display:flex;height:26px;border-radius:2px;overflow:hidden;margin-bottom:12px}
      .fall-visual span{height:100%}
      .fall-row{display:grid;grid-template-columns:1fr 130px;align-items:center;gap:12px;padding:7px 0;
        border-bottom:1px dotted var(--doc-line)}
      .fall-row:last-child{border-bottom:none}
      .fall-row .fk{font-size:12.5px;color:var(--doc-tx3);display:flex;align-items:center;gap:8px}
      .fall-row .fk::before{content:'';width:8px;height:8px;border-radius:2px;background:var(--c,var(--doc-neutral));flex-shrink:0}
      .fall-row .fv{font-family:var(--font-mono, ui-monospace);font-size:12.5px;text-align:right;color:var(--doc-tx)}
      .fall-row.total{border-top:2px solid var(--doc-tx);margin-top:6px;padding-top:10px;border-bottom:none}
      .fall-row.total .fk{color:var(--doc-tx);font-weight:600;font-size:13px}
      .fall-row.total .fk::before{display:none}
      .fall-row.total .fv{font-weight:700;font-size:14.5px;color:var(--signal-red)}
      .bars{display:flex;flex-direction:column;gap:9px}
      .bar-row{display:grid;grid-template-columns:120px 1fr auto;align-items:center;gap:12px}
      .bar-row .bk{font-size:12px;color:var(--doc-tx3);text-align:right}
      .bar-track{height:16px;background:var(--doc-paper3);border-radius:2px;overflow:hidden}
      .bar-fill{height:100%;border-radius:2px}
      .bar-row .bv{font-family:var(--font-mono, ui-monospace);font-size:12.5px;font-weight:700;white-space:nowrap;color:var(--doc-tx)}
      .spark{width:100%;height:110px;display:block}
      .tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:6px}
      .tbl{border-collapse:collapse;width:100%;min-width:390px}
      .tbl th{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;
        color:var(--doc-tx4);padding:8px 10px;text-align:right;border-bottom:1px solid var(--doc-line);font-weight:400}
      .tbl th:first-child{text-align:left}
      .tbl td{font-family:var(--font-mono, ui-monospace);font-size:12.5px;padding:9px 10px;text-align:right;
        border-bottom:1px solid var(--doc-line);color:var(--doc-tx)}
      .tbl td:first-child{text-align:left;font-family:var(--font-body, sans-serif);color:var(--doc-tx3);white-space:nowrap}
      .tbl tr.hl td{background:var(--doc-paper3)}
      .cell-neg{color:var(--signal-red)} .cell-pos{color:var(--doc-good)}
      .tbl-scrollcue{font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.1em;text-transform:uppercase;
        color:var(--doc-tx4);margin-bottom:16px}
      @media (max-width: 767px){
        .fall-row{grid-template-columns:1fr 108px;gap:8px}
        .bar-row{grid-template-columns:88px 1fr auto;gap:8px}
        .bar-row .bk{font-size:11px}
        .spark{height:96px}
      }
    `,
      }}
    />
  );
}
