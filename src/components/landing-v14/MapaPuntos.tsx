"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Capa de puntos del mapa: TODOS los avisos activos con coordenadas (~44.000),
// en <canvas>. Cada punto es un depto, 2 px a 1x y 3 px en retina, alpha baja
// para que la acumulación se lea como calor sin que el punto deje de ser un punto.
// Los datos llegan del endpoint ISR /api/landing/mapa-puntos (binario propio,
// ~110 KB) y se piden recién cuando el mapa se acerca.
//
// Color por DENSIDAD (FASE 1.8): cada punto toma un color de la escala del hero
// (azul → ciruela → rojo, leída de los tokens [data-verdict] de globals.css)
// según cuántos avisos hay en su celda (18 unidades del viewBox, ~12 px en
// pantalla), en escala logarítmica: las zonas con más oferta tiran a rojo, las de
// menos a azul. Es dato, no decoración: la escala se explica antes de que
// aparezca en el informe.
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
/** Alpha por extremo. El rojo (zonas densas, los puntos se acumulan) conserva el
 *  0,28 elegido con screenshot en FASE 1.3; el azul (puntos sueltos sobre tinta)
 *  necesita más cuerpo o desaparece: a 0,4 no se veía (QA 08-sep). */
const ALPHA_ROJO = 0.28;
const ALPHA_CIRUELA = 0.5;
const ALPHA_AZUL = 0.75;
const CUBOS = 12;
const CELDA = 18;

/** `--verdict` de un veredicto, leído del token de globals.css. */
function tokenVerdict(veredicto: string): [number, number, number] | null {
  const el = document.createElement("span");
  el.setAttribute("data-verdict", veredicto);
  el.style.display = "none";
  document.body.appendChild(el);
  const v = getComputedStyle(el).getPropertyValue("--verdict").trim();
  el.remove();
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Escala azul → ciruela → rojo en CUBOS pasos, como rgba listos para el canvas. */
function escalaDensidad(): string[] {
  const azul = tokenVerdict("COMPRAR");
  const ciruela = tokenVerdict("AJUSTA SUPUESTOS");
  const rojo = tokenVerdict("BUSCAR OTRA");
  const out: string[] = [];
  for (let b = 0; b < CUBOS; b++) {
    const t = b / (CUBOS - 1);
    const alpha = t < 0.5 ? ALPHA_AZUL + (ALPHA_CIRUELA - ALPHA_AZUL) * t * 2 : ALPHA_CIRUELA + (ALPHA_ROJO - ALPHA_CIRUELA) * (t - 0.5) * 2;
    if (!azul || !ciruela || !rojo) {
      // sin tokens (no debería pasar): Signal Red plano, como antes de FASE 1.8
      out.push(`rgba(200,50,60,${ALPHA_ROJO})`);
      continue;
    }
    const [a, c] = t < 0.5 ? [azul, ciruela] : [ciruela, rojo];
    const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const mix = (i: number) => Math.round(a[i] + (c[i] - a[i]) * u);
    out.push(`rgba(${mix(0)},${mix(1)},${mix(2)},${alpha.toFixed(3)})`);
  }
  return out;
}

/** Cubo de densidad (0 = azul … CUBOS-1 = rojo) de cada punto, por celda y en log. */
function cubosPorDensidad(puntos: Float32Array): Uint8Array {
  const n = puntos.length / 2;
  const cols = Math.ceil(proj.VW / CELDA), filas = Math.ceil(proj.VH / CELDA);
  const cuenta = new Uint32Array(cols * filas);
  const celda = new Uint32Array(n);
  for (let k = 0; k < n; k++) {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(puntos[k * 2] / CELDA)));
    const cy = Math.min(filas - 1, Math.max(0, Math.floor(puntos[k * 2 + 1] / CELDA)));
    celda[k] = cy * cols + cx;
    cuenta[celda[k]]++;
  }
  let max = 1;
  for (let i = 0; i < cuenta.length; i++) if (cuenta[i] > max) max = cuenta[i];
  const lmax = Math.log1p(max);
  const out = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const t = Math.log1p(cuenta[celda[k]]) / lmax;
    out[k] = Math.min(CUBOS - 1, Math.floor(t * CUBOS));
  }
  return out;
}

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
    /** Índices de cada cubo de densidad, en el orden barajado: el llenado sigue
     *  siendo aleatorio y el canvas cambia de color solo CUBOS veces por cuadro. */
    let porCubo: Uint32Array[] = [];
    let colores: string[] = [];
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

    /** Pinta la fracción `frac` (0..1) de cada cubo, en su orden barajado. */
    const pintarEn = (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, frac: number) => {
      if (!puntos || !orden) return;
      ctx.clearRect(0, 0, w, h);
      const sx = w / proj.VW, sy = h / proj.VH;
      const px = tamPunto(dpr);
      const off = Math.floor(px / 2);
      for (let b = 0; b < porCubo.length; b++) {
        const idx = porCubo[b];
        const hasta = Math.round(frac * idx.length);
        ctx.fillStyle = colores[b];
        for (let i = 0; i < hasta; i++) {
          const k = idx[i] * 2;
          ctx.fillRect(Math.round(puntos[k] * sx) - off, Math.round(puntos[k + 1] * sy) - off, px, px);
        }
      }
    };

    const estadoFinal = () => {
      const { w, h, dpr } = medir();
      if (!lleno) {
        lleno = document.createElement("canvas");
        lleno.width = w;
        lleno.height = h;
        const c = lleno.getContext("2d");
        if (c && orden) pintarEn(c, w, h, dpr, 1);
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
        pintarEn(ctx, w, h, dpr, frac);
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
        colores = escalaDensidad();
        const cubo = cubosPorDensidad(puntos);
        const listas: number[][] = Array.from({ length: CUBOS }, () => []);
        for (let i = 0; i < orden.length; i++) listas[cubo[orden[i]]].push(orden[i]);
        porCubo = listas.map((l) => Uint32Array.from(l));
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
