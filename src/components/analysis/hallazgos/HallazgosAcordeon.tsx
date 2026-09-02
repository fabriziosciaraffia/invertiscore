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
// Telemetría: `informe_hallazgo_abierto {n, id_hallazgo, tipo, veredicto,
// access_level}` pasa a medir EXPANSIONES REALES (la serie nació en FASE 1
// colgada de la apertura de drawer, como línea base). Un disparo por fila por
// montaje: reabrir la misma fila no vuelve a contar, así el % de expansión es
// de lectores, no de clics. `veredicto`/`access_level` son los cortes del
// tablero FASE 5 (lectura 10-sep-2026).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  /** Sub-label del KPI (`findingDisplay().ksub`): la unidad y el contraste que el
   *  KPI solo no dice — "bajo la mediana de Ñuñoa · UF 78,4 vs UF 93,1 /m²".
   *  GOAL 16 (c): hasta acá `findingDisplay` lo construía y NINGUNA superficie lo
   *  renderizaba. El rediseño Dictamen reemplazó las cards de la pirámide por este
   *  acordeón y el sub-label quedó huérfano en el camino — medido sobre
   *  /analisis/1920fd35-… : "/m²" aparecía 0 veces en todo el DOM. El par
   *  sujeto-vs-mediana solo vivía dentro del párrafo IA del cuerpo 16, el mismo que
   *  este goal desarma; sin este consumidor el dato desaparecía del informe. */
  ksub?: string;
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
  veredicto,
  accessLevel,
  variante = "hallazgo",
  abrir,
}: {
  filas: FilaHallazgo[];
  tipo: TipoInforme;
  /** Rótulo del pie ("12 hallazgos"). */
  total?: number;
  /** Cortes del tablero FASE 5 — viajan en `informe_hallazgo_abierto`. */
  veredicto: string;
  accessLevel: string;
  /** T3 (contrato CONGELADO): `capitulo` = los cinco capítulos de La inversión.
   *  Mismo acordeón, otra piel (numeral romano, cuerpo como extensión de la fila,
   *  chip «↑ Cerrar» a la derecha, sin eyebrow) y OTRA serie de telemetría:
   *  `informe_capitulo_abierto {capitulo, id_capitulo, tipo, veredicto,
   *  access_level}`. La serie vieja `informe_hallazgo_abierto` muere en LTR con
   *  el acordeón de hallazgos; STR la sigue emitiendo. */
  variante?: "hallazgo" | "capitulo";
  /** Apertura pedida desde afuera («↓ Ver detalle» de Principales hallazgos):
   *  abre esa fila, la mide como expansión y ancla arriba. `nonce` cambia en cada
   *  pedido para que dos clics seguidos al mismo capítulo lo reabran. */
  abrir?: { id: string; nonce: number } | null;
}) {
  const posthog = usePostHog();
  const [abierta, setAbierta] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  // Un disparo por fila por montaje (ver cabecera).
  const medidas = useRef<Set<string>>(new Set());
  const esCapitulo = variante === "capitulo";

  const medir = useCallback(
    (fila: FilaHallazgo, indice: number) => {
      if (medidas.current.has(fila.id)) return;
      medidas.current.add(fila.id);
      const name = esCapitulo ? "informe_capitulo_abierto" : "informe_hallazgo_abierto";
      const props = esCapitulo
        ? { capitulo: fila.numero, id_capitulo: fila.id, n: indice + 1, tipo, veredicto, access_level: accessLevel }
        : { n: indice + 1, id_hallazgo: fila.id, tipo, veredicto, access_level: accessLevel };
      try {
        posthog?.capture(name, props);
      } catch {
        /* la telemetría jamás rompe la lectura */
      }
      if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
        (window.__informeEvents ??= []).push({ name, props });
      }
    },
    [esCapitulo, posthog, tipo, veredicto, accessLevel],
  );

  const toggle = useCallback(
    (fila: FilaHallazgo, indice: number) => {
      const yaAbierta = abierta === fila.id;
      setAbierta(yaAbierta ? null : fila.id);
      if (yaAbierta) return;
      medir(fila, indice);
      // Decisión 2: anclar arriba con scroll suave, dejando el encabezado a la
      // vista. El timeout deja que el cuerpo monte antes de medir la posición.
      setTimeout(() => {
        refs.current[fila.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    },
    [abierta, medir],
  );

  // Apertura externa (capítulos): mismo camino que el tap, sin pasar por el botón.
  useEffect(() => {
    if (!abrir) return;
    const i = filas.findIndex((f) => f.id === abrir.id);
    const fila = filas[i];
    if (!fila || !fila.cuerpo) return;
    setAbierta(fila.id);
    medir(fila, i);
    const t = setTimeout(() => {
      refs.current[fila.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrir?.id, abrir?.nonce]);

  const cerrarYVolver = useCallback((fila: FilaHallazgo) => {
    setAbierta(null);
    refs.current[fila.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  if (filas.length === 0) return null;

  return (
    <section className="hall-list">
      <TokensHallazgos />
      {!esCapitulo && (
        <div className="chapters-eyebrow">
          <span>Los hallazgos, en el orden en que pesan ↓</span>
          <span className="h">toca para profundizar</span>
        </div>
      )}

      {filas.map((f, i) => {
        const open = abierta === f.id;
        return (
          <div
            key={f.id}
            id={f.anchorId}
            ref={(el) => {
              refs.current[f.id] = el;
            }}
            className={`hall${esCapitulo ? " cap" : ""}${open ? " open" : ""}`}
          >
            <button
              type="button"
              className="hall-head"
              aria-expanded={open}
              disabled={!f.cuerpo}
              onClick={() => f.cuerpo && toggle(f, i)}
            >
              <span className="num">{f.numero}</span>
              <span className="q">
                {f.pregunta}
                {f.ksub && <span className="ksub">{f.ksub}</span>}
              </span>
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
                {esCapitulo ? (
                  <div className="hall-end">
                    <button type="button" className="hall-close" onClick={() => cerrarYVolver(f)}>
                      ↑ Cerrar
                    </button>
                  </div>
                ) : (
                  <button type="button" className="v-collapse" onClick={() => cerrarYVolver(f)}>
                    ↑ Cerrar
                  </button>
                )}
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
export function TokensHallazgos() {
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
      .thermo.con-marca{padding-top:28px}
      .thermo-you{position:absolute;top:-24px;transform:translateX(-50%);font-family:var(--font-mono, ui-monospace);font-size:11px;font-weight:700;
        color:var(--doc-tx);white-space:nowrap}
      /* T3 · capítulo V: la misma plata en otro lado + venta/refinanciamiento */
      .oport{margin-top:18px;padding:14px 16px;border:1px solid var(--doc-line);border-radius:3px;background:var(--doc-paper2)}
      .oport .bt{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--doc-tx4);margin-bottom:6px}
      .oport .nota{font-size:12px;line-height:1.6;color:var(--doc-tx3);margin:10px 0 0}
      .venta{display:grid;grid-template-columns:1fr 1fr;gap:26px}
      .venta h4{font-family:var(--font-heading, Georgia, serif);font-size:15px;font-weight:600;margin:0 0 4px;color:var(--doc-tx)}
      .venta .ex{font-size:12px;line-height:1.55;color:var(--doc-tx3);margin:0 0 8px}
      @media (max-width: 767px){ .venta{grid-template-columns:1fr;gap:18px} .hall.cap .num{font-size:20px} }
      .thermo-track{position:relative;height:6px;border-radius:3px;
        background:linear-gradient(90deg,var(--doc-good),var(--doc-warn),var(--signal-red))}
      /* v9b — eje donde la calidad crece hacia la derecha (ocupación): el color
         codifica calidad, no posición. */
      .thermo-track.inv{background:linear-gradient(90deg,var(--signal-red),var(--doc-warn),var(--doc-good))}
      .thermo-mark{position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:var(--doc-tx);
        border:3px solid var(--doc-paper);transform:translate(-50%,-50%)}
      .thermo-ref{position:absolute;top:-5px;bottom:-5px;width:2px;background:var(--doc-tx3)}
      /* Hito del CERO (goal plusvalía): más tenue que la referencia — es un punto de
         lectura, no el umbral contra el que se compara. */
      .thermo-cero{position:absolute;top:-3px;bottom:-3px;width:1px;background:var(--doc-tx4)}
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
      /* Convención del informe (Capa 1): el rojo del NUMERAL lo decide el signo, no
         el destaque de la serie. */
      .bar-row .bv.neg{color:var(--signal-red)}
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
      .tbl tr.cruce td{border-top:2px solid var(--doc-good)}
      .tbl-crucelbl{display:block;font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.08em;
        text-transform:uppercase;color:var(--doc-good);padding-top:7px}
      .cell-neg{color:var(--signal-red)} .cell-pos{color:var(--doc-good)}
      .tbl-scrollcue{font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.1em;text-transform:uppercase;
        color:var(--doc-tx4);margin-bottom:16px}
      /* Pie de diagrama: el texto que describe el gráfico cuelga de él, no es un cierre. */
      .viz-pie{margin:-10px 0 18px;font-size:12.5px;line-height:1.7;color:var(--doc-tx3);max-width:62ch}
      /* El −10px de arriba existe para que el pie CUELGUE del diagrama (waterfall,
         cadena). Bajo un Thermo no sirve: su leyenda es de dos líneas y el pie se
         metía dentro de la fila de valores (el 3,0% central quedaba en el párrafo).
         Se neutraliza SOLO en ese vecindario, sin tocar los cuerpos donde funciona. */
      .thermo + .viz-pie{margin-top:8px}
      /* GOAL 16 (c) — sub-label del KPI en la fila del acordeón. Mono chico y en
         tx3 para que no compita con la pregunta: es la unidad del número de la
         derecha, no un segundo titular. */
      .hall-head .q .ksub{display:block;margin-top:3px;font-family:var(--font-mono, ui-monospace);font-size:10px;line-height:1.35;color:var(--doc-tx3);font-weight:400;letter-spacing:0.01em}
      .viz-pie b{color:var(--doc-tx2);font-weight:600}

      /* ===== FASE 4.1 · MATRIZ DE PALANCAS ===== */
      .pal{display:flex;flex-direction:column;gap:1px;background:var(--doc-line);border:1px solid var(--doc-line);
        border-radius:3px;overflow:hidden}
      .pal-row{display:grid;grid-template-columns:1fr auto;gap:3px 12px;background:var(--doc-paper);padding:11px 13px}
      .pal-row.si{background:var(--doc-paper2)}
      .pal-glosa{flex-basis:100%;font-size:11px;font-weight:400;color:var(--doc-tx3);margin-top:1px}
      .pal-row.off{opacity:.62}
      .pal-row.off .pal-name{color:var(--doc-tx2)}
      .pal-row.wash-warn{background:linear-gradient(90deg,color-mix(in srgb,var(--doc-warn) 7%,transparent),transparent 70%)}
      .pal-row.wash-good{background:linear-gradient(90deg,color-mix(in srgb,var(--doc-good) 8%,transparent),transparent 72%)}
      .pal-name{font-size:13px;color:var(--doc-tx);display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
      .pal-delta{font-family:var(--font-mono, ui-monospace);font-size:11.5px;font-weight:700;padding:1px 5px;border-radius:2px}
      .pal-delta.si{color:var(--doc-good);background:color-mix(in srgb,var(--doc-good) 12%,transparent)}
      .pal-delta.no{color:var(--signal-red);background:color-mix(in srgb,var(--signal-red) 8%,transparent)}
      .pal-verdict{font-size:13px;text-align:right;line-height:1.4}
      .pal-verdict.si{color:var(--doc-good)}
      .pal-verdict.no{color:var(--doc-tx4)}
      .pal-detail{grid-column:1/-1;font-family:var(--font-mono, ui-monospace);font-size:11px;color:var(--doc-tx3)}
      .pal-arrow{margin:0 6px;color:var(--doc-tx4)}
      .pal-why{color:var(--doc-tx4);font-style:italic}
      .pal-pie{background:var(--doc-paper);padding:10px 13px;font-size:11.5px;line-height:1.6;color:var(--doc-tx4)}

      /* ===== DIAL DE VEREDICTO ===== */
      .dial{position:relative;padding:34px 0 2px}
      .dial-marklbl{position:absolute;top:0;transform:translateX(-50%);text-align:center;white-space:nowrap;
        font-family:var(--font-mono, ui-monospace)}
      .dial-marklbl .k{display:block;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--doc-tx4)}
      .dial-marklbl .v{display:block;font-size:12.5px;font-weight:700;color:var(--doc-tx)}
      .dial-track{display:flex;height:22px;border-radius:3px;overflow:hidden}
      .dial-zone{display:flex;align-items:center;justify-content:center;overflow:hidden;
        font-family:var(--font-mono, ui-monospace);font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:#fff}
      .dial-zone span{padding:0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dial-zone.buscar{background:var(--signal-red)}
      .dial-zone.ajusta{background:var(--doc-warn)}
      .dial-zone.comprar{background:var(--doc-good)}
      .dial-mark{position:absolute;top:29px;height:32px;width:3px;border-radius:2px;background:var(--doc-tx);
        transform:translateX(-50%);z-index:2}
      .dial-edges{position:relative;height:48px;margin-top:12px}
      .dial-edge{position:absolute;top:0;white-space:nowrap;font-family:var(--font-mono, ui-monospace)}
      .dial-edge.arriba{transform:translateX(-100%);text-align:right}
      .dial-edge .d{display:block;font-size:12px;font-weight:700;color:var(--doc-tx)}
      .dial-edge .v{display:block;font-size:11px;color:var(--doc-tx2)}
      .dial-edge .k{display:block;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--doc-tx4)}

      /* ===== COMPOSICIÓN (llaves + segmentos) ===== */
      .compo-wrap{padding:2px 0}
      .compo-brackets{display:flex;gap:3px;margin-bottom:6px}
      .compo-bracket{font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.08em;text-transform:uppercase;
        color:var(--doc-tx4);border:1px solid var(--doc-line2);border-bottom:none;border-radius:3px 3px 0 0;
        padding:4px 6px 3px;text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .compo-bracket b{color:var(--doc-tx2)}
      .compo-track{display:flex;height:28px;border-radius:2px;overflow:hidden;gap:1px}
      .compo-seg{height:100%}
      .compo-seg.pie,.compo-sw.pie{background:var(--doc-tx3)}
      .compo-seg.aporte,.compo-sw.aporte{background:var(--doc-tx4)}
      .compo-seg.amort,.compo-sw.amort,.compo-seg.oper,.compo-sw.oper{background:var(--doc-neutral)}
      .compo-seg.plus,.compo-sw.plus,.compo-seg.util,.compo-sw.util{background:var(--doc-good)}
      .compo-seg.com,.compo-sw.com{background:var(--doc-warn)}
      .compo-seg.proy,.compo-sw.proy{background-image:repeating-linear-gradient(45deg,transparent,transparent 3px,
        rgba(255,255,255,.5) 3px,rgba(255,255,255,.5) 6px)}
      .compo-leg{margin-top:12px}
      .compo-leg-row{display:grid;grid-template-columns:11px 1fr auto;align-items:baseline;gap:10px;padding:7px 0;
        border-bottom:1px dotted var(--doc-line)}
      .compo-leg-row:last-child{border-bottom:none}
      .compo-sw{width:9px;height:9px;border-radius:2px;align-self:center}
      .compo-k{font-size:12.5px;color:var(--doc-tx3)}
      .compo-k small{display:block;font-size:10.5px;color:var(--doc-tx4);margin-top:2px;line-height:1.45}
      .compo-v{font-family:var(--font-mono, ui-monospace);font-size:12.5px;color:var(--doc-tx);text-align:right;white-space:nowrap}
      .compo-v small{display:block;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--doc-tx4);margin-top:2px}
      .compo-total{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
        border-top:2px solid var(--doc-tx);margin-top:8px;padding-top:10px}
      .compo-total .k{font-size:13px;font-weight:600;color:var(--doc-tx)}
      .compo-total .v{font-family:var(--font-mono, ui-monospace);font-size:15px;font-weight:700;color:var(--signal-red)}

      /* ===== BARRA DE $100 (banda + corte) ===== */
      .cien{position:relative;padding:22px 0 2px}
      .cien-banda{position:absolute;top:22px;height:26px;z-index:2;pointer-events:none;
        border-left:1px dashed var(--doc-tx4);border-right:1px dashed var(--doc-tx4);
        background:repeating-linear-gradient(45deg,rgba(0,0,0,.10) 0,rgba(0,0,0,.10) 2px,transparent 2px,transparent 5px)}
      .cien-banda-lbl{position:absolute;top:0;font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.08em;
        text-transform:uppercase;color:var(--doc-tx4);white-space:nowrap}
      .cien-banda-lbl.der{transform:translateX(-100%)}
      .cien-track{position:relative;display:flex;height:26px;border-radius:2px;overflow:hidden}
      .cien-seg{height:100%}
      .cien-seg.oper{background:var(--doc-neutral)}
      .cien-seg.com{background:var(--doc-warn)}
      .cien-seg.util{background:var(--doc-good)}
      .cien-desborde{position:absolute;right:0;top:0;bottom:0;width:9px;z-index:3;
        background:repeating-linear-gradient(90deg,var(--signal-red) 0,var(--signal-red) 2px,transparent 2px,transparent 4px)}
      .cien-corte{position:absolute;top:18px;height:34px;width:2px;background:var(--doc-tx);transform:translateX(-50%);z-index:4}
      .cien-corte-lbl{position:absolute;top:54px;transform:translateX(-50%);font-family:var(--font-mono, ui-monospace);
        font-size:12px;font-weight:700;color:var(--doc-tx);white-space:nowrap}
      .cien .compo-leg{margin-top:34px}

      /* ===== FASE 4.2 · COMPARACIÓN TUYO vs REFERENCIA ===== */
      .cmp{display:flex;flex-direction:column;gap:16px}
      /* ═══ PRIMITIVAS DEL CONTRATO CONGELADO (T0, 02-sep-2026) — sin llamador hasta T2/T3 ═══ */
      .v-sub{font-family:var(--font-heading, Georgia, serif);font-size:16px;font-weight:600;color:var(--doc-tx);margin:24px 0 8px;line-height:1.3}
      .v-puente{font-family:var(--font-mono, ui-monospace);font-size:11px;letter-spacing:.02em;color:color-mix(in srgb,var(--doc-tx) 60%,transparent);
        margin:2px 0 16px;padding-top:12px;border-top:1px dotted var(--doc-line2)}
      .datarow{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--doc-line);font-size:12.5px;font-weight:600;color:var(--doc-tx)}
      .datarow small{display:block;font-weight:400;font-size:11px;color:var(--doc-tx3);margin-top:1px}
      .datarow .v{font-family:var(--font-mono, ui-monospace);font-weight:700;white-space:nowrap}
      /* matriz de sensibilización */
      .mx-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}
      .mx-toggle{display:inline-flex;border:1px solid var(--doc-line2);border-radius:4px;overflow:hidden}
      .mx-toggle button{font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:5px 11px;
        background:var(--doc-paper);color:var(--doc-tx3);border:none;cursor:pointer}
      .mx-toggle button+button{border-left:1px solid var(--doc-line2)}
      .mx-toggle button.on{background:var(--doc-tx);color:var(--doc-paper);font-weight:700}
      .mx{border-collapse:collapse;width:100%}
      .mx th{font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--doc-tx4);padding:8px 6px;
        font-weight:400;border-bottom:1px solid var(--doc-line);text-align:right}
      .mx th:first-child{text-align:left}
      .mx td{font-family:var(--font-mono, ui-monospace);font-size:12px;padding:10px 6px;text-align:right;border-bottom:1px solid var(--doc-line);white-space:nowrap}
      .mx td:first-child{text-align:left;font-weight:700;color:var(--doc-tx)}
      .mx td:first-child small{display:block;font-family:var(--font-body, system-ui);font-size:10px;font-weight:400;color:var(--doc-tx3)}
      .mx td.neg{color:var(--signal-red)} .mx td.pos{color:var(--doc-tx)}
      .mx td.hoy{box-shadow:inset 0 0 0 200px color-mix(in srgb,var(--doc-warn) 16%,transparent);font-weight:700}
      .mx-note{font-family:var(--font-mono, ui-monospace);font-size:10.5px;color:var(--doc-tx2);line-height:1.6;margin-top:10px;letter-spacing:.02em}
      .mx-wrap .tbl-scrollcue{display:none}
      /* línea de tiempo */
      .tl{display:grid;align-items:start;gap:8px;margin:14px 0 6px}
      .hito{border-top:3px solid var(--doc-tx);padding-top:10px}
      .hito.mid{border-top-color:var(--doc-warn)} .hito.end{border-top-color:var(--doc-good)}
      .hito .k{font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--doc-tx3);display:block}
      .hito .d{font-size:11px;color:var(--doc-tx4);display:block;margin-top:1px}
      .hito .v{font-family:var(--font-mono, ui-monospace);font-size:15px;font-weight:700;color:var(--doc-tx);display:block;margin-top:6px}
      .tl-delta{align-self:center;text-align:center;font-family:var(--font-mono, ui-monospace);font-size:10.5px;color:var(--doc-tx2);padding:0 4px}
      .tl-delta b{display:block;font-size:12px;color:var(--doc-good)}
      .tl-delta::before{content:'→';display:block;color:var(--doc-tx4);font-size:14px}
      .lectura{font-family:var(--font-heading, Georgia, serif);font-style:italic;font-size:14px;color:var(--doc-tx2);margin-top:12px;line-height:1.6}
      /* barra apilada (propuesta-04) */
      .ba-brackets{display:flex;margin-bottom:5px}
      .ba-bracket{position:relative;text-align:center;font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--doc-tx3);padding-bottom:7px}
      .ba-bracket::after{content:'';position:absolute;left:3px;right:3px;bottom:0;height:5px;border:1px solid var(--doc-line2);border-bottom:none;border-radius:3px 3px 0 0}
      .ba-bracket b{color:var(--doc-tx);font-size:11px}
      .ba-compo{display:flex;height:38px;border-radius:3px;overflow:hidden}
      .ba-seg{height:100%;position:relative}
      .ba-seg.pie,.ba-sw.pie{background:var(--doc-neutral)} .ba-seg.amort,.ba-sw.amort{background:var(--doc-good)} .ba-seg.plus,.ba-sw.plus{background:var(--doc-good);opacity:.45}
      .ba-seg.plus::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(255,255,255,.35) 5px,rgba(255,255,255,.35) 10px)}
      .ba-leg{margin-top:14px}
      .ba-row{display:grid;grid-template-columns:12px 1fr auto;align-items:baseline;gap:10px;padding:8px 0;border-bottom:1px solid var(--doc-line)}
      .ba-row:last-child{border-bottom:none}
      .ba-sw{width:12px;height:12px;border-radius:2px;position:relative;top:2px}
      .ba-sw.plus::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,.4) 3px,rgba(255,255,255,.4) 6px)}
      .ba-k{font-size:12.5px;color:var(--doc-tx2)} .ba-k small{display:block;font-size:11px;color:var(--doc-tx3);margin-top:1px}
      .ba-v{font-family:var(--font-mono, ui-monospace);font-size:12.5px;font-weight:700;white-space:nowrap;text-align:right;color:var(--doc-tx)}
      .ba-v small{display:block;font-family:var(--font-mono, ui-monospace);font-size:9.5px;color:var(--doc-tx4);font-weight:400;margin-top:1px}
      .ba-total{display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;padding-top:11px;border-top:2px solid var(--doc-tx)}
      .ba-total .k{font-size:13px;font-weight:600;color:var(--doc-tx)} .ba-total .v{font-family:var(--font-mono, ui-monospace);font-size:19px;font-weight:700;color:var(--doc-tx)}
      .ba-mult{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--doc-paper2);border:1px solid var(--doc-line);border-radius:3px;margin-top:12px}
      .ba-mult .k{font-size:12px;color:var(--doc-tx3);flex:1;line-height:1.45} .ba-mult .v{font-family:var(--font-mono, ui-monospace);font-size:17px;font-weight:700;color:var(--doc-good);white-space:nowrap}
      /* modal (overlay Ink 60%, panel 720px, pantalla completa en mobile) */
      .v-modal-overlay{position:fixed;inset:0;background:rgba(20,19,17,.6);display:flex;align-items:center;justify-content:center;z-index:60;padding:20px}
      .v-modal{width:100%;max-width:720px;max-height:92vh;overflow-y:auto;background:var(--doc-paper);border:1px solid var(--doc-line2);border-radius:4px;padding:26px 28px 24px;position:relative;color:var(--doc-tx)}
      .v-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:6px}
      .v-modal-head h3{font-family:var(--font-heading, Georgia, serif);font-size:22px;font-weight:700;line-height:1.2;margin:0}
      .v-modal-sub{font-size:13px;color:var(--doc-tx3);line-height:1.5;margin:0 0 18px}
      .v-modal-x{background:none;border:1px solid var(--doc-line2);border-radius:4px;width:30px;height:30px;font-family:var(--font-mono, ui-monospace);font-size:14px;color:var(--doc-tx3);cursor:pointer;flex-shrink:0}
      .v-modal-x:hover{color:var(--doc-tx);border-color:var(--doc-tx4)}
      .v-modal-pie{margin-top:18px;padding-top:12px;border-top:1px solid var(--doc-line);font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.06em;color:var(--doc-tx4);line-height:1.5}
      /* cuerpo de capítulo (B): extensión de la fila — línea bajo el número, indentado, chip de cierre a la derecha */
      .hall.cap .hall-body{margin-left:12px;padding:6px 0 18px 74px;border-left:2px solid color-mix(in srgb,var(--doc-tx) 30%,transparent)}
      .hall-end{display:flex;justify-content:flex-end;margin-top:16px}
      .hall-close{font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--doc-tx3);background:none;
        border:1px solid var(--doc-line2);border-radius:3px;padding:6px 12px;cursor:pointer}
      .hall-close:hover{color:var(--doc-tx);border-color:var(--doc-tx4)}
      @media (max-width: 767px){
        .mx-wrap .tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .mx-wrap .mx{min-width:470px} .mx td{font-size:11px;padding:9px 6px}
        .mx-wrap .tbl-scrollcue{display:block;margin-top:6px}
        .tl{grid-template-columns:1fr !important;gap:6px} .tl-delta::before{content:'↓'} .hito .v{font-size:14px}
        .ba-total .v{font-size:17px}
        .v-modal-overlay{padding:0} .v-modal{max-width:none;max-height:none;height:100%;border-radius:0;border:none;padding:22px 20px 24px}
        .hall.cap .hall-body{margin-left:8px;padding-left:22px}
      }
      .cmp-row{display:flex;flex-direction:column;gap:5px}
      .cmp-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:2px}
      .cmp-k{font-size:12.5px;color:var(--doc-tx)}
      .cmp-k small{display:block;font-size:10.5px;color:var(--doc-tx4);margin-top:1px}
      .cmp-tag{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;
        white-space:nowrap;padding:2px 6px;border-radius:2px}
      .cmp-tag.ok{color:var(--doc-good);background:color-mix(in srgb,var(--doc-good) 12%,transparent)}
      .cmp-tag.flojo{color:var(--signal-red);background:color-mix(in srgb,var(--signal-red) 8%,transparent)}
      .cmp-tag.par{color:var(--doc-tx4);background:var(--doc-paper3)}
      .cmp-line{display:grid;grid-template-columns:56px 1fr auto;align-items:center;gap:10px}
      .cmp-lbl{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;
        color:var(--doc-tx4);text-align:right}
      .cmp-track{height:14px;background:var(--doc-paper3);border-radius:2px;overflow:hidden}
      .cmp-fill{height:100%;border-radius:2px}
      /* fase42 pasada-marco — el mockup canónico (13-11) pinta la barra propia en
         ámbar, no en Signal Red: el rojo quedaba en filas neutras (pie, cuota) y
         viola la regla del color (rojo = solo atención). Toca también las barras
         de precio STR (K1), que heredaban el rojo por defecto. */
      .cmp-fill.tuyo{background:var(--doc-warn)}
      .cmp-fill.tuyo.ok{background:var(--doc-good)}
      .cmp-fill.ref{background:var(--doc-tx4)}
      .cmp-v{font-family:var(--font-mono, ui-monospace);font-size:12px;font-weight:700;color:var(--doc-tx);white-space:nowrap}
      .cmp-pie{font-size:11.5px;line-height:1.6;color:var(--doc-tx4);margin-top:2px}

      /* ===== ESCALERA DEL PIE (trade-off flujo ↔ TIR) ===== */
      .esca{border:1px solid var(--doc-line);border-radius:3px;overflow:hidden}
      .esca-head,.esca-row{display:grid;grid-template-columns:1fr 1.15fr 62px;gap:10px;align-items:baseline;
        padding:9px 12px}
      .esca-head{font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.1em;text-transform:uppercase;
        color:var(--doc-tx4);background:var(--doc-paper2);border-bottom:1px solid var(--doc-line)}
      .esca-head span:not(:first-child),.esca-row .esca-v{text-align:right}
      /* Variante ANCHA — escalera del plazo: la tercera columna lleva un monto
         (interés total del crédito), no un porcentaje de 5 caracteres. */
      .esca.ancha .esca-head,.esca.ancha .esca-row{grid-template-columns:0.85fr 1.1fr 1.05fr}
      .esca-row{border-bottom:1px dotted var(--doc-line)}
      .esca-row:last-child{border-bottom:none}
      .esca-row.hoy{background:linear-gradient(90deg,color-mix(in srgb,var(--doc-warn) 12%,transparent),transparent 78%)}
      .esca-pie{font-family:var(--font-mono, ui-monospace);font-size:13px;font-weight:700;color:var(--doc-tx)}
      .esca-pie small{display:block;font-family:var(--font-body, sans-serif);font-size:10px;font-weight:400;
        color:var(--doc-tx4);margin-top:2px;letter-spacing:0}
      .esca-row.hoy .esca-pie small{color:var(--doc-tx3)}
      .esca-v{font-family:var(--font-mono, ui-monospace);font-size:12.5px;font-weight:700;color:var(--doc-tx);white-space:nowrap}
      .esca-v.neg{color:var(--signal-red)}
      .esca-v.pos{color:var(--doc-good)}
      .esca-v small{display:block;font-family:var(--font-body, sans-serif);font-size:10px;font-weight:400;
        color:var(--doc-tx4);margin-top:2px}
      .esca-foot{padding:10px 12px;font-size:11.5px;line-height:1.6;color:var(--doc-tx4);
        border-top:1px solid var(--doc-line);background:var(--doc-paper2)}

      /* ===== ESCENARIOS (rango con supuesto declarado) ===== */
      .esc{display:flex;flex-direction:column;gap:10px}
      .esc-row{display:grid;grid-template-columns:132px 1fr auto;align-items:center;gap:12px}
      .esc-k{font-size:12px;color:var(--doc-tx3);line-height:1.3}
      /* T3 — el wash va SIN margen negativo: -8px empujaba la grilla fuera del
         cuerpo y recortaba los valores del borde derecho (medido: 790 vs 782px). */
      .esc-row.base{background:linear-gradient(90deg,color-mix(in srgb,var(--doc-tx) 6%,transparent),transparent 72%);
        border-radius:3px;padding:6px 0}
      .esc-row.base .esc-k{color:var(--doc-tx);font-weight:600}
      .esc-k small{display:block;font-size:10px;color:var(--doc-tx4);margin-top:2px;line-height:1.35}
      .esc-track{height:15px;background:var(--doc-paper3);border-radius:2px;overflow:hidden}
      .esc-fill{height:100%;border-radius:2px}
      .esc-fill.pes{background:var(--signal-red)}
      .esc-fill.base{background:var(--doc-neutral)}
      .esc-fill.opt{background:var(--doc-good)}
      .esc-v{font-family:var(--font-mono, ui-monospace);font-size:12.5px;font-weight:700;color:var(--doc-tx);white-space:nowrap}
      .esc-foot{font-size:11.5px;line-height:1.6;color:var(--doc-tx4);margin-top:4px}

      /* ===== PAR DE BARRAS CON CONSECUENCIA ===== */
      .par{display:flex;flex-direction:column;gap:14px}
      .par-cap{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;
        color:var(--doc-tx4)}
      .par-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:5px}
      .par-k{font-size:12.5px;color:var(--doc-tx)}
      .par-cons{font-family:var(--font-mono, ui-monospace);font-size:12px;font-weight:700;color:var(--signal-red);white-space:nowrap}
      .par-bar{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px}
      .par-track{height:16px;background:var(--doc-paper3);border-radius:2px;overflow:hidden}
      .par-fill{height:100%;border-radius:2px;background:var(--doc-neutral)}
      .par-fill.alta{background:var(--signal-red)}
      .par-v{font-family:var(--font-mono, ui-monospace);font-size:12.5px;font-weight:700;color:var(--doc-tx);white-space:nowrap}

      @media (max-width: 767px){
        .fall-row{grid-template-columns:1fr 108px;gap:8px}
        .bar-row{grid-template-columns:88px 1fr auto;gap:8px}
        .bar-row .bk{font-size:11px}
        .spark{height:96px}
        .dial-zone{font-size:7px;letter-spacing:.04em}
        .dial-marklbl .v{font-size:11.5px}
        .dial-edge .d{font-size:11px}
        /* T3 · a 390px los dos bordes posicionados en % se pisaban (dial de precio):
           pasan a una fila flex con cada borde en su lado, sin coordenadas. */
        .dial-edges{position:static;height:auto;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-top:12px}
        .dial-edge{position:static;transform:none !important;left:auto !important;max-width:48%;white-space:normal}
        .dial-edge.arriba{text-align:right;margin-left:auto}
        .dial-edge .k{white-space:normal;line-height:1.35}
        .compo-leg-row{grid-template-columns:10px 1fr auto;gap:8px}
        .compo-k{font-size:12px}
        .compo-bracket{font-size:8px;letter-spacing:.04em}
        .par-top{flex-wrap:wrap;gap:2px}
        .pal-name{font-size:12.5px}
      }
    `,
      }}
    />
  );
}
