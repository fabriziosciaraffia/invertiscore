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
// Decisiones congeladas que implementa (variante «hallazgo»):
//  1. ACORDEÓN EXCLUSIVO — uno abierto a la vez.
//  2. Al abrir, ANCLA ARRIBA con scroll suave; el encabezado queda visible.
//  3. Cierre DOBLE — el encabezado sigue siendo toggle + botón "↑ Cerrar" al pie
//     (que además devuelve la fila al centro para no dejar al lector perdido).
//  5. Vocabulario único de 4 piezas (ver vocabulario.tsx).
//
// LA MUDANZA (23-sep-2026, variante «capitulo»): los once capítulos —cinco de LTR, seis
// de STR— dejan de expandirse en el mismo lugar y abren un POP-UP: el `Modal` de
// vocabulario.tsx, que es hoja desde abajo en teléfono y panel de 720 en escritorio. La
// fila no cambia (título, dato, disco «›»); el clic abre el modal con título, sub (la
// cifra apellidada y su ksub) y el cuerpo; salen el «↑ Cerrar» y el cuerpo inline. La
// apertura externa (`abrir`) y el enlace profundo (`#cap-…` al montar) abren el mismo
// modal, y la telemetría dispara en la apertura igual que antes. Motivo: medido el
// 22-sep, un cuerpo de 1.000-1.800 px expandido en la lista dejaba al lector sin fila
// a la vista y sin salida cerca; el pop-up de ajustes ya había resuelto el contenedor.
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
import { Modal } from "./vocabulario";

export type FilaHallazgo = {
  /** id del hallazgo (viaja en la telemetría). */
  id: string;
  /** Numeral del orden único ("01"…). */
  numero: string;
  /** La pregunta/resumen — la línea visible. */
  pregunta: string;
  /** Valor mono a la derecha (KPI del hallazgo). Acepta nodo porque con el rediseño la
   *  fila de capítulo lo lleva APELLIDADO —«Cap rate 4,3%»— y el apellido va en su
   *  propio span para poder pintarlo distinto. Los call sites de siempre siguen
   *  pasando un string. */
  valor: ReactNode;
  /** Sub-label del KPI (`findingDisplay().ksub`): la unidad y el contraste que el
   *  KPI solo no dice — "bajo la mediana de Ñuñoa · UF 78,4 vs UF 93,1 /m²".
   *  GOAL 16 (c): hasta acá `findingDisplay` lo construía y NINGUNA superficie lo
   *  renderizaba. El rediseño Dictamen reemplazó las cards de la pirámide por este
   *  acordeón y el sub-label quedó huérfano en el camino — medido sobre
   *  /analisis/1920fd35-… : "/m²" aparecía 0 veces en todo el DOM. El par
   *  sujeto-vs-mediana solo vivía dentro del párrafo IA del cuerpo 16, el mismo que
   *  este goal desarma; sin este consumidor el dato desaparecía del informe. */
  ksub?: ReactNode;
  /** El ⓘ del indicador de la cifra (23-sep-2026). Va SOLO en el sub del capítulo abierto: en
   *  la fila no, porque toda la fila abre el capítulo y un segundo blanco adentro competiría. */
  glosa?: ReactNode;
  /** El ksub del capítulo ABIERTO, cuando nombra indicadores y necesita sus ⓘ (el de la fila
   *  sigue siendo `ksub`, sin botones: la fila entera es un botón). */
  ksubAbierto?: ReactNode;
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
      if (esCapitulo) {
        // La puerta de los capítulos es el pop-up: la fila abre, el modal cierra.
        setAbierta(fila.id);
        medir(fila, indice);
        return;
      }
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
    [abierta, medir, esCapitulo],
  );

  // Apertura externa (capítulos): mismo camino que el tap, sin pasar por el botón.
  useEffect(() => {
    if (!abrir) return;
    const i = filas.findIndex((f) => f.id === abrir.id);
    const fila = filas[i];
    if (!fila || !fila.cuerpo) return;
    setAbierta(fila.id);
    medir(fila, i);
    if (esCapitulo) return;
    const t = setTimeout(() => {
      refs.current[fila.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrir?.id, abrir?.nonce]);

  // Enlace profundo (capítulos): al montar, si el hash coincide con el ancla de una fila,
  // se abre su pop-up. El scroll nativo al ancla ya lo hace el navegador; antes de esto
  // el lector aterrizaba en la fila cerrada y nada la abría.
  useEffect(() => {
    if (!esCapitulo || typeof window === "undefined") return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const i = filas.findIndex((f) => f.anchorId === hash);
    const fila = filas[i];
    if (!fila || !fila.cuerpo) return;
    setAbierta(fila.id);
    medir(fila, i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cerrarYVolver = useCallback((fila: FilaHallazgo) => {
    setAbierta(null);
    refs.current[fila.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  const cerrarCapitulo = useCallback(() => setAbierta(null), []);
  const filaAbierta = esCapitulo ? (filas.find((f) => f.id === abierta) ?? null) : null;

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
            className={`hall${esCapitulo ? " cap" : ""}${open && !esCapitulo ? " open" : ""}`}
          >
            <button
              type="button"
              className="hall-head"
              aria-expanded={esCapitulo ? undefined : open}
              aria-haspopup={esCapitulo ? "dialog" : undefined}
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
            {open && !esCapitulo && f.cuerpo && (
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

      {esCapitulo && (
        <Modal
          abierto={filaAbierta !== null}
          onClose={cerrarCapitulo}
          titulo={filaAbierta?.pregunta ?? ""}
          sub={
            filaAbierta ? (
              <>
                {filaAbierta.valor}
                {filaAbierta.glosa}
                {(filaAbierta.ksubAbierto ?? filaAbierta.ksub) && <> · {filaAbierta.ksubAbierto ?? filaAbierta.ksub}</>}
              </>
            ) : undefined
          }
        >
          {filaAbierta?.cuerpo}
        </Modal>
      )}

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
      /* EL PLUMÓN SE QUEDA EN LA PROSA Y SALE DEL CIERRE (17-sep-2026). Antes era UNA
         regla para los dos. Ver la neutralización explícita más abajo: sacar el cierre de
         este selector NO alcanza — lo dejaría sin regla propia y <mark> cae al AMARILLO
         por defecto del navegador, porque el repo no tiene reset global de mark. */
      .v-prosa mark{
        background:linear-gradient(transparent 60%,var(--doc-hl) 60%);
        color:var(--doc-hl-tx);padding:0 2px;font-weight:500}
      .v-viz{margin:0 0 18px}
      .v-viz-t{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
        color:var(--doc-tx4);margin-bottom:10px}
      /* ⛔ LA FORMA EDITORIAL SALIÓ (17-sep-2026). Era de cuando el informe era una
         revista: caja con fondo, barra roja de 3px, rótulo en versalita ROJA weight 700 y
         cuerpo en itálica. Tres cosas la mataron, y ninguna es estética:

         · EL ROJO ESTABA GASTADO. Cinco piezas del informe llevan barra roja y hacen tres
           trabajos distintos; una sola es alarma de verdad (el aviso de que falta el
           análisis STR). El precedente de esta decisión ya estaba escrito en este mismo
           archivo, cuatro líneas más abajo: «no Signal Red: un caveat no es una alarma».
         · DOS DE SUS CUATRO SEÑALES NO EXISTÍAN. Pedía --font-heading (Georgia, serif) y
           --font-mono, pero en el informe web los tres tokens de tipografía valen Inter
           (medido). O sea que el «serif itálico» era Inter itálica y la «versalita mono»
           era Inter.
         · Y EL RÓTULO INVERTÍA LA JERARQUÍA: gritaba en rojo weight 700 mientras el rótulo
           que nombra cada diagrama del mismo capítulo susurra en gris weight 400.

         El rótulo va a --doc-tx3, NO a --doc-tx4 como el de los diagramas. Igualarlos
         sonaba coherente y era una regresión medible: sobre los papeles del informe,
         --doc-tx4 da 2,15-2,33:1 y el cierre venía de Signal Red a 4,81:1. --doc-tx3 da
         4,06-4,40:1 en claro y 6,77:1 en oscuro. Que .v-viz-t esté en 2,2:1 es un
         problema real y de todos los diagramas, no de esta pieza: va en su propia cola. */
      .v-cierre{border-top:1px solid var(--doc-line);padding:12px 0 0;margin:18px 0 4px}
      .v-cierre .t{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
        color:var(--doc-tx3);font-weight:500;margin-bottom:7px}
      .v-cierre p{font-family:var(--font-body, system-ui);font-size:13.5px;line-height:1.65;
        color:var(--doc-tx2);max-width:58ch;margin:0}
      /* ⛔ NEUTRALIZADO, NO SACADO DEL SELECTOR. 19 de los 28 cierres pueden traer <mark>
         —por el motor vía SegsCierre, por plumonInline o escrito a mano en el JSX— y sin
         esta regla quedarían con el amarillo por defecto del navegador. */
      .v-cierre p mark{background:none;color:inherit;padding:0;font-weight:inherit}
      /* LA REGLA DEGRADADA SE RETIRA (17-sep-2026). Existía para que dos cierres apilados no
         dieran dos cajas: la primera perdía fondo y borde y pasaba a sans normal. Con la forma
         única NO HAY CAJA, así que todos los cierres son ya el caso degradado —su .t en gris
         y su p en sans normal eran literalmente esto—. Y no era solo redundante: pintaba un
         border-left gris que chocaría con la regla superior de arriba.
         Medido antes de sacarla: ningún capítulo apila dos cierres. El único apilamiento real
         estaba en DrawerPatrimonioStr, que se retiró el 17-sep-2026 por inalcanzable; los
         demás casos eran ramas de un ternario, donde solo una renderiza. O sea que hoy la
         regla no tendría ni un caso que atender. */
      .v-fuente{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.06em;color:var(--doc-tx4);margin-top:12px}
      /* «Cuánto renta» (21-sep-2026): la referencia en pesos al centro, el cruce con la zona y la
         banda del colchón. Geometría del mockup capitulo-i-cuanto-renta.html, tokens del acordeón. */
      .v-explica{font-size:12.5px;line-height:1.5;color:var(--doc-tx3);margin:-4px 0 10px}
      .v-centro{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:14px;background:var(--doc-paper2);border:1px solid var(--doc-line);border-radius:3px}
      .v-centro .k{font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--doc-tx4);margin-bottom:3px}
      .v-centro .n{font-family:var(--font-mono, ui-monospace);font-size:20px;font-weight:700;line-height:1.1;color:var(--doc-tx);letter-spacing:-.01em}
      .v-centro .n small{display:block;font-family:var(--font-sans, inherit);font-size:11px;font-weight:500;color:var(--doc-tx3);margin-top:3px;letter-spacing:0}
      .v-centro .fl{font-size:18px;color:var(--doc-tx3)}
      .v-centro .hoy .n{color:var(--doc-tx3)}
      @media (max-width:640px){.v-centro{grid-template-columns:1fr;gap:6px}.v-centro .fl{display:none}}
      .v-cruce{margin-top:12px;font-size:13px;line-height:1.5;color:var(--doc-tx2)}
      .v-cruce b{color:var(--doc-tx);font-weight:600}
      .v-cruce .neg{color:var(--signal-red);font-weight:600}
      .v-banda{margin-top:8px;font-size:11.5px;color:var(--doc-tx3)}
      .v-banda b{color:var(--doc-tx);font-weight:600}
      /* .v-fuente.aviso — cuando la procedencia deja de ser una nota al pie y pasa a ser
         una advertencia: el dato del que cuelga el capitulo no esta contrastado. Sube de
         --doc-tx4 (el gris mas apagado) al gris de cuerpo, gana el tamano de la prosa
         chica y toma un borde izquierdo de 3px en --doc-tx3 (el patron que usaba el bloque
         de regulacion STR, retirado el 11-sep-2026).
         SIN COLOR NUEVO y sin Signal Red a proposito: el rojo es del veredicto y de la
         cifra negativa, y este bloque acaba de dejar de usarlo para no decir dos cosas
         con el mismo color. Un caveat no es una alarma. */
      .v-fuente.aviso{font-size:11.5px;line-height:1.5;color:var(--doc-tx2);letter-spacing:0;
        border-left:3px solid var(--doc-tx3);padding:2px 0 2px 12px;margin-top:14px}
      .v-collapse{margin-top:18px;width:100%;background:none;border:1px dashed var(--doc-line2);border-radius:3px;padding:10px;
        font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
        color:var(--doc-tx3);cursor:pointer}
      .v-collapse:hover{color:var(--doc-tx);border-color:var(--doc-tx4)}

      /* ===== PRIMITIVAS DE DIAGRAMA ===== */
      /* T3 · capítulo V: la misma plata en otro lado + venta/refinanciamiento */
      .oport{margin-top:18px;padding:14px 16px;border:1px solid var(--doc-line);border-radius:3px;background:var(--doc-paper2)}
      .oport .bt{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--doc-tx4);margin-bottom:6px}
      .oport .nota{font-size:12px;line-height:1.6;color:var(--doc-tx3);margin:10px 0 0}
      .venta{display:grid;grid-template-columns:1fr 1fr;gap:26px}
      .venta h4{font-family:var(--font-heading, Georgia, serif);font-size:15px;font-weight:600;margin:0 0 4px;color:var(--doc-tx)}
      .venta .ex{font-size:12px;line-height:1.55;color:var(--doc-tx3);margin:0 0 8px}
      @media (max-width: 767px){ .venta{grid-template-columns:1fr;gap:18px} .hall.cap .num{font-size:20px} }
      /* .thermo-* se retiró el 22-sep-2026 con el Thermo (único consumidor: el III de STR); con él se fue
         el único degradado verde→ocre→rojo de las primitivas. */
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
      .tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:6px}
      .tbl{border-collapse:collapse;width:100%;min-width:390px}
      .tbl th{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;
        color:var(--doc-tx4);padding:8px 10px;text-align:right;border-bottom:1px solid var(--doc-line);font-weight:400}
      .tbl th:first-child{text-align:left}
      .tbl td{font-family:var(--font-mono, ui-monospace);font-size:12.5px;padding:9px 10px;text-align:right;
        border-bottom:1px solid var(--doc-line);color:var(--doc-tx)}
      .tbl td:first-child{text-align:left;font-family:var(--font-body, sans-serif);color:var(--doc-tx3);white-space:nowrap}
      .tbl tr.hl td{background:var(--doc-paper3)}
      .tbl tr.cruce td{border-top:2px solid var(--doc-tx)}
      .tbl-crucelbl{display:block;font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.08em;
        text-transform:uppercase;color:var(--doc-tx);padding-top:7px}
      .cell-neg{color:var(--signal-red)}
      .tbl-scrollcue{font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.1em;text-transform:uppercase;
        color:var(--doc-tx4);margin-bottom:16px}
      /* Pie de diagrama: el texto que describe el gráfico cuelga de él, no es un cierre. */
      .viz-pie{margin:-10px 0 18px;font-size:12.5px;line-height:1.7;color:var(--doc-tx3);max-width:62ch}
      /* El −10px de arriba existe para que el pie CUELGUE del diagrama (waterfall,
         cadena). Bajo un Thermo no sirve: su leyenda es de dos líneas y el pie se
         metía dentro de la fila de valores (el 3,0% central quedaba en el párrafo).
         Se neutraliza SOLO en ese vecindario, sin tocar los cuerpos donde funciona. */
      /* GOAL 16 (c) — sub-label del KPI en la fila del acordeón. Mono chico y en
         tx3 para que no compita con la pregunta: es la unidad del número de la
         derecha, no un segundo titular. */
      .hall-head .q .ksub{display:block;margin-top:3px;font-family:var(--font-mono, ui-monospace);font-size:10px;line-height:1.35;color:var(--doc-tx3);font-weight:400;letter-spacing:0.01em}
      .viz-pie b{color:var(--doc-tx2);font-weight:600}


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
      /* LAS ZONAS NOMBRAN UN VEREDICTO → LA TRÍADA (23-sep-2026). Pintaban ajusta en --doc-warn
         (ocre) y comprar en --doc-good (verde): el semáforo en una pieza que dice «Ajustar» y
         «Comprar». Con texto blanco la tríada da 5,28 · 7,83 · 7,50. */
      .dial-zone.buscar{background:var(--verdict-buscar)}
      .dial-zone.ajusta{background:var(--verdict-ajusta)}
      .dial-zone.comprar{background:var(--verdict-comprar)}
      .dial-mark{position:absolute;top:29px;height:32px;width:3px;border-radius:2px;background:var(--doc-tx);
        transform:translateX(-50%);z-index:2}
      .dial-tick{position:absolute;top:30px;width:1px;height:30px;background:var(--doc-tx);opacity:.55;z-index:3}
      /* fronteras en dos celdas estáticas (abajo · arriba): sin solapamiento en PC ni en 390 */
      .dial-edges{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}
      .dial-edge{font-family:var(--font-mono, ui-monospace);text-align:left;white-space:normal;min-height:1px}
      .dial-edge.arriba{text-align:right}
      .dial-edge .d{display:block;font-size:12px;font-weight:700;color:var(--doc-tx)}
      .dial-edge.abajo .d{color:var(--signal-red)}
      .dial-edge .v{display:block;font-size:11px;color:var(--doc-tx2);margin-top:2px}
      .dial-edge .k{display:block;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--doc-tx4);margin-top:3px;line-height:1.35}

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
      /* matriz de sensibilización: toggle (la grilla vive en TokensShared, .matriz) */
      .mx-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}
      .mx-toggle{display:inline-flex;border:1px solid var(--doc-line2);border-radius:4px;overflow:hidden}
      .mx-toggle button{font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:5px 11px;
        background:var(--doc-paper);color:var(--doc-tx3);border:none;cursor:pointer}
      .mx-toggle button+button{border-left:1px solid var(--doc-line2)}
      .mx-toggle button.on{background:var(--doc-tx);color:var(--doc-paper);font-weight:700}
      /* línea de tiempo */
      .tl{display:grid;align-items:start;gap:8px;margin:14px 0 6px}
      .hito{border-top:3px solid var(--doc-tx);padding-top:10px}
      .hito .k{font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--doc-tx3);display:block}
      .hito .d{font-size:11px;color:var(--doc-tx4);display:block;margin-top:1px}
      .hito .v{font-family:var(--font-mono, ui-monospace);font-size:15px;font-weight:700;color:var(--doc-tx);display:block;margin-top:6px}
      .tl-delta{align-self:center;text-align:center;font-family:var(--font-mono, ui-monospace);font-size:10.5px;color:var(--doc-tx2);padding:0 4px}
      .tl-delta b{display:block;font-size:12px;color:var(--doc-tx)}
      .tl-delta::before{content:'→';display:block;color:var(--doc-tx4);font-size:14px}
      .lectura{font-family:var(--font-heading, Georgia, serif);font-style:italic;font-size:14px;color:var(--doc-tx2);margin-top:12px;line-height:1.6}
      /* barra apilada (propuesta-04) */
      /* modal (overlay Ink 60%, panel 720px, pantalla completa en mobile) */
      /* El overlay toma --overlay dentro del informe: los dos overlays del
         informe usaban el mismo alfa sobre dos negros distintos, sin razon. */
      .doc-dictamen .v-modal-overlay{background:var(--overlay)}
      .v-modal-overlay{position:fixed;inset:0;background:rgba(20,19,17,.6);display:flex;align-items:center;justify-content:center;z-index:60;padding:20px}
      /* El modal declara su PROPIA escalera y no hereda la de la sección: cuelga del
         overlay, fuera del flujo, así que su papel es fijo y sus piezas tienen que
         medirse contra él. Es también la razón por la que las piezas del modal nunca
         se apilaron pese a pedir «--doc-paper2» a mano — algo que la auditoría de
         septiembre dio por apilado sin mirar el padre real. */
      .v-modal{
        --doc-inset-0:var(--doc-paper); --doc-inset-1:var(--doc-paper2); --doc-inset-2:var(--doc-paper3);
        width:100%;max-width:720px;max-height:92vh;overflow-y:auto;background:var(--doc-inset-0);border:1px solid var(--doc-line2);border-radius:4px;padding:26px 28px 24px;position:relative;color:var(--doc-tx)}
      .v-modal-asa{display:none}
      .v-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:6px}
      .v-modal-tit{min-width:0}
      .v-modal-head h3{font-family:var(--font-heading, Georgia, serif);font-size:22px;font-weight:700;line-height:1.2;margin:0}
      .v-modal-sub{font-size:13px;color:var(--doc-tx3);line-height:1.5;margin:6px 0 12px}
      .v-modal-cuerpo{min-width:0}
      .v-modal-x{background:none;border:1px solid var(--doc-line2);border-radius:4px;width:30px;height:30px;font-family:var(--font-mono, ui-monospace);font-size:14px;color:var(--doc-tx3);cursor:pointer;flex-shrink:0}
      .v-modal-x:hover{color:var(--doc-tx);border-color:var(--doc-tx4)}
      .v-modal-pie{margin-top:18px;padding-top:12px;border-top:1px solid var(--doc-line);font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.06em;color:var(--doc-tx4);line-height:1.5}
      /* El cuerpo inline de capítulo (.hall.cap .hall-body, .hall-end, .hall-close) se retiró el
         23-sep-2026: el capítulo abre en el Modal. */
      @media (max-width: 767px){
        .tl{grid-template-columns:1fr !important;gap:6px} .tl-delta::before{content:'↓'} .hito .v{font-size:14px}
        .ba-total .v{font-size:17px}
        /* LA HOJA (23-sep-2026, mockup docs/wireframes/rediseno-informe/hoja-mobile.html): desde
           abajo, deja 56 px del informe (el velo, tocable), radio arriba, asa, cabecera fija y el
           cuerpo como único scroll con overscroll contenido. El selector con [role] gana a
           .doc-dictamen .v-modal (border-radius) de la portada sin depender del orden. */
        .v-modal-overlay{padding:0;align-items:flex-end}
        .v-modal-overlay[role="dialog"] .v-modal{max-width:none;max-height:none;height:calc(100vh - 56px);height:calc(100dvh - 56px);
          border-radius:18px 18px 0 0;border:none;padding:0;display:flex;flex-direction:column;overflow:hidden;
          transition:transform .18s ease-out;animation:v-hoja-sube .22s ease-out}
        .v-modal-asa{display:block;flex:none;width:40px;height:4px;border-radius:2px;background:var(--doc-line2);margin:8px auto 0}
        .v-modal-head{flex:none;margin:0;padding:8px 16px 10px 20px;border-bottom:1px solid var(--doc-line);gap:12px;align-items:center}
        .v-modal-head h3{font-size:18px}
        .v-modal-sub{font-size:11.5px;margin:2px 0 0}
        .v-modal-x{width:32px;height:32px}
        .v-modal-cuerpo{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:16px 20px 24px}
      }
      @keyframes v-hoja-sube{from{transform:translateY(100%)}to{transform:translateY(0)}}
      @media (prefers-reduced-motion:reduce){.v-modal-overlay[role="dialog"] .v-modal{animation:none;transition:none}}
      .cmp-row{display:flex;flex-direction:column;gap:5px}
      .cmp-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:2px}
      .cmp-k{font-size:12.5px;color:var(--doc-tx)}
      .cmp-k small{display:block;font-size:10.5px;color:var(--doc-tx4);margin-top:1px}
      .cmp-tag{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;
        white-space:nowrap;padding:2px 6px;border-radius:2px}
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
      .esca-pie{font-family:var(--font-mono, ui-monospace);font-size:13px;font-weight:700;color:var(--doc-tx)}
      .esca-pie small{display:block;font-family:var(--font-body, sans-serif);font-size:10px;font-weight:400;
        color:var(--doc-tx4);margin-top:2px;letter-spacing:0}
      .esca-row.hoy .esca-pie small{color:var(--doc-tx3)}
      .esca-v{font-family:var(--font-mono, ui-monospace);font-size:12.5px;font-weight:700;color:var(--doc-tx);white-space:nowrap}
      .esca-v.neg{color:var(--signal-red)}
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
        .dial-zone{font-size:7px;letter-spacing:.04em}
        .dial-marklbl .v{font-size:11.5px}
        .dial-edge .d{font-size:11px}
        /* T3 · a 390px los dos bordes posicionados en % se pisaban (dial de precio):
           pasan a una fila flex con cada borde en su lado, sin coordenadas. */
        .dial-edges{gap:10px}
        .compo-leg-row{grid-template-columns:10px 1fr auto;gap:8px}
        .compo-k{font-size:12px}
        .compo-bracket{font-size:8px;letter-spacing:.04em}
        .par-top{flex-wrap:wrap;gap:2px}
      }
    `,
      }}
    />
  );
}
