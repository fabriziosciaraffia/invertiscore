"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Capa de puntos del mapa: TODOS los avisos activos con coordenadas (~44.000),
// en <canvas>. Cada punto es un depto: Signal Red, 2 px a 1x y 3 px en retina,
// alpha baja para que la acumulación se lea como calor sin que el punto deje de
// ser un punto. Los datos llegan del endpoint ISR /api/landing/mapa-puntos
// (binario propio, ~110 KB) y se piden recién cuando el mapa se acerca.
//
// Animación en loop (FASE 1.4): los puntos aparecen en orden ALEATORIO (barajado
// determinista) hasta llenar en ~6 s, sostiene 5 s, se desvanece 1 s y vuelve a
// empezar. Se pausa cuando el mapa sale de pantalla y retoma donde iba. Con
// prefers-reduced-motion no hay loop: estado final fijo.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { decodificarPuntos } from "./mapa-puntos-codec";
import proj from "./mapa-santiago.proj.json";

const LLENAR_MS = 6000;
const SOSTENER_MS = 5000;
const FUNDIR_MS = 1000;
const CICLO_MS = LLENAR_MS + SOSTENER_MS + FUNDIR_MS;
/** Alpha de cada punto (elegido con screenshot en FASE 1.3). */
const ALPHA = 0.28;
const COLOR = `rgba(200,50,60,${ALPHA})`;

/** Barajado Fisher-Yates con semilla fija: mismo orden en cada carga. */
function barajar(n: number): Uint32Array {
  const o = new Uint32Array(n);
  for (let i = 0; i < n; i++) o[i] = i;
  let s = 0x9e3779b9;
  const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) >>> 0); s = (Math.imul(s ^ (s >>> 12), 0x297a2d39) >>> 0); return (s ^ (s >>> 15)) >>> 0; };
  for (let i = n - 1; i > 0; i--) {
    const j = rnd() % (i + 1);
    const t = o[i]; o[i] = o[j]; o[j] = t;
  }
  return o;
}

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

    /** Pinta los primeros `hasta` puntos del orden barajado en un contexto. */
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
        // llenado parejo con un leve ease-out al final
        const p = fase / LLENAR_MS;
        const frac = 1 - Math.pow(1 - p, 1.4);
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
        orden = barajar(puntos.length / 2);
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
