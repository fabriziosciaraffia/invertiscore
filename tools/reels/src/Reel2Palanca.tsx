import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as cargarSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as cargarSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as cargarMono } from "@remotion/google-fonts/JetBrainsMono";
import {
  ANIOS_EJE_X,
  GRID_MAX,
  GRID_PASO,
  NM,
  PLOT,
  TEMA_REEL2,
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
import type { Tema } from "./lineas";

const { fontFamily: SERIF } = cargarSerif();
const { fontFamily: SANS } = cargarSans();
const { fontFamily: MONO } = cargarMono();

/** Las curvas de la v8: cubic-bezier(.4,0,.2,1) para el hook, ease para el resto. */
const SUAVE = Easing.bezier(0.4, 0, 0.2, 1);
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

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

  const X = (tt: number) => PLOT.x0 + (tt / NM) * (PLOT.x1 - PLOT.x0);
  const Y = (v: number) => PLOT.y1 - (v / yMax) * (PLOT.y1 - PLOT.y0);

  // ── Hook: nace protagonista al centro, sube a la safe zone y se achica ──
  const opHook =
    interpolate(el, [T_HOOK_VISIBLE, T_HOOK_VISIBLE + 0.9], [0, 1], {
      easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }) *
    interpolate(el, [T_CTA, T_CTA + 1.1], [1, 0], {
      easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
  const pSube = interpolate(el, [T_HOOK_SUBE, T_HOOK_SUBE + 1.1], [0, 1], {
    easing: SUAVE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  // v8: top 44% (845px) → 130px · font 78 → 60.
  const hookTop = 845 + (130 - 845) * pSube;
  const hookFs = 78 + (60 - 78) * pSube;

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

  // Etiquetas con anti-colisión de la v8. Los % son los de meta.tir (estáticos, desde
  // el año 1 de carrera como gatea la v8) — jamás recalculados acá.
  const tags = [
    { nombre: "🏠 Depto con crédito", v: deptoEn(t), color: tema.series[0], alto: 104, fsN: 29, fsV: 38, fsA: 26, pct: tirDeptoPct },
    { nombre: "Depto sin crédito", v: puroEn(t), color: tema.series[1], alto: 88, fsN: 25, fsV: 32, fsA: 23, pct: tirSinCreditoPct },
    { nombre: "plata aportada", v: fantEn(t), color: tema.series[2], alto: 58, fsN: 23, fsV: 27, fsA: 0, pct: null as number | null },
  ].map((tg) => ({ ...tg, y: Y(tg.v) }));
  tags.sort((a, b) => a.y - b.y);
  for (let i = 1; i < tags.length; i++) {
    const minGap = (tags[i - 1].alto + tags[i].alto) / 2 + 8;
    if (tags[i].y - tags[i - 1].y < minGap) tags[i].y = tags[i - 1].y + minGap;
  }

  const opCorchete = interpolate(el, [T_FIN, T_FIN + 0.6], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const opPalancaLbl = interpolate(el, [T_FIN + 0.4, T_FIN + 1.1], [0, 0.92], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const opMarca = el > T_HOOK_SUBE + 0.5 && t < 6 ? 1 : 0;

  // ── CTA: crossfade + cascada de la v8 ──
  const opCta = interpolate(el, [T_CTA, T_CTA + 1.1], [0, 1], {
    easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const entradaCta = (delay: number) =>
    interpolate(el, [T_CTA + delay, T_CTA + delay + 0.7], [0, 1], {
      easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
  const opL1 = entradaCta(0.7);
  const opL2 = entradaCta(1.6);
  const opWm = entradaCta(2.5);

  const anioAgua = 2015 + Math.max(0, Math.min(Math.floor((t - 0.01) / 12), anios.length - 1));

  const xCorchete = X(NM) + 12;
  const yT = Y(deptoEn(NM));
  const yB = Y(puroEn(NM));
  const tl = 100;

  // Grilla con el desvanecido superior de la v8.
  const grilla: { v: number; y: number; op: number }[] = [];
  for (let v = GRID_PASO; v <= GRID_MAX; v += GRID_PASO) {
    const y = Y(v);
    if (y > PLOT.y1 - 6 || y < PLOT.y0 - 120) continue;
    grilla.push({ v, y, op: Math.max(0, Math.min(1, (y - (PLOT.y0 - 120)) / 140)) });
  }

  const [hookPre, hookPost] = ["Pagó ", ` en 10 años.`];

  return (
    <AbsoluteFill style={{ backgroundColor: tema.fondo }}>
      {/* ---------- ESCENA ---------- */}
      <div style={{ position: "absolute", inset: 0, opacity: opEscena }}>
        {/* Título del gráfico, bajo el hook: chico y sobrio. */}
        <div
          style={{
            position: "absolute", left: 70, right: 70, top: 292, textAlign: "center",
            fontFamily: SANS, fontWeight: 500, fontSize: 30, letterSpacing: "0.04em",
            color: tema.tx3,
          }}
        >
          El efecto amplificador del crédito
        </div>

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
            // Lo cazó el still de verificación, no el prototipo (que los montaba).
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
          {/* área de la palanca + las tres líneas */}
          <path d={pathArea(deptoEn, puroEn, t, X, Y)} fill={tema.rojo} opacity={0.14} />
          <path d={pathCurva(fantEn, t, X, Y)} fill="none" stroke={tema.series[2]} strokeWidth={5} strokeDasharray="14 16" strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathCurva(puroEn, t, X, Y)} fill="none" stroke={tema.series[1]} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathCurva(deptoEn, t, X, Y)} fill="none" stroke={tema.series[0]} strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
          {/* corchete del freeze */}
          <g opacity={opCorchete}>
            <line x1={xCorchete} x2={xCorchete} y1={yT} y2={yB} stroke={tema.ink} strokeWidth={4} />
            <line x1={xCorchete} x2={xCorchete - 16} y1={yT} y2={yT} stroke={tema.ink} strokeWidth={4} />
            <line x1={xCorchete} x2={xCorchete - 16} y1={yB} y2={yB} stroke={tema.ink} strokeWidth={4} />
          </g>
        </svg>

        {/* rótulo de la palanca */}
        <div
          style={{
            position: "absolute", left: X(tl), top: (Y(deptoEn(tl)) + Y(puroEn(tl))) / 2,
            transform: "translate(-50%,-50%)", fontFamily: SERIF, fontStyle: "italic",
            fontWeight: 600, fontSize: 48, color: tema.rojo, opacity: opPalancaLbl,
          }}
        >
          la palanca
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
            {/* La v8 los dejaba en nowrap y el lienzo cortaba "con crédito" en el
                freeze — acá envuelven a dos líneas dentro del borde. */}
            <div style={{ fontFamily: SANS, fontWeight: tg.fsA ? 600 : 500, fontSize: tg.fsN, maxWidth: 250, lineHeight: 1.15 }}>{tg.nombre}</div>
            <div style={{ fontFamily: MONO, fontWeight: tg.fsA ? 700 : 500, fontSize: tg.fsV, whiteSpace: "nowrap" }}>{fmtUF(tg.v)} UF</div>
            {tg.pct !== null && t >= 12 && (
              <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: tg.fsA, whiteSpace: "nowrap", opacity: 0.85 }}>
                {fmtPct(tg.pct)}
              </div>
            )}
          </div>
        ))}

        {/* año marca de agua */}
        <div
          style={{
            position: "absolute", left: 0, right: 0, bottom: 200, textAlign: "center",
            fontFamily: MONO, fontWeight: 700, fontSize: 150, color: tema.marcaAgua,
            opacity: 0.1, letterSpacing: 6,
          }}
        >
          {anioAgua}
        </div>

        {/* fuente */}
        <div
          style={{
            position: "absolute", bottom: 58, left: 70, right: 70, textAlign: "center",
            fontFamily: SANS, fontSize: 19, lineHeight: 1.4, color: tema.fondoSrc,
          }}
        >
          {fuente}
        </div>
      </div>

      {/* ---------- HOOK ---------- */}
      <div
        style={{
          position: "absolute", left: 70, right: 70, top: hookTop, textAlign: "center",
          fontFamily: SERIF, fontWeight: 600, fontSize: hookFs, lineHeight: 1.24,
          color: tema.ink, opacity: opHook,
        }}
      >
        {hookPre}UF {fmtUF(capitalRedondoUF)} y ganó{" "}
        <span style={{ color: tema.rojo, fontWeight: 700 }}>UF {fmtUF(gananciaNetaUF)}</span>
        {hookPost}
      </div>

      {/* ---------- CTA ---------- */}
      <div
        style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 36, opacity: opCta,
        }}
      >
        <div style={{ fontFamily: SERIF, color: tema.ink, fontSize: 56, fontWeight: 600, textAlign: "center", lineHeight: 1.3, maxWidth: 820, opacity: opL1, transform: `translateY(${24 * (1 - opL1)}px)` }}>
          Analiza tu depto de inversión con Franco.
        </div>
        <div style={{ fontFamily: SERIF, color: tema.ink, fontSize: 48, fontWeight: 600, textAlign: "center", lineHeight: 1.3, opacity: opL2, transform: `translateY(${24 * (1 - opL2)}px)` }}>
          El primero es gratis 🚀
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 74, color: tema.ink, marginTop: 20, opacity: opWm }}>
          <span style={{ fontStyle: "italic", fontWeight: 400, opacity: 0.45 }}>re</span>
          <span style={{ fontWeight: 700 }}>franco</span>
          <span style={{ color: tema.rojo, fontSize: 40, fontWeight: 600 }}>.ai</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
