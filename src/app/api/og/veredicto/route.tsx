import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { readVeredicto } from "@/lib/results-helpers";
import type {
  FullAnalysisResult,
  AnalisisInput,
  AIAnalysisV2,
  Veredicto,
} from "@/lib/types";

// Edge runtime: misma elección que /api/og (existente).
export const runtime = "edge";

// ── Fuentes del sistema (Capa 2) ─────────────────────────────────────────
// Solo Source Serif 4 (narrativa/wordmark) + JetBrains Mono (datos/labels).
// El hero no usa IBM Plex Sans: todo es serif o mono (igual que el PNG del
// welcome).
//
// Las fuentes se sirven estáticamente desde /public/fonts y se bajan en
// RUNTIME (fetch), NO se embeben en el bundle vía import.meta.url. Embeberlas
// metía ~1.3MB de TTF dentro de la Edge Function y rompía el deploy en plan
// Hobby (límite 1MB por función). Fuera del bundle, la función queda liviana.
//
// Variantes reducidas a las 4 que el render realmente usa (se omitió Serif
// Regular 400 normal: todo el serif es Bold 700 o Italic 400):
//   - Source Serif 4 Bold   → wordmark "franco"/".ai", título de propiedad
//   - Source Serif 4 Italic → wordmark "re", frase veredicto, caja "lo que verías"
//   - JetBrains Mono Regular → tagline, labels, meta, axis, KPI labels/sub
//   - JetBrains Mono Bold    → Franco Score, badge veredicto, valor KPI
const FONT_FILES = {
  serifBold: "/fonts/SourceSerif4-Bold.ttf",
  serifItalic: "/fonts/SourceSerif4-It.ttf",
  monoRegular: "/fonts/JetBrainsMono-Regular.ttf",
  monoBold: "/fonts/JetBrainsMono-Bold.ttf",
} as const;

type FontKey = keyof typeof FONT_FILES;

// Cache a nivel de módulo: en instancias edge "calientes" se reutiliza el
// fetch de fuentes entre invocaciones (origin estable por deployment).
let fontsCache: Promise<Record<FontKey, ArrayBuffer>> | null = null;

function loadFonts(origin: string): Promise<Record<FontKey, ArrayBuffer>> {
  if (!fontsCache) {
    fontsCache = (async () => {
      const entries = await Promise.all(
        (Object.keys(FONT_FILES) as FontKey[]).map(async (key) => {
          const res = await fetch(new URL(FONT_FILES[key], origin));
          if (!res.ok) {
            throw new Error(`Font fetch failed: ${FONT_FILES[key]} (${res.status})`);
          }
          return [key, await res.arrayBuffer()] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<FontKey, ArrayBuffer>;
    })();
  }
  return fontsCache;
}

// ── Paleta (solo Ink + Signal Red) ───────────────────────────────────────
const INK_900 = "#0F0F0F"; // fondo página
const INK_700 = "#2C2C2A"; // bordes
const INK_600 = "#5F5E5A"; // texto terciario / muted fuerte
const INK_500 = "#888780"; // texto muted / labels
const INK_400 = "#B4B2A9"; // texto secundario claro
const INK_100 = "#FAFAF8"; // texto principal
const SIGNAL_RED = "#C8323C"; // acento

// ── Helpers de formato (chileno) ─────────────────────────────────────────
function dots(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString();
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "−" : "") + grouped;
}

function fmtFlujo(n: number): string {
  const sign = n < 0 ? "−" : "+";
  const abs = Math.abs(n);
  if (abs >= 10000) return `${sign}$${Math.round(abs / 1000)}K`;
  return `${sign}$${dots(abs)}`;
}

// Trunca por LÍMITE DE ORACIÓN, no a N caracteres exactos:
//  1. Si entra completo, se devuelve tal cual.
//  2. Si no, se corta en el último cierre de oración (. ! ?) que quepa dentro
//     del máximo — SIN puntos suspensivos (la oración queda completa).
//     Solo cuenta como cierre la puntuación SEGUIDA DE ESPACIO, para no cortar
//     dentro de cifras ("UF 4.180", "$420.000") ni abreviaturas pegadas.
//  3. Si no hay cierre de oración antes del límite, se corta en la última
//     palabra completa + "…" (nunca a media palabra).
const MIN_KEEP = 30; // evita fragmentos diminutos sin rechazar oraciones cortas
function clamp(s: string | undefined | null, max: number): string {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  // Ventana hasta max+1 para captar un "." cuyo espacio cae justo en el límite.
  const window = t.slice(0, max + 1);
  let lastSentenceEnd = -1;
  for (let i = 0; i < window.length - 1; i++) {
    const c = window[i];
    if ((c === "." || c === "!" || c === "?") && window[i + 1] === " ") {
      lastSentenceEnd = i; // índice de la puntuación de cierre
    }
  }
  if (lastSentenceEnd >= MIN_KEEP) {
    return t.slice(0, lastSentenceEnd + 1).trim();
  }
  // Sin cierre de oración: última palabra completa + elipsis.
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > MIN_KEEP ? lastSpace : max).trim() + "…";
}

function defaultFrase(v: Veredicto): string {
  if (v === "COMPRAR")
    return "Los números cierran. La estructura sostiene la inversión.";
  if (v === "AJUSTA SUPUESTOS")
    return "Hay caso, pero los supuestos necesitan ajuste antes de avanzar.";
  return "Los números no cierran con esta estructura. Hay mejores opciones.";
}

// Estilos de badge por veredicto (skill Patrón 1):
//  COMPRAR → Ink invertido · AJUSTA → outline rojo · BUSCAR OTRA → rojo sólido
function badgeStyles(v: Veredicto) {
  if (v === "COMPRAR")
    return { bg: INK_100, color: INK_900, border: "1px solid " + INK_100 };
  if (v === "AJUSTA SUPUESTOS")
    return { bg: INK_900, color: SIGNAL_RED, border: "1px solid " + INK_700 };
  return { bg: SIGNAL_RED, color: "#FFFFFF", border: "1px solid " + SIGNAL_RED };
}

interface Kpi {
  label: string;
  value: string;
  sub: string;
  neg?: boolean;
}

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const { searchParams } = reqUrl;
  const id = searchParams.get("analisisId") || searchParams.get("id");

  if (!id) {
    return new Response("Missing analisisId", { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fuentes (runtime) + datos del análisis en paralelo. Las fuentes se bajan
  // desde el mismo origin que sirve esta función (prod o localhost), así están
  // disponibles tanto en deploy como en dev sin hardcodear el dominio.
  const [fonts, { data }] = await Promise.all([
    loadFonts(reqUrl.origin),
    supabase
      .from("analisis")
      .select("nombre, comuna, score, superficie, precio, input_data, results, ai_analysis")
      .eq("id", id)
      .single(),
  ]);

  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const results = (data.results as FullAnalysisResult | null) ?? null;
  const input = (data.input_data as AnalisisInput | null) ?? null;
  const ai = (data.ai_analysis as AIAnalysisV2 | null) ?? null;

  const score = Math.max(0, Math.min(100, Math.round(data.score || 0)));
  const veredicto: Veredicto =
    readVeredicto(results) ??
    (score >= 70 ? "COMPRAR" : score >= 45 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA");

  const title = data.nombre || `Depto en ${data.comuna}`;

  // Metadata: "62 M² · UF 4.180 · PIE 20%"
  const metaParts: string[] = [];
  if (data.superficie) metaParts.push(`${Math.round(data.superficie)} M²`);
  if (data.precio) metaParts.push(`UF ${dots(data.precio)}`);
  const piePct = input?.piePct;
  if (typeof piePct === "number") metaParts.push(`PIE ${Math.round(piePct)}%`);
  const meta = metaParts.join("  ·  ");

  // Frase editorial del veredicto (italic serif) + caja "lo que verías".
  const conviene = ai?.conviene;
  const frase = clamp(
    conviene?.veredictoFrase_uf ||
      conviene?.veredictoFrase_clp ||
      results?.resumenEjecutivo ||
      defaultFrase(veredicto),
    150,
  );
  const boxText = clamp(
    conviene?.reencuadre_uf ||
      conviene?.reencuadre_clp ||
      conviene?.cajaAccionable_uf ||
      conviene?.cajaAccionable_clp ||
      "",
    190,
  );

  // KPI cards (igual lenguaje que el PNG welcome). Se toman las 4 primeras
  // métricas disponibles; el grid es 2×2.
  const kpis: Kpi[] = [];
  const flujo = results?.metrics?.flujoNetoMensual;
  if (typeof flujo === "number") {
    kpis.push({
      label: "02 · COSTO MENSUAL",
      value: fmtFlujo(flujo),
      sub: "FLUJO DE BOLSILLO",
      neg: flujo < 0,
    });
  }
  const precioSug = results?.negociacion?.precioSugeridoUF;
  if (typeof precioSug === "number" && precioSug > 0) {
    kpis.push({
      label: "03 · NEGOCIACIÓN",
      value: `UF ${dots(precioSug)}`,
      sub: "PRECIO SUGERIDO",
    });
  }
  const mult = results?.exitScenario?.multiplicadorCapital;
  if (typeof mult === "number" && mult > 0) {
    kpis.push({
      label: "04 · LARGO PLAZO",
      value: `${mult.toFixed(1)}x`,
      sub: "RETORNO 10 AÑOS",
    });
  }
  const rentBruta = results?.metrics?.rentabilidadBruta;
  if (typeof rentBruta === "number") {
    kpis.push({
      label: "05 · RENTABILIDAD",
      value: `${rentBruta.toFixed(1)}%`,
      sub: "BRUTA ANUAL",
    });
  }
  const cards = kpis.slice(0, 4);

  const badge = badgeStyles(veredicto);
  const labelActive = (which: Veredicto) =>
    veredicto === which ? INK_100 : INK_600;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "600px",
          height: "840px",
          backgroundColor: INK_900,
          padding: "34px 36px",
          fontFamily: "Source Serif 4",
        }}
      >
        {/* ── Header: wordmark + tagline · estado COMPLETADO ── */}
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: "26px", lineHeight: 1 }}>
              <span style={{ fontStyle: "italic", color: INK_500 }}>re</span>
              <span style={{ fontWeight: 700, color: INK_100 }}>franco</span>
              <span style={{ fontWeight: 700, color: SIGNAL_RED }}>.ai</span>
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "JetBrains Mono",
                fontSize: "10px",
                letterSpacing: "2px",
                color: INK_600,
                marginTop: "8px",
              }}
            >
              REAL ESTATE EN SU ESTADO MÁS FRANCO
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "JetBrains Mono",
              fontSize: "10px",
              letterSpacing: "2px",
              color: INK_500,
            }}
          >
            COMPLETADO
          </div>
        </div>

        {/* ── Card: property + Franco Score + barra ── */}
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            flexDirection: "column",
            border: `1px solid ${INK_700}`,
            borderRadius: "10px",
            padding: "22px 24px",
            marginTop: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontWeight: 700,
              fontSize: "20px",
              color: INK_100,
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
          {meta ? (
            <div
              style={{
                display: "flex",
                fontFamily: "JetBrains Mono",
                fontSize: "12px",
                letterSpacing: "1px",
                color: INK_500,
                marginTop: "7px",
              }}
            >
              {meta}
            </div>
          ) : null}

          {/* score label + badge */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "JetBrains Mono",
                fontSize: "11px",
                letterSpacing: "2px",
                color: INK_500,
              }}
            >
              FRANCO SCORE
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "JetBrains Mono",
                fontWeight: 700,
                fontSize: "13px",
                letterSpacing: "2px",
                color: badge.color,
                background: badge.bg,
                border: badge.border,
                borderRadius: "5px",
                padding: "7px 16px",
              }}
            >
              {veredicto}
            </div>
          </div>

          {/* score number + barra gradiente */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "JetBrains Mono",
                fontWeight: 700,
                fontSize: "44px",
                color: INK_100,
                lineHeight: 1,
                width: "78px",
              }}
            >
              {score}
            </div>
            <div
              style={{
                display: "flex",
                position: "relative",
                flex: 1,
                height: "5px",
                borderRadius: "3px",
                background: `linear-gradient(90deg, ${SIGNAL_RED} 0%, ${INK_600} 55%, ${INK_400} 100%)`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${score}%`,
                  top: "-5px",
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: INK_100,
                  transform: "translateX(-50%)",
                }}
              />
            </div>
          </div>

          {/* axis labels */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "12px",
              marginLeft: "78px",
              fontFamily: "JetBrains Mono",
              fontSize: "10px",
              letterSpacing: "1px",
            }}
          >
            <span style={{ color: labelActive("BUSCAR OTRA") }}>BUSCAR</span>
            <span style={{ color: labelActive("AJUSTA SUPUESTOS") }}>AJUSTA</span>
            <span style={{ color: labelActive("COMPRAR") }}>COMPRAR</span>
          </div>
        </div>

        {/* ── Frase editorial del veredicto ── */}
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            flexDirection: "column",
            width: "100%",
            fontStyle: "italic",
            fontSize: "19px",
            lineHeight: "27px",
            color: INK_100,
            marginTop: "22px",
          }}
        >
          {frase}
        </div>

        {/* ── Caja "lo que verías" ── */}
        {boxText ? (
          <div style={{ display: "flex", flexShrink: 0, marginTop: "16px" }}>
            <div
              style={{
                display: "flex",
                width: "3px",
                borderRadius: "2px",
                background: SIGNAL_RED,
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                paddingLeft: "16px",
                flex: 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontFamily: "JetBrains Mono",
                  fontSize: "11px",
                  letterSpacing: "2px",
                  color: SIGNAL_RED,
                  marginBottom: "7px",
                }}
              >
                LO QUE VERÍAS
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                  fontStyle: "italic",
                  fontSize: "15px",
                  lineHeight: "22px",
                  color: INK_400,
                }}
              >
                {boxText}
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Grid 2×2 de KPI cards ── */}
        {cards.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexShrink: 0,
              flexWrap: "wrap",
              marginTop: "24px",
              gap: "12px",
            }}
          >
            {cards.map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "256px",
                  border: `1px solid ${INK_700}`,
                  borderRadius: "8px",
                  padding: "15px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontSize: "10px",
                    letterSpacing: "1px",
                    color: INK_500,
                    marginBottom: "9px",
                  }}
                >
                  {kpi.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontWeight: 700,
                    fontSize: "23px",
                    color: kpi.neg ? SIGNAL_RED : INK_100,
                    marginBottom: "4px",
                  }}
                >
                  {kpi.value}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontSize: "10px",
                    letterSpacing: "1px",
                    color: INK_600,
                  }}
                >
                  {kpi.sub}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ),
    {
      width: 600,
      height: 840,
      fonts: [
        { name: "Source Serif 4", data: fonts.serifBold, weight: 700, style: "normal" },
        { name: "Source Serif 4", data: fonts.serifItalic, weight: 400, style: "italic" },
        { name: "JetBrains Mono", data: fonts.monoRegular, weight: 400, style: "normal" },
        { name: "JetBrains Mono", data: fonts.monoBold, weight: 700, style: "normal" },
      ],
    },
  );
}
