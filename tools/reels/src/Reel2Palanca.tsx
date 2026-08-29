import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as cargarSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as cargarSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as cargarMono } from "@remotion/google-fonts/JetBrainsMono";
import {
  ANIOS_EJE_X,
  DUR_SUBIDA,
  GRID_MAX,
  GRID_PASO,
  NM,
  PLOT,
  XMIN_MESES,
  T_CARRERA_INI,
  T_CTA,
  T_FIN,
  T_HOOK_SUBE,
  T_HOOK_VISIBLE,
  ejeYAmortiguado,
  escalonLineal,
  fmtPct,
  fmtUF,
  monotona,
  pathArea,
  pathCurva,
  tCarrera,
} from "./reel2";
import { CTA_DELAY_L1, CTA_DELAY_L2, CTA_DELAY_L3, CTA_FADE, CTA_SUBIDA, px, type Tema } from "./lineas";

const { fontFamily: SERIF } = cargarSerif();
const { fontFamily: SANS } = cargarSans();
const { fontFamily: MONO } = cargarMono();

/** Las curvas de la v8: cubic-bezier(.4,0,.2,1) para el hook, ease para el resto. */
const SUAVE = Easing.bezier(0.4, 0, 0.2, 1);
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

// ── PARIDAD EDITORIAL CON EL REEL 1 ──
// El reel 1 es el estándar publicado; sus constantes tipográficas (en unidades de
// prototipo 405, convertidas con px()) mandan sobre las que trajo la v8, que fue
// hecha a ojo en HTML. Lo que no tiene equivalente en el reel 1 se deriva por
// proporción y queda anotado.
const HOOK_TOP_CHICO = px(100); // safe zone del titular del reel 1
const HOOK_FS_CHICO = px(25); // TITULO_FS del reel 1
const HOOK_LH_CHICO = 1.16;
const ANTETITULO_FS = px(11.5);
/** Factor de las etiquetas de línea: el rótulo del reel 1 es px(9.5) ≈ 25 y el de la
 *  v8 era 29 — todos los tamaños de etiqueta se escalan por 25/29. */
const F_TAG = px(9.5) / 29;
/** Marca de agua del año: el reel 1 la dibuja a 34 unidades de SVG que ocupan el ancho
 *  útil (factor ≈ 2,67) → ~91 px, opacidad 0,15, anclada a la derecha DENTRO del
 *  gráfico. Reemplaza el 150 px centrado de la v8. */
const AGUA_FS = 91;
/**
 * Cierre destacado, calibrado contra las etiquetas de línea: el valor más grande de
 * las etiquetas mide 33 (mono 700) y el hook chico 67 — el rótulo va a 58 (domina el
 * freeze sin disputarle el rango al hook) y el corchete a 7 (más grueso que la línea
 * sin crédito, 6, y por debajo de la protagonista, 9: cierra sin tapar cifras).
 */
const ROTULO_FS = 58;
const CORCHETE_TRAZO = 7;

export type PropsReel2 = {
  /** Todo sale del dataset del backtest — ninguna cifra se escribe acá. */
  anios: number[];
  depto: number[];
  deptoSinCredito: number[];
  plataAportada: number[];
  aporteInicialUF: number;
  capitalRedondoUF: number;
  gananciaNetaUF: number;
  /** Los % de etiquetas y corchete: SIEMPRE de meta.tir, nunca recalculados. */
  tirDeptoPct: number;
  tirSinCreditoPct: number;
  fuente: string;
  tema: Tema;
};

export const Reel2Palanca: React.FC<PropsReel2> = ({
  anios,
  depto,
  deptoSinCredito,
  plataAportada,
  aporteInicialUF,
  capitalRedondoUF,
  gananciaNetaUF,
  tirDeptoPct,
  tirSinCreditoPct,
  fuente,
  tema,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const el = frame / fps;
  const t = tCarrera(el);

  // Nudos anuales como en la v8: mes 0 = aporte inicial, mes 12k = cierre del año k.
  const knotX = [0, ...anios.map((_, k) => (k + 1) * 12)];
  const deptoEn = monotona(knotX, [aporteInicialUF, ...depto]);
  const puroEn = monotona(knotX, [aporteInicialUF, ...deptoSinCredito]);
  const fantEn = escalonLineal(knotX, [aporteInicialUF, ...plataAportada]);

  const yInicial = aporteInicialUF * 1.28;
  const yTarget = (tt: number) =>
    Math.max(yInicial, Math.max(aporteInicialUF, deptoEn(tt), puroEn(tt), fantEn(tt)) * 1.15);
  const ysEje = React.useMemo(
    () => ejeYAmortiguado(yTarget, yInicial, 30),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aporteInicialUF],
  );
  const yMax = ysEje[Math.min(Math.round(el * 60), ysEje.length - 1)];

  // Dominio X móvil, la mecánica del reel 1: la punta de las líneas cabalga el borde
  // derecho mientras el eje se comprime. Única versión tras el A/B.
  const xmax = Math.max(t, XMIN_MESES);
  const X = (tt: number) => PLOT.x0 + (tt / xmax) * (PLOT.x1 - PLOT.x0);
  const Y = (v: number) => PLOT.y1 - (v / yMax) * (PLOT.y1 - PLOT.y0);

  // ── Hook: 3,5 s protagonista, luego sube a la safe zone del reel 1 ──
  // ALINEADO A LA IZQUIERDA en ambos estados, como el bloque editorial del reel 1
  // publicado (verificado contra el post de Instagram): así la transición es continua
  // sin morfear la alineación a mitad del vuelo.
  const opHook =
    interpolate(el, [T_HOOK_VISIBLE, T_HOOK_VISIBLE + 0.9], [0, 1], {
      easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }) *
    interpolate(el, [T_CTA, T_CTA + 1.1], [1, 0], {
      easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
  const pSube = interpolate(el, [T_HOOK_SUBE, T_HOOK_SUBE + DUR_SUBIDA], [0, 1], {
    easing: SUAVE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  // Hook grande a 82 px (antes 78; 86 quebraba "del crédito hipotecario" en dos).
  // 4 líneas × 82 × 1.24 ≈ 407 de alto → centrado vertical parte en ~756.
  const hookTop = 756 + (HOOK_TOP_CHICO - 756) * pSube;
  // Las líneas 3-4 ya fueron leídas en los 3,5 s: se desvanecen durante la subida
  // para no competir con la carrera desde la safe zone.
  const opLineas34 = 1 - pSube;
  const hookFs = 82 + (HOOK_FS_CHICO - 82) * pSube;
  const hookLh = 1.24 + (HOOK_LH_CHICO - 1.24) * pSube;

  // ── Escena: fade-in al subir el hook, fade-out al CTA ──
  const opEscena =
    interpolate(el, [T_HOOK_SUBE, T_HOOK_SUBE + 1.0], [0, 1], {
      easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }) *
    interpolate(el, [T_CTA, T_CTA + 1.2], [1, 0], {
      easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });

  const enFreeze = el > T_FIN;
  const xTags = X(Math.min(t, NM)) + 26 + (enFreeze ? 22 : 0);

  // Etiquetas con anti-colisión de la v8, tipografía a escala del reel 1 (F_TAG).
  // Los % son los de meta.tir (estáticos, desde el año 1 como gatea la v8) — jamás
  // recalculados acá.
  const tags = [
    { nombre: "🏠 Depto con crédito", v: deptoEn(t), color: tema.series[0], alto: Math.round(104 * F_TAG), fsN: Math.round(29 * F_TAG), fsV: Math.round(38 * F_TAG), fsA: Math.round(26 * F_TAG), pct: tirDeptoPct },
    // alto 118 (no 88): el nombre envuelve a DOS líneas con maxWidth 250 y el alto de
    // la v8 era de nombre corto — con 88 el anti-colisión dejaba que el %/año se
    // montara sobre la etiqueta vecina en la ventana comprimida del eje móvil.
    { nombre: "Sin crédito (misma plata)", v: puroEn(t), color: tema.series[1], alto: Math.round(118 * F_TAG), fsN: Math.round(25 * F_TAG), fsV: Math.round(32 * F_TAG), fsA: Math.round(23 * F_TAG), pct: tirSinCreditoPct },
    { nombre: "plata aportada", v: fantEn(t), color: tema.series[2], alto: Math.round(58 * F_TAG), fsN: Math.round(23 * F_TAG), fsV: Math.round(27 * F_TAG), fsA: 0, pct: null as number | null },
  ].map((tg) => ({ ...tg, y: Y(tg.v) }));
  tags.sort((a, b) => a.y - b.y);
  for (let i = 1; i < tags.length; i++) {
    const minGap = (tags[i - 1].alto + tags[i].alto) / 2 + 14;
    if (tags[i].y - tags[i - 1].y < minGap) tags[i].y = tags[i - 1].y + minGap;
  }

  // Cierre: el corchete se DIBUJA (crece del centro a los extremos, 0,5 s) y el
  // rótulo entra después con fade + escala leve 0,92 → 1. Registro sobrio.
  const pCorchete = interpolate(el, [T_FIN, T_FIN + 0.5], [0, 1], {
    easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const pRotulo = interpolate(el, [T_FIN + 0.55, T_FIN + 1.05], [0, 1], {
    easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const opMarca = el > T_HOOK_SUBE + 0.5 && t < 6 ? 1 : 0;

  // ── CTA: crossfade de la v8, layout y cascada del reel 1 ──
  const opCta = interpolate(el, [T_CTA, T_CTA + 1.1], [0, 1], {
    easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const entradaCta = (delay: number) =>
    interpolate(el, [T_CTA + delay, T_CTA + delay + CTA_FADE], [0, 1], {
      easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
  const opL1 = entradaCta(CTA_DELAY_L1);
  const opL2 = entradaCta(CTA_DELAY_L2);
  const opL3 = entradaCta(CTA_DELAY_L3);
  const subir = (op: number) => `translateY(${px(CTA_SUBIDA) * (1 - op)}px)`;

  const anioAgua = 2015 + Math.max(0, Math.min(Math.floor((t - 0.01) / 12), anios.length - 1));

  const xCorchete = X(NM) + 12;
  const yT = Y(deptoEn(NM));
  const yB = Y(puroEn(NM));
  const yMedio = (yT + yB) / 2;
  const semiAlto = (yB - yT) / 2;

  // Grilla con el desvanecido superior de la v8.
  const grilla: { v: number; y: number; op: number }[] = [];
  for (let v = GRID_PASO; v <= GRID_MAX; v += GRID_PASO) {
    const y = Y(v);
    if (y > PLOT.y1 - 6 || y < PLOT.y0 - 120) continue;
    grilla.push({ v, y, op: Math.max(0, Math.min(1, (y - (PLOT.y0 - 120)) / 140)) });
  }

  return (
    <AbsoluteFill style={{ backgroundColor: tema.fondo }}>
      {/* ---------- ESCENA ---------- */}
      <div style={{ position: "absolute", inset: 0, opacity: opEscena }}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", top: 0, left: 0 }}>
          {/* grilla */}
          {grilla.map(({ v, y, op }) => (
            <g key={v} opacity={op}>
              <line x1={PLOT.x0} x2={PLOT.x1 + 40} y1={y} y2={y} stroke={tema.grid} strokeWidth={2} />
              <text x={PLOT.x0 - 16} y={y + 9} textAnchor="end" fill={tema.tx3Grafico} fontFamily={MONO} fontSize={27}>
                {fmtUF(v)}
              </text>
            </g>
          ))}
          {/* ejes */}
          <line x1={PLOT.x0} x2={PLOT.x0} y1={PLOT.y0 - 30} y2={PLOT.y1} stroke={tema.eje} strokeWidth={3} />
          <line x1={PLOT.x0} x2={PLOT.x1 + 40} y1={PLOT.y1} y2={PLOT.y1} stroke={tema.eje} strokeWidth={3} />
          <text x={PLOT.x0 - 58} y={PLOT.y0 - 46} fill={tema.tx3Grafico} fontFamily={MONO} fontSize={24}>UF</text>
          <text x={PLOT.x0 - 16} y={PLOT.y1 + 9} textAnchor="end" fill={tema.tx3Grafico} fontFamily={MONO} fontSize={27}>0</text>
          {/* eje X: solo los años pedidos, fuente 28, aparecen cuando la carrera los pisa */}
          {ANIOS_EJE_X.filter((a) => t >= (a - 2014) * 12 - 0.01).map((a) => {
            const x = X((a - 2014) * 12);
            // Años ADYACENTES del subset (2015/2016 y 2024/2025) quedan a 56 px y una
            // etiqueta mono de 28 mide ~67: el par se separa con anclas end/start.
            const vecinoDespues = ANIOS_EJE_X.includes(a + 1);
            const vecinoAntes = ANIOS_EJE_X.includes(a - 1);
            const ancla = vecinoDespues ? "end" : vecinoAntes ? "start" : "middle";
            return (
              <g key={a}>
                <line x1={x} x2={x} y1={PLOT.y1} y2={PLOT.y1 + 12} stroke={tema.eje} strokeWidth={2} />
                <text x={x} y={PLOT.y1 + 52} textAnchor={ancla} fill={tema.tx3Grafico} fontFamily={MONO} fontSize={28}>
                  {a}
                </text>
              </g>
            );
          })}
          {/* año marca de agua: métrica del reel 1 (≈91 px, 0,15, mono 700, anclada a
              la derecha DENTRO del gráfico) en vez del 150 centrado de la v8 */}
          <text
            x={PLOT.x1 + 34}
            y={PLOT.y1 - 24}
            textAnchor="end"
            fill={tema.marcaAgua}
            opacity={0.15}
            fontFamily={MONO}
            fontWeight={700}
            fontSize={AGUA_FS}
          >
            {anioAgua}
          </text>
          {/* área de la palanca + las tres líneas */}
          <path d={pathArea(deptoEn, puroEn, t, X, Y)} fill={tema.rojo} opacity={0.14} />
          <path d={pathCurva(fantEn, t, X, Y)} fill="none" stroke={tema.series[2]} strokeWidth={5} strokeDasharray="14 16" strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathCurva(puroEn, t, X, Y)} fill="none" stroke={tema.series[1]} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathCurva(deptoEn, t, X, Y)} fill="none" stroke={tema.series[0]} strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
          {/* corchete del freeze: el trazo crece desde el centro hacia los extremos */}
          {pCorchete > 0 && (
            <g>
              <line
                x1={xCorchete}
                x2={xCorchete}
                y1={yMedio - semiAlto * pCorchete}
                y2={yMedio + semiAlto * pCorchete}
                stroke={tema.ink}
                strokeWidth={CORCHETE_TRAZO}
              />
              {pCorchete >= 1 && (
                <>
                  <line x1={xCorchete} x2={xCorchete - 22} y1={yT} y2={yT} stroke={tema.ink} strokeWidth={CORCHETE_TRAZO} />
                  <line x1={xCorchete} x2={xCorchete - 22} y1={yB} y2={yB} stroke={tema.ink} strokeWidth={CORCHETE_TRAZO} />
                </>
              )}
            </g>
          )}
        </svg>

        {/* rótulo del cierre — centrado respecto del corchete (vertical) y del área
            de ploteo (horizontal), con fade + escala 0,92 → 1 */}
        <div
          style={{
            position: "absolute",
            left: (PLOT.x0 + PLOT.x1) / 2,
            top: yMedio,
            transform: `translate(-50%,-50%) scale(${0.92 + 0.08 * pRotulo})`,
            fontFamily: SERIF,
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: ROTULO_FS,
            color: tema.ink,
            opacity: 0.95 * pRotulo,
            whiteSpace: "nowrap",
          }}
        >
          efecto del crédito
        </div>

        {/* marca del aporte inicial */}
        <div
          style={{
            position: "absolute", left: X(0), top: Y(aporteInicialUF),
            transform: "translate(-50%,-140%)", fontFamily: MONO, fontSize: 26,
            color: "#9A9AB4", opacity: opMarca,
          }}
        >
          {fmtUF(aporteInicialUF)} UF
        </div>

        {/* etiquetas con anti-colisión */}
        {tags.map((tg) => (
          <div
            key={tg.nombre}
            style={{
              position: "absolute", left: xTags, top: tg.y, transform: "translateY(-50%)",
              display: "flex", flexDirection: "column", gap: 1, color: tg.color,
              opacity: t > 0.2 ? 1 : 0,
            }}
          >
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: tg.fsN, maxWidth: 250, lineHeight: 1.15 }}>{tg.nombre}</div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: tg.fsV, whiteSpace: "nowrap" }}>{fmtUF(tg.v)} UF</div>
            {tg.pct !== null && t >= 12 && (
              <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: tg.fsA, whiteSpace: "nowrap", opacity: 0.85 }}>
                {fmtPct(tg.pct)}
              </div>
            )}
          </div>
        ))}

        {/* pie del reel 1 publicado: wordmark y, debajo, la línea de fuente — ambos a
            la izquierda, bottom px(48). El wordmark se va con la escena (en el CTA lo
            pone la cascada, no se duplica). */}
        <div style={{ position: "absolute", bottom: px(48), left: px(28), right: px(28), textAlign: "left" }}>
          <div style={{ fontFamily: SERIF, fontSize: px(14), color: tema.ink }}>
            <span style={{ fontStyle: "italic", fontWeight: 400, color: tema.tx3 }}>re</span>
            <b style={{ fontWeight: 700 }}>franco</b>
            <span style={{ color: tema.rojo, fontSize: px(9.5), fontWeight: 600 }}>.ai</span>
          </div>
          <div
            style={{
              marginTop: px(3), fontFamily: SANS, fontSize: px(7.2), lineHeight: 1.4,
              color: tema.fondoSrc,
            }}
          >
            {fuente}
          </div>
        </div>
      </div>

      {/* ---------- HOOK: 4 líneas, quiebres fijos ---------- */}
      <div
        style={{
          position: "absolute", left: px(28), right: px(28), top: hookTop, textAlign: "left",
          fontFamily: SERIF, fontWeight: 700, fontSize: hookFs, lineHeight: hookLh,
          color: tema.ink, opacity: opHook,
        }}
      >
        {/* Comuna del caso, en el slot del antetítulo del reel 1. OJO: el dataset es
            comuna SANTIAGO (GfK 52,8 UF/m² 2015) — ver reporte. */}
        <div
          style={{
            fontFamily: SANS, fontWeight: 600, fontSize: ANTETITULO_FS,
            letterSpacing: "0.20em", textTransform: "uppercase", color: tema.tx3,
            marginBottom: px(9),
          }}
        >
          En Santiago
        </div>
        Pagó UF {fmtUF(capitalRedondoUF)} y ganó
        <br />
        <span style={{ color: tema.rojo }}>UF {fmtUF(gananciaNetaUF)}</span> en 10 años.
        <div style={{ opacity: opLineas34 }}>
          El efecto amplificador
          <br />
          <span style={{ color: tema.rojo }}>del crédito hipotecario</span>
        </div>
      </div>

      {/* Wordmark del hook a pantalla completa, abajo a la izquierda; se despide con
          las líneas 3-4 (la escena trae el suyo en el pie). */}
      <div
        style={{
          position: "absolute", left: px(28), bottom: px(48), fontFamily: SERIF,
          fontSize: px(14), color: tema.ink, opacity: opHook * opLineas34,
        }}
      >
        <span style={{ fontStyle: "italic", fontWeight: 400, color: tema.tx3 }}>re</span>
        <b style={{ fontWeight: 700 }}>franco</b>
        <span style={{ color: tema.rojo, fontSize: px(9.5), fontWeight: 600 }}>.ai</span>
      </div>

      {/* ---------- CTA: layout del reel 1 (cascada izquierda) ---------- */}
      <div
        style={{
          position: "absolute", left: px(26), right: px(22), top: "50%",
          transform: "translateY(-50%)", textAlign: "left", opacity: opCta,
        }}
      >
        <div
          style={{
            fontFamily: SERIF, fontWeight: 700, fontSize: px(44), lineHeight: 1.1,
            color: tema.ink, opacity: opL1, transform: subir(opL1),
          }}
        >
          Analiza tu depto
          <br />
          de inversión
          <br />
          con <span style={{ color: tema.rojo, fontWeight: 700 }}>Franco</span>.
        </div>
        <div
          style={{
            marginTop: px(26), fontFamily: SANS, fontSize: px(26), fontWeight: 600,
            color: tema.ink, opacity: opL2, transform: subir(opL2),
          }}
        >
          El primero es <span style={{ color: tema.rojo }}>gratis</span>{" "}
          <span style={{ fontSize: px(27) }}>🚀</span>
        </div>
        <div
          style={{
            marginTop: px(30), fontFamily: SERIF, fontSize: px(19), color: tema.ink,
            opacity: opL3, transform: subir(opL3),
          }}
        >
          <span style={{ fontStyle: "italic", fontWeight: 400, color: tema.tx3 }}>re</span>
          <b style={{ fontWeight: 700 }}>franco</b>
          <span style={{ color: tema.rojo, fontSize: px(12), fontWeight: 600 }}>.ai</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
