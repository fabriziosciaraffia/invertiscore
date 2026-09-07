"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Capa de puntos del mapa: TODOS los avisos activos con coordenadas (~44.000),
// en <canvas>. Cada punto es un depto: Signal Red, 2 px a 1x y 3 px en retina,
// alpha baja para que la acumulación se lea como calor sin que el punto deje de
// ser un punto (FASE 1.3). Los datos llegan del endpoint ISR
// /api/landing/mapa-puntos (binario propio, ~110 KB) y se piden recién cuando
// el mapa se acerca a pantalla.
//
// Animación en loop: llena en oleadas desde Plaza de Armas (2,6 s), sostiene
// 4 s, se desvanece 0,8 s y vuelve a llenar. Se pausa cuando la sección sale
// de pantalla y se retoma donde iba. Con prefers-reduced-motion no hay loop:
// estado final fijo. El canvas se dibuja a resolución del dispositivo.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { decodificarPuntos } from "./mapa-puntos-codec";
import proj from "./mapa-santiago.proj.json";

/** Centro de las oleadas: Plaza de Armas, en unidades del viewBox. */
const CENTRO = {
  x: (-70.6506 - proj.W) * proj.kLat * proj.s + proj.ox,
  y: (proj.N - -33.4378) * proj.s + proj.oy,
};
const LLENAR_MS = 2600;
const SOSTENER_MS = 4000;
const FUNDIR_MS = 800;
const CICLO_MS = LLENAR_MS + SOSTENER_MS + FUNDIR_MS;
const OLEADAS = 4;
/** Alpha de cada punto (elegido con screenshot en FASE 1.3). */
const ALPHA = 0.28;
const COLOR = `rgba(200,50,60,${ALPHA})`;

export function MapaPuntos() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelado = false;
    let raf = 0;
    let puntos: Float32Array | null = null;
    let orden: Uint32Array | null = null;
    /** Copia del estado final, para el sostenido y el fundido sin repintar 44k puntos. */
    let lleno: HTMLCanvasElement | null = null;
    let visible = false;
    /** Tiempo dentro del ciclo al pausar, para retomar donde iba. */
    let faseAlPausar = 0;
    let t0 = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const medir = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        lleno = null;
      }
      return { w, h, dpr };
    };

    const tamPunto = (dpr: number) => (dpr >= 2 ? 3 : 2);

    /** Pinta los primeros `hasta` puntos (orden por distancia al centro) en un contexto. */
    const pintarEn = (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, hasta: number) => {
      if (!puntos || !orden) return;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = COLOR;
      const sx = w / proj.VW, sy = h / proj.VH;
      const px = tamPunto(dpr);
      const off = Math.floor(px / 2);
      for (let i = 0; i < hasta; i++) {
        const k = orden[i] * 2;
        ctx.fillRect(Math.round(puntos[k] * sx) - off, Math.round(puntos[k + 1] * sy) - off, px, px);
      }
    };

    const estadoFinal = () => {
      const { w, h, dpr } = medir();
      if (!lleno) {
        lleno = document.createElement("canvas");
        lleno.width = w;
        lleno.height = h;
        const c = lleno.getContext("2d");
        if (c && orden) pintarEn(c, w, h, dpr, orden.length);
      }
      return { w, h, dpr };
    };

    const cuadro = (t: number) => {
      if (cancelado || !orden || !visible) return;
      if (!t0) t0 = t - faseAlPausar;
      const fase = (t - t0) % CICLO_MS;
      const { w, h, dpr } = estadoFinal();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (fase < LLENAR_MS) {
        const p = fase / LLENAR_MS;
        const ol = Math.min(OLEADAS - 1, Math.floor(p * OLEADAS));
        const dentro = p * OLEADAS - ol;
        const frac = (ol + (1 - Math.pow(1 - dentro, 3))) / OLEADAS;
        pintarEn(ctx, w, h, dpr, Math.round(frac * orden.length));
      } else if (fase < LLENAR_MS + SOSTENER_MS) {
        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = 1;
        if (lleno) ctx.drawImage(lleno, 0, 0);
      } else {
        const p = (fase - LLENAR_MS - SOSTENER_MS) / FUNDIR_MS;
        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = 1 - p;
        if (lleno) ctx.drawImage(lleno, 0, 0);
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(cuadro);
    };

    const pintarFinal = () => {
      const { w, h } = estadoFinal();
      const ctx = canvas.getContext("2d");
      if (!ctx || !lleno) return;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(lleno, 0, 0);
    };

    const reanudar = () => {
      if (!orden || cancelado) return;
      if (reduce) { pintarFinal(); return; }
      if (raf) cancelAnimationFrame(raf);
      t0 = 0;
      raf = requestAnimationFrame(cuadro);
    };
    const pausar = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        if (t0) faseAlPausar = (performance.now() - t0) % CICLO_MS;
      }
    };

    const cargar = async () => {
      try {
        const r = await fetch("/api/landing/mapa-puntos");
        if (!r.ok) return;
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (cancelado) return;
        puntos = decodificarPuntos(bytes);
        const n = puntos.length / 2;
        const d = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const dx = puntos[i * 2] - CENTRO.x, dy = puntos[i * 2 + 1] - CENTRO.y;
          d[i] = dx * dx + dy * dy;
        }
        orden = new Uint32Array(n);
        for (let i = 0; i < n; i++) orden[i] = i;
        orden.sort((a, b) => d[a] - d[b]);
        if (visible) reanudar();
      } catch {
        /* sin puntos el mapa igual muestra calles y etiquetas */
      }
    };

    // Datos: al acercarse. Loop: solo mientras el mapa está en pantalla.
    let cargado = false;
    const obs = new IntersectionObserver(
      (es) => {
        const e = es[0];
        if (!e) return;
        if (e.isIntersecting && !cargado) { cargado = true; void cargar(); }
        visible = e.isIntersecting;
        if (visible) reanudar(); else pausar();
      },
      { rootMargin: "200px 0px", threshold: 0 },
    );
    obs.observe(canvas);

    const ro = new ResizeObserver(() => { lleno = null; if (orden && (reduce || !visible)) pintarFinal(); });
    ro.observe(canvas);

    return () => {
      cancelado = true;
      obs.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="lv-map-puntos" aria-hidden="true" />;
}
