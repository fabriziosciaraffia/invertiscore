"use client";

// Drawers propios (rama drawers-propios · F2) — plantillas DETERMINÍSTICAS motor-templated.
// Cero prosa IA, cero prompt, cero regen: cada cifra deriva de results/exit/projections/
// metrics + hallazgo.valor persistidos. El contrato visual es mockup-drawers-propios.html
// (⛔#1, los 3 reescritos aprobados). Sirve LTR (FullAnalysisResult) y STR (ShortTermResult):
// las plantillas de presentación son puras (reciben cifras ya derivadas); la derivación
// campo→fuente vive en el caller por modalidad (of-drawers-propios-f1.md).
//
// Primitivas de presentación (espejo del mockup): Lead · Chips/Cell · Decomp · Box · Chain · Note.

import type { ReactNode } from "react";
import type {
  FullAnalysisResult,
  HallazgoTIR,
  HallazgoSensibilidad,
  HallazgoDistanciaVeredicto,
  HallazgoPatrimonio,
  HallazgoPlusvalia,
  HallazgoSobreprecio,
  HallazgoEstructuraFinanciamiento,
  HallazgoEstructuraCostosStr,
} from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { InfoTooltip } from "@/components/ui/tooltip";

// Proyección estándar Franco a futuro, como texto ("3%") — desde la constante, nunca literal.
const PROYECCION_FRANCO_PCT = `${Math.round(PLUSVALIA_PROYECCION_ANUAL * 100)}%`;

// ── Formato (coma decimal chilena, UTF-8 directo) ──────────────────────────────
type Currency = "CLP" | "UF";
// dec1 normaliza el guion ASCII de toFixed al − tipográfico (HUECO-3b): mismo trato
// de signo que el resto de los helpers.
const dec1 = (n: number) => n.toFixed(1).replace(".", ",").replace("-", "−");
const pctStr = (n: number) => dec1(n) + "%";
// Multiplicador a 2 decimales RECORTADOS — misma precisión que card (findingDisplay),
// hero y la prosa (exit.multiplicadorCapital a 2 dec). Familia 7 del censo: antes el
// drawer decía ×1,5 mientras la card decía ×1,45. El gate anti-no-op de los stress
// sigue comparando a 1 decimal (round1) — solo cambia el display.
const multStr = (n: number) =>
  "×" + n.toFixed(2).replace(/0$/, "").replace(/\.$/, "").replace(".", ",").replace("-", "−");
const round1 = (n: number) => Math.round(n * 10) / 10;

// ── GRUPO A · clasificar SOBRE LO MOSTRADO (una regla, un lugar) ────────────────
// pts: redondea a 1 decimal PRIMERO; el signo y el tono salen de ese redondeado, nunca
// del crudo. Lo consumen los dos márgenes de TIR (STR y LTR) — muere el tono hardcoded.
function ptsClass(n: number): { display: string; tone: "pos" | "red" | "plain" } {
  const r = round1(n);
  if (r > 0) return { display: "+" + dec1(r) + " pts", tone: "pos" };
  if (r < 0) return { display: dec1(r) + " pts", tone: "red" }; // dec1(r) ya trae el − tipográfico
  return { display: "0,0 pts", tone: "plain" };
}
// Comparación inline entre dos cifras QUE SE MUESTRAN: la palabra sale de la aritmética
// sobre lo mostrado (ambas a 1 decimal). mayor→"sobre" · igual→"en" · menor→"bajo".
// (hallazgo.direccion manda en clasificaciones de fondo, no en estas comparaciones visibles.)
function cmpMostrado(a: number, b: number): "sobre" | "en" | "bajo" {
  const ra = round1(a);
  const rb = round1(b);
  return ra > rb ? "sobre" : ra < rb ? "bajo" : "en";
}
// Consecuencia del multiplicador tras el stress "0% plano", por round1(mult) — tres salidas.
// UNA sola semántica desde F2 (motor-supuestos): EQUITY para LTR y STR. multiplicador =
// equity/aportado → ×1 = break-even (recuperas lo puesto), <1 terminas con menos, <0 en rojo.
function consecuenciaMultEquity(m: number): string {
  const r = round1(m);
  if (r >= 1) return "seguirías cerrando a favor, pero buena parte de la ganancia se apoya en ese supuesto";
  if (r >= 0) return "terminarías con menos de lo que pusiste";
  return "no recuperarías ni lo aportado: el resultado neto queda en rojo";
}

// Monto completo respetando toggle CLP/UF.
function fmtMoney(n: number, currency: Currency, valorUF: number): string {
  const abs = Math.abs(n);
  if (currency === "UF") {
    const uf = abs / (valorUF || 1);
    if (uf >= 100) return "UF " + Math.round(uf).toLocaleString("es-CL");
    return "UF " + dec1(Math.round(uf * 10) / 10);
  }
  return "$" + Math.round(abs).toLocaleString("es-CL");
}

// Monto abreviado para barras/decomp ($48,4M · UF 1,2K).
function fmtCompact(n: number, currency: Currency, valorUF: number): string {
  const abs = Math.abs(n);
  if (currency === "UF") {
    const uf = abs / (valorUF || 1);
    if (uf >= 1000) return "UF " + dec1(uf / 1000) + "K";
    return "UF " + Math.round(uf).toLocaleString("es-CL");
  }
  const M = abs / 1_000_000;
  if (M >= 100) return "$" + Math.round(M) + "M";
  if (M >= 1) return "$" + dec1(M) + "M";
  if (abs >= 1000) return "$" + Math.round(abs / 1000) + "K";
  return "$" + Math.round(abs).toLocaleString("es-CL");
}
const signCompact = (n: number, currency: Currency, valorUF: number) =>
  (n < 0 ? "−" : "+") + fmtCompact(n, currency, valorUF);
// Monto completo con SIGNO explícito (− tipográfico / + ) — para valores de flujo en prosa
// que pueden ser negativos (FIX-2). Cuando la frase NO declara dirección, la cifra la lleva.
const fmtMoneySigned = (n: number, currency: Currency, valorUF: number) =>
  (n < 0 ? "−" : "+") + fmtMoney(n, currency, valorUF);

// ── Primitivas de presentación ─────────────────────────────────────────────────
export function Lead({ children }: { children: ReactNode }) {
  return (
    <p
      className="font-body"
      style={{ fontSize: 14, lineHeight: 1.65, color: "var(--franco-text)", margin: "0 0 16px" }}
    >
      {children}
    </p>
  );
}

// Término con traducción pegada (jerga → paréntesis con glosa + tooltip).
export function Jerga({ term, gloss, tip }: { term: string; gloss: string; tip: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span>
        {term} <span style={{ color: "var(--franco-text-tertiary)" }}>({gloss})</span>
      </span>
      <InfoTooltip content={tip} />
    </span>
  );
}

type Cell = { k: string; v: string; tone?: "pos" | "red" | "plain"; small?: string };

export function Chips({ label, cells, foot }: { label: string; cells: Cell[]; foot?: ReactNode }) {
  const cols = cells.length === 2 ? "repeat(2,1fr)" : "repeat(3,1fr)";
  const toneColor = (t?: Cell["tone"]) =>
    t === "red" ? "var(--signal-red)" : t === "pos" ? "var(--franco-pos-text, var(--ink-400))" : "var(--franco-text)";
  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
        border: "0.5px solid var(--franco-border)",
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <p
        className="font-mono uppercase m-0"
        style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--franco-text-secondary)", marginBottom: 12 }}
      >
        {label}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}>
        {cells.map((c) => (
          <div key={c.k}>
            <p
              className="font-mono uppercase m-0"
              style={{ fontSize: 10, letterSpacing: "0.04em", color: "var(--franco-text-secondary)", marginBottom: 4 }}
            >
              {c.k}
            </p>
            <p className="font-mono font-bold m-0" style={{ fontSize: 20, lineHeight: 1.05, color: toneColor(c.tone) }}>
              {c.v}
              {c.small && <span style={{ fontSize: 13, fontWeight: 500 }}> {c.small}</span>}
            </p>
          </div>
        ))}
      </div>
      {foot && (
        <p className="font-body m-0" style={{ fontSize: 11, color: "var(--franco-text-secondary)", marginTop: 12 }}>
          {foot}
        </p>
      )}
    </div>
  );
}

type DecompRow = { label: string; value: string; widthPct: number; tone: "strong" | "mid" | "weak" | "red" };

export function Decomp({ rows, net }: { rows: DecompRow[]; net?: { label: string; value: string } }) {
  const fill = (t: DecompRow["tone"]) =>
    t === "red"
      ? "var(--signal-red)"
      : t === "strong"
        ? "var(--ink-400)"
        : t === "mid"
          ? "color-mix(in srgb, var(--ink-400) 55%, transparent)"
          : "color-mix(in srgb, var(--ink-400) 30%, transparent)";
  return (
    <div style={{ marginBottom: 16 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
          <span
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: "0.04em", color: "var(--franco-text-secondary)", width: 92, flexShrink: 0 }}
          >
            {r.label}
          </span>
          <div
            style={{
              flex: 1,
              height: 22,
              background: "color-mix(in srgb, var(--franco-text) 6%, transparent)",
              borderRadius: 4,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${r.widthPct}%`, borderRadius: 4, background: fill(r.tone) }}
            />
          </div>
          <span
            className="font-mono font-bold text-right"
            style={{ fontSize: 12, width: 104, flexShrink: 0, color: r.tone === "red" ? "var(--signal-red)" : "var(--franco-text)" }}
          >
            {r.value}
          </span>
        </div>
      ))}
      {net && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderTop: "0.5px solid var(--franco-border-strong)",
            marginTop: 4,
            paddingTop: 10,
          }}
        >
          <span
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: "0.04em", color: "var(--franco-text-secondary)" }}
          >
            {net.label}
          </span>
          <span className="font-mono font-bold" style={{ fontSize: 13, color: "var(--franco-text)" }}>
            {net.value}
          </span>
        </div>
      )}
    </div>
  );
}

export function Box({
  label,
  tone = "neutral",
  big,
  children,
}: {
  label: string;
  tone?: "neutral" | "red";
  big?: string;
  children: ReactNode;
}) {
  const red = tone === "red";
  return (
    <div
      style={{
        borderLeft: `3px solid ${red ? "var(--signal-red)" : "var(--franco-text-secondary)"}`,
        background: red
          ? "color-mix(in srgb, var(--signal-red) 7%, transparent)"
          : "color-mix(in srgb, var(--franco-text) 4%, transparent)",
        borderRadius: "0 8px 8px 0",
        padding: "14px 16px",
        marginBottom: 14,
      }}
    >
      <p
        className="font-mono uppercase m-0"
        style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--franco-text-secondary)", marginBottom: big ? 3 : 5 }}
      >
        {label}
      </p>
      {big && (
        <p className="font-mono font-bold m-0" style={{ fontSize: 24, lineHeight: 1.1, color: "var(--franco-pos-text, var(--ink-400))", marginBottom: 3 }}>
          {big}
        </p>
      )}
      <p className="font-body m-0" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--franco-text)" }}>
        {children}
      </p>
    </div>
  );
}

// Cadena causal (una sola, números encadenados) — Financiamiento STR.
export function Chain({ steps }: { steps: Array<{ v: string; k: ReactNode; pos?: boolean }> }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 8, margin: "2px 0 12px", flexWrap: "wrap" }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "contents" }}>
          <div
            style={{
              flex: 1,
              minWidth: 96,
              background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
              border: "0.5px solid var(--franco-border)",
              borderRadius: 8,
              padding: "10px 12px",
              textAlign: "center",
            }}
          >
            <span
              className="font-mono font-bold"
              style={{ display: "block", fontSize: 15, lineHeight: 1.1, marginBottom: 4, color: s.pos ? "var(--ink-400)" : "var(--franco-text)" }}
            >
              {s.v}
            </span>
            <span
              className="font-mono uppercase"
              style={{ display: "block", fontSize: 9, letterSpacing: "0.04em", color: "var(--franco-text-secondary)", lineHeight: 1.35 }}
            >
              {s.k}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span className="font-mono" style={{ alignSelf: "center", color: "var(--franco-text-tertiary)", fontSize: 15, flexShrink: 0 }}>
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p
      className="font-mono uppercase m-0"
      style={{ fontSize: 10, letterSpacing: "0.04em", color: "color-mix(in srgb, var(--franco-text) 35%, transparent)", marginTop: 6 }}
    >
      {children}
    </p>
  );
}

// Fallback breve cuando falta el dato crítico de un cuerpo (GRUPO B) — patrón STR-TIR
// extendido a todos: mejor una constatación honesta que ceros o cifras falsas.
function SinDatos({ children }: { children: ReactNode }) {
  return (
    <p className="font-body" style={{ fontSize: 14, lineHeight: 1.65, color: "var(--franco-text-secondary)" }}>
      {children}
    </p>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LTR — 4 drawers propios (tir · sensibilidad · patrimonio · plusvalía)
// ════════════════════════════════════════════════════════════════════════════

// 1 · TIR LTR — "por qué tu X% no es el X% de un depósito"
export function DrawerTIRLtr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoTIR;
  results: FullAnalysisResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const m = results.metrics;
  const exit = results.exitScenario;
  // GRUPO B / HUECO-B — guard: sin escenario de salida válido, la descomposición no tiene de
  // dónde salir; el multiplicador de estado sale del hallazgo patrimonio (única fuente).
  const pat = results.hallazgos?.find((h): h is HallazgoPatrimonio => h.id === "patrimonio");
  if (!((exit?.valorVenta ?? 0) > 0) || !pat) {
    return <SinDatos>Datos insuficientes para el detalle de retorno (aún no calculamos la venta a futuro de este análisis).</SinDatos>;
  }
  const tirPct = v.tirPct;
  const umbral = v.umbralPct;
  const margenPts = tirPct - umbral;
  const margen = ptsClass(margenPts);

  const creditoInicial = (m?.precioCLP ?? 0) - (m?.pieCLP ?? 0);
  const amortizacion = Math.max(creditoInicial - (exit?.saldoCredito ?? 0), 0);
  const flujoAcum = exit?.flujoAcumulado ?? 0;
  const vmFrancoCLP = (m?.valorMercadoFrancoUF ?? 0) * valorUF;
  const plusvaliaProj = Math.max((exit?.valorVenta ?? 0) - vmFrancoCLP, 0);
  const bruto = flujoAcum + amortizacion + plusvaliaProj;
  // Con flujo negativo el relato de shares se rompe (share > 100% porque el bruto se
  // achica). Se porta la rama de DrawerTIRStr (⛔#1): sin share%, con fila neta y
  // contrafáctico en multiplicador. Con flujo ≥ 0, la rama original (mockup aprobado).
  const flujoResta = flujoAcum < 0;

  // Rama flujo ≥ 0 (share%): fuentes ordenadas + carga.
  const fuentes = [
    { label: "Plusvalía", value: plusvaliaProj, tone: "strong" as const },
    { label: "Flujo 10 años", value: flujoAcum, tone: "mid" as const },
    { label: "Amortización", value: amortizacion, tone: "weak" as const },
  ].sort((a, b) => b.value - a.value);
  const maxF = Math.max(...fuentes.map((f) => f.value), 1);
  const share = (n: number) => (bruto > 0 ? Math.round((n / bruto) * 100) : 0);
  const carga = fuentes[0];
  const cargaShare = share(carga.value);

  // Rama flujo < 0 (reconstrucción STR-style, sin share%). HUECO-B — estado desde el hallazgo
  // (LTR: patrimonioCLP = equity final); contrafáctico derivado de su misma base cruda.
  const brutoSinFlujo = plusvaliaProj + amortizacion;
  const net = pat.valor.patrimonioCLP;
  const aportado = pat.valor.aportadoCLP;
  const multActual = pat.valor.multiplicador;
  const netSinResta = net - flujoAcum; // flujoAcum<0 ⇒ suma |flujo|
  const multSinResta = aportado > 0 ? netSinResta / aportado : 0;
  const maxBar = Math.max(plusvaliaProj, amortizacion, Math.abs(flujoAcum), 1);
  const rowsResta: DecompRow[] = [
    { label: "Plusvalía", value: "+" + fmtCompact(plusvaliaProj, currency, valorUF), widthPct: Math.max((plusvaliaProj / maxBar) * 100, 2), tone: "strong" },
    { label: "Amortización", value: "+" + fmtCompact(amortizacion, currency, valorUF), widthPct: Math.max((amortizacion / maxBar) * 100, 2), tone: "mid" },
    { label: "Flujo 10 años", value: signCompact(flujoAcum, currency, valorUF), widthPct: Math.max((Math.abs(flujoAcum) / maxBar) * 100, 2), tone: "red" },
  ];

  return (
    <div>
      <Lead>
        La{" "}
        <Jerga
          term="TIR"
          gloss="la rentabilidad anual de toda tu inversión"
          tip="TIR = rentabilidad anual de toda tu inversión, ya juntando arriendo, tus aportes y la venta a 10 años."
        />{" "}
        es {pctStr(tirPct)}.{" "}
        {flujoResta
          ? "Pero acá hay una vuelta importante: uno de los tres motores del retorno —la caja, la plusvalía y la amortización— no suma, resta, y ese porcentaje ya lo trae descontado."
          : `Un depósito te paga su tasa y listo; tu ${pctStr(tirPct)} se arma de tres motores distintos —la caja, la plusvalía y la amortización—, y cada uno tiene su propio riesgo. Vale saber cuál lo carga.`}
      </Lead>

      <Chips
        label="Tu retorno vs el piso"
        cells={[
          { k: "Tu TIR", v: pctStr(tirPct), tone: margen.tone === "red" ? "plain" : "pos" },
          { k: "Piso exigible", v: pctStr(umbral) },
          { k: "Margen", v: margen.display, tone: margen.tone },
        ]}
        foot={
          flujoResta
            ? margen.tone === "red"
              ? `Quedas ${dec1(Math.abs(round1(margenPts)))} pts bajo el piso de ${pctStr(umbral)} — y eso ya con la caja negativa descontada, no antes.`
              : `Ese ${margen.display} es sobre el piso de ${pctStr(umbral)} — y está medido después de descontar la caja negativa, no antes. El ${pctStr(tirPct)} no es un retorno bruto que luego baja.`
            : `${pctStr(umbral)} es el mínimo que un crédito apalancado debe rendir para pagar el esfuerzo y la iliquidez de tener un depto.`
        }
      />

      {flujoResta ? (
        <Decomp rows={rowsResta} net={{ label: "Suma de los tres, en bruto", value: fmtCompact(bruto, currency, valorUF) }} />
      ) : (
        <Decomp
          rows={fuentes.map((f) => ({
            label: f.label,
            value: `${fmtCompact(f.value, currency, valorUF)} · ${share(f.value)}%`,
            widthPct: Math.max((f.value / maxF) * 100, 2),
            tone: f.tone,
          }))}
        />
      )}

      {flujoResta ? (
        <Box label="Qué significa">
          Tu {pctStr(tirPct)} no viene de la caja — la caja <b>resta</b> {fmtCompact(Math.abs(flujoAcum), currency, valorUF)} en
          el camino, porque el arriendo no cubre la cuota todos los años. Lo levantan la plusvalía ({fmtCompact(plusvaliaProj, currency, valorUF)})
          y la amortización ({fmtCompact(amortizacion, currency, valorUF)}): juntas suman {fmtCompact(brutoSinFlujo, currency, valorUF)},
          y recién después baja a {fmtCompact(bruto, currency, valorUF)} cuando le restas la caja. El {pctStr(tirPct)} es la tasa
          sobre lo que queda al final —tras esa resta y los costos de vender—, no antes. Sin la resta de la caja,
          lo que terminas teniendo pasaría de <b>~{fmtCompact(net, currency, valorUF)} a ~{fmtCompact(netSinResta, currency, valorUF)}</b> — de{" "}
          {multStr(multActual)} a {multStr(multSinResta)} sobre lo que pusiste.
        </Box>
      ) : (
        <Box label="Qué significa">
          {cargaShare >= 50 ? "Más de la mitad" : `El grueso (${cargaShare}%)`} de tu retorno lo carga la{" "}
          <b>{carga.label.toLowerCase()}</b> ({fmtCompact(carga.value, currency, valorUF)}) — un supuesto a
          futuro, no plata en la mano. El arriendo que te queda ({fmtCompact(flujoAcum, currency, valorUF)}) y la
          deuda que amortizas ({fmtCompact(amortizacion, currency, valorUF)}) son más firmes: dependen de que el
          depto se arriende, no de que la comuna siga subiendo.
        </Box>
      )}
      {flujoResta ? (
        <Box label="Qué pasa si falla" tone="red">
          Si la comuna no se aprecia, el {pctStr(tirPct)} se desploma: te quedas apoyado solo en la amortización,
          con una caja que ya es negativa. A diferencia de una renta larga sana, este retorno depende fuerte de un
          supuesto a futuro — vale entrarle con los ojos abiertos.
        </Box>
      ) : (
        <Box label="Qué pasa si falla" tone="red">
          Si la comuna no se aprecia (plusvalía 0%), tu retorno pierde el ~{share(plusvaliaProj)}% que hoy aporta
          la valorización: la operación sigue rentando, pero pasa a apoyarse en el arriendo y la amortización, no
          en la apuesta de valorización. Por eso el {pctStr(tirPct)} no es comparable pelado con un depósito UF.
        </Box>
      )}
      <Note>
        Montos en {currency} · togglean con el switch de la página · los tres motores salen del mismo
        cálculo de la venta a 10 años, no se recalculan aparte.
      </Note>
    </div>
  );
}

// 2 · SENSIBILIDAD LTR — "cuánto aguanta tu veredicto" (KPI en positivo, capas separadas)
export function DrawerSensibilidadLtr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoSensibilidad;
  results: FullAnalysisResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const arriendo = results.metrics?.ingresoMensual ?? 0;
  // GRUPO B — guard por dato crítico: sin arriendo declarado no hay piso/colchón que mostrar.
  if (!(arriendo > 0)) {
    return <SinDatos>Datos insuficientes para el margen del veredicto (falta el arriendo declarado).</SinDatos>;
  }
  const margenFrac = v.marginPct / 100;
  const colchon = arriendo * margenFrac;
  const piso = arriendo * (1 - margenFrac);
  const base = v.veredictoBase;
  const nuevo = v.veredictoNuevo ?? "AJUSTA SUPUESTOS";
  const arriendoStr = fmtMoney(arriendo, currency, valorUF);
  const pisoStr = fmtMoney(piso, currency, valorUF);
  const colchonStr = fmtMoney(colchon, currency, valorUF);
  // GRUPO A — clasifica sobre marginPct redondeado a 1 decimal (mismo formato que se
  // muestra) y contra el corte del motor (v.corteFavorable), no un literal 15.
  const amplio = round1(v.marginPct) >= v.corteFavorable;

  return (
    <div>
      <Lead>
        Tu veredicto es {base} con el arriendo que declaraste ({arriendoStr}). La pregunta honesta es cuánto
        puede fallar ese número antes de que la conclusión cambie. El dial que probamos es el arriendo: lo
        bajamos hasta que el veredicto se mueve.
      </Lead>

      <Box label="Cuánto aguanta">
        <span style={{ fontSize: 15, lineHeight: 1.55 }}>
          Tu arriendo puede caer hasta <b>{pisoStr}</b> —un <b>{pctStr(v.marginPct)} menos</b> que los{" "}
          {arriendoStr} que declaraste— antes de que el veredicto pase de {base} a {nuevo}. Todo lo que quede por
          encima de ese piso, aguanta.
        </span>
      </Box>

      <Chips
        label="Los tres números, por separado"
        cells={[
          { k: "Arriendo hoy", v: arriendoStr },
          { k: "Piso antes de cambiar", v: pisoStr },
          { k: "Colchón", v: colchonStr, tone: "pos", small: "/mes" },
        ]}
        foot={`Entre lo que declaraste y el piso hay ${colchonStr} al mes de holgura. Recién bajo ${pisoStr} el veredicto se movería a ${nuevo}.`}
      />

      <Box label="Qué significa">
        {amplio
          ? "Es un colchón amplio. Aunque te hayas pasado de optimista en el arriendo por un cuarto largo, la conclusión no se cae: tendrías que estar equivocado por casi un tercio para que "
          : "El colchón es acotado. No hace falta mucho error en el arriendo para que "}
        {base} deje de tenerse en pie. La decisión {amplio ? "no cuelga" : "cuelga bastante"} de que
        el arriendo declarado sea exacto al peso.
      </Box>
      <Box label="Qué haces con esto">
        {amplio
          ? "Con este margen, no necesitas afinar el arriendo antes de decidir. Igual conviene validarlo con 2–3 publicaciones comparables de la zona — no para salvar el veredicto, sino para saber con qué flujo real vas a vivir mes a mes."
          : "Antes de decidir, valida el arriendo con 2–3 publicaciones comparables de la zona: el veredicto es sensible a ese número, así que conviene apretarlo antes de firmar."}
      </Box>

      {/* Espejo bidireccional: hasta acá el drawer solo miró hacia ABAJO (cuánto puede
          caer el arriendo antes de bajar de veredicto). Cuando existe el hallazgo de
          distancia, el otro borde también tiene número y mostrar uno solo daría una
          lectura sesgada — "aguanta 25%" suena holgado hasta que ves que el borde de
          arriba está a 4,3%. En COMPRAR el hallazgo no se emite y este bloque no aparece. */}
      {(() => {
        const dist = results.hallazgos?.find(
          (h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto",
        );
        if (!dist || dist.valor.esEstructural) return null;
        const l = dist.valor.palancaMasBarata;
        if (!l) return null;
        const objetivo =
          dist.valor.veredictoObjetivo === "COMPRAR" ? "COMPRAR" : "AJUSTA SUPUESTOS";
        const haciaArriba =
          l.palanca === "plazo"
            ? `estirar el crédito a ${l.objetivo} años`
            : l.palanca === "arriendo"
              ? `un arriendo ${pctStr(Math.abs(l.deltaPct))} mayor`
              : `un precio ${pctStr(Math.abs(l.deltaPct))} menor`;
        const masCerca = Math.abs(l.deltaPct) < round1(v.marginPct);
        return (
          <Box label="Y hacia el otro lado">
            <span style={{ fontSize: 15, lineHeight: 1.55 }}>
              El arriendo tendría que caer <b>{pctStr(v.marginPct)}</b> para que esto baje a{" "}
              {nuevo}, y basta <b>{haciaArriba}</b> para que suba a {objetivo}.{" "}
              {masCerca
                ? "Estás más cerca del borde de arriba que del de abajo: la conclusión de hoy es la más pesimista de las dos que tienes a mano."
                : "El colchón hacia abajo es más ancho que la distancia hacia arriba, así que el veredicto de hoy es una lectura estable."}
            </span>
          </Box>
        );
      })()}
    </div>
  );
}

// 2b · DISTANCIA AL VEREDICTO LTR — "lo que te separa" (las vías, una por una)
// Espejo del drawer de sensibilidad: aquella responde "cuánto aguanta antes de bajar",
// esta "cuánto falta para subir". Las vías NO se suman — cada una cruza por su cuenta.
export function DrawerDistanciaLtr({
  hallazgo,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoDistanciaVeredicto;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const base = v.veredictoBase;
  const objetivo = v.veredictoObjetivo;

  if (v.esEstructural) {
    const dm = v.deltaMinimoFueraDeTope;
    return (
      <div>
        <Lead>
          Tu veredicto es {base}. La pregunta honesta no es qué falta, sino si hay algo que
          alcance: probamos {v.pieEsPalanca ? "subir el pie, " : ""}subir el arriendo, bajar el
          precio y estirar el crédito, cada uno por su cuenta y hasta donde deja de ser un ajuste
          para ser otro departamento.
        </Lead>
        <Box label="Qué encontramos" tone="red">
          {dm ? (
            <span style={{ fontSize: 15, lineHeight: 1.55 }}>
              La vía menos exigente de las tres es{" "}
              {dm.palanca === "precio" ? "bajar el precio" : "subir el arriendo"}, y aun así pide{" "}
              <b>
                {dm.deltaPct > 0 ? "+" : "−"}
                {pctStr(Math.abs(dm.deltaPct))}
              </b>{" "}
              para que esto llegue a {objetivo}. Estirar el crédito a 30 años tampoco alcanza.
            </span>
          ) : (
            <span style={{ fontSize: 15, lineHeight: 1.55 }}>
              Ninguna de las tres llega, ni llevándolas a extremos que ya no son negociación:
              arriendo al doble, precio a un tercio, crédito a 30 años.
            </span>
          )}
        </Box>
        <Box label="Qué significa">
          La brecha no está en cómo estás mirando este depto — está en el depto. Ajustar supuestos
          sirve cuando el número está cerca; acá el esfuerzo que pide es de otro orden.
        </Box>
        <Box label="Qué haces con esto">
          {/* "Guarda el pie para el siguiente" no aplica sin pie: con financiamiento 100%
              no hay capital guardado que reasignar (analysis-voice-franco §1.11.1). */}
          {v.piePctActual === 0
            ? "Sigue buscando: lo que no cuadra acá es el depto, y con financiamiento 100% no tienes colchón para absorberlo. Si igual quieres avanzar por razones que no son financieras, está bien saberlo — pero no te cuentes que los números dan."
            : "Guarda el pie para el siguiente. Si igual quieres avanzar por razones que no son financieras, está bien saberlo — pero no te cuentes que los números dan."}
        </Box>
      </div>
    );
  }

  const cells = v.palancas.map((l) => {
    if (l.palanca === "plazo") {
      return { k: "Plazo del crédito", v: `${l.objetivo} años`, small: `desde ${l.actual}` };
    }
    // El pie se muestra como NIVEL, no como variación: su deltaPct viene en puntos
    // porcentuales y con pie 0 un "+26%" se leería como aumento sobre cero.
    if (l.palanca === "pie") {
      return {
        k: "Pie",
        v: `${pctStr(l.objetivo)}`,
        small: l.actual > 0 ? `desde ${pctStr(l.actual)}` : "hoy sin pie",
      };
    }
    const valor =
      l.palanca === "arriendo"
        ? fmtMoney(l.objetivo, currency, valorUF)
        : `UF ${Math.round(l.objetivo).toLocaleString("es-CL")}`;
    return {
      k: l.palanca === "arriendo" ? "Arriendo mensual" : "Precio de cierre",
      v: valor,
      small: `${l.deltaPct > 0 ? "+" : "−"}${pctStr(Math.abs(l.deltaPct))}`,
    };
  });
  const tienePlazo = v.palancas.some((l) => l.palanca === "plazo");
  const tienePie = v.palancas.some((l) => l.palanca === "pie");

  return (
    <div>
      <Lead>
        Tu veredicto es {base} y está cerca del borde de arriba. Estas son las vías que lo cruzan a{" "}
        {objetivo}, cada una por su cuenta: no se suman, cualquiera alcanza.
      </Lead>

      <Chips
        label="Las vías, una por una"
        cells={cells}
        foot={
          // "La única que no depende de negociar" deja de ser cierto cuando el pie también
          // es vía: las dos dependen de ti y no del vendedor. Con ambas, lo que las separa
          // es el capital — el plazo no te cuesta plata hoy, el pie sí.
          tienePlazo && tienePie
            ? "El pie y el plazo son las dos que no dependen de negociar con el vendedor ni de que el mercado de arriendo te acompañe. Se diferencian en el bolsillo: el pie te cuesta capital hoy, el plazo no —alarga la deuda y pagas más intereses en total."
            : tienePlazo
              ? "Estirar el plazo es la única que no depende de negociar con el vendedor ni de que el mercado de arriendo te acompañe: alarga la deuda y pagas más intereses en total, pero no te cuesta capital hoy."
              : "Cada valor es el punto exacto donde el veredicto cambia, moviendo esa variable y dejando el resto igual."
        }
      />

      <Box label="Qué significa">
        Que el veredicto no está lejos no lo vuelve un buen negocio por sí solo — lo vuelve un
        negocio que depende de una condición concreta y verificable, en vez de una intuición.
      </Box>
      <Box label="Qué haces con esto">
        {v.palancas[0]?.palanca === "pie"
          ? "Esta no se negocia con nadie: es plata tuya contra menos crédito. Antes de descartar el depto, confirma con el banco cuánto baja la cuota con ese pie y si tienes la liquidez sin quedarte sin colchón."
          : v.palancas[0]?.palanca === "precio"
            ? "Llévalo a la mesa: la diferencia está en rango de negociación, no en otro departamento. Si el vendedor no baja, ya sabes exactamente cuánto te separa."
            : "Antes de descartarlo, confirma ese techo de arriendo contra 2–3 publicaciones comparables de la zona. Si el mercado lo da, la decisión se toma sola."}
      </Box>
      {v.pieExcluidoPorBono && (
        <Box label="Por qué el pie no aparece acá">
          Tu pie lo cubre la inmobiliaria: subirlo no es una palanca, es deshacer el trato que
          estás evaluando. Por eso las vías de arriba son el precio y el arriendo — y con el pie
          cubierto, el precio se mira con más dureza, porque alguien está pagando ese bono.
        </Box>
      )}
      <Note>
        {/* La nota enumera SOLO lo que quedó fuera. Decir "el pie no entra acá" mientras el
            pie es la primera vía de la tabla de arriba era una contradicción directa. */}
        {[
          tienePlazo
            ? "El plazo se muestra en tramos de 5 años porque es lo que los bancos ofrecen."
            : null,
          tienePie
            ? "La tasa no entra acá: es condición del banco, no del depto."
            : "El pie y la tasa no entran acá: son condiciones de tu bolsillo y del banco, no del depto.",
        ]
          .filter(Boolean)
          .join(" ")}
      </Note>
    </div>
  );
}

// 3 · PATRIMONIO LTR — "cuánto es tuyo a 10 años" (self-liquidating con vuelta honesta por signo)
export function DrawerPatrimonioLtr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoPatrimonio;
  results: FullAnalysisResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const m = results.metrics;
  const exit = results.exitScenario;
  // GRUPO B — guard por dato crítico: sin escenario de salida válido, `amortizacion`
  // caería al CRÉDITO COMPLETO (cifra falsa). Se corta antes de mostrar nada.
  if (!((exit?.valorVenta ?? 0) > 0)) {
    return <SinDatos>Datos insuficientes para el patrimonio a 10 años (aún no calculamos la venta a futuro de este análisis).</SinDatos>;
  }
  const patrimonio = v.patrimonioCLP;
  const aportado = v.aportadoCLP;
  const mult = v.multiplicador;
  const creditoInicial = (m?.precioCLP ?? 0) - (m?.pieCLP ?? 0);
  const amortizacion = Math.max(creditoInicial - (exit?.saldoCredito ?? 0), 0);
  const bolsillo = exit?.flujoMensualAcumuladoNegativo ?? 0; // suma absoluta de años con flujo neto negativo
  const aniosPlazo = exit?.anios ?? 10;
  const selfLiquidating = bolsillo <= 0;
  // GRUPO D — prorrateo honesto: cuenta los AÑOS de flujo negativo desde projections
  // persistidas (sin motor nuevo) y prorratea el bolsillo SOLO sobre esos meses. Si no
  // se pueden contar (projections ausentes/positivo), no se muestra "$/mes" — queda el total.
  const mesesNegativos =
    (results.projections ?? []).slice(0, aniosPlazo).filter((p) => p.flujoAnual < 0).length * 12;
  const bolsilloMes = mesesNegativos > 0 ? bolsillo / mesesNegativos : 0;

  return (
    <div>
      <Lead>
        El depto vale una cosa; lo tuyo es esa cifra menos la deuda que aún le debes al banco. A {aniosPlazo}{" "}
        años, tras vender y saldar el crédito, esto es lo que te queda en la mano frente a lo que fuiste
        poniendo.
      </Lead>

      <Chips
        label="Lo tuyo vs lo que pusiste"
        cells={[
          { k: "Tu parte", v: fmtMoney(patrimonio, currency, valorUF) },
          { k: "Aportaste", v: fmtMoney(aportado, currency, valorUF) },
          { k: "Multiplicador", v: multStr(mult), tone: mult >= 2 ? "pos" : "plain" },
        ]}
        foot={`${fmtMoney(patrimonio, currency, valorUF)} contra los ${fmtMoney(aportado, currency, valorUF)} que pusiste entre pie, gastos y aportes del camino.`}
      />

      {selfLiquidating ? (
        <Box label="La deuda que se paga sola">
          En estos {aniosPlazo} años amortizas <b>{fmtCompact(amortizacion, currency, valorUF)}</b> del crédito —
          y acá el arriendo la paga entera por ti: como el flujo te queda a favor todos los años, no pusiste un
          peso extra para bajar la deuda. Eso es apalancamiento sano: el inquilino te construye patrimonio
          mientras tú no aportas de tu bolsillo.
        </Box>
      ) : (
        <Box label="La deuda no se paga sola del todo" tone="red">
          El arriendo amortiza <b>{fmtCompact(amortizacion, currency, valorUF)}</b> del crédito, pero no alcanza a
          cubrir toda la cuota: pusiste <b>{fmtCompact(bolsillo, currency, valorUF)}</b> de tu bolsillo en el
          camino
          {mesesNegativos > 0 && (
            <> (unos {fmtMoney(bolsilloMes, currency, valorUF)} al mes durante los años de flujo negativo)</>
          )}
          . La deuda baja, sí, pero en parte la pagas tú, no solo el inquilino.
        </Box>
      )}
      <Box label="Qué significa">
        {mult >= 2
          ? `Multiplicas por ${dec1(mult).replace(",0", "")} lo que pusiste, apalancado por dos motores: la deuda que el arriendo amortiza y la plusvalía proyectada. `
          : `Terminas con más de lo que pusiste (${multStr(mult)}), pero el margen es acotado y buena parte se apoya en la plusvalía proyectada. `}
        La parte que depende de que la comuna suba la ves en detalle en el drawer de plusvalía — acá lo que
        importa es de dónde sale tu parte y cuánto de eso ya es firme.
      </Box>
    </div>
  );
}

// 4 · PLUSVALÍA LTR — procedencia sin eufemismo + stress "si fuera 0%" (multiplicador, no TIR recomputada)
export function DrawerPlusvaliaLtr({
  hallazgo,
  results,
  valorUF,
  comuna,
}: {
  hallazgo: HallazgoPlusvalia;
  results: FullAnalysisResult;
  valorUF: number;
  comuna: string;
}) {
  const v = hallazgo.valor;
  const m = results.metrics;
  const exit = results.exitScenario;
  // HUECO-B — el multiplicador de ESTADO sale del hallazgo patrimonio (única fuente de verdad:
  // el mismo que muestran la card y el drawer Patrimonio). Sin recompute local. Si el hallazgo
  // falta, el guard decide (SinDatos), NO un fallback a recompute.
  const pat = results.hallazgos?.find((h): h is HallazgoPatrimonio => h.id === "patrimonio");
  if (!((exit?.valorVenta ?? 0) > 0) || !pat) {
    return <SinDatos>Datos insuficientes para el detalle de plusvalía (aún no calculamos la venta a futuro de este análisis).</SinDatos>;
  }
  const anual = v.anualizadaPct;
  const umbral = v.refPct;
  const comunaLabel = comuna || "la comuna";
  const cmp = cmpMostrado(anual, umbral); // GRUPO A — palabra desde la aritmética sobre lo mostrado
  const historicoNegativo = round1(anual) < 0; // GRUPO C — el histórico ya está cayendo

  // Stress "si 0%": quitar plusvalía_proj. multActual = estado (hallazgo); multSinPlus = escenario
  // derivado desde la MISMA base cruda del motor (pat.valor.patrimonioCLP/aportadoCLP).
  const vmFrancoCLP = (m?.valorMercadoFrancoUF ?? 0) * valorUF;
  const plusvaliaProj = Math.max((exit?.valorVenta ?? 0) - vmFrancoCLP, 0);
  const multActual = pat.valor.multiplicador;
  const multSinPlus = pat.valor.aportadoCLP > 0 ? (pat.valor.patrimonioCLP - plusvaliaProj) / pat.valor.aportadoCLP : 0;
  // GRUPO C anti-no-op: si el contrafáctico no mueve el multiplicador a 1 decimal, NO se
  // narra "cae de X a Y" — se reemplaza por la constatación de que el retorno no descansa ahí.
  const contrafactualVisible = round1(multActual) !== round1(multSinPlus);
  // v.fuente ahora carga la PROCEDENCIA HISTÓRICA REAL (F4), fuente única de verdad. Fallback
  // defensivo para filas persistidas pre-regen (cuya v.fuente aún trae el texto del umbral): si
  // falta o dice "umbral", cae al literal — idéntico entre la card y ambos drawers (LTR/STR).
  const tieneData = v.tieneData;
  const fuenteHist = (v.fuente && !/umbral/i.test(v.fuente))
    ? v.fuente
    : (tieneData ? "Histórico 2014-2024 · Arenas & Cayo, Tinsa, Propital, Activo Más" : "Promedio histórico Gran Santiago 2014-2024");

  return (
    <div>
      <Lead>
        La{" "}
        <Jerga
          term="plusvalía"
          gloss="cuánto sube de precio el depto con los años"
          tip="Plusvalía = cuánto sube de precio el depto con los años."
        />{" "}
        {historicoNegativo
          ? `suele ser el motor grande del retorno a largo plazo — pero acá el histórico juega en contra: ${comunaLabel} viene retrocediendo un ${pctStr(Math.abs(anual))} real anual.`
          : "es el motor que más pesa en tu retorno a largo plazo. Por eso conviene mirar de dónde sale el número y qué tan garantizado está."}
      </Lead>

      <Chips
        label={tieneData ? `Histórico de ${comunaLabel}` : "Apreciación de referencia"}
        cells={[
          { k: tieneData ? "Se valorizó" : "Referencia (GS)", v: pctStr(anual), small: "anual" },
          { k: "Umbral real", v: pctStr(umbral), small: "anual" },
        ]}
        foot={`${pctStr(anual)} anual — ${cmp} el ${pctStr(umbral)} que marca la apreciación real (valor por sobre inflación).`}
      />

      <Box label="De dónde sale">
        {tieneData ? (
          <>
            {fuenteHist} (de {comunaLabel}). Es una{" "}
            <b>referencia histórica, no una garantía a futuro</b>: {comunaLabel}{" "}
            {historicoNegativo ? "venía cayendo a ese ritmo" : "se movió con ese ritmo"} la última década, y nada
            asegura que {historicoNegativo ? "revierta la tendencia" : "lo repita"} los próximos diez años.
          </>
        ) : (
          <>
            No hay histórico propio de {comunaLabel}: usamos el <b>promedio del Gran Santiago</b> (~{pctStr(anual)}{" "}
            real) como referencia — supuesto conservador, sin dato comunal.
          </>
        )}{" "}
        Hacia adelante es otra cosa: la proyección de patrimonio y TIR usa{" "}
        <b>{PROYECCION_FRANCO_PCT} anual parejo</b> (la proyección estándar Franco a futuro), no este histórico —
        el histórico es el contexto de riesgo sobre esa apuesta.
      </Box>

      {historicoNegativo ? (
        <Box label="Ojo con el supuesto" tone="red">
          {contrafactualVisible ? (
            <>
              Pese al retroceso histórico, la proyección a 10 años igual valoriza el depto — es un supuesto del
              modelo, no el histórico de {comunaLabel}. Si la comuna solo se queda plana (0% real), tu
              multiplicador cae de <b>{multStr(multActual)} a {multStr(multSinPlus)}</b>: {consecuenciaMultEquity(multSinPlus)}.
              Y quedarse plana ya sería mejor que su tendencia real. No compres asumiendo que la comuna se da vuelta.
            </>
          ) : (
            <>La proyección no le carga retorno relevante a la valorización: lo que ves en TIR y patrimonio se sostiene del arriendo y la amortización.</>
          )}
        </Box>
      ) : (
        <Box label="Qué pasa si se detiene" tone="red">
          {contrafactualVisible ? (
            <>
              Si la comuna dejara de apreciarse (0% real), tu multiplicador a 10 años cae de{" "}
              <b>{multStr(multActual)} a {multStr(multSinPlus)}</b>: {consecuenciaMultEquity(multSinPlus)}. Es el
              supuesto más frágil de todo el análisis.
            </>
          ) : (
            <>La proyección no le carga retorno relevante a la valorización: lo que ves en TIR y patrimonio se sostiene del arriendo y la amortización.</>
          )}
        </Box>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STR — 6 drawers propios (financiamiento · precio · retorno · patrimonio ·
// plusvalía · estructura de costos). Reusan las primitivas; la derivación es
// STR-específica (ShortTermResult). Guard de exit (opcional en filas legacy).
// ════════════════════════════════════════════════════════════════════════════

// 5 · FINANCIAMIENTO STR — una sola cadena causal (pie → cuota → flujo)
export function DrawerFinanciamientoStr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoEstructuraFinanciamiento;
  results: ShortTermResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  // GRUPO B — guard por dato crítico: sin crédito no hay cuota ni palanca del pie.
  if (!(results.montoCredito > 0)) {
    return <SinDatos>Datos insuficientes para el detalle de financiamiento (falta el monto del crédito).</SinDatos>;
  }
  const cuota = results.dividendoMensual;
  const flujo = results.escenarios?.base?.flujoCajaMensual ?? 0;
  const oldPieFrac = v.piePct / 100;
  const OPTIMO = 25;
  const hayPalanca = v.piePct < OPTIMO && results.montoCredito > 0;

  // Palanca determinística: subir el pie al óptimo (25%) baja crédito → cuota → sube flujo.
  const newPieFrac = OPTIMO / 100;
  const precio = oldPieFrac < 1 ? results.montoCredito / (1 - oldPieFrac) : 0;
  const extraPie = precio * (newPieFrac - oldPieFrac);
  const creditoRatio = (1 - newPieFrac) / (1 - oldPieFrac);
  const deltaCuota = Math.max(cuota - cuota * creditoRatio, 0);
  const newFlujo = flujo + deltaCuota;
  // FIX-5 — adjetivo → número: qué % de la sangría recorta el ahorro de cuota.
  const recorte = flujo < 0 ? Math.round((deltaCuota / Math.abs(flujo)) * 100) : 0;

  const spread = v.spreadBps;
  const tasaMsg =
    Math.abs(spread) <= 25
      ? `La tasa (${pctStr(v.tasaPct)}) está en buen nivel — prácticamente en el promedio de mercado (${pctStr(v.tasaMarketPct)}). El punto flojo es el pie.`
      : spread > 0
        ? `Tu tasa (${pctStr(v.tasaPct)}) está sobre el promedio de mercado (${pctStr(v.tasaMarketPct)}): hay margen para renegociarla.`
        : `Tu tasa (${pctStr(v.tasaPct)}) está bajo el promedio de mercado (${pctStr(v.tasaMarketPct)}) — buen nivel.`;

  return (
    <div>
      <Lead>
        Cómo armas el crédito define cuánta cuota cargas cada mes — y en una renta corta con flujo apretado, eso
        mueve la aguja. Tu pie y tu tasa hoy dejan {hayPalanca ? "un margen menor" : "poco espacio de mejora"}.
      </Lead>

      <Chips
        label="Tu estructura actual"
        cells={[
          { k: "Pie", v: `${v.piePct}%`, small: `· óptimo ${OPTIMO}%` },
          { k: "Tasa", v: pctStr(v.tasaPct) },
          { k: "Cuota / mes", v: fmtMoney(cuota, currency, valorUF) },
        ]}
        foot={tasaMsg}
      />

      {hayPalanca ? (
        <>
          <div
            style={{
              borderLeft: "3px solid var(--franco-text-secondary)",
              background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
              borderRadius: "0 8px 8px 0",
              padding: "14px 16px",
              marginBottom: 14,
            }}
          >
            <p
              className="font-mono uppercase m-0"
              style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--franco-text-secondary)", marginBottom: 8 }}
            >
              La palanca real: el pie
            </p>
            <Chain
              steps={[
                { v: "+" + fmtCompact(extraPie, currency, valorUF), k: <>de pie hoy<br />({v.piePct}% → {OPTIMO}%)</> },
                { v: "−" + fmtMoney(deltaCuota, currency, valorUF), k: <>de cuota<br />al mes</> },
                { v: `${signCompact(flujo, currency, valorUF)} → ${signCompact(newFlujo, currency, valorUF)}`, k: <>tu flujo<br />mensual</>, pos: true },
              ]}
            />
            <p className="font-body m-0" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--franco-text)" }}>
              Un solo movimiento, tres efectos encadenados: pones ~{fmtCompact(extraPie, currency, valorUF)} más de
              pie el día uno, la cuota baja ~{fmtMoney(deltaCuota, currency, valorUF)} al mes, y con eso tu flujo
              mejora de {fmtMoneySigned(flujo, currency, valorUF)} a {fmtMoneySigned(newFlujo, currency, valorUF)} mensuales.
              {newFlujo < 0 ? ` No lo deja neutro, pero le recorta un ~${recorte}% a la sangría` : " Con eso el flujo se da vuelta"}{" "}
              — y es lo único que no depende del mercado ni de la ocupación, solo de cuánto pones día uno.
            </p>
          </div>
          <Box label="Qué haces con esto">
            Si tienes la liquidez para subir el pie, es el ajuste de mayor impacto y menor riesgo. Si no la
            tienes, el flujo negativo es un dato a asumir, no un error a esconder.
          </Box>
        </>
      ) : (
        <Box label="Qué haces con esto">
          Tu pie ya está en el óptimo ({OPTIMO}% o más), así que la palanca del financiamiento está agotada: el
          flujo se resuelve por el lado de la ocupación y la gestión, no del crédito.
        </Box>
      )}
    </div>
  );
}

// 6 · PRECIO / SOBREPRECIO STR — dos lentes (fusión)
export function DrawerPrecioStr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoSobreprecio;
  results: ShortTermResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const precioCLP = results.pie + results.montoCredito;
  // GRUPO B — guard: las dos lentes necesitan precio válido y UF/m² del sujeto (>0)
  // para derivar superficie y valor estimado; sin eso, todo cae a 0.
  if (!(v.sujetoUfM2 > 0) || !(precioCLP > 0)) {
    return <SinDatos>Datos insuficientes para el detalle de precio (falta el precio o el UF/m² del sujeto).</SinDatos>;
  }
  const precioUF = valorUF > 0 ? precioCLP / valorUF : 0;
  const superficie = v.sujetoUfM2 > 0 ? precioUF / v.sujetoUfM2 : 0;
  const valorEstimadoUF = v.medianaComunaUfM2 * superficie;
  const margenUF = valorEstimadoUF - precioUF;
  const margenCLP = margenUF * valorUF;
  const bajoMercado = v.desviacionPct < 0;
  const comuna = v.comuna || "la comuna";

  const fmtUF = (uf: number) => "UF " + Math.round(uf).toLocaleString("es-CL");

  return (
    <div>
      <Lead>
        Dos maneras de mirar lo mismo: cuánto pagas por metro cuadrado frente a {comuna}, y cuánto pagas por el
        depto entero frente a su valor estimado de mercado. Ambas apuntan al mismo lado.
      </Lead>

      <Chips
        label="Lente 1 · por metro cuadrado"
        cells={[
          { k: "Tu m²", v: fmtUF(v.sujetoUfM2), tone: bajoMercado ? "pos" : "red" },
          { k: `Mediana ${comuna}`, v: fmtUF(v.medianaComunaUfM2) },
          { k: "Diferencia", v: `${v.desviacionPct >= 0 ? "+" : "−"}${Math.abs(v.desviacionPct)}%`, tone: bajoMercado ? "pos" : "red" },
        ]}
        foot={`${bajoMercado ? "Entras" : "Pagas"} ${Math.abs(v.desviacionPct)}% ${bajoMercado ? "bajo" : "sobre"} la mediana de publicación de ${comuna}${v.n > 0 ? ` (${v.n} avisos comparables)` : ""}.`}
      />

      <Chips
        label="Lente 2 · el depto entero"
        cells={[
          { k: "Tu precio", v: fmtUF(precioUF), tone: bajoMercado ? "pos" : "plain" },
          { k: "Valor estimado", v: fmtUF(valorEstimadoUF) },
          { k: "Margen", v: signCompact(margenCLP, currency, valorUF), tone: margenCLP >= 0 ? "pos" : "red" },
        ]}
        foot={`Sobre tus ${Math.round(superficie)} m² a mediana comunal, el mercado estimaría ~${fmtUF(valorEstimadoUF)}. ${margenCLP >= 0 ? `Pagas ~${fmtCompact(margenCLP, currency, valorUF)} menos` : `Pagas ~${fmtCompact(margenCLP, currency, valorUF)} de más`}.`}
      />

      <Box label="De dónde sale (sin adornos)">
        El &ldquo;valor estimado de mercado&rdquo; es la <b>mediana de publicaciones</b> de venta de la comuna
        ajustada hacia precio de cierre por un factor asumido — <b>no son transacciones cerradas medidas</b>. Es
        una estimación de referencia, no un valor de tasación. Por eso decimos &ldquo;estimado&rdquo;, nunca
        &ldquo;vale menos&rdquo;.
      </Box>
      <Box label="Tu palanca de negociación">
        {bajoMercado
          ? `Entrar bajo mercado ya te da una ventaja de compra de ~${fmtCompact(margenCLP, currency, valorUF)} el día uno — es parte de por qué tu patrimonio a 10 años cierra a favor pese al flujo negativo. No hay urgencia de bajar más el precio; la palanca de este deal está en el flujo (pie y gestión), no en el precio de entrada.`
          : `Pagas sobre la referencia de mercado, así que acá sí hay espacio para negociar: cada peso que bajes del precio entra directo a tu patrimonio y mejora el flujo (menos crédito, menos cuota).`}
      </Box>
    </div>
  );
}

// 7 · TIR / RETORNO STR — suma reconstruible + 10,3% ya descuenta la caja
export function DrawerTIRStr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoTIR;
  results: ShortTermResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const exit = results.exitScenario;
  // Multiplicador de ESTADO desde el hallazgo patrimonio (única fuente); sin él, el guard
  // decide. Desde F2: STR patrimonioCLP = EQUITY (equity/aportado → ×1 break-even), como LTR.
  const pat = results.hallazgos?.find((h): h is HallazgoPatrimonio => h.id === "patrimonio");
  if (!exit || !pat) return <SinDatos>Datos insuficientes para el detalle de retorno (aún no calculamos la venta a futuro de este análisis).</SinDatos>;

  const tirPct = v.tirPct;
  const umbral = v.umbralPct;
  const margenPts = tirPct - umbral;
  const margen = ptsClass(margenPts);
  const precioCLP = results.pie + results.montoCredito;
  const amort = Math.max(results.montoCredito - exit.saldoCreditoAlVender, 0);
  const flujo = exit.flujoAcumuladoAlVender; // puede ser negativo (drag)
  const plusvalia = Math.max(exit.valorVenta - precioCLP, 0);
  const brutoSinFlujo = plusvalia + amort;
  const bruto = brutoSinFlujo + flujo;

  // Estado desde el hallazgo; contrafáctico "sin la resta" derivado de la MISMA base cruda.
  const net = pat.valor.patrimonioCLP; // equity (STR, desde F2): lo que te queda al vender
  const aportado = pat.valor.aportadoCLP;
  const multActual = pat.valor.multiplicador;
  const netSinResta = net - flujo; // flujo<0 ⇒ suma |flujo|
  const multSinResta = aportado > 0 ? netSinResta / aportado : 0;
  const flujoResta = flujo < 0;

  const maxBar = Math.max(plusvalia, amort, Math.abs(flujo), 1);
  const rows: DecompRow[] = [
    { label: "Plusvalía", value: "+" + fmtCompact(plusvalia, currency, valorUF), widthPct: Math.max((plusvalia / maxBar) * 100, 2), tone: "strong" },
    { label: "Amortización", value: "+" + fmtCompact(amort, currency, valorUF), widthPct: Math.max((amort / maxBar) * 100, 2), tone: "mid" },
    { label: "Flujo 10 años", value: signCompact(flujo, currency, valorUF), widthPct: Math.max((Math.abs(flujo) / maxBar) * 100, 2), tone: flujoResta ? "red" : "weak" },
  ];

  return (
    <div>
      <Lead>
        La{" "}
        <Jerga
          term="TIR"
          gloss="la rentabilidad anual de toda tu inversión"
          tip="TIR = rentabilidad anual de toda tu inversión, juntando caja, amortización y venta."
        />{" "}
        es {pctStr(tirPct)}
        {margen.tone === "red" ? ` — bajo el piso de ${pctStr(umbral)}. ` : `, sobre el piso de ${pctStr(umbral)}. `}
        {flujoResta
          ? "Pero acá hay una vuelta importante: uno de los tres motores del retorno —la caja, la plusvalía y la amortización— no suma, resta, y ese porcentaje ya lo trae descontado."
          : "Se arma de tres motores —la caja, la plusvalía y la amortización—; vale ver cuál lo carga."}
      </Lead>

      <Chips
        label="Tu retorno vs el piso"
        cells={[
          // El semáforo lo lleva el margen: una TIR bajo el piso no se destaca como positiva.
          { k: "Tu TIR", v: pctStr(tirPct), tone: margen.tone === "red" ? "plain" : "pos" },
          { k: "Piso exigible", v: pctStr(umbral) },
          { k: "Margen", v: margen.display, tone: margen.tone },
        ]}
        foot={
          flujoResta
            ? margen.tone === "red"
              ? `Quedas ${dec1(Math.abs(round1(margenPts)))} pts bajo el piso de ${pctStr(umbral)} — y eso ya con la caja negativa descontada, no antes.`
              : `Ese ${margen.display} es sobre el piso de ${pctStr(umbral)} — y está medido después de descontar la caja negativa, no antes. El ${pctStr(tirPct)} no es un retorno bruto que luego baja.`
            : `${pctStr(umbral)} es el mínimo que un crédito apalancado debe rendir para pagar el esfuerzo y la iliquidez de tener un depto.`
        }
      />

      <Decomp rows={rows} net={{ label: "Suma de los tres, en bruto", value: fmtCompact(bruto, currency, valorUF) }} />

      <Box label="Qué significa">
        {flujoResta ? (
          <>
            Tu {pctStr(tirPct)} no viene de la caja — la caja <b>resta</b> {fmtCompact(Math.abs(flujo), currency, valorUF)} en
            el camino, porque el corto te saca plata cada mes. Lo levantan la plusvalía ({fmtCompact(plusvalia, currency, valorUF)})
            y la amortización ({fmtCompact(amort, currency, valorUF)}): juntas suman {fmtCompact(brutoSinFlujo, currency, valorUF)},
            y recién después baja a {fmtCompact(bruto, currency, valorUF)} cuando le restas la caja. El {pctStr(tirPct)} es la
            tasa sobre lo que queda al final —tras esa resta y los costos de vender—, no antes. Sin la resta de la
            caja, lo que terminas teniendo pasaría de <b>~{fmtCompact(net, currency, valorUF)} a ~{fmtCompact(netSinResta, currency, valorUF)}</b> — de{" "}
            {multStr(multActual)} a {multStr(multSinResta)} sobre lo que pusiste.
          </>
        ) : (
          <>
            El grueso de tu {pctStr(tirPct)} lo levantan la plusvalía ({fmtCompact(plusvalia, currency, valorUF)}) y la
            amortización ({fmtCompact(amort, currency, valorUF)}); la caja aporta {fmtCompact(flujo, currency, valorUF)}. Es un
            retorno con base operativa, no solo de valorización.
          </>
        )}
      </Box>
      <Box label="Qué pasa si falla" tone="red">
        Si la comuna no se aprecia, el {pctStr(tirPct)} se desploma: te quedas apoyado {flujoResta ? "solo en la amortización, con una caja que ya es negativa" : "en la amortización y una caja ajustada"}. A
        diferencia de una renta larga sana, este retorno depende fuerte de un supuesto a futuro — vale entrarle
        con los ojos abiertos.
      </Box>
      <Note>No repite el drawer de patrimonio: acá se explica el ritmo del retorno (por qué {pctStr(tirPct)} al año); allá, cuánto es tuyo al final.</Note>
    </div>
  );
}

// 8 · PATRIMONIO STR — self-liquidating con vuelta honesta por signo del flujo
export function DrawerPatrimonioStr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoPatrimonio;
  results: ShortTermResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const exit = results.exitScenario;
  // GRUPO B — guard: sin escenario de salida no hay amortización ni bolsillo que mostrar.
  if (!exit) {
    return <SinDatos>Datos insuficientes para el patrimonio a 10 años (aún no calculamos la venta a futuro de este análisis).</SinDatos>;
  }
  const anios = exit.yearVenta ?? 10; // GRUPO D — horizonte del exit STR, no un 10 hardcoded
  // EQUITY (rama motor-supuestos F2): `patrimonioCLP` (= exit.equityCLP) ya es EQUITY final —
  // lo que te queda en la mano al vender (neto de deuda y comisión, más flujo acumulado), NO la
  // ganancia encima del capital. El multiplicador es equity/aportado → ×1 = break-even, misma vara
  // que LTR. Copy y umbrales alineados a la card (patrimonio-hallazgo): <1 adverso · [1,2) borde ·
  // ≥2 favorable → la fraseCanonica de la card y este drawer dicen lo mismo.
  const patrimonio = v.patrimonioCLP;
  const aportado = v.aportadoCLP;
  const mult = v.multiplicador;
  const amort = Math.max(results.montoCredito - exit.saldoCreditoAlVender, 0);
  const flujoAcum = exit.flujoAcumuladoAlVender;
  const selfLiquidating = flujoAcum >= 0;
  // GRUPO D — el bolsillo STR sale de flujoAcumuladoAlVender, una acumulación NETA (mezcla
  // años + y −); un "$/mes" no sale limpio de lo persistido → se muestra SOLO el total (exacto).
  const bolsillo = Math.abs(Math.min(flujoAcum, 0));

  return (
    <div>
      <Lead>
        El depto vale una cosa; lo tuyo es esa cifra menos la deuda que aún le debes al banco. A {anios}{" "}
        años, tras vender y saldar el crédito, esto es lo que te queda en la mano frente a lo que fuiste
        poniendo.
      </Lead>

      <Chips
        label="Lo tuyo vs lo que pusiste"
        cells={[
          { k: "Tu parte", v: fmtMoney(patrimonio, currency, valorUF) },
          { k: "Aportaste", v: fmtMoney(aportado, currency, valorUF) },
          { k: "Multiplicador", v: multStr(mult), tone: mult >= 2 ? "pos" : mult < 1 ? "red" : "plain" },
        ]}
        foot={`${fmtMoney(patrimonio, currency, valorUF)} contra los ${fmtMoney(aportado, currency, valorUF)} que pusiste entre pie, gastos y aportes del camino.`}
      />

      {selfLiquidating ? (
        <Box label="La deuda que se paga sola">
          El arriendo amortiza <b>{fmtCompact(amort, currency, valorUF)}</b> del crédito en {anios} años, y el
          flujo te queda a favor: no pusiste plata extra para bajar la deuda. El inquilino te construye patrimonio.
        </Box>
      ) : (
        <Box label="Acá la deuda NO se paga sola" tone="red">
          El arriendo sí amortiza <b>{fmtCompact(amort, currency, valorUF)}</b> del crédito en {anios} años — esa
          parte trabaja a tu favor. Pero como el flujo es negativo, no alcanza a cubrir toda la cuota: pusiste{" "}
          <b>{fmtCompact(bolsillo, currency, valorUF)}</b> de tu bolsillo en el camino. La deuda baja, sí, pero en
          parte la pagas tú, no solo el inquilino.
        </Box>
      )}
      <Box label="Qué significa">
        {mult >= 2
          ? `Multiplicas por ${dec1(mult).replace(",0", "")} lo que pusiste, apalancado por dos motores: la deuda que el arriendo amortiza y la plusvalía proyectada. `
          : mult >= 1
            ? `Terminas con más de lo que pusiste (${multStr(mult)}), pero el margen es acotado y buena parte se apoya en la plusvalía proyectada (la ves en el drawer de plusvalía). `
            : `Terminas con menos de lo que pusiste (${multStr(mult)}): ni lo que amortizas ni la plusvalía proyectada alcanzan a devolverte lo que fuiste aportando. `}
        {selfLiquidating
          ? "Tu parte se construye con caja a favor, que es lo más firme."
          : "Además el flujo es negativo: tu parte se construye a pesar de la caja, no gracias a ella."}
      </Box>
    </div>
  );
}

// 9 · PLUSVALÍA STR — misma plantilla, nervio del deal cuando la caja es negativa
export function DrawerPlusvaliaStr({
  hallazgo,
  results,
  comuna,
}: {
  hallazgo: HallazgoPlusvalia;
  results: ShortTermResult;
  comuna: string;
}) {
  const v = hallazgo.valor;
  const exit = results.exitScenario;
  // Multiplicador de ESTADO desde el hallazgo patrimonio (única fuente de verdad). Si falta
  // el hallazgo, el guard decide (SinDatos), sin fallback a recompute. Desde F2: STR es
  // EQUITY (equity/aportado → ×1 break-even), misma vara que LTR.
  const pat = results.hallazgos?.find((h): h is HallazgoPatrimonio => h.id === "patrimonio");
  // GRUPO B — guard: el stress y la lectura de la caja necesitan exit; el estado, el hallazgo.
  if (!exit || !pat) {
    return <SinDatos>Datos insuficientes para el detalle de plusvalía (aún no calculamos la venta a futuro de este análisis).</SinDatos>;
  }
  const anual = v.anualizadaPct;
  const umbral = v.refPct;
  const comunaLabel = comuna || "la comuna";
  const cajaNegativa = exit.flujoAcumuladoAlVender < 0;
  const cmp = cmpMostrado(anual, umbral); // GRUPO A
  const historicoNegativo = round1(anual) < 0; // GRUPO C

  const precioCLP = results.pie + results.montoCredito;
  const plusvaliaProj = Math.max(exit.valorVenta - precioCLP, 0);
  const multActual = pat.valor.multiplicador; // estado (hallazgo)
  const multSinPlus = pat.valor.aportadoCLP > 0 ? (pat.valor.patrimonioCLP - plusvaliaProj) / pat.valor.aportadoCLP : 0; // escenario derivado (misma base cruda)
  // GRUPO C anti-no-op: round1(hallazgo) vs round1(derivado).
  const contrafactualVisible = round1(multActual) !== round1(multSinPlus);
  const tieneData = v.tieneData;
  // v.fuente = procedencia histórica real (F4), fuente única de verdad; fallback defensivo al
  // literal para filas pre-regen (v.fuente con texto del umbral). Idéntico al drawer LTR.
  const fuenteHist = (v.fuente && !/umbral/i.test(v.fuente))
    ? v.fuente
    : (tieneData ? "Histórico 2014-2024 · Arenas & Cayo, Tinsa, Propital, Activo Más" : "Promedio histórico Gran Santiago 2014-2024");
  // FIX-7 — cierre de caja negativa ramificado por caso: "la historia no respalda" solo es cierto
  // con histórico negativo. Con histórico que sí respalda (positivo) o sin dato comunal, cambia.
  const cierreCaja = !cajaNegativa
    ? ""
    : historicoNegativo
      ? " Con la caja también negativa, el deal descansa completo en un supuesto que la historia de la comuna no respalda."
      : tieneData
        ? " Con la caja también negativa, el deal descansa completo en que esa valorización se sostenga los próximos diez años."
        : " Con la caja también negativa, el deal descansa completo en ese supuesto de referencia — sin dato comunal que lo respalde.";

  return (
    <div>
      <Lead>
        {historicoNegativo ? (
          <>
            La{" "}
            <Jerga term="plusvalía" gloss="cuánto sube de precio el depto con los años" tip="Plusvalía = cuánto sube de precio el depto con los años." />{" "}
            suele sostener el retorno a largo plazo, pero acá el histórico juega en contra: {comunaLabel} viene
            retrocediendo un {pctStr(Math.abs(anual))} real anual
            {cajaNegativa ? " — y con la caja también negativa, el deal se apoya en un supuesto que la historia no respalda." : "."}
          </>
        ) : (
          <>
            {cajaNegativa ? "En este deal la " : "La "}
            <Jerga term="plusvalía" gloss="cuánto sube de precio el depto con los años" tip="Plusvalía = cuánto sube de precio el depto con los años." />{" "}
            {cajaNegativa
              ? "no es un extra: es el motor que sostiene todo el retorno, porque la caja es negativa. Por eso importa doble de dónde sale."
              : "aporta al retorno a largo plazo. Conviene mirar de dónde sale el número y qué tan garantizado está."}
          </>
        )}
      </Lead>

      <Chips
        label={tieneData ? `Histórico de ${comunaLabel}` : "Apreciación de referencia"}
        cells={[
          { k: tieneData ? "Se valorizó" : "Referencia (GS)", v: pctStr(anual), small: "anual" },
          { k: "Umbral real", v: pctStr(umbral), small: "anual" },
        ]}
        foot={`${pctStr(anual)} anual — ${cmp} el ${pctStr(umbral)} que marca la apreciación real (valor por sobre inflación).`}
      />

      <Box label="De dónde sale">
        {tieneData ? (
          <>
            {fuenteHist} (de {comunaLabel}). <b>Referencia histórica, no garantía futura.</b>{" "}
            {comunaLabel} {historicoNegativo ? "venía cayendo a ese ritmo" : "se movió con ese ritmo"}{" "}
            la última década; el modelo asume que {historicoNegativo ? "se revierte" : "lo repite"}, pero es un supuesto.
          </>
        ) : (
          <>
            No hay histórico propio de {comunaLabel}: usamos el <b>promedio del Gran Santiago</b> (~{pctStr(anual)}{" "}
            real) como referencia — supuesto conservador, sin dato comunal.
          </>
        )}{" "}
        Hacia adelante, la proyección de patrimonio y TIR usa <b>{PROYECCION_FRANCO_PCT} anual parejo</b> (la
        proyección estándar Franco a futuro), no este histórico — el histórico es el contexto de riesgo sobre esa apuesta.
      </Box>

      {historicoNegativo ? (
        <Box label="Ojo con el supuesto" tone="red">
          {contrafactualVisible ? (
            <>
              Pese al retroceso histórico, la proyección a 10 años igual valoriza el depto — es un supuesto del
              modelo, no el histórico de {comunaLabel}. Si la comuna solo se queda plana (0% real), tu
              multiplicador cae de <b>{multStr(multActual)} a {multStr(multSinPlus)}</b>: {consecuenciaMultEquity(multSinPlus)}.
              Y quedarse plana ya sería mejor que su tendencia real. No compres asumiendo que la comuna se da vuelta.
              {cierreCaja}
            </>
          ) : (
            <>La proyección no le carga retorno relevante a la valorización: lo que ves en TIR y patrimonio se sostiene del arriendo y la amortización.</>
          )}
        </Box>
      ) : (
        <Box label="Qué pasa si se detiene" tone="red">
          {contrafactualVisible ? (
            <>
              {cajaNegativa ? "Acá está el nervio del deal: si" : "Si"} la comuna no se aprecia (0% real), tu
              multiplicador cae de <b>{multStr(multActual)} a {multStr(multSinPlus)}</b>: {consecuenciaMultEquity(multSinPlus)}.
              {cierreCaja}
            </>
          ) : (
            <>La proyección no le carga retorno relevante a la valorización: lo que ves en TIR y patrimonio se sostiene del arriendo y la amortización.</>
          )}
        </Box>
      )}
    </div>
  );
}

// 10 · ESTRUCTURA COSTOS STR — drawer propio (deja de compartir rentabilidad)
export function DrawerEstructuraCostosStr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoEstructuraCostosStr;
  results: ShortTermResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const base = results.escenarios?.base;
  const bruto = base?.ingresoBrutoMensual ?? 0;
  // GRUPO B — guard por dato crítico: sin ingreso bruto, el "de cada $100" no tiene base.
  if (!(bruto > 0)) {
    return <SinDatos>Datos insuficientes para el desglose de costos (falta el ingreso bruto del escenario base).</SinDatos>;
  }
  const costosOp = base?.costosOperativos ?? 0;
  const comision = base?.comisionMensual ?? 0;
  // GRUPO E — el "flujo de hoy" sale de la MISMA fuente que Financiamiento y Sostenibilidad
  // (escenario base), no de str_auto. str_auto/str_admin quedan SOLO para el contraste de gestión.
  const flujoHoy = base?.flujoCajaMensual ?? 0;
  const seVa = Math.round(v.costStackPct);
  const queda = 100 - seVa;
  // GRUPO A — clasifica sobre el ENTERO mostrado ($seVa), no sobre el crudo.
  const dentroDeVara = seVa <= v.bandaAdvPct;

  // GRUPO E — el contraste gestionas-tú vs administrador necesita ambos escenarios;
  // sin uno de los dos NO se mezclan fuentes: se omite el box completo.
  const strAuto = results.comparativa?.str_auto;
  const strAdmin = results.comparativa?.str_admin;
  const gestionComparable = !!strAuto && !!strAdmin;

  return (
    <div>
      <Lead>
        De cada $100 que entran por noches arrendadas, una parte se va en operar el depto antes de que veas un
        peso de utilidad. Cuánto se va decide si el corto respira o no.
      </Lead>

      <Chips
        label="De cada $100 brutos"
        cells={[
          { k: "Se va en costos", v: `$${seVa}`, tone: dentroDeVara ? "plain" : "red" },
          { k: "Vara típica", v: `$${v.bandaFavPct}–$${v.bandaAdvPct}` },
          { k: "Queda operativo", v: `$${queda}` },
        ]}
        foot={`Sobre ${fmtMoney(bruto, currency, valorUF)} brutos al mes: ${fmtMoney(costosOp, currency, valorUF)} de operación (aseo, servicios, insumos) + ${fmtMoney(comision, currency, valorUF)} de comisión.`}
      />

      <Box label="Qué significa">
        {seVa}% está {dentroDeVara ? "dentro de lo típico" : "sobre la vara típica"} para una renta corta — {dentroDeVara ? "no es acá donde se rompe el deal" : "acá sí hay grasa que recortar"}.
        {/* FIX-4 · matriz 2×2 (vara × flujo) */}
        {flujoHoy < 0
          ? dentroDeVara
            ? " El problema del flujo negativo viene de la ocupación y la cuota, no de costos inflados. Cada punto que bajes de comisión o servicios va directo a tu bolsillo, pero no esperes que un recorte de costos dé vuelta el mes."
            : " Acá los costos inflados son parte del problema: recortarlos ayuda de verdad. Pero con esta cuota y esta ocupación, no esperes que solo ese recorte dé vuelta el mes."
          : dentroDeVara
            ? " Cada punto que bajes de comisión o servicios va directo a tu bolsillo."
            : " Los costos están sobre la vara: recortarlos mejora directo tu bolsillo — es la palanca más limpia acá."}
      </Box>
      {gestionComparable && (
        <Box label="La única palanca real: cómo lo gestionas">
          La diferencia grande no está en los insumos, está en quién administra. Gestionándolo tú, el flujo es{" "}
          <b>{fmtMoneySigned(strAuto.flujoCajaMensual, currency, valorUF)}/mes</b>. Con administrador profesional, la
          comisión sube de {fmtMoney(strAuto.comisionMensual, currency, valorUF)} a{" "}
          {fmtMoney(strAdmin.comisionMensual, currency, valorUF)} y el flujo cae a{" "}
          <b>{fmtMoneySigned(strAdmin.flujoCajaMensual, currency, valorUF)}/mes</b>. En un corto tan apretado, tercerizar
          la gestión se come la operación: si no vas a administrarlo tú, los números no dan.
        </Box>
      )}
    </div>
  );
}

// ── DISTANCIA AL VEREDICTO STR — "lo que te separa" ──────────────────────────
// Port del `DrawerDistanciaLtr`. Cambian tres cosas, y ninguna es cosmética:
//   · dos vías que LTR no tiene (la tarifa por noche y el modo de gestión);
//   · la tarifa se marca como APUESTA, no como ajuste — el número de referencia sale de
//     lo que se cobra realmente en la zona, así que pedir superarlo es asumir un riesgo,
//     no corregir un supuesto optimista del usuario;
//   · el caso PURO-GATE, que en LTR no existe: cuando el puntaje ya alcanza la banda de
//     arriba, abrir con "estás cerca del borde" sería falso. Se nombra primero lo que
//     retiene el veredicto y recién después la vía que lo suelta.
export function DrawerDistanciaStr({
  hallazgo,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoDistanciaVeredicto;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const base = v.veredictoBase;
  const objetivo = v.veredictoObjetivo;

  if (v.esEstructural) {
    const dm = v.deltaMinimoFueraDeTope;
    return (
      <div>
        <Lead>
          Tu veredicto es {base}. La pregunta honesta no es qué falta, sino si hay algo que
          alcance: probamos {v.pieEsPalanca ? "subir el pie, " : ""}bajar el precio, subir la
          tarifa por noche, cambiar el modo de gestión y estirar el crédito, cada uno por su
          cuenta y hasta donde deja de ser un ajuste para ser otro departamento.
        </Lead>
        <Box label="Qué encontramos" tone="red">
          {dm ? (
            <span style={{ fontSize: 15, lineHeight: 1.55 }}>
              La vía menos exigente es{" "}
              {dm.palanca === "precio" ? "bajar el precio" : "subir la tarifa por noche"}, y aun
              así pide{" "}
              <b>
                {dm.deltaPct > 0 ? "+" : "−"}
                {pctStr(Math.abs(dm.deltaPct))}
              </b>{" "}
              para llegar a {objetivo}. Estirar el crédito a 30 años tampoco alcanza.
            </span>
          ) : (
            <span style={{ fontSize: 15, lineHeight: 1.55 }}>
              Ninguna llega, ni llevándolas a extremos que ya no son negociación: tarifa al
              doble, precio a un tercio, crédito a 30 años.
            </span>
          )}
        </Box>
        <Box label="Qué significa">
          La brecha no está en cómo estás mirando este departamento — está en el departamento.
          Ajustar supuestos sirve cuando el número está cerca; acá el esfuerzo que pide es de
          otro orden.
        </Box>
        <Box label="Qué haces con esto">
          {v.piePctActual === 0
            ? "Sigue buscando: lo que no cuadra acá es el departamento, y con financiamiento 100% no tienes colchón para absorberlo. Si igual quieres avanzar por razones que no son financieras, está bien saberlo — pero no te cuentes que los números dan."
            : "Guarda el pie para el siguiente. Si igual quieres avanzar por razones que no son financieras, está bien saberlo — pero no te cuentes que los números dan."}
        </Box>
      </div>
    );
  }

  const cells = v.palancas.map((l) => {
    if (l.palanca === "plazo") {
      return { k: "Plazo del crédito", v: `${l.objetivo} años`, small: `desde ${l.actual}` };
    }
    // Pie y gestión se muestran como NIVEL, no como variación: sus deltas vienen en puntos
    // porcentuales y un "+26%" se leería como aumento relativo sobre el valor de hoy.
    if (l.palanca === "pie") {
      return {
        k: "Pie",
        v: pctStr(l.objetivo),
        small: l.actual > 0 ? `desde ${pctStr(l.actual)}` : "hoy sin pie",
      };
    }
    if (l.palanca === "gestion") {
      return {
        k: "Modo de gestión",
        v: l.modoGestionObjetivo === "auto" ? "Lo gestionas tú" : "Con administrador",
        small: `comisión ${pctStr(l.objetivo)} en vez de ${pctStr(l.actual)}`,
      };
    }
    const valor =
      l.palanca === "adr"
        ? fmtMoney(l.objetivo, currency, valorUF)
        : `UF ${Math.round(l.objetivo).toLocaleString("es-CL")}`;
    return {
      k: l.palanca === "adr" ? "Tarifa por noche" : "Precio de cierre",
      v: valor,
      small: `${l.deltaPct > 0 ? "+" : "−"}${pctStr(Math.abs(l.deltaPct))}`,
    };
  });
  const tieneAdr = v.palancas.some((l) => l.palanca === "adr");
  const tienePlazo = v.palancas.some((l) => l.palanca === "plazo");
  const tieneGestion = v.palancas.some((l) => l.palanca === "gestion");
  const tienePie = v.palancas.some((l) => l.palanca === "pie");
  const primera = v.palancas[0]?.palanca;

  return (
    <div>
      <Lead>
        {v.esPuroGate ? (
          <>
            Tu puntaje ya da para {objetivo}: lo que retiene el veredicto en {base} no son
            puntos, es que la operación todavía no cierra. Estas son las vías que la dan
            vuelta, cada una por su cuenta: no se suman, cualquiera alcanza.
          </>
        ) : (
          <>
            Tu veredicto es {base} y está cerca del borde de arriba. Estas son las vías que lo
            cruzan a {objetivo}, cada una por su cuenta: no se suman, cualquiera alcanza.
          </>
        )}
      </Lead>

      <Chips
        label="Las vías, una por una"
        cells={cells}
        foot={
          tieneGestion
            ? "Cambiar el modo de gestión es la única que no te cuesta plata ni depende de nadie más: es la misma propiedad con otra estructura de comisión."
            : tienePlazo
              ? "Estirar el plazo es la única que no depende de negociar con el vendedor ni de que la zona rinda más: alarga la deuda y pagas más intereses en total, pero no te cuesta capital hoy."
              : "Cada valor es el punto exacto donde el veredicto cambia, moviendo esa variable y dejando el resto igual."
        }
      />

      {/* La tarifa NO es un supuesto que se corrige: es una apuesta contra la zona. Este
          bloque existe para que no se lea como una palanca más de la tabla. */}
      {tieneAdr && (
        <Box label="Ojo con la tarifa" tone="red">
          La tarifa de referencia no es un supuesto nuestro: sale de lo que se cobra realmente
          alrededor. Pedirte que la superes no es ajustar un número optimista, es apostar a que
          vas a rendir sobre la mediana de tu zona. Se puede —mejores fotos, calendario bien
          manejado, respuesta rápida—, pero es trabajo tuyo sostenido, no un dato que cambia.
        </Box>
      )}

      <Box label="Qué significa">
        Que el veredicto no esté lejos no lo vuelve un buen negocio por sí solo — lo vuelve un
        negocio que depende de una condición concreta y verificable, en vez de una intuición.
      </Box>
      <Box label="Qué haces con esto">
        {primera === "pie"
          ? "Esta no se negocia con nadie: es plata tuya contra menos crédito. Antes de descartar el departamento, confirma con el banco cuánto baja la cuota con ese pie y si tienes la liquidez sin quedarte sin colchón."
          : primera === "gestion"
            ? "Esta la decides tú y no cuesta capital. Antes de moverla, mira qué estás entregando a cambio: gestionar tú significa responder huéspedes, coordinar aseo y sostener el calendario todas las semanas."
            : primera === "precio"
              ? "Llévalo a la mesa: la diferencia está en rango de negociación, no en otro departamento. Si el vendedor no baja, ya sabes exactamente cuánto te separa."
              : "Antes de decidir, mira qué se cobra hoy por noche en propiedades comparables de tu zona. Si tu departamento no tiene con qué diferenciarse, esa tarifa es una apuesta y no un plan."}
      </Box>
      {v.pieExcluidoPorBono && (
        <Box label="Por qué el pie no aparece acá">
          Tu pie lo cubre la inmobiliaria: subirlo no es una palanca, es deshacer el trato que
          estás evaluando. Por eso las vías de arriba son el precio y la operación — y con el
          pie cubierto, el precio se mira con más dureza, porque alguien está pagando ese bono.
        </Box>
      )}
      <Note>
        {[
          tienePlazo
            ? "El plazo se muestra en tramos de 5 años porque es lo que los bancos ofrecen."
            : null,
          // La ocupación merece explicación propia: es la ausencia que un lector de renta
          // corta va a notar primero.
          "La ocupación no entra como vía: no la fijas tú —sale de tarifa, demanda y reseñas— y en el cálculo mueve exactamente lo mismo que la tarifa, así que aparecería dos veces con otro nombre.",
          tienePie
            ? "La tasa no entra acá: es condición del banco, no del departamento."
            : "El pie y la tasa no entran acá: son condiciones de tu bolsillo y del banco, no del departamento.",
        ]
          .filter(Boolean)
          .join(" ")}
      </Note>
    </div>
  );
}
