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

// Colores semánticos de la banda (mockup v8; único lugar semántico del informe).
const BANDA: Record<string, { light: string; dark: string; label: string }> = {
  "BUSCAR OTRA": { light: "#C8323C", dark: "#D8434D", label: "Buscar otra" },
  "AJUSTA SUPUESTOS": { light: "#A96F1B", dark: "#DFA34F", label: "Ajusta supuestos" },
  COMPRAR: { light: "#2F7D55", dark: "#57B98A", label: "Comprar" },
};

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
  const banda = BANDA[veredicto] ?? BANDA["AJUSTA SUPUESTOS"];
  const scorePct = Math.max(0, Math.min(100, score ?? 0));

  return (
    <section className="doc-portada" data-verdict={veredicto}>
      {/* Eyebrow — la dirección deja de ser H1 (decisión 8) */}
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

      {/* Banda de veredicto — full-bleed del documento, único color semántico */}
      <div className="doc-banda" aria-label={`Veredicto: ${banda.label}`}>
        <span
          className="doc-banda-band"
          style={{ ["--banda-light" as string]: banda.light, ["--banda-dark" as string]: banda.dark }}
        >
          {banda.label}
        </span>
      </div>

      {/* Score = barra fina bajo la banda (muere el score gigante) */}
      <div className="flex items-center gap-3 max-w-[420px] mb-5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] whitespace-nowrap" style={{ color: "var(--doc-tx3)" }}>
          Franco Score
        </span>
        <div className="flex-1 relative h-[3px] rounded-[2px]" style={{ background: "var(--doc-line2)" }}>
          <div
            className="absolute left-0 top-0 bottom-0 rounded-[2px]"
            style={{ width: `${scorePct}%`, background: "var(--doc-tx)" }}
          />
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] whitespace-nowrap" style={{ color: "var(--doc-tx3)" }}>
          <b style={{ color: "var(--doc-tx)" }}>{score ?? "—"}</b>/100
        </span>
      </div>

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
            <div
              className="inline-flex rounded-md overflow-hidden shrink-0"
              style={{ border: "1px solid var(--doc-line2)" }}
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
                    className="font-mono text-[10px] font-medium tracking-[0.06em] px-2.5 py-1 transition-colors"
                    style={{
                      background: on ? "var(--doc-tx)" : "transparent",
                      color: on ? "var(--doc-paper)" : "var(--doc-tx3)",
                    }}
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
export function DocumentoFrame({ children }: { children: ReactNode }) {
  return (
    <div className="doc-dictamen">
      <DocTokens />
      <div className="doc-toprule" aria-hidden="true" />
      <div className="doc-head">
        <Wordmark />
        {/* Sin fecha acá: vive en el eyebrow (decisión d del PARÁ 0 — folio sin №). */}
        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em]" style={{ color: "var(--doc-tx4)" }}>
          Análisis
        </span>
      </div>
      <div className="doc-page">{children}</div>
      <div className="doc-foot">
        <span>Real estate en su estado más franco</span>
        <Wordmark small />
      </div>
    </div>
  );
}

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-baseline leading-none font-heading ${small ? "text-[11px]" : "text-[16px]"}`}>
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
        --doc-hl:rgba(216,67,77,.38); --doc-hl-tx:#FFFFFF;
        --doc-paper3:#232323; --doc-neutral:#6E6A63; --doc-good:#57B98A; --doc-warn:#DFA34F;
        --doc-shadow:0 24px 60px rgba(0,0,0,.6);
        --doc-banda:var(--banda-dark, #DFA34F);
      }
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
        --doc-hl:rgba(224,67,80,.26); --doc-hl-tx:#141311;
        --doc-paper3:#EAE7DF; --doc-neutral:#8C8880; --doc-good:#2F7D55; --doc-warn:#A96F1B;
        --doc-shadow:0 24px 60px rgba(20,19,17,.14);
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
      .doc-banda-band{display:block;color:#fff;font-family:var(--font-mono, ui-monospace);
        font-size:12.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;
        padding:10px 20px 10px 64px;background:var(--banda-dark)}
      [data-theme="light"] .doc-banda-band{background:var(--banda-light)}
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
        background:linear-gradient(transparent 42%, var(--doc-hl) 42%, var(--doc-hl) 94%, transparent 94%);
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
        background:linear-gradient(transparent 42%,var(--doc-hl) 42%,var(--doc-hl) 94%,transparent 94%);
        color:var(--doc-hl-tx);padding:0 2px;font-weight:500}
      @media (prefers-reduced-motion: reduce){
        .doc-props-link{transition:none}
      }
    ` }} />
  );
}
