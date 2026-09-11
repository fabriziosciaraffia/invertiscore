"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Portada del informe — concepto Dictamen (FASE 3; mockups v8/v9 congelados).
//
// UN componente para LTR y STR (decisión 21: mismo frame por construcción).
// Estructura: eyebrow (dirección · comuna · modalidad) → BANDA de veredicto
// full-bleed (ÚNICO lugar con color semántico — M2) → barra fina de score
// (fill en tinta) → titular serif con núcleo plumón → cifra clave (mono grande
// + caption de catálogo) → fila utilitaria (link ficha + toggle CLP/UF) → mapa
// de comparables SOLO desktop (columna 236px).
//
// Tokens `--doc-*` scoped al documento (paleta papel del mockup v8, light
// primario + paridad dark por concepto). El color semántico vive SOLO acá.
// Nomenclatura regla 25: "dictamen" jamás en strings de UI.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type ReactNode } from "react";
import { MapaThumbnail, type Comparable } from "@/components/formulario-v3/MapaThumbnail";
import { stripMarcas, normalizarMarcasTitular } from "@/lib/prosa-marcas";
import { captionDeCifraClave, type CifraClave } from "@/lib/cifra-clave";
import type { FichaDepto } from "@/lib/ficha-depto";
import { FichaModal } from "./FichaModal";
import { CLASE_REDISENO } from "@/lib/rediseno-flag";
import { useRediseno } from "@/components/analysis/RedisenoContexto";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";

// Etiqueta de la banda por veredicto. El COLOR ya no vive acá: sale de los tokens
// --verdict / --verdict-deep que DocTokens fija según `data-verdict` en la raíz del
// documento (goal "material del informe", 06-sep-2026; contrato docs/mockups/plumon-veredicto.html).
// Etiqueta (goal 10a, 07-sep-2026): la escritura vive en veredicto-etiqueta.ts; un
// veredicto que no sea de los tres cae a la etiqueta de AJUSTA, como antes.
const bandaLabelDe = (v: string): string => etiquetaVeredicto(v, "banda", etiquetaVeredicto("AJUSTA SUPUESTOS", "banda"));

/** EL SIGNO DEL BOTÓN DE VEREDICTO, como en la landing. Los glifos son los que ya usa
 *  `SectionObjections` —«✕ Una calculadora dice» / «✓ Franco te dice»— y el «−» es el
 *  mismo U+2212 con que la landing escribe sus negativos. No se inventa ninguno.
 *
 *  Cuelga del VEREDICTO y no de la etiqueta: la etiqueta es copy y puede cambiar; los
 *  tres veredictos son un enum cerrado. El fallback es el del escalón intermedio, igual
 *  que en `bandaLabelDe`. */
const SIGNO_VEREDICTO: Record<string, string> = {
  "BUSCAR OTRA": "✕",
  "AJUSTA SUPUESTOS": "−",
  COMPRAR: "✓",
};
const signoDe = (v: string): string => SIGNO_VEREDICTO[v] ?? SIGNO_VEREDICTO["AJUSTA SUPUESTOS"];

/** Titular con marcas `**…**` → <mark> plumón. Normaliza defensivamente
 *  (marcas rotas en prosa persistida: sin plumón o con el primer par — el
 *  escalón del guard ya persiste limpio, esto cubre filas raras). */
function renderTitular(titular: string): ReactNode {
  const partes = normalizarMarcasTitular(titular).split(/(\*\*[^*]+\*\*)/g);
  return partes.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <mark key={i}>{p.slice(2, -2)}</mark> : <span key={i}>{p}</span>,
  );
}

function fmtCifra(cifra: CifraClave, moneda: "CLP" | "UF"): string {
  if (cifra.tipo === "pct") return `${cifra.valorPct.toLocaleString("es-CL")}%`;
  const signo = cifra.signo < 0 ? "-" : "+";
  if (moneda === "UF") {
    const uf = Math.round(cifra.valorUf * 10) / 10;
    return `${signo}UF ${uf.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  }
  return `${signo}$${cifra.valorClp.toLocaleString("es-CL")}`;
}

export function PortadaInforme({
  veredicto,
  score,
  direccion,
  comuna,
  modalidadLabel,
  fecha,
  titular,
  cifra,
  ficha,
  currency,
  onCurrencyChange,
  mapa,
  onAjustarSupuestos,
}: {
  veredicto: string;
  score: number | null;
  direccion: string;
  comuna: string;
  /** "Renta larga" | "Renta corta" — el eyebrow declara la modalidad. */
  modalidadLabel: string;
  /** Fecha corta para el header del documento ("26 ago 2026"). */
  fecha: string;
  /** Titular v10/v7 CRUDO (con `**…**`) — acá el plumón se pinta de verdad.
   *  null/ausente (prosa vieja o descartado): la portada carga sin titular. */
  titular?: string | null;
  /** Cifra clave del motor (derivación runtime); null = sin cifra. */
  cifra: CifraClave | null;
  ficha: FichaDepto;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  /** Mapa de comparables (solo desktop). null = sin coords → columna no se renderiza. */
  mapa: { lat: number; lng: number; comparables: Comparable[]; count: number; label: string } | null;
  onAjustarSupuestos?: () => void;
}) {
  const [fichaOpen, setFichaOpen] = useState(false);
  const bandaLabel = bandaLabelDe(veredicto);
  const scorePct = Math.max(0, Math.min(100, score ?? 0));

  const rediseno = useRediseno();

  return (
    <section className={`doc-portada${rediseno ? " doc-hero" : ""}`} data-verdict={veredicto}>
      {/* LA CAPA DE FONDO VA APARTE Y EL FILTRO VIVE EN ELLA (contrato §3): si el
          `filter` se aplicara a la sección, se lo comería también el texto. Y el
          espectro NO depende del veredicto — es el mismo siempre. El grano va en su
          propia capa encima, con su modo de fusión. */}
      {rediseno && (
        <>
          <div className="doc-hero-bg" aria-hidden="true" />
          <div className="doc-hero-grain" aria-hidden="true" />
        </>
      )}
      {rediseno ? (
        /* Eyebrow del contrato: identidad a la izquierda, modalidad a la derecha. */
        <div className="doc-hero-eyebrow">
          {/* SOLO DIRECCIÓN Y COMUNA. La tipología («2D · 1B») y la superficie («55 m²»)
              salieron: ya viven en la ficha del depto, y acá no decían nada que la
              ficha no dijera mejor. Medido antes de sacarlas: iban en texto plano,
              peso 400 y la misma opacidad que el resto — el único resalte del eyebrow
              es, y era, el <b> de la dirección. */}
          <span className="doc-hero-eyebrow-l">
            <b>{direccion || comuna}</b>
            {direccion && comuna && <><i>·</i>{comuna}</>}
          </span>
          {/* LA MODALIDAD PESA: negrita y un punto más que el eyebrow (§3). */}
          <span className="doc-hero-modalidad">{modalidadLabel}</span>
        </div>
      ) : (
        /* Eyebrow — la dirección deja de ser H1 (decisión 8) */
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] mb-4" style={{ color: "var(--doc-tx3)" }}>
          <b className="font-medium" style={{ color: "var(--doc-tx2)" }}>{direccion || comuna}</b>
          {direccion && (
            <>
              <span className="mx-2" style={{ color: "var(--doc-tx4)" }}>·</span>
              {comuna}
            </>
          )}
          <span className="mx-2" style={{ color: "var(--doc-tx4)" }}>·</span>
          {modalidadLabel}
          <span className="mx-2" style={{ color: "var(--doc-tx4)" }}>·</span>
          {fecha}
        </div>
      )}

      {rediseno ? (
        /* EL BOTÓN REEMPLAZA A LA BANDA, y la banda NO se borra: `PortadaInforme` lo
           monta también STR (`renta-corta/[id]/results-client.tsx`), y el OG dibuja su
           propio degradado. Se deja de montar solo acá, solo con el interruptor. */
        <p className="doc-hero-verdict" aria-label={`Veredicto: ${bandaLabel}`}>
          <span className="doc-hero-pill">
            <span className="doc-hero-dot" aria-hidden="true" />
            {/* El signo no se lee: el `aria-label` del <p> ya dice el veredicto entero,
                y un lector de pantalla que anuncie «equis» antes del rótulo lo empeora. */}
            <span className="doc-hero-signo" aria-hidden="true">{signoDe(veredicto)}</span>
            {bandaLabel}
          </span>
        </p>
      ) : (
        /* Banda de veredicto — full-bleed del documento, único color semántico */
        <div className="doc-banda" aria-label={`Veredicto: ${bandaLabel}`}>
          <span className="doc-banda-band">{bandaLabel}</span>
        </div>
      )}

      {rediseno ? (
        /* Score en TEXTO PLANO. La barra de bloques se retira del hero: sobre el
           espectro compite con el botón, que es lo que tiene que mirarse primero. */
        <p className="doc-hero-score">Franco Score {score ?? "—"} de 100</p>
      ) : (
        /* Score = barra de bloques llenos bajo la banda, en el color del veredicto
            (contrato: "▓▓▓░░"). Diez bloques de 10 puntos; muere la barra fina Ink. */
        <div className="flex items-center gap-3 max-w-[420px] mb-5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] whitespace-nowrap" style={{ color: "var(--doc-tx3)" }}>
            Franco Score
          </span>
          <div className="flex-1 flex gap-[3px]" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className="flex-1 h-[6px] rounded-[1px]"
                style={{ background: i < Math.round(scorePct / 10) ? "var(--verdict)" : "var(--doc-score-empty)" }}
              />
            ))}
          </div>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] whitespace-nowrap" style={{ color: "var(--doc-tx3)" }}>
            <b style={{ color: "var(--doc-tx)" }}>{score ?? "—"}</b>/100
          </span>
        </div>
      )}

      {/* Grid portada: contenido + mapa (mapa solo PC) */}
      <div className="doc-cover-grid">
        <div className="min-w-0">
          {titular && (
            <h1 className="doc-headline">{renderTitular(titular)}</h1>
          )}
          {/* UN SOLO PARRAFO CON EL MONTO ADENTRO — no dos columnas.
              Historia corta: era `flex-wrap` con la glosa como span rigido, asi que
              o cabia entera en la linea del monto o saltaba ENTERA a un bloque
              debajo. El primer arreglo la hizo envolver (`min-w-0 flex-1`), pero en
              390px seguia leyendose como parrafo aparte: al ser una COLUMNA de flex,
              sus lineas 2 y 3 volvian al margen de esa columna —alineadas entre si,
              a la derecha del monto— y el ojo las leia como otro bloque.
              Ahora es UN parrafo y el monto es un `<span>` INLINE: el texto arranca a
              su lado y las lineas siguientes envuelven por debajo, como si el monto
              fuera la primera palabra de la frase. La baseline sale gratis —estan en
              la misma linea de texto— y no hay que alinearla a mano.
              El catalogo de glosas es cerrado (6) y va de 321px a 503px en una sola
              linea; el ancho disponible manda cuantas lineas ocupa. */}
          {cifra && (
            <p className="doc-keyfig">
              <span className="doc-keyfig-fig">{fmtCifra(cifra, currency)}</span>{" "}
              <span className="doc-keyfig-cap">{captionDeCifraClave(cifra)}</span>
            </p>
          )}
          {/* Línea de utilidades: link ficha + toggle CLP/UF (decisión e del PARÁ 0) */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <button type="button" className="doc-props-link" onClick={() => setFichaOpen(true)}>
              🏢 Ficha del depto evaluado →
            </button>
            {/* LOS COLORES DEL TOGGLE SON INLINE, así que una regla CSS no los puede
                pisar: sobre el espectro hay que cambiarlos acá. Mismo tratamiento que el
                botón de veredicto —blanco translúcido y anillo, no un bloque sólido— y
                la opción activa se distingue por opacidad, no por otro color. */}
            <div
              className={`inline-flex overflow-hidden shrink-0 ${rediseno ? "doc-cur-toggle" : "rounded-md"}`}
              style={rediseno ? undefined : { border: "1px solid var(--doc-line2)" }}
              role="group"
              aria-label="Moneda"
            >
              {(["CLP", "UF"] as const).map((c) => {
                const on = currency === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onCurrencyChange(c)}
                    aria-pressed={on}
                    className="font-mono text-[10px] font-medium tracking-[0.06em] px-2.5 py-1 transition-colors"
                    style={
                      rediseno
                        ? { background: on ? "rgba(255,255,255,.18)" : "transparent", color: on ? "#fff" : "rgba(255,255,255,.6)" }
                        : { background: on ? "var(--doc-tx)" : "transparent", color: on ? "var(--doc-paper)" : "var(--doc-tx3)" }
                    }
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mapa comparables — SOLO desktop (decisión 7) */}
        {mapa && (
          <div className="doc-mapcol">
            <MapaThumbnail
              lat={mapa.lat}
              lng={mapa.lng}
              comparables={mapa.comparables}
              comparablesCount={mapa.count}
              locationLabel={mapa.label}
              height={210}
            />
          </div>
        )}
      </div>

      <FichaModal ficha={ficha} open={fichaOpen} onClose={() => setFichaOpen(false)} onAjustar={onAjustarSupuestos} />

      {/* aria: el titular plano para lectores cuando hay marcas */}
      {titular && <span className="sr-only">{stripMarcas(titular)}</span>}
    </section>
  );
}

/**
 * Marco de documento (mockup v8): papel + regla superior Signal 5px + header
 * (wordmark · "Análisis · fecha") + footer (tagline · wordmark). Envuelve la
 * portada Y el contenido existente del informe — FASE 4 transforma el interior.
 */
/** `secciones` (T2, contrato CONGELADO): la página alterna secciones a sangre y
 *  cada una gobierna su propio aire vertical, así que `.doc-page` suelta el padding
 *  vertical y conserva solo el horizontal, contra el que las secciones sangran. STR
 *  no lo pasa y queda idéntico. */
/** `veredicto` (goal "material del informe"): fija `data-verdict` en la raíz, de donde
 *  DocTokens deriva --verdict / --verdict-deep para la banda, los plumones y la barra de
 *  score. Sin veredicto (AMBAS) los tokens caen a Ink. */
/** `rediseno`: SOLO LTR lo pasa. STR queda con el informe de hoy hasta que tenga su
 *  propia pasada — encender un rediseño en un informe que nadie diseñó es exactamente
 *  lo que el interruptor vino a evitar (contrato §11). Ver `rediseno-flag.ts` para los
 *  tres pasos de retiro cuando STR llegue. */
export function DocumentoFrame({ children, secciones = false, veredicto, rediseno = false }: { children: ReactNode; secciones?: boolean; veredicto?: string; rediseno?: boolean }) {
  return (
    <div className={`doc-dictamen ${rediseno ? CLASE_REDISENO : ""}`.trim()} data-verdict={veredicto}>
      <DocTokens />
      <div className="doc-toprule" aria-hidden="true" />
      <div className="doc-head">
        <Wordmark />
        {/* Sin fecha acá: vive en el eyebrow (decisión d del PARÁ 0 — folio sin №). */}
        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em]" style={{ color: "var(--doc-tx4)" }}>
          Análisis
        </span>
      </div>
      <div className={`doc-page${secciones ? " doc-page--secciones" : ""}`}>{children}</div>
      <div className="doc-foot">
        <span>Real estate en su estado más franco</span>
        <Wordmark small />
      </div>
    </div>
  );
}

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className={`doc-wordmark inline-flex items-baseline leading-none font-heading ${small ? "text-[11px]" : "text-[16px]"}`}>
      <em className="italic font-normal" style={{ color: "var(--doc-tx3)", marginRight: "-0.05em" }}>re</em>
      <span className="font-bold" style={{ color: "var(--doc-tx)" }}>franco</span>
      <span className="font-body font-semibold" style={{ color: "var(--signal-red)", fontSize: "0.55em", letterSpacing: "0.08em", marginLeft: 1 }}>.ai</span>
    </span>
  );
}

/** Tokens del documento — paleta papel (mockup v8), light primario + paridad dark.
 *  dangerouslySetInnerHTML: un template literal como children se serializa con
 *  comillas escapadas en SSR y crudas en cliente → hydration mismatch (misma
 *  clase que el style de zona2Aparece). Con innerHTML ambos lados son idénticos. */
export function DocTokens() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      /* AUDITORÍA fase42 (9) — los tokens también viven en .doc-tokens: los
         DRAWERS (vías, STR) montan FUERA de .doc-dictamen y todo estilo --doc-*
         de sus cuerpos (matriz de palancas incluida) resolvía a nada en silencio.
         El wash del degradado lo hizo visible; el hueco venía de FASE 4.1. */
      .doc-dictamen,.doc-tokens{
        /* dark (default del app: data-theme ausente) */
        --doc-paper:#141414; --doc-paper2:#1B1B1B;
        --doc-line:#282828; --doc-line2:#3A3A3A;
        --doc-tx:#EDEBE6; --doc-tx2:#C4C2BC; --doc-tx3:#8C8A84; --doc-tx4:#5C5A55;
        /* plumón OSCURO (tríada Tinta, 07-sep-2026): se ACLARA el color antes de
           aplicarlo en vez de subirle el alfa. Sobre papel #141414 un color oscuro al
           32% se hunde — medido, la marca quedaba en 1,25:1 contra el papel, o sea
           invisible. Aclarado 25% hacia blanco y aplicado al 40%, la marca sube a
           1,69-1,90:1 y el texto encima se queda sobre 8:1. Todo en srgb: el repo no
           usa oklab en ninguna parte y la diferencia con oklab es de centésimas.
           Sin veredicto cae a Ink porque --verdict cae a Ink. */
        --doc-hl:color-mix(in srgb,color-mix(in srgb,var(--verdict),white 25%) 40%,transparent); --doc-hl-tx:var(--doc-tx);
        /* bloques vacíos de la barra de score: solo en oscuro bajan a la línea del
           papel para que la barra sea el veredicto y no una fila de casilleros. */
        --doc-score-empty:#282828;
        --doc-paper3:#232323; --doc-neutral:#6E6A63; --doc-good:#57B98A; --doc-warn:#DFA34F;
        /* CUARTO NIVEL (10-sep-2026) — existe para que una sección «p2» conserve DOS
           escalones hacia adentro. Sin él la escalera miente en la mitad de las
           secciones. El valor no se eligió a ojo: continúa el paso perceptual de la
           rampa (ΔL* 3,82 desde paper3, contra 3,45 y 3,95 de los pasos anteriores). */
        --doc-paper4:#2B2B2B;
        --doc-shadow:0 24px 60px rgba(0,0,0,.6);
        /* grano de papel: tile SVG 300px, NO filtro en vivo (contrato plumon-veredicto.html) */
        --doc-grain:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
      }
      /* ═══ COLOR POR VEREDICTO ═══ El bloque [data-verdict] se mudó a
         src/app/globals.css (07-sep-2026, camino B): la landing necesita los mismos
         tokens fuera del informe, y tenerlos en dos hojas era tener dos fuentes. Acá
         no queda ninguna definición — el catch-test del QUICK falla si vuelve. */
      /* grano sobre todo el documento: oscuro soft-light .12 (mockup oscuro aprobado),
         claro multiply .10 (contrato). Encima del contenido, sin capturar el mouse. */
      .doc-dictamen::after{content:"";position:absolute;inset:0;pointer-events:none;
        background-image:var(--doc-grain);background-size:300px;opacity:.12;mix-blend-mode:soft-light}
      [data-theme="light"] .doc-dictamen::after{opacity:.10;mix-blend-mode:multiply}
      @media print{.doc-dictamen::after,.doc-banda-band::after{display:none}}
      .doc-dictamen{
        background:var(--doc-paper);
        border:1px solid var(--doc-line);
        box-shadow:var(--doc-shadow);
        position:relative;
      }
      [data-theme="light"] .doc-dictamen,[data-theme="light"] .doc-tokens{
        --doc-paper:#FAF8F3; --doc-paper2:#F1EEE7;
        --doc-line:#DAD6CC; --doc-line2:#C4BFB2;
        --doc-tx:#141311; --doc-tx2:#3B3A36; --doc-tx3:#75726A; --doc-tx4:#A39F94;
        /* claro: el plumón NO cambia — 32% sobre papel claro da 1,63-1,67:1 de marca
           y 10,5:1 de texto encima. El aclarado es un arreglo del papel oscuro. */
        --doc-hl:color-mix(in srgb,var(--verdict) 32%,transparent); --doc-hl-tx:var(--doc-tx);
        /* la barra de score en claro se queda como estaba */
        --doc-score-empty:var(--doc-line2);
        /* semáforo del DATO (Dial, Thermo, matriz): verde y ámbar propios, y se quedan.
           Hasta el 06-sep valían los mismos hexes que la tríada de veredicto para no
           tener dos verdes ni dos ámbares en la página; con la tríada Tinta
           (07-sep-2026) la tríada dejó de ser verde y ámbar, así que esa razón murió y
           los valores se quedan donde están: el Dial mide un DATO en un eje ordinal,
           no un veredicto, y ahí verde y ámbar son la lectura convencional. En oscuro
           conservan sus variantes claras por contraste sobre #141414. */
        --doc-paper3:#EAE7DF; --doc-neutral:#8C8880; --doc-good:#2E8B57; --doc-warn:#B7791F;
        /* el cuarto nivel en claro: ΔL* 2,82 desde paper3, dentro del rango de los
           pasos que ya existían (3,45 y 2,48). */
        --doc-paper4:#E2DFD7;
        --doc-shadow:0 24px 60px rgba(20,19,17,.14);
      }
      /* ═══════════════ REDISEÑO · SOMBRAS Y OVERLAY (contrato §1) ═══════════════
         «Sombra solo en las dos cajas y en el hover de capítulos. Ninguna otra pieza
         lleva sombra.» Las dos cajas y las filas de capítulo son de la parte 4, así que
         acá se definen los dos valores y esperan, igual que --rad.

         EL INFORME CASI NO USA SOMBRAS, y conviene decirlo porque el inventario engaña:
         hay cuatro box-shadow en total y TRES no son sombras. Dos son anillos «inset»
         —o sea bordes— del «hoy» de la matriz, y el tercero marca la columna pegajosa de
         la tabla, que es una señal de scroll y no decoración. La única sombra real es la
         del marco .doc-dictamen, y esa queda huérfana cuando la parte 4 convierta el
         hero y la recomendación en cajas. Se retira ALLÁ, no acá: mientras el marco
         exista, su sombra es lo que lo separa del fondo de la página.

         --overlay ES UN TOKEN NUEVO, y no es una sombra. Los dos overlays de modal del
         informe usaban el mismo alfa .6 sobre DOS negros distintos —rgba(10,10,10) y
         rgba(20,19,17)— sin ninguna razón: el mismo rol pintado de dos maneras. Un solo
         token cierra eso. La trama rayada a 45° de las barras (el tercer rgba literal)
         NO entra: no es sombra ni overlay, es textura, y funciona con cualquier paleta
         porque va sobre --doc-line2. */
      .doc-r2,
      .doc-r2 .doc-dictamen,
      .doc-r2 .doc-tokens{
        --sombra:0 1px 2px rgba(0,0,0,.5); --sombra-h:0 2px 8px rgba(0,0,0,.6);
        --overlay:rgba(12,12,14,.72);
      }
      [data-theme="light"] .doc-r2,
      [data-theme="light"] .doc-r2 .doc-dictamen,
      [data-theme="light"] .doc-r2 .doc-tokens{
        --sombra:0 1px 2px rgba(0,0,0,.05),0 10px 30px rgba(0,0,0,.07);
        --sombra-h:0 2px 5px rgba(0,0,0,.07),0 14px 32px rgba(0,0,0,.10);
        --overlay:rgba(24,24,27,.55);
      }
      .doc-r2 .doc-ficha-overlay{background:var(--overlay)}

      /* ═══════════════ REDISEÑO · ESTRUCTURA (contrato §2) ═══════════════
         SOLO DOS SECCIONES LLEVAN CAJA —borde redondo, sombra, fondo propio—: el hero y
         la recomendación. El resto va suelto sobre el papel, separado por espacio y no
         por color. Ésa es la diferencia con la estructura de hoy, donde TODAS las
         secciones son bloques de color alternado a sangre.

         LA ALTERNANCIA MUERE ACÁ. Las secciones sueltas dejan de pintar fondo y de
         sangrar el padding: se apoyan en --page y se separan con 38 px. Las dos cajas
         llevan 34. El andamio de --doc-inset NO se retira —lo sigue usando el camino de
         prosa vieja, que es permanente para 453 filas anónimas— pero en el camino nuevo
         deja de tener trabajo, porque ya no hay dos tonos que alternar.

         Y SE VA EL MARCO ENTERO. §2 pide «página blanca, dos cajas y nada más», así que
         no se retira solo la sombra: el fondo, el borde, la barra roja, la cabecera con
         el wordmark y el pie con el tagline. La marca vive en el chrome de la app y el
         informe no la repite — repetirla convertía el informe en un documento impreso
         dentro de la pantalla, que es justo la metáfora que el rediseño abandona.

         SE OCULTAN, NO SE BORRAN DEL JSX: «DocumentoFrame» lo monta también STR, que
         conserva su marco completo. Las dos formas del selector por lo de siempre —en
         producción las clases van pegadas, en la ruta dev envuelve—.

         El grano del marco («.doc-dictamen::after») también se va: el rediseño tiene el
         suyo en el hero y en la recomendación, y dos granos superpuestos no son un
         grano más fuerte, son ruido. */
      .doc-r2.doc-dictamen,
      .doc-r2 .doc-dictamen{
        background:none;border:none;box-shadow:none}
      /* Y EL LIENZO DE LA PÁGINA, un nivel más afuera. Retirado el marco, lo que queda
         detrás del informe es el gris de la app, y §2 pide la página entera del color
         del papel. Sobre ese lienzo, las tarjetas «--card» son lo único con superficie.

         LA CLASE LA PONE LA RUTA DEL ANÁLISIS LTR, solo ésa. STR tiene su propio wrapper
         y no la lleva; el resto de la app conserva su fondo.

         DECLARA «--page» Y NADA MÁS, y por eso no reusa «.doc-r2»: esa clase trae los
         doce tokens del informe, y «--card» es también un token de shadcn —«40 20% 98%»,
         en HSL—. Puesta en el wrapper le cambiaba el valor a todo el chrome de la página,
         y «bg-card» pasaba a resolver «hsl(#F4F4F6)», que es inválido. Medido en el DOM.

         EL «body» VA POR «:has» porque el wrapper no puede pintarlo: es su ancestro. Hoy
         el wrapper cubre el documento entero —medido: 7727 px los dos— así que el gris
         del body solo asoma en el rebote del scroll, pero asomar en un rebote sigue
         siendo asomar. Los dos selectores comparten la declaración para que el valor
         viva UNA sola vez. */
      .doc-lienzo,
      body:has(.doc-lienzo){--page:#0C0C0E;background:var(--page)}
      [data-theme="light"] .doc-lienzo,
      [data-theme="light"] body:has(.doc-lienzo){--page:#FFFFFF}
      .doc-r2.doc-dictamen::after,
      .doc-r2 .doc-dictamen::after{display:none}
      .doc-r2 .doc-toprule,
      .doc-r2 .doc-head,
      .doc-r2 .doc-foot{display:none}
      /* Sin cabecera ni pie, el padding del marco deja de tener sentido: la página es la
         página. */
      .doc-r2 .doc-page{padding:0}
      @media (max-width: 767px){ .doc-r2 .doc-page{padding:0} }
      /* «.doc-sec.p2» tiene la misma especificidad que «.doc-r2 .doc-sec» y gana por
         orden, asi que la seccion alternada conservaba su fondo. Con «.p2» en el
         selector se resuelve, y de paso queda explicito que la alternancia muere. */
      .doc-r2 .doc-sec,
      .doc-r2 .doc-sec.p2{
        margin:0;padding:0;background:none;
        margin-bottom:38px}
      .doc-r2 .doc-sec:last-child{margin-bottom:0}
      /* las dos cajas */
      .doc-r2 .doc-sec--caja,
      .doc-r2 .doc-sec--caja.p2{
        border-radius:var(--rad);overflow:hidden;box-shadow:var(--sombra);
        background:var(--card);margin-bottom:34px}
      /* el ancho del contrato */
      .doc-r2 .doc-page--secciones{max-width:700px;margin:0 auto}

      /* ═══════════════ REDISEÑO · LAS CIFRAS (contrato §6) ═══════════════
         La rejilla de filete pasa a tarjetas. Hoy «.nums» son seis celdas pegadas por
         una línea de 1 px sobre un borde común: se lee como una tabla, y una tabla se
         recorre entera. El contrato pide tarjetas separadas por aire, que se leen de a
         una y permiten saltarse las que no importan.

         DOS COLUMNAS, NO TRES. Con tres columnas la traducción de cada cifra —que es lo
         que hace entendible el número— cabe en dos o tres palabras por línea. A dos
         columnas la traducción respira, y en móvil baja a UNA sola.

         LO QUE NO CAMBIA: el markup. «.nums», «.num-cell» y sus «.k/.v/.tr» son los
         mismos que ya emite «SeisCifras», que es una pieza COMPARTIDA con STR. Todo esto
         cuelga de «.doc-r2», y STR no lo recibe (ver «rediseno-flag.ts»): si se tocara el
         JSX, el interruptor no alcanzaría para dejar a STR quieto.

         Y NO REACCIONAN AL HOVER, que es la parte que parece un olvido y no lo es: las
         tarjetas de cifra no abren nada —«div.num-cell» sin onClick, verificado— y esa
         diferencia con la fila navegable ES información (contrato §9). Lo único
         clickeable de la sección es «Ver cómo se calcula», que ya es «.doc-lnk». */
      .doc-r2 .nums{grid-template-columns:repeat(2,1fr);gap:11px;background:none;border:0}
      .doc-r2 .num-cell{background:var(--card);border-radius:var(--rad-s);padding:17px}
      /* El rótulo deja el versalitas espaciado: a 13 px se lee como lo que es —el nombre
         de la cifra— y no como el encabezado de una columna de tabla. */
      .doc-r2 .num-cell .k{
        font-size:13px;letter-spacing:normal;text-transform:none;
        color:var(--tx3);margin-bottom:9px}
      .doc-r2 .num-cell .v{font-size:29px;letter-spacing:-.02em}
      .doc-r2 .num-cell .v small{font-size:12.5px;color:var(--tx3)}
      /* La traducción sube un escalón de contraste —era «--tx3»— porque a dos columnas
         deja de ser un pie de celda y pasa a ser la mitad de la tarjeta que se lee. El
         «<b>» conserva su papel: un escalón más que su cuerpo, ahora «--tx». */
      .doc-r2 .num-cell .tr{font-size:13px;line-height:1.5;color:var(--tx2);margin-top:9px}
      .doc-r2 .num-cell .tr b{color:var(--tx);font-weight:600}
      .doc-r2 .nums-foot{margin-top:14px}
      @media (max-width: 767px){
        .doc-r2 .nums{grid-template-columns:1fr}
        .doc-r2 .num-cell .v{font-size:25px}
      }

      /* ═══════════════ REDISEÑO · EL HERO (contrato §3) ═══════════════
         EL HERO DEL CONTRATO ES LA PORTADA, no la sección que el código llama «hero».
         §3 lista eyebrow, botón de veredicto, score, titular con plumón y cifra clave:
         eso es «.doc-portada». Lo que el código llama «hero» es la prosa IA más la
         recomendación. En 4a le puse la caja a la sección equivocada leyendo el nombre
         en vez del contenido; acá se corrige y la caja pasa a la portada, que es la
         primera de las dos del contrato.

         EL FILTRO VA EN UNA CAPA APARTE Y NUNCA SOBRE EL TEXTO. «filter» crea un
         contexto de apilado y afecta a todo el subárbol: aplicado a la sección, el
         «brightness(1.10)» se comería también el titular y el botón. Por eso el
         espectro vive en «.doc-hero-bg», que es un hermano absoluto detrás del
         contenido, y el grano en otra capa encima de ella.

         EL FONDO NO DEPENDE DEL VEREDICTO. Es el mismo espectro para los tres. La
         tríada sigue viva donde corresponde —el botón— y nada más.

         EL GRANO, MEDIDO SOBRE ESTE FONDO Y NO SOBRE EL VIEJO. Método: el mismo árbol
         con el grano apagado al lado, misma «background-position», y se restan los dos
         píxel a píxel — la resta ES el control. Amplitud = desviación estándar de esa
         diferencia, sobre la media del tile:

           overlay .05   0,288   0,83%
           overlay .08   0,282   0,82%
           overlay .12   0,513   1,53%     ← lo que decía el contrato antes
           overlay .16   0,639   1,94%     ← el valor de este bloque

         El «~2% del claro» que se usó de objetivo NO EXISTE: en tema claro el grano
         mide 0,00%, y no es fallo del instrumento — «soft-light» es un no-op cuando el
         fondo es blanco puro (Cb=1 da 1 para cualquier fuente). El valor queda en una
         sola constante para que moverlo sea una línea. */
      /* «.doc-sec .doc-portada» —que ya existía para matar el borde y el margen de la
         portada dentro de una sección— tiene la MISMA especificidad que «.doc-r2
         .doc-hero» y va después en el archivo, así que se llevaba puesto el
         «padding-bottom». Medido: 34px 32px 0px en vez de 30 abajo. Con «.doc-sec» en
         el selector gana el rediseño; el borde y el margen los sigue matando ella. */
      .doc-r2 .doc-sec .doc-hero{position:relative;isolation:isolate;overflow:hidden;
        border-radius:var(--rad);padding:34px 32px 30px;color:#fff}
      .doc-r2 .doc-hero-bg{
        position:absolute;inset:0;z-index:0;pointer-events:none;
        background:linear-gradient(135deg,#0F2440 0%,#2E1C28 50%,#4E1119 100%);
        filter:brightness(1.10) saturate(.90)}
      .doc-r2 .doc-hero-grain{
        position:absolute;inset:0;z-index:1;pointer-events:none;
        background-image:var(--doc-grain);background-size:300px;
        opacity:.16;mix-blend-mode:overlay}
      /* «:not(.sr-only)» NO es prolijidad. «.sr-only» se esconde con «clip», y «clip»
         SOLO aplica a elementos posicionados en absoluto: al forzarles «position:
         relative» para subirlos sobre el grano, la copia para lectores de pantalla del
         titular se volvía VISIBLE debajo de la caja. Se ve en los primeros shots. */
      .doc-r2 .doc-hero > *:not(.doc-hero-bg):not(.doc-hero-grain):not(.sr-only){position:relative;z-index:2}

      /* — EL EYEBROW — identidad a la izquierda, modalidad a la derecha. En móvil se
           apila, que es lo único que el contrato pide para este ancho. */
      .doc-r2 .doc-hero-eyebrow{
        display:flex;justify-content:space-between;align-items:baseline;gap:12px;
        font-size:12px;line-height:1.4;opacity:.6;margin:0 0 18px}
      .doc-r2 .doc-hero-eyebrow b{font-weight:600}
      .doc-r2 .doc-hero-eyebrow i{font-style:normal;margin:0 7px;opacity:.7}
      /* La modalidad es el otro extremo del eyebrow y tiene que sostenerlo: un punto
         más (13 px contra 12) y en negrita. */
      .doc-r2 .doc-hero-modalidad{font-size:13px;font-weight:700}

      /* — EL BOTÓN DE VEREDICTO — píldora del color del veredicto con anillo blanco.
           El anillo va en «box-shadow» y no en «border» para no mover la caja. */
      .doc-r2 .doc-hero-verdict{margin:0 0 14px}
      .doc-r2 .doc-hero-pill{
        display:inline-flex;align-items:center;gap:9px;
        padding:8px 16px 8px 13px;border-radius:var(--rad-pill);
        background:var(--verdict);color:#fff;
        font-family:var(--font-mono, ui-monospace);font-size:12.5px;font-weight:700;
        letter-spacing:.14em;text-transform:uppercase;
        box-shadow:0 0 0 2px rgba(255,255,255,.3)}
      /* EL PUNTO QUE LATE. El punto en sí es opaco; lo que late es su «::after», que
         crece y se desvanece — así el punto no desaparece entre pulsos. */
      /* EL SIGNO DEL VEREDICTO. Va antes del rótulo y no lo empuja: el «gap» de la
         píldora ya separa, así que solo se le quita el «letter-spacing» —que en un
         glifo suelto deja un hueco a la derecha— y se le da su propio tamaño. */
      .doc-r2 .doc-hero-signo{
        font-size:14px;line-height:1;letter-spacing:normal;margin-right:-2px}
      .doc-r2 .doc-hero-dot{
        position:relative;width:7px;height:7px;border-radius:50%;background:#fff;flex:none}
      .doc-r2 .doc-hero-dot::after{
        content:"";position:absolute;inset:0;border-radius:50%;background:#fff;
        animation:docHeroLate 1.8s ease-out infinite}
      @keyframes docHeroLate{
        0%{transform:scale(.6);opacity:.6}
        100%{transform:scale(2.1);opacity:0}
      }
      /* OBLIGATORIO por contrato: sin esto el punto late para siempre en la cara de
         alguien que pidió que nada se mueva. */
      @media (prefers-reduced-motion:reduce){
        .doc-r2 .doc-hero-dot::after{animation:none;opacity:0}
      }

      /* — EL SCORE EN TEXTO PLANO — */
      .doc-r2 .doc-hero-score{
        font-family:var(--font-mono, ui-monospace);font-size:12.5px;letter-spacing:.06em;
        opacity:.75;margin:0 0 20px}

      /* — EL TITULAR — 30 px, peso 600, y el plumón BLANCO al 26%.
           NO se repunta «--doc-hl»: ese token lo usan también las marcas de prosa de
           las secciones, que van sobre papel y con blanco quedarían invisibles. El
           blanco vive acotado a este titular y a nada más. */
      .doc-r2 .doc-hero .doc-headline{
        font-size:30px;font-weight:600;line-height:1.18;color:#fff;margin:0 0 14px}
      .doc-r2 .doc-hero .doc-headline mark{
        background:linear-gradient(transparent 60%, rgba(255,255,255,.26) 60%);
        color:#fff}
      /* La cifra clave y su caption se conservan; sobre el espectro cambian de tinta. */
      .doc-r2 .doc-hero .doc-keyfig-fig{color:#fff}
      .doc-r2 .doc-hero .doc-keyfig-cap{color:rgba(255,255,255,.7)}
      .doc-r2 .doc-hero .doc-props-link{color:rgba(255,255,255,.75)}
      /* EL MAPA Y EL TOGGLE no están en §3 y quedaban con su tinta de papel sobre el
         espectro: la tarjeta gris clara y el chip blanco se leían como dos parches. Van
         con el resto del hero —texto blanco— y el toggle recibe el MISMO tratamiento
         que el botón de veredicto: fondo blanco translúcido y anillo, no un bloque
         sólido. La opción activa se distingue por opacidad, no por color. */
      /* EL MAPA: su tarjeta viene de «MapaThumbnail», que se pinta con los tokens de la
         app («--franco-card», «--franco-border») porque también vive en el wizard. Sobre
         el espectro quedaba como un parche gris claro. Se reapunta desde acá —no se
         toca el componente, que es compartido— y el texto va en blanco como el resto. */
      .doc-r2 .doc-hero .doc-mapcol > div{
        background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.22)}
      .doc-r2 .doc-hero .doc-mapcol span,
      .doc-r2 .doc-hero .doc-mapcol svg{color:rgba(255,255,255,.75)}
      /* El toggle lleva su forma acá; los COLORES van inline en el JSX, porque los del
         camino de siempre también lo son y una regla no los podría pisar. */
      .doc-r2 .doc-hero .doc-cur-toggle{
        border-radius:var(--rad-pill);box-shadow:0 0 0 1px rgba(255,255,255,.22);
        background:rgba(255,255,255,.06)}

      @media (max-width: 767px){
        .doc-r2 .doc-hero{padding:26px 20px 24px;border-radius:var(--rad)}
        .doc-r2 .doc-hero-eyebrow{flex-direction:column;align-items:flex-start;gap:4px}
        .doc-r2 .doc-hero .doc-headline{font-size:25px}
      }

      /* ═══════════════ REDISEÑO · LOS CAPÍTULOS (contrato §7) ═══════════════
         SE MONTA «.fila-nav», la primitiva que la parte 3 definió y dejó sin usar. La
         fila de capítulo deja de ser una línea con un romano gigante y pasa a ser una
         tarjeta navegable: fondo propio, radio, la cifra a la derecha y el disco del
         chevron. La rejilla es «1fr auto auto» — pregunta, cifra, disco.

         LA PUERTA NO CAMBIA. Los capítulos NO abren un pop-up: son un acordeón que
         expande «.hall-body» en el mismo lugar, con su «↑ Cerrar» al pie. Eso queda
         igual. Lo que cambia es la FILA, no adónde lleva, y por eso el chevron sigue
         girando al abrirse en vez de apuntar a la derecha.

         MUEREN LOS NÚMEROS ROMANOS (§7 los nombra explícitamente). El romano ocupaba
         46 px de ancho y competía con la cifra, que es el dato que hace la lista útil
         sin abrir nada.

         EL «:focus-visible» NO SE PIERDE. «.hall-head» ya lo tenía antes del rediseño y
         el catch-test de la parte 3 lo fija; acá se le agrega el de «.fila-nav» con el
         mismo anillo. Es exactamente lo que una reescritura de la fila deja caer. */
      .doc-r2 .hall.cap{border-bottom:none;margin-bottom:9px}
      .doc-r2 .hall.cap .hall-head{
        background:var(--card);padding:16px 17px;border-radius:var(--rad-s);
        border:1px solid transparent;display:grid;grid-template-columns:1fr auto auto;
        gap:0 15px;align-items:center;
        transition:box-shadow .13s,border-color .13s,transform .13s}
      .doc-r2 .hall.cap .hall-head:not([disabled]):hover{
        padding-left:17px;border-color:var(--line2);box-shadow:var(--sombra-h);transform:translateY(-1px)}
      .doc-r2 .hall.cap .hall-head:focus-visible{outline:2px solid var(--signal-red);outline-offset:2px}
      /* El romano sale de la fila; se oculta en vez de borrarse del JSX porque la misma
         pieza la monta STR, que conserva su numeración. */
      .doc-r2 .hall.cap .num{display:none}
      .doc-r2 .hall.cap .q{
        font-family:var(--font-heading, Georgia, serif);font-size:15.5px;font-weight:600;
        color:var(--tx);line-height:1.35}
      /* SIN BAJADA (§7): la fila es titulo y cifra. El «ksub» explica el numero —«de los
         $750.000 del arriendo, despues de cuota, gastos y vacancia»— y eso es el cuerpo
         del capitulo, no la fila. Con la cifra ya apellidada, la fila se lee sola. No se
         borra del JSX: la pieza la monta tambien STR, que lo conserva. */
      .doc-r2 .hall.cap .ksub{display:none}
      .doc-r2 .hall.cap .val{
        font-family:var(--font-mono, ui-monospace);font-size:14px;font-weight:700;
        color:var(--tx);font-variant-numeric:tabular-nums;white-space:nowrap}
      /* EL APELLIDO es contexto, no cifra: va mas liviano y sin el mono, para que el
         numero siga siendo lo que el ojo agarra primero. */
      .doc-r2 .hall.cap .val-ap{
        font-family:inherit;font-size:12.5px;font-weight:500;color:var(--tx3)}
      /* EL DISCO del chevron: el mismo de «.fila-nav», que al hover se llena. */
      /* EL DISCO LLEVA «›», no la flecha hacia abajo. El «↓» del acordeon dice «esto se
         despliega»; el «›» dice «esto lleva a algo», que es lo que la primitiva de fila
         navegable promete. El caracter del JSX se oculta con «font-size:0» en vez de
         cambiarse, porque esa pieza la monta tambien STR. Al abrirse gira 90 grados y
         vuelve a apuntar hacia abajo, que es adonde efectivamente se abrio. */
      .doc-r2 .hall.cap .chev{
        width:32px;height:32px;border-radius:50%;display:flex;align-items:center;
        justify-content:center;background:var(--page);border:1px solid var(--line2);
        color:var(--tx3);font-size:0;line-height:1;
        transition:background .13s,border-color .13s,color .13s,transform .2s}
      .doc-r2 .hall.cap .chev::after{content:"›";font-size:17px;line-height:1}
      .doc-r2 .hall.cap.open .chev{transform:rotate(90deg)}
      .doc-r2 .hall.cap .hall-head:not([disabled]):hover .chev{
        background:var(--tx);border-color:var(--tx);color:var(--page)}
      .doc-r2 .hall.cap.open .hall-head{border-color:var(--line2)}
      .doc-r2 .hall.cap .hall-body{padding:14px 17px 20px}
      .doc-r2 .chapters-eyebrow{border-bottom:none;padding-bottom:6px}
      @media (max-width: 767px){
        .doc-r2 .hall.cap .hall-head{padding:14px 14px;gap:0 11px}
        .doc-r2 .hall.cap .hall-head:not([disabled]):hover{padding-left:14px}
        .doc-r2 .hall.cap .q{font-size:14.5px}
        .doc-r2 .hall.cap .hall-body{padding:12px 14px 18px}
      }
      @media (prefers-reduced-motion:reduce){
        .doc-r2 .hall.cap .hall-head{transition:none}
        .doc-r2 .hall.cap .hall-head:not([disabled]):hover{transform:none}
      }

      /* ═══════════════ REDISEÑO · LA RECOMENDACIÓN (contrato §5) ═══════════════
         ES LA ÚNICA PIEZA CUYO FONDO DEPENDE DEL VEREDICTO. El hero usa el mismo
         espectro para los tres precisamente para que esta caja pueda no hacerlo: si las
         dos cambiaran de color, el color dejaría de significar algo. Acá va del tono
         profundo del veredicto a tinta.

         EL FILTRO EN SU CAPA, igual que en el hero: sobre la caja se comería el texto.

         LA ECUACIÓN ES UNA REJILLA DE DOS COLUMNAS con el rótulo a 96 px fijos (78 en
         móvil) pegado al margen. Fijo y no «auto» a propósito: con «auto» cada fila
         alinea su valor en un sitio distinto según el largo del rótulo, y la columna de
         valores deja de leerse como una columna.

         LO QUE SE CAMBIA VA TACHADO Y TRANSPARENTE; LO NUEVO, SÓLIDO. Es lo que hace
         legible el movimiento sin leer: el ojo salta a lo sólido. */
      .doc-r2 .rec-card{
        position:relative;isolation:isolate;overflow:hidden;
        border-radius:var(--rad);padding:28px 30px 26px;color:#fff;
        box-shadow:var(--sombra)}
      .doc-r2 .rec-bg{
        position:absolute;inset:0;z-index:0;pointer-events:none;
        background:linear-gradient(135deg,var(--verdict-deep) 0%,#18181B 100%);
        filter:brightness(1.30) saturate(.70)}
      .doc-r2 .rec-grain{
        position:absolute;inset:0;z-index:1;pointer-events:none;
        background-image:var(--doc-grain);background-size:300px;
        opacity:.16;mix-blend-mode:overlay}
      .doc-r2 .rec-card > *:not(.rec-bg):not(.rec-grain):not(.sr-only){position:relative;z-index:2}

      .doc-r2 .rec-t{font-size:22px;font-weight:700;line-height:1.25;margin:0}
      .doc-r2 .rec-sub{font-size:14px;line-height:1.45;opacity:.62;margin:5px 0 20px}

      /* — LA ECUACIÓN — */
      .doc-r2 .rec-eq{margin:0 0 20px}
      /* LA COLUMNA DE RÓTULOS pasa de 96 a 128 px. Los rótulos dejaron de ser de una
         palabra —«Solo el arriendo» es el más largo— y a 96 envolvía en dos líneas. 128
         es lo medido para que entre en una sola a 700. En móvil se deja envolver: a 390
         el ancho se lo lleva el valor, que es lo que hay que leer. */
      .doc-r2 .rec-row{
        display:grid;grid-template-columns:128px 1fr;gap:14px;align-items:baseline;
        padding:13px 0;border-top:1px solid rgba(255,255,255,.14)}
      .doc-r2 .rec-row:first-child{border-top:none;padding-top:0}
      .doc-r2 .rec-k{
        font-family:var(--font-mono, ui-monospace);font-size:11.5px;letter-spacing:.1em;
        text-transform:uppercase;opacity:.5;line-height:1.5}
      .doc-r2 .rec-v{display:block;font-size:15px;line-height:1.45}
      .doc-r2 .rec-v > b{font-weight:700}
      .doc-r2 .rec-v > em{display:block;font-style:normal;font-size:13px;opacity:.62;margin-top:3px}

      /* los chips del cambio */
      .doc-r2 .rec-chips{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .doc-r2 .rec-chip{
        display:inline-flex;align-items:baseline;gap:6px;
        padding:6px 12px;border-radius:var(--rad-pill);
        background:rgba(255,255,255,.10);box-shadow:0 0 0 1px rgba(255,255,255,.18);
        font-family:var(--font-mono, ui-monospace);font-size:13px;white-space:nowrap}
      .doc-r2 .rec-chip s{opacity:.45;text-decoration:line-through}
      .doc-r2 .rec-chip b{font-weight:700}
      /* EL GRUPO QUE NO ROMPE: el chip y su «+» viajan juntos, asi el salto de linea
         cae DESPUES del signo y nunca antes. Suelto, a 390 px el «+» quedaba solo
         arriba del segundo chip, sumando con la nada. */
      .doc-r2 .rec-chip-g{display:inline-flex;align-items:center;gap:10px;white-space:nowrap}
      .doc-r2 .rec-mas{font-style:normal;opacity:.5;font-size:15px}

      /* EL DESCUENTO VIVE DENTRO DE «Con lo tuyo», no en una fila propia. Plegado, así
         que ya no es un bloque: va en línea con los chips, detrás de su flecha. Baja de
         30 a 22 px por lo mismo que no subía de 30 antes — en una fila compartida, a 30
         se come los chips que tiene al lado. */
      .doc-r2 .rec-dcto-g{display:inline-flex;align-items:baseline;gap:9px;white-space:nowrap}
      .doc-r2 .rec-dcto{
        font-family:var(--font-mono, ui-monospace);font-size:22px;font-weight:700;
        line-height:1.1;letter-spacing:-.02em}
      .doc-r2 .rec-dcto small{font-size:12.5px;font-weight:500;opacity:.62;letter-spacing:normal}
      .doc-r2 .rec-sin{font-size:14px;font-weight:600}
      .doc-r2 .rec-contra{
        display:block;font-style:normal;font-family:var(--font-mono, ui-monospace);
        font-size:13px;opacity:.72;margin-top:5px}
      .doc-r2 .rec-contra s{opacity:.55;text-decoration:line-through}
      .doc-r2 .rec-contra b{font-weight:700;opacity:1}

      /* la transición de veredicto */
      .doc-r2 .rec-trans{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .doc-r2 .rec-pill{
        padding:5px 13px;border-radius:var(--rad-pill);
        font-family:var(--font-mono, ui-monospace);font-size:11.5px;font-weight:700;
        letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}
      .doc-r2 .rec-pill.de{background:rgba(255,255,255,.12);opacity:.45}
      .doc-r2 .rec-pill.a{background:#fff;color:#18181B}
      .doc-r2 .rec-fl{font-style:normal;opacity:.5}

      .doc-r2 .rec-ctx{font-size:13px;opacity:.62;margin:0 0 14px}
      .doc-r2 .rec-desc{font-size:13px;opacity:.62;margin:14px 0 0}
      /* EL PUENTE del estado sin salida: mas presente que el descarte —es lo unico
         accionable que queda— pero sin competir con el numero de arriba. */
      .doc-r2 .rec-puente{font-size:14px;line-height:1.5;opacity:.82;margin:14px 0 0}
      /* DÓNDE SÍ (§5). Va pegada al puente —es su respuesta, no otro párrafo— y con
         más presencia que él: el puente dice que no hay salida acá, y ésta dice a
         dónde ir, que es lo único accionable que le queda al lector. Sin cifras. */
      .doc-r2 .rec-donde{font-size:15px;line-height:1.45;font-weight:600;margin:8px 0 0}
      /* el costo del día uno: SIEMPRE bajo el mix (§5) */
      .doc-r2 .rec-cost{font-size:13.5px;opacity:.75;margin:16px 0 0}

      /* — EL DETALLE DE LA ALTERNATIVA, en el pop-up — la línea de la card nombra
           dos comunas; acá se rinde cuentas de todas las que cruzan, con su muestra. */
      .doc-r2 .alt-com{margin:22px 0 0;padding:18px 0 0;border-top:1px solid var(--doc-line)}
      .doc-r2 .alt-com-t{font-family:var(--font-mono, ui-monospace);font-size:10px;
        letter-spacing:.16em;text-transform:uppercase;color:var(--doc-tx3);margin:0 0 8px}
      .doc-r2 .alt-com-l{font-size:13.5px;line-height:1.5;color:var(--doc-tx2);margin:0 0 14px}
      .doc-r2 .alt-com-tabla{width:100%;border-collapse:collapse;font-size:13px}
      .doc-r2 .alt-com-tabla th{font-family:var(--font-mono, ui-monospace);font-size:10px;
        letter-spacing:.12em;text-transform:uppercase;color:var(--doc-tx3);font-weight:500;
        text-align:right;padding:0 0 8px}
      .doc-r2 .alt-com-tabla th:first-child{text-align:left}
      .doc-r2 .alt-com-tabla td{padding:9px 0;border-top:1px solid var(--doc-line);
        text-align:right;color:var(--doc-tx);white-space:nowrap}
      .doc-r2 .alt-com-tabla td:first-child{text-align:left;white-space:normal}
      .doc-r2 .alt-com-tabla small{display:block;font-size:10.5px;color:var(--doc-tx3);
        letter-spacing:0;margin-top:2px}

      /* — EL CTA — botón BLANCO SÓLIDO con icono, no un enlace (§5) — */
      .doc-r2 .rec-cta{
        display:inline-flex;align-items:center;gap:10px;
        padding:12px 20px;border-radius:var(--rad-pill);border:none;cursor:pointer;
        background:#fff;color:#18181B;
        font-size:14px;font-weight:600;letter-spacing:normal;
        transition:transform .12s,box-shadow .12s}
      .doc-r2 .rec-cta:hover{box-shadow:var(--sombra-h)}
      .doc-r2 .rec-cta:active{transform:translateY(1px)}
      .doc-r2 .rec-cta:focus-visible{outline:2px solid #fff;outline-offset:3px}
      .doc-r2 .rec-cta-ico{font-size:10px;line-height:1;opacity:.65}

      @media (max-width: 767px){
        .doc-r2 .rec-card{padding:22px 18px 20px}
        .doc-r2 .rec-row{grid-template-columns:78px 1fr;gap:10px}
        .doc-r2 .rec-dcto{font-size:26px}
        .doc-r2 .rec-t{font-size:19px}
      }
      @media (prefers-reduced-motion:reduce){
        .doc-r2 .rec-cta{transition:none}
        .doc-r2 .rec-cta:active{transform:none}
      }

      /* ═══════════════ REDISEÑO · LA ZONA (contrato §8) ═══════════════
         Tres tarjetas, MISMO ESTILO QUE LAS CIFRAS —el contrato lo dice así—, pero con
         una jerarquía propia: qué es, TU valor, la referencia, la píldora con la
         diferencia y una línea de contexto. El arriendo va primero.

         LAS TARJETAS NO REACCIONAN, igual que las de cifra: no abren nada. Lo único
         clickeable de la sección es «Ver los comparables», que es «.doc-lnk».

         LAS PÍLDORAS USAN EL PAR DIRECCIONAL, no colores nuevos: «--signal-red» cuando
         el dato empeora tu caso y «--up» cuando lo mejora, las dos con fondo al 12% como
         pide el contrato. La neutra va en gris. Ojo con la dirección: en dos de las tres
         tarjetas «más» es PEOR —pagar más por m², declarar un arriendo por encima de lo
         que la zona publica— y en la valorización «más» es mejor. El color lo decide el
         SENTIDO, no el signo.

         EL PIE COMÚN ES UNA PIEZA, no un pie de tarjeta: ahí vive el caveat del período
         de la valorización, que es de las tres y no de una. */
      .doc-r2 .zona-cards{
        display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-top:18px}
      .doc-r2 .zc{
        background:var(--card);border-radius:var(--rad-s);padding:17px;
        display:flex;flex-direction:column;align-items:flex-start;gap:0}
      .doc-r2 .zc-k{font-size:13px;line-height:1.35;color:var(--tx3);margin:0 0 9px}
      .doc-r2 .zc-v{
        font-family:var(--font-mono, ui-monospace);font-size:26px;font-weight:700;
        line-height:1;letter-spacing:-.02em;color:var(--tx);margin:0;
        font-variant-numeric:tabular-nums}
      .doc-r2 .zc-r{font-size:13px;line-height:1.4;color:var(--tx3);margin:7px 0 0;min-height:18px}
      .doc-r2 .zc-s{font-size:12.5px;line-height:1.45;color:var(--tx2);margin:10px 0 0}
      .doc-r2 .zc-s b{color:var(--tx);font-weight:600}
      /* la píldora */
      .doc-r2 .zp{
        display:inline-block;margin-top:9px;padding:3px 9px;border-radius:var(--rad-pill);
        font-size:12px;font-weight:600;line-height:1.35;white-space:nowrap}
      .doc-r2 .zp-mal{color:var(--signal-red);background:color-mix(in srgb,var(--signal-red) 12%,transparent)}
      .doc-r2 .zp-bien{color:var(--up);background:color-mix(in srgb,var(--up) 12%,transparent)}
      .doc-r2 .zp-neu{color:var(--tx3);background:color-mix(in srgb,var(--tx3) 12%,transparent)}
      /* el pie común de las tres */
      .doc-r2 .zona-caveat{
        font-size:12px;line-height:1.5;color:var(--tx3);margin:13px 0 0}
      .doc-r2 .zona-foot{margin-top:13px}
      @media (max-width: 767px){
        .doc-r2 .zona-cards{grid-template-columns:1fr}
        .doc-r2 .zc-v{font-size:23px}
      }

      /* ═══════════════ REDISEÑO · LAS TRES PRIMITIVAS (contrato §9) ═══════════════
         Tres niveles de affordance, y la diferencia entre ellos ES información:

           BOTÓN            fondo sólido, icono circular, sombra, baja 1 px al presionar
           FILA NAVEGABLE   levanta 1 px, gana borde y sombra, el disco se llena
           ENLACE           subrayado al 35% que se satura, con flecha
           y NO REACCIONAN  tarjeta de cifra, tarjeta de zona, fila de hallazgo

         LA REGLA DE LO QUE NO REACCIONA NO ES UN OLVIDO, y está verificada en el código:
         las tarjetas de cifra son «div.num-cell» sin onClick y las de zona son
         «div» dentro de «.zona-cells», también sin handler. No reaccionan porque NO
         ABREN NADA. Lo único clickeable de esas dos secciones es su enlace al pie, que
         sí es un botón. Si alguna vez tienen que abrir algo, eso es estructura y
         decisión de producto, no un hover que falta.

         DOS DE LAS TRES YA EXISTEN Y SE REAPUNTAN, NO SE DUPLICAN: «.doc-btn» (1 uso, en
         PosicionFranco) y «.doc-lnk» (3 usos, en SeisCifras, ZonaLtr y ZonaStrSection).
         Los dos ya son «button type=button», así que la semántica estaba bien; lo que
         les faltaba era la forma del contrato.

         LA FILA NAVEGABLE SE DEFINE Y NO SE MONTA. La pieza del contrato —fila de
         capítulo con disco y chevron— no existe todavía: hoy la navegación de capítulos
         es «.hall-head», que es un acordeón. La clase queda lista para que la parte 4 la
         use, y así el rediseño no inventa una estructura antes de tiempo.

         EL FOCO NO ES OPCIONAL. Cada primitiva declara «:focus-visible» con el mismo
         anillo, porque el hover no existe en teclado ni en táctil. «.hall-head» ya lo
         tenía; acá se le da a las otras dos y el catch-test lo fija, porque es
         exactamente lo que una reescritura de la parte 4 puede perder sin que se note. */

      /* — BOTÓN — */
      .doc-r2 .doc-btn{
        gap:10px;font-size:14px;font-weight:600;padding:13px 20px;letter-spacing:normal;
        text-transform:none;box-shadow:var(--sombra);
        transition:transform .12s,box-shadow .12s,filter .12s}
      .doc-r2 .doc-btn:hover{filter:none;box-shadow:var(--sombra-h)}
      .doc-r2 .doc-btn:active{transform:translateY(1px)}
      .doc-r2 .doc-btn::before{
        content:"";width:20px;height:20px;border-radius:50%;flex:none;
        background:var(--page);
        -webkit-mask:radial-gradient(circle,#000 99%,transparent) center/100% 100% no-repeat;
        mask:radial-gradient(circle,#000 99%,transparent) center/100% 100% no-repeat}

      /* — ENLACE — el subrayado vive SIEMPRE, y al hover se satura. Antes aparecía
           recién al hover, o sea que en reposo no se distinguía de un rótulo. */
      .doc-r2 .doc-lnk{
        display:inline-flex;align-items:center;gap:8px;
        font-size:13.5px;font-weight:600;letter-spacing:normal;text-transform:none;
        padding-bottom:2px;text-decoration:none;
        border-bottom:1.5px solid color-mix(in srgb,var(--signal-red) 35%,transparent)}
      .doc-r2 .doc-lnk:hover{text-decoration:none;border-bottom-color:var(--signal-red)}
      /* SIN FLECHA PROPIA. Los tres usos ya la traen en su texto («Ver cómo se calcula
           →», «Ver los comparables →»), así que un «::after» que la agrega dibuja DOS.
           Medido en el DOM: textContent «Ver cómo se calcula →» + ::after content "→".
           La del texto se queda; la del pseudo-elemento se va. */

      /* — FILA NAVEGABLE — definida, sin montar. La parte 4 la usa. */
      .doc-r2 .fila-nav{
        background:var(--card);padding:16px 17px;cursor:pointer;display:grid;
        grid-template-columns:1fr auto auto;gap:0 15px;align-items:center;
        border-radius:var(--rad-s);border:1px solid transparent;width:100%;text-align:left;
        color:inherit;transition:box-shadow .13s,border-color .13s,transform .13s}
      .doc-r2 .fila-nav:hover{border-color:var(--line2);box-shadow:var(--sombra-h);transform:translateY(-1px)}
      .doc-r2 .fila-nav .disco{
        width:32px;height:32px;border-radius:50%;display:flex;align-items:center;
        justify-content:center;background:var(--page);border:1px solid var(--line2);flex:none;
        color:var(--tx3);font-size:15px;font-weight:700;line-height:1;
        transition:background .13s,border-color .13s,color .13s}
      .doc-r2 .fila-nav:hover .disco{background:var(--tx);border-color:var(--tx);color:var(--page)}

      /* — EL FOCO, para las tres — */
      .doc-r2 .doc-btn:focus-visible,
      .doc-r2 .doc-lnk:focus-visible,
      .doc-r2 .fila-nav:focus-visible{outline:2px solid var(--signal-red);outline-offset:2px}

      @media (prefers-reduced-motion:reduce){
        .doc-r2 .doc-btn,.doc-r2 .fila-nav,.doc-r2 .fila-nav .disco{transition:none}
        .doc-r2 .doc-btn:active,.doc-r2 .fila-nav:hover{transform:none}
      }

      /* ═══════════════ REDISEÑO · RADIOS (contrato §1) ═══════════════
         Cuatro radios del contrato más uno que el contrato no tenía.

         POR QUÉ HACE FALTA UN QUINTO. El contrato define «--rad» 16 para cajas,
         «--rad-s» 12 para tarjetas y filas, «--rad-xs» 10 para chips y 99 para píldoras.
         Pero 19 de las 52 declaraciones de radio del informe son TRACKS Y FILLS DE
         BARRA, de 6 a 16 px de alto: un radio de 12 sobre una barra de 14 la convierte
         en píldora y deja de leerse como una escala. «--rad-bar» congela los 2 px que ya
         funcionan y deja escrito que las barras no participan de la escala de tarjetas.

         Y POR ESO LAS BARRAS NO LLEVAN REGLA ACÁ: ya valen 2 px. El token existe para
         nombrar la decisión y para que la parte 4 tenga de dónde tomarlo, no para
         reescribir 19 reglas que no cambian.

         «--rad» no se aplica a nada todavía: las dos cajas —hero y recomendación— son de
         la parte 4. Se define y espera. */
      .doc-r2,
      .doc-r2 .doc-dictamen,
      .doc-r2 .doc-tokens{
        --rad:16px; --rad-s:12px; --rad-xs:10px; --rad-pill:99px; --rad-bar:2px;
      }
      /* contenedores */
      .doc-r2 .pos-card,
      .doc-r2 .oport,
      .doc-r2 .colchon,
      .doc-r2 .esca,
      .doc-r2 .compo,
      .doc-r2 .ba-compo,
      .doc-r2 .v-collapse,
      .doc-r2 .lqhy-mix{border-radius:var(--rad-s)}
      /* chips */
      .doc-r2 .lqhy-chip,
      .doc-r2 .pos-chip,
      .doc-r2 .ba-mult{border-radius:var(--rad-xs)}
      /* píldoras y controles */
      .doc-r2 .doc-btn,
      .doc-r2 .mx-toggle,
      .doc-r2 .v-modal-x{border-radius:var(--rad-pill)}
      /* el panel del modal es una caja */
      .doc-r2 .v-modal{border-radius:var(--rad)}

      /* ═══════════════ REDISEÑO · PALETA (contrato §1) ═══════════════
         Los papeles cálidos pasan a los neutros fríos del contrato. TRES niveles de
         superficie —page, card, sunk— más las dos líneas.

         SE PUBLICAN LOS NOMBRES DEL CONTRATO Y SE REAPUNTAN LOS VIEJOS. Los 522 usos de
         «--doc-*» del informe siguen funcionando sin tocarlos, y el vocabulario nuevo
         queda disponible para las partes 3 y 4. Cambiar los 522 a mano sería un diff
         imposible de revisar y encima habría que poder apagarlo.

         EL ANDAMIO DE «--doc-inset» (daedff8b) NO SE TOCA. «.doc-sec» y «.doc-sec.p2»
         siguen declarando su escalera en términos de «--doc-paper*», así que al
         reapuntar esos tokens la escalera se mueve sola a page/card/sunk. La escala
         nueva se apoya en el andamio, no lo reemplaza.

         EL SEMÁFORO DEL DATO —«--doc-good», «--doc-warn», «--doc-neutral», 57 usos— NO
         se toca y NO se reapunta a la tríada. Son sistemas distintos: la tríada nombra
         un veredicto, el semáforo mide un dato contra un umbral. Confundirlos fue el
         error que el goal de la tríada vino a arreglar (contrato §1).

         Oscuro primero, como el bloque de arriba: el default del app es oscuro
         («data-theme» ausente) y el claro se declara aparte.

         EL SELECTOR LLEVA LAS CUATRO FORMAS, y la cuarta llegó A PRODUCCIÓN antes de
         encontrarse. Este comentario decía TRES y faltaba justo la de prod:
         «.doc-r2.doc-dictamen», las dos clases PEGADAS en el mismo elemento.

         Qué pasaba, medido en prod con el interruptor encendido: los repuntes
         «--doc-*: var(--page)» viven en el bloque de arriba, cuyo selector «.doc-r2» es
         (0,1,0). En tema CLARO hay una regla anterior «[data-theme=light] .doc-dictamen»
         que es (0,1,1) y le gana, así que los NUEVE tokens «--doc-*» se quedaban en la
         paleta cálida vieja —#FAF8F3 en vez de #FFFFFF— y con ellos la mayor parte del
         informe. En oscuro no pasaba: ahí compite «.doc-dictamen» (0,1,0), empata, y
         gana el bloque posterior.

         Y NO SE VIO EN NINGÚN SHOT porque la ruta dev ENVUELVE con «.doc-r2», y ahí sí
         matchea la forma descendente (0,2,1). Con la forma pegada, «.doc-r2.doc-dictamen»
         es (0,2,0) y le gana a (0,1,1) en los dos montajes.

         El resto del comentario original: «.doc-dictamen» declara
         los tokens base con la misma especificidad que «.doc-r2», así que cuando las dos
         clases van en el MISMO elemento gana el orden de aparición —y este bloque va
         después, o sea bien—. Pero cuando «.doc-r2» envuelve desde afuera (la ruta dev),
         el «.doc-dictamen» de adentro está más cerca y se lleva puesta la paleta: medido,
         la sección seguía en el papel cálido #FAF8F3. Las dos formas descendentes suben
         la especificidad y ganan en los dos montajes. */
      .doc-r2,
      .doc-r2.doc-dictamen,
      .doc-r2 .doc-dictamen,
      .doc-r2 .doc-tokens{
        --page:#0C0C0E; --card:#1A1A1E; --sunk:#232328;
        --line:#232327; --line2:#37373D; --line-sunk:#2C2C30;
        --tx:#FAFAFA; --tx2:#D4D4D8; --tx3:#A1A1AA; --tx4:#71717A;
        --up:#6C9BE0;
        --doc-paper:var(--page); --doc-paper2:var(--card);
        --doc-paper3:var(--sunk); --doc-paper4:var(--sunk);
        --doc-line:var(--line); --doc-line2:var(--line2);
        --doc-tx:var(--tx); --doc-tx2:var(--tx2); --doc-tx3:var(--tx3); --doc-tx4:var(--tx4);
        --doc-score-empty:var(--sunk);
      }
      [data-theme="light"] .doc-r2,
      [data-theme="light"] .doc-r2.doc-dictamen,
      [data-theme="light"] .doc-r2 .doc-dictamen,
      [data-theme="light"] .doc-r2 .doc-tokens{
        --page:#FFFFFF; --card:#F4F4F6; --sunk:#EBEBEE;
        --line:#E9E9EC; --line2:#D6D6DB; --line-sunk:#E0E0E3;
        --tx:#18181B; --tx2:#3F3F46; --tx3:#71717A; --tx4:#A1A1AA;
        --up:#2B558F;
      }

      /* EL PAR DIRECCIONAL: «--signal-red» BAJA, «--up» SUBE (contrato §1).
         «--signal-red» ya existía —es de marca, vive en globals.css y vale lo mismo en
         los dos temas—; «--up» no existía en el código y sí en el contrato, que lo pide
         para las flechas de hallazgo (§3) y las píldoras de zona (§8). Se publica acá,
         con la escala, para que nadie lo escriba a mano cuando llegue a usarlo.

         DOS VALORES, uno por tema, porque un azul que se lee sobre blanco desaparece
         sobre negro. Medido en contraste WCAG:

           claro   #2B558F  7,50:1 sobre --page · 6,83:1 sobre --card
           oscuro  #6C9BE0  6,89:1 sobre --page · 6,12:1 sobre --card

         Los cuatro pasan AA. Y el par SE DISTINGUE entre sí, que es lo único que hace
         direccional a un color: ΔL* 9,51 en claro y 17,87 en oscuro contra
         «--signal-red». Si los dos se leyeran igual de claros, la dirección la tendría
         que decir otra cosa.

         ES EL MISMO HEX QUE «--verdict» de COMPRAR y NO es el mismo sistema: aquel
         nombra un veredicto, éste dice si un dato mejora o empeora tu caso. Que
         coincidan es economía de paleta, no una equivalencia — no los unifiques.

         YA LO MONTAN LAS FLECHAS DE HALLAZGO (§4, 11-sep-2026): «↑» en «--up» y «↓» en
         «--signal-red», a 20 px, detrás del interruptor. La decisión «SÍMBOLO, NO COLOR»
         del 09-sep queda superada, con acta en «PrincipalesHallazgos.tsx»: el color
         vuelve solo a las flechas, no a las cifras ni a los textos. */

      /* UNA LÍNEA SOBRE UNA SUPERFICIE HUNDIDA NECESITA SU PROPIO VALOR.
         «--line» está calibrado contra «--page» y «--card»; contra «--sunk» desaparece:
         ΔL* 0,70 en claro y 0,04 en oscuro — en oscuro difieren en un punto del canal
         azul. Un separador que no se ve no es un separador.

         «--line-sunk» iguala el paso que «--line» tiene sobre «--card» —3,82 en claro y
         4,44 en oscuro— desde «--sunk»: da 3,87 y 4,24. Y respeta la dirección de cada
         tema, más oscuro en claro y más claro en oscuro, igual que «--line»; al revés se
         leería como una ranura y no como un separador. No es «--line2» disfrazado: queda
         a ΔL* 3,50 y 5,13 de él.

         Son las dos únicas reglas del informe que hoy combinan las dos cosas. */
      .doc-r2 .fbar .fb-ing,
      .doc-r2 .pos-chip{border-color:var(--line-sunk)}

      /* ═══════════════ REDISEÑO · TIPOGRAFÍA (contrato §1) ═══════════════
         Todo lo de acá cuelga de «.doc-r2», que solo existe con el interruptor de
         «rediseno-flag.ts» encendido. Con el interruptor apagado ninguna de estas
         reglas matchea y el informe se sirve exactamente como hoy.

         POR QUÉ SE REAPUNTAN LOS TOKENS EN VEZ DE REESCRIBIR 115 REGLAS. El mono se
         pide en 115 lugares del informe y la serif en 14. Reescribirlos uno por uno
         sería un diff de 129 reglas que hay que revisar a mano, y que además habría
         que poder apagar. Reapuntar el token hace el mismo trabajo en tres líneas y
         se revierte borrando el bloque. Los tamaños y pesos de cada pieza NO se tocan
         acá: son de las partes 2, 3 y 4.

         LA SERIF SE CAPTURA ANTES DE REAPUNTAR. «--font-serif» se declara fuera de
         «.doc-r2», porque dentro del mismo bloque donde se redefine «--font-heading»
         la variable ya resolvería al valor nuevo — y el titular del hero perdería la
         serif que el contrato le reserva.

         Y se captura en «body», NO en «:root»: next/font define «--font-heading» en la
         clase que va en «body», así que en «html» la variable no existe y la captura
         resolvía a nada — medido, el titular caía a Georgia. */
      body{--font-serif:var(--font-heading)}
      .doc-r2{
        --font-body:var(--font-ui);
        --font-mono:var(--font-ui);
        --font-heading:var(--font-ui);
        font-family:var(--font-ui, system-ui);
      }
      /* Source Serif 4 se reserva al titular del hero. Todo lo demás es Inter.
         EXCEPTO el wordmark: «refranco.ai» es la marca, no tipografía del informe, y su
         serif está fijada en CLAUDE.md («re» Light itálica + «franco» Bold). Reapuntar
         «--font-heading» se lo llevaba puesto — medido en el navegador. */
      .doc-r2 .doc-headline,
      .doc-r2 .doc-wordmark{font-family:var(--font-serif, Georgia, serif)}
      .doc-r2 .doc-headline{font-weight:600}

      /* LA COLUMNA DE CIFRAS ALINEA POR «tabular-nums», NO POR LA FUENTE.
         El mono garantizaba el mismo ancho de dígito por construcción. Inter es
         proporcional: su «1» mide 6,20 px y su «4» mide 9,84 a 15 px, y sin esta
         declaración dos cifras del mismo largo se separan hasta 27 px — más de un
         cuarto del ancho de la columna. Con «tabular-nums» los diez dígitos miden
         9,55 y la alineación es EXACTAMENTE la del mono: cero de diferencia en los
         cuatro pares medidos. Va en la clase de la columna y no suelta, y el
         catch-test la fija: sin ella la alineación se cae en silencio. */
      .doc-r2 .hz-n,
      .doc-r2 .num-cell .v,
      .doc-r2 .doc-keyfig-fig{font-variant-numeric:tabular-nums}

      /* ═══ PÁGINA POR SECCIONES (T2, contrato CONGELADO 02-sep-2026) ═══
         Fondo alternado a sangre: cada sección sangra el padding horizontal de
         .doc-page con márgenes negativos y trae su propio padding. */
      .doc-page--secciones{padding-top:0;padding-bottom:0}
      /* ═══ LA ESCALERA DE SUPERFICIES (10-sep-2026) ═══
         El informe ALTERNA el papel de sus secciones, y la alternancia se INVIERTE entre
         la prosa v21+ y el camino viejo («SubjectCardGrid.tsx»: «dosBloques ? "paper" :
         "paper2"»). El camino viejo no es transitorio: es PERMANENTE para 453 filas
         anónimas que no regeneran. Así que una pieza interior que pide «--doc-paper2» a
         mano contrasta en una alternancia y se apila en la otra — y no hay token que
         elegir bien, porque el correcto depende de la fila.

         La escalera lo resuelve por construcción: cada contenedor declara SU propia
         secuencia y las piezas piden «un escalón adentro» sin saber de qué tono parten.
         Una pieza escribe «background:var(--doc-inset-1)» y queda bien en las dos.

         El nivel 0 es el papel del contenedor y está para que una pieza pueda volver a
         él (una tira que se apoya en el fondo de su sección) sin nombrar el token global.
         Los contenedores que declaran escalera son los que PINTAN: las secciones y el
         modal. Un contenedor transparente hereda la del suyo, que es lo correcto. */
      .doc-sec{
        --doc-inset-0:var(--doc-paper); --doc-inset-1:var(--doc-paper2); --doc-inset-2:var(--doc-paper3);
        margin:0 -64px;padding:36px 64px 44px;background:var(--doc-inset-0);color:var(--doc-tx)}
      .doc-sec.p2{
        --doc-inset-0:var(--doc-paper2); --doc-inset-1:var(--doc-paper3); --doc-inset-2:var(--doc-paper4);
        background:var(--doc-inset-0)}
      .doc-sec .doc-portada{border-bottom:none;margin-bottom:0;padding-bottom:0}
      /* UN TÍTULO POR SECCIÓN (08-sep-2026). Murieron el ksub (.doc-sec-eyebrow) y la
         bajada (.doc-sec-intent): el ksub repetía la palabra del título y la bajada
         anunciaba lo que la sección iba a hacer en vez de hacerlo — y en «Principales
         hallazgos» prometía «los cuatro» cuando el número varía por caso. Las props
         salieron de SeccionInforme para que no vuelvan por costumbre.
         El margen inferior del título absorbe el que traía la bajada: sin eso el
         título quedaba a 10px del contenido. */
      .doc-sec-t{font-family:var(--font-heading, Georgia, serif);font-size:30px;font-weight:700;line-height:1.12;letter-spacing:-.012em;margin:0 0 22px;color:var(--doc-tx)}
      .doc-sec mark{background:linear-gradient(transparent 60%,var(--doc-hl) 60%);color:var(--doc-hl-tx);padding:0 2px;font-weight:500}
      .doc-lnk{font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--signal-red);background:none;border:none;cursor:pointer;padding:0;white-space:nowrap}
      .doc-lnk:hover{text-decoration:underline;text-underline-offset:3px}
      /* el único botón del informe hasta que exista el CTA */
      .doc-btn{display:inline-flex;align-items:center;gap:8px;background:var(--signal-red);color:#fff;font-family:var(--font-mono, ui-monospace);font-size:11px;
        letter-spacing:.1em;text-transform:uppercase;font-weight:700;padding:10px 16px;border-radius:4px;border:none;cursor:pointer;white-space:nowrap}
      .doc-btn:hover{filter:brightness(.92)}
      /* la posición de Franco: card con footer propio (la línea roja termina antes del footer) */
      .pos-card{margin-top:20px;background:var(--doc-paper);border:1px solid var(--doc-line);border-radius:3px;overflow:hidden}
      .pos-main{border-left:3px solid var(--signal-red);padding:16px 18px 14px}
      /* display:flex en vez de block para que el chip del objetivo (v21) se apoye
         a la derecha (nada de backticks acá dentro: esto vive en un template
         literal). Con un solo hijo de texto —STR y la prosa vieja— el resultado
         es el mismo renglón que daba display:block. */
      .pos-t{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--signal-red);font-weight:700;display:flex;align-items:baseline;gap:12px;margin-bottom:8px}
      /* El objetivo del plan: dato, no rótulo — mono, sin versalitas, sobre paper3
         (que por contrato no es fondo de sección, y por eso lo usan las piezas). */
      .pos-chip{margin-left:auto;font-style:normal;font-size:11px;letter-spacing:.06em;text-transform:none;color:var(--doc-tx2);background:var(--doc-paper3);border:1px solid var(--doc-line);border-radius:3px;padding:3px 8px;white-space:nowrap}
      .pos-p{font-family:var(--font-heading, Georgia, serif);font-style:italic;font-size:14.5px;line-height:1.7;color:var(--doc-tx2);max-width:70ch}
      .pos-p + .pos-p{margin-top:13px}
      .pos-firma{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:11.5px;font-weight:600;color:var(--doc-tx)}
      .pos-firma small{display:block;font-family:var(--font-mono, ui-monospace);font-size:9.5px;font-weight:400;letter-spacing:.06em;text-transform:uppercase;color:var(--doc-tx3)}
      .pos-foot{background:var(--doc-paper2);border-top:1px solid var(--doc-line);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
      .pos-foot .k{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--doc-tx3);font-weight:700;display:block;margin-bottom:4px}
      .pos-foot .l{font-size:13px;color:var(--doc-tx2);line-height:1.5}
      /* «LO QUE HARÍA YO» determinista (10-sep-2026) — el bloque deja de ser prosa.
         Contrato: docs/wireframes/rediseno-informe/lo-que-haria-yo-apretado.html
         La fila es la MISMA gramática que las de hallazgo (.hz-lin): pregunta a la
         izquierda, cifra mono a la derecha y su referencia debajo, en small. Nada de
         backticks acá dentro: esto vive en un template literal. */
      .lqhy{margin-top:2px}
      .lqhy-kick{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--doc-tx3);font-weight:700;margin-bottom:9px}
      .lqhy-row{display:grid;grid-template-columns:1fr auto;gap:0 12px;padding:12px 0;border-bottom:1px solid var(--doc-line);align-items:start}
      .lqhy-row:last-of-type{border-bottom:none}
      .lqhy-q{font-family:var(--font-heading, Georgia, serif);font-size:15.5px;line-height:1.3;color:var(--doc-tx)}
      .lqhy-n{font-family:var(--font-mono, ui-monospace);font-size:15px;font-weight:700;white-space:nowrap;text-align:right;color:var(--doc-tx)}
      .lqhy-n small{display:block;font-family:var(--font-mono, ui-monospace);font-size:10px;font-weight:500;color:var(--doc-tx3);margin-top:3px;min-height:13px;white-space:normal}
      /* El chip de quién la pone. El de la palanca TUYA va en el color del veredicto:
         es la única que el lector puede mover hoy, y el color lo dice sin una palabra.
         --verdict ya existe por veredicto (franco-design-system) y no es color nuevo. */
      .lqhy-chip{display:inline-block;font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.07em;text-transform:uppercase;padding:2px 6px;border-radius:3px;background:var(--doc-paper3);color:var(--doc-tx3);margin-top:5px}
      .lqhy-chip.tuyo{background:var(--verdict);color:var(--doc-paper)}
      /* La cifra IMPOSIBLE. Va en el cuerpo de la línea de descarte —mono chica y
         apagada— y no en el de una fila: es contexto, no acción. La jerarquía es el
         mensaje; con el mismo peso que el mix el lector no sabe cuál mirar. */
      .lqhy-ctx{font-family:var(--font-mono, ui-monospace);font-size:10.5px;color:var(--doc-tx3);line-height:1.55;margin:11px 0 0}
      .lqhy-mix{background:var(--doc-paper3);margin:14px -18px 0;padding:14px 18px 15px;border-left:3px solid var(--verdict)}
      /* El rótulo del mix pesa como el del bloque (700): es el encabezado de LA ACCIÓN,
         y tiene que ganarle a la línea de contexto que va justo encima. */
      .lqhy-mix-k{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--doc-tx2);font-weight:700;margin-bottom:9px}
      .lqhy-mix-mov{font-family:var(--font-mono, ui-monospace);font-size:12.5px;color:var(--doc-tx2);margin-bottom:11px;line-height:1.5}
      .lqhy-mix-mov .de{color:var(--doc-tx3)}
      .lqhy-mix-mov .fl{color:var(--doc-tx4);margin:0 4px}
      .lqhy-mix-res{font-family:var(--font-mono, ui-monospace);font-size:13px;color:var(--doc-tx);display:flex;align-items:baseline;flex-wrap:wrap;gap:0 4px}
      .lqhy-mix-res .a{text-decoration:line-through;color:var(--doc-tx3);font-weight:500}
      .lqhy-mix-res .b{font-weight:700}
      .lqhy-mix-res .fl{color:var(--doc-tx4)}
      .lqhy-mix-res .u{font-size:10.5px;color:var(--doc-tx3);letter-spacing:.02em;margin-left:4px}
      /* El costo del día uno en Signal Red: es lo que el mix COBRA, y el rojo acá es
         info que pide atención, no decoración (regla del rojo, CLAUDE.md). */
      .lqhy-mix-cost{font-family:var(--font-mono, ui-monospace);font-size:12px;font-weight:700;color:var(--signal-red);margin-top:8px}
      .lqhy-desc{font-family:var(--font-mono, ui-monospace);font-size:10.5px;color:var(--doc-tx3);line-height:1.5;padding-top:11px;border-top:1px solid var(--doc-line);margin:13px 0 0}
      @media (max-width:640px){
        .lqhy-q{font-size:14.5px} .lqhy-n{font-size:14px}
        .lqhy-mix{margin-left:-14px;margin-right:-14px;padding-left:14px;padding-right:14px}
      }
      /* LA REGULACIÓN DEL EDIFICIO (STR, 09-sep-2026) — la quinta razón, la que no es
         un número. Vive dentro de «Qué determina el veredicto», debajo de las cuatro
         líneas. Sobre --doc-paper3, que por contrato no es fondo de sección; con el
         reglamento ya en contra sube a Signal Red (uso legítimo: condición que invalida
         la operación, no decoración). */
      .reg{margin-top:22px;padding:14px 16px;border:1px solid var(--doc-line);border-left:3px solid var(--doc-tx3);
        border-radius:3px;background:var(--doc-paper3)}
      .reg.crit{border-left-color:var(--signal-red)}
      .reg-t{font-family:var(--font-mono, ui-monospace);font-size:10.5px;letter-spacing:.14em;
        text-transform:uppercase;color:var(--doc-tx3);font-weight:700;margin:0 0 8px}
      .reg.crit .reg-t{color:var(--signal-red)}
      .reg-p{font-size:13.5px;line-height:1.6;color:var(--doc-tx2);margin:0;max-width:70ch}

      /* PRINCIPALES HALLAZGOS · la fila es una línea (08-sep-2026).
         Contrato: docs/wireframes/rediseno-informe/la-fila-como-linea.html, opción 2.
         Murieron .num, .q, .q small, .hz-cierre, .hz-foot y .dot-dir: la numeración,
         el kicker, el punto de dirección, el título y la frase larga salieron de la
         fila. El separador y el espaciado se deciden con el informe completo a la
         vista, en otro goal; acá va el que trae el contrato. */
      /* ALINEACIÓN — estrategia 3 del contrato. «start», no «baseline»: con baseline la
         frase de dos líneas arrastraba la cifra hacia abajo. Y la columna de cifras va con
         ANCHO FIJO, no «auto»: con auto cada fila se acomodaba a su largo y las cuatro
         cifras arrancaban en sitios distintos. 120px entra el caso peor (−$1.149.025). */
      .hz-lin{display:grid;grid-template-columns:16px 1fr 120px;gap:14px;align-items:start;width:100%;
        padding:15px 0;border-bottom:1px solid var(--doc-line);text-align:left}
      .hz-lin:last-child{border-bottom:none}
      /* La flecha en el informe de siempre: Ink, una sola tinta para las dos
         direcciones. Ancho fijo para que la fila neutral, que no lleva flecha, no corra
         la frase hacia la izquierda. El color de §4 entra con el interruptor, más abajo. */
      .hz-fl{font-family:var(--font-mono, ui-monospace);font-size:14px;line-height:1.4;color:var(--doc-tx);text-align:center}
      .hz-lin p{font-family:var(--font-heading, Georgia, serif);font-weight:400;font-size:16px;line-height:1.4;color:var(--doc-tx);margin:0}
      /* Sin :hover ni :focus-visible: la fila dejó de ser un control. Un hover sobre algo
         que no responde promete una puerta que no existe. */
      /* Cifra y referencia alineadas al MISMO borde, el derecho. La caja mide 120px fijos:
         con la cifra a la izquierda y la referencia a la derecha, el par se leía torcido —
         se notaba en las cifras cortas (3,3%), donde quedaba un hueco que la referencia
         cruzaba por debajo. A la derecha las unidades quedan una bajo otra y comparan. */
      .hz-n{font-family:var(--font-mono, ui-monospace);font-size:15px;font-weight:700;white-space:nowrap;letter-spacing:-.01em;color:var(--doc-tx);text-align:right}
      /* La ÚNICA cifra con color: el monto negativo. «.mal» (adverso) y «.bien»
         (--doc-good) murieron — codificaban DIRECCIÓN, que ahora dice la flecha. */
      .hz-n.neg{color:var(--signal-red)}
      /* — LAS FLECHAS DE HALLAZGO (contrato §4) — el color vuelve, y SOLO acá.
           A 20 px y en el par direccional: «↓» lo que frena en «--signal-red», «↑» lo
           que ayuda en «--up». Las cifras y los textos siguen en tinta; la única
           excepción de color que ya había —el monto negativo— sigue siendo la única.

           SUPERA A «SÍMBOLO, NO COLOR» (09-sep), con acta en «PrincipalesHallazgos.tsx».
           Aquella decisión sacó el color del bloque entero porque estaba en todos lados;
           acá vuelve a UN solo lugar, y a un lugar que no carga significado propio: la
           flecha es «aria-hidden» y repite lo que la frase ya dice con palabras.

           EL GANCHO ES «data-dir», que emite el componente con la dirección del motor.
           La tercera dirección, «neutral», no lleva flecha: no necesita regla. */
      .doc-r2 .hz-fl{font-size:20px}
      .doc-r2 .hz-fl[data-dir="adverso"]{color:var(--signal-red)}
      .doc-r2 .hz-fl[data-dir="favorable"]{color:var(--up)}
      /* El slot de la referencia reserva su alto AUNQUE ESTÉ VACÍO (min-height + el
         espacio duro que emite el componente): sin eso la fila sin referencia —Pie 20%—
         se hundía respecto de las otras tres. */
      .hz-n small{display:block;min-height:14px;font-size:10.5px;font-weight:500;color:var(--doc-tx3);margin-top:2px;letter-spacing:0;white-space:normal}
      /* los números */
      .nums{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--doc-line);border:1px solid var(--doc-line)}
      .num-cell{background:var(--doc-paper);padding:14px 16px 13px}
      .num-cell .k{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--doc-tx4);margin-bottom:8px}
      .num-cell .v{font-family:var(--font-mono, ui-monospace);font-size:23px;font-weight:700;line-height:1;color:var(--doc-tx);letter-spacing:-.01em}
      .num-cell .v.neg{color:var(--signal-red)}
      .num-cell .v small{font-size:11px;font-weight:400;color:var(--doc-tx4);letter-spacing:0;margin-left:1px}
      .num-cell .tr{font-size:12px;line-height:1.5;color:var(--doc-tx3);margin-top:8px}
      .num-cell .tr b{color:var(--doc-tx2);font-weight:500}
      .nums-foot{display:flex;justify-content:flex-end;margin-top:12px}
      /* modal de cálculo */
      .m-block{margin-top:22px;padding-top:18px;border-top:1px solid var(--doc-line)}
      .m-block:first-of-type{margin-top:0;padding-top:0;border-top:none}
      .m-block .bt{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--signal-red);font-weight:700;margin-bottom:4px}
      .m-block .bq{font-family:var(--font-heading, Georgia, serif);font-size:16px;font-weight:600;margin-bottom:10px;color:var(--doc-tx)}
      .m-tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
      .m-scrollcue{display:none;font-family:var(--font-mono, ui-monospace);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--doc-tx4);margin-top:8px}
      .calc-tbl{border-collapse:collapse;width:100%;min-width:560px}
      .calc-tbl th{font-family:var(--font-mono, ui-monospace);font-size:8px;letter-spacing:.04em;text-transform:uppercase;color:var(--doc-tx4);padding:7px 4px;text-align:right;border-bottom:1px solid var(--doc-line);font-weight:400;white-space:nowrap}
      .calc-tbl th:first-child{text-align:left}
      .calc-tbl td{font-family:var(--font-mono, ui-monospace);font-size:10px;padding:7px 4px;text-align:right;border-bottom:1px solid var(--doc-line);white-space:nowrap;color:var(--doc-tx)}
      .calc-tbl td:first-child{text-align:left;color:var(--doc-tx3)}
      .calc-tbl tr.pre td{color:var(--doc-tx4)}
      .calc-tbl tr.ent td:first-child{color:var(--doc-warn);font-weight:700}
      .calc-tbl tr.tot td{font-weight:700;border-top:2px solid var(--doc-tx);border-bottom:none;color:var(--doc-tx)}
      .calc-tbl .neg,.ind-tbl .neg{color:var(--signal-red)}
      .ind-tbl{border-collapse:collapse;width:100%}
      .ind-tbl td{padding:9px 0;border-bottom:1px solid var(--doc-line);font-size:12.5px;vertical-align:baseline;color:var(--doc-tx2)}
      .ind-tbl td:first-child{color:var(--doc-tx);font-weight:600;width:28%}
      .ind-tbl td:nth-child(2){color:var(--doc-tx3);font-size:12px;padding-right:12px}
      .ind-tbl td:nth-child(3){font-family:var(--font-mono, ui-monospace);font-size:11.5px;padding-right:12px}
      .ind-tbl td:last-child{font-family:var(--font-mono, ui-monospace);font-weight:700;text-align:right;white-space:nowrap;width:12%;color:var(--doc-tx)}
      .kv{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px dotted var(--doc-line);font-size:12.5px;color:var(--doc-tx3)}
      .kv .v{font-family:var(--font-mono, ui-monospace);color:var(--doc-tx);white-space:nowrap} .kv .v.neg{color:var(--signal-red)}
      .kv.tot{border-top:2px solid var(--doc-tx);border-bottom:none;margin-top:4px;padding-top:9px;color:var(--doc-tx);font-weight:600}
      .kv.tot .v{font-weight:700;font-size:14px}
      .compo{display:flex;height:22px;border-radius:3px;overflow:hidden;margin-top:12px}
      .compo span{height:100%} .compo .f{background:var(--doc-tx)} .compo .p{background:var(--doc-good);opacity:.45}
      .compo-leg{display:flex;justify-content:space-between;gap:10px;font-family:var(--font-mono, ui-monospace);font-size:10px;color:var(--doc-tx3);margin-top:6px}
      .compo-leg b{color:var(--doc-tx)}
      @media (max-width: 767px){
        .doc-sec{margin:0 -22px;padding:26px 22px 32px}
        .doc-sec-t{font-size:25px}
        /* Móvil proporcional: 15px. Igualar a 16 aprieta demasiado a 390; los 14,5
           viejos mantenían el problema justo donde más se lee. */
        .hz-lin p{font-size:15px} .hz-n{font-size:14px}
        .hz-lin{grid-template-columns:14px 1fr 104px;gap:10px}
        .nums{grid-template-columns:repeat(2,1fr)} .num-cell .v{font-size:19px}
        .m-scrollcue{display:block}
        .ind-tbl td:nth-child(2){display:none}
      }
      /* la zona (T4): síntesis + tres celdas comparadas + explorar · drawer: lugares como filas */
      .zona-cells{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--doc-line);border:1px solid var(--doc-line);margin-top:18px}
      .zona-cells>div{background:var(--doc-paper);padding:12px 14px}
      .zona-cells .k{font-size:11.5px;color:var(--doc-tx3);margin-bottom:6px;line-height:1.35}
      .zona-cells .v{font-family:var(--font-mono, ui-monospace);font-size:17px;font-weight:700;color:var(--doc-tx)}
      .zona-cells .s{font-size:11.5px;color:var(--doc-tx3);margin-top:6px;line-height:1.4}
      .zona-cells .s b{font-family:var(--font-mono, ui-monospace);font-weight:700;color:var(--doc-tx2)}
      .zona-cells + .v-viz{margin-top:24px}
      .zona-foot{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:12px;flex-wrap:wrap}
      .lugar{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:10px 0;border-bottom:1px solid var(--doc-line)}
      .lugar .n{font-size:13px;font-weight:600;color:var(--doc-tx)}
      .lugar .t{grid-column:1;font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--doc-tx4)}
      .lugar .d{grid-row:span 2;font-family:var(--font-mono, ui-monospace);font-size:12px;font-weight:700;color:var(--doc-tx2);align-self:center}
      .zona-sin{font-size:13px;color:var(--doc-tx3);margin:10px 0 0;line-height:1.5}
      @media (max-width: 767px){
        .zona-cells{grid-template-columns:1fr 1fr} .zona-cells>div:last-child{grid-column:span 2}
      }
      .doc-toprule{height:5px;background:var(--signal-red)}
      .doc-head{display:flex;justify-content:space-between;align-items:center;padding:16px 40px;border-bottom:1px solid var(--doc-line)}
      .doc-page{padding:36px 64px 44px}
      .doc-foot{display:flex;justify-content:space-between;gap:12px;padding:14px 64px 20px;font-family:var(--font-mono, ui-monospace);
        font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--doc-tx4)}
      @media (max-width: 767px){
        .doc-head{padding:14px 20px}
        .doc-page{padding:24px 22px 32px}
        .doc-foot{padding:12px 22px 18px}
      }
      .doc-portada{padding-bottom:26px;border-bottom:1px solid var(--doc-line);margin-bottom:26px;color:var(--doc-tx)}
      /* banda full-bleed: sangra el padding de .doc-page */
      .doc-banda{position:relative;left:-64px;width:calc(100% + 128px);margin-bottom:18px}
      /* banda con cuerpo: degradado 100° color → 80/20 → deep (0 / 70 / 100%) + grano .35
         multiply. Texto blanco. Mismo material en claro y oscuro (contrato). */
      .doc-banda-band{display:block;position:relative;overflow:hidden;color:#fff;font-family:var(--font-mono, ui-monospace);
        font-size:12.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;
        padding:10px 20px 10px 64px;
        background:linear-gradient(100deg,var(--verdict-band-0) 0%,color-mix(in srgb,var(--verdict) 80%,var(--verdict-deep)) 70%,var(--verdict-deep) 100%)}
      .doc-banda-band::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.35;mix-blend-mode:multiply;
        background-image:var(--doc-grain);background-size:220px}
      @media (max-width: 767px){
        .doc-banda{left:-22px;width:calc(100% + 44px)}
        .doc-banda-band{padding-left:22px;font-size:11.5px;letter-spacing:.16em}
      }
      /* EL MAPA CEDE PRIMERO. La columna del mapa era 236px FIJOS a cualquier
         ancho >=768, asi que el contenido absorbia toda la compresion: a 820px de
         viewport la columna de texto caia a 377px y las glosas largas se partian.
         El orden de degradacion ahora es explicito: primero el mapa se angosta,
         despues baja, y solo al final desaparece. */
      .doc-cover-grid{display:grid;grid-template-columns:minmax(0,1fr) 236px;gap:30px;align-items:start}
      .doc-mapcol{display:block}
      /* 1 - el mapa se angosta en vez de robarle ancho al texto. El piso del
         clamp es 176px: medido, por debajo de ~170px la etiqueta de la direccion
         empieza a partirse en tres lineas y el pin queda apretado contra el borde
         — un mapa que no se entiende es peor que no tenerlo. */
      @media (max-width: 1039px){
        .doc-cover-grid{grid-template-columns:minmax(0,1fr) clamp(176px, 22vw, 236px);gap:20px}
      }
      /* 2 - DESAPARECE justo cuando tocaria ese piso, sin estado intermedio. El
         clamp llega a 176px cuando 22vw = 176, o sea a 800px de viewport: por eso
         el corte va en 799 y no antes — cortar mas arriba tiraria un mapa que
         todavia se lee. Se probo bajarlo bajo el contenido y se descarto: a ancho
         casi completo domina la portada y empuja ficha y toggle fuera de vista. */
      @media (max-width: 799px){
        .doc-cover-grid{grid-template-columns:minmax(0,1fr)}
        .doc-mapcol{display:none}
      }
      .doc-headline{font-family:var(--font-heading, Georgia, serif);font-size:36px;line-height:1.15;font-weight:700;
        letter-spacing:-.01em;margin:0 0 16px;color:var(--doc-tx)}
      @media (max-width: 767px){ .doc-headline{font-size:27px;margin-bottom:12px} }
      /* El mark del TITULAR hereda el weight 700 del h1 — aporta SOLO el fondo
         de plumón (corrección PARÁ 3; con 500 el destacado se veía más delgado
         que el resto). Las marcas de PROSA (FASE 4) mantienen su 500. */
      .doc-headline mark{
        background:linear-gradient(transparent 60%, var(--doc-hl) 60%);
        color:var(--doc-hl-tx);padding:0 2px;font-weight:inherit}
      /* Parrafo unico: el monto inline arrastra la altura de linea, asi que el
         interlineado se fija aca y no en el span grande. */
      /* El margen inferior vive ACA y no en una clase de Tailwind: el bloque de
         estilo inyectado del componente gana por orden, y un margin cero aca se
         comia el mb-[18px] de la clase, dejando la ficha pegada al parrafo. */
      .doc-keyfig{margin:0 0 18px;line-height:1.55}
      .doc-keyfig-fig{font-family:var(--font-mono, ui-monospace);font-size:23px;font-weight:700;color:var(--signal-red)}
      .doc-keyfig-cap{font-size:13.5px;color:var(--doc-tx3)}
      @media (max-width: 767px){ .doc-keyfig-fig{font-size:19px} }
      .doc-props-link{display:inline-flex;align-items:center;gap:9px;background:none;border:none;cursor:pointer;
        font-family:var(--font-mono, ui-monospace);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--doc-tx2);
        border-bottom:1px dashed var(--doc-line2);padding:0 0 3px;transition:color .15s,border-color .15s}
      .doc-props-link:hover{color:var(--signal-red);border-color:var(--signal-red)}
      /* ficha modal */
      .doc-ficha-overlay{position:fixed;inset:0;background:rgba(10,10,10,.6);backdrop-filter:blur(3px);
        display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}
      .doc-ficha-sheet{width:100%;max-width:480px;max-height:86vh;overflow-y:auto;background:var(--doc-paper);
        border:1px solid var(--doc-line2);color:var(--doc-tx)}
      .doc-specfranja{display:flex;flex-wrap:wrap;border-top:2px solid var(--doc-tx);border-bottom:1px solid var(--doc-line);margin-bottom:22px}
      .doc-specfranja .sp{flex:1 1 auto;padding:12px 16px 12px 0;margin-right:16px;border-right:1px solid var(--doc-line)}
      .doc-specfranja .sp:last-child{border-right:none;margin-right:0}
      .doc-specfranja .sk{font-family:var(--font-mono, ui-monospace);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--doc-tx4);margin-bottom:4px}
      .doc-specfranja .sv{font-family:var(--font-mono, ui-monospace);font-size:14.5px;font-weight:700;color:var(--doc-tx);white-space:nowrap}
      @media (max-width: 480px){
        .doc-specfranja .sp{flex:1 1 30%;padding-right:10px;margin-right:10px}
        .doc-specfranja .sv{font-size:13px}
      }
      .doc-tick{width:14px;height:3px;background:var(--signal-red);display:inline-block}
      .doc-g2{display:flex;flex-wrap:wrap;row-gap:18px}
      .doc-g2 .cell{flex:1 1 33%;min-width:33%;padding-right:14px}
      @media (max-width: 480px){ .doc-g2 .cell{min-width:50%} }
      .doc-g2 .k{font-size:11px;color:var(--doc-tx3);margin-bottom:3px}
      .doc-g2 .v{font-family:var(--font-mono, ui-monospace);font-size:13.5px;color:var(--doc-tx)}
      /* ═══ CUERPO DEL DOCUMENTO (FASE 4) ═══ */
      /* SIN COLUMNA DE MARGEN. Tenía 56px reservados para el isotipo f. sticky, y
         eso hacía tres cosas a la vez, todas malas desde que el bloque de veredicto
         perdió su card:
           · DOS chips f. seguidos — el sticky del margen y el inline del título,
             medidos a 16px de distancia vertical uno del otro;
           · el cuerpo arrancaba en x=216 mientras la portada arrancaba en x=138, o
             sea NUNCA alinearon;
           · la franja vacía a la izquierda del texto.
         El ísotipo queda SOLO donde la referencia lo pone: pegado al titulo, inline
         (.doc-fmark-inline). El cuerpo pasa a una columna y comparte margen y ancho
         con la portada. */
      .doc-cuerpo{display:grid;grid-template-columns:minmax(0,1fr)}
      /* Nota al margen "f. —": apunte serif itálico en rojo entre párrafos.
         Curaduría (decisión b del PARÁ 0): sale de las cajaAccionable que la
         prosa YA trae; ningún campo IA nuevo. */
      .doc-fnote{font-family:var(--font-heading, Georgia, serif);font-style:italic;font-size:13.5px;line-height:1.6;
        color:var(--signal-red);margin:14px 0 16px;padding-left:14px;border-left:2px solid var(--signal-red);max-width:56ch}
      .doc-fnote::before{content:'f. — ';font-style:normal;font-weight:700;letter-spacing:.02em}
      /* Capítulos de cierre (La simulación · La zona) */
      .doc-capitulo{margin-top:34px;padding-top:18px;border-top:1px solid var(--doc-line)}
      .doc-cap-eyebrow{font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.16em;text-transform:uppercase;
        color:var(--doc-tx3);margin-bottom:14px}
      .doc-cap-sub{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
        color:var(--doc-tx4);margin-bottom:10px}
      /* Plumón de la prosa FUERA del acordeón (hero): mismo gesto, weight 500. */
      .doc-portada + div mark,.doc-cuerpo mark{
        background:linear-gradient(transparent 60%,var(--doc-hl) 60%);
        color:var(--doc-hl-tx);padding:0 2px;font-weight:500}
      @media (prefers-reduced-motion: reduce){
        .doc-props-link{transition:none}
      }
    ` }} />
  );
}
