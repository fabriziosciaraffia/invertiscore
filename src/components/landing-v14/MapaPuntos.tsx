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
// ANIMACIÓN: ESTALLIDOS POR TODO EL TERRITORIO (27-sep-2026, pedido de Fabrizio: «que la
// animación de los comparables se note; hoy son puntos que laten»). El mapa entra con todos
// los puntos en un fundido corto y sobre esa base aparecen estallidos, sin parar. El lugar de
// cada estallido se sortea POR TERRITORIO, no por aviso: primero una celda ocupada del mapa
// (todas igual de probables) y después un aviso dentro de ella. Sorteando por aviso, casi todos
// caerían en el centro, que es donde está la mayoría de la oferta.
// Dos variantes para elegir en el preview (`?mapa=a` / `?mapa=b`):
//   · A · ANILLOS — un anillo que se abre desde el aviso y se apaga, con un destello al centro.
//   · B · RACIMOS — el aviso se enciende y el encendido corre a los vecinos, del centro hacia
//     afuera, como una chispa que prende la cuadra.
// Se pausa cuando el mapa sale de pantalla. Con prefers-reduced-motion no hay estallidos: la
// base fija.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { decodificarPuntos } from "./mapa-puntos-codec";
import proj from "./mapa-santiago.proj.json";

/** Fundido de entrada de la base. */
const ENTRADA_MS = 1200;
/** La base va más tenue que el estallido, para que éste se note. */
const ALPHA_BASE = 0.6;
/** Celda del sorteo por territorio (unidades del viewBox de 900 × 1000). */
const CELDA_SORTEO = 40;

type Variante = "a" | "b";
/** A · anillos: uno nuevo cada 90 ms, cada uno dura 1,6 s. B · racimos: uno cada 260 ms. */
const RITMO: Record<Variante, { cada: number; dura: number }> = {
  a: { cada: 90, dura: 1600 },
  b: { cada: 260, dura: 1700 },
};
/** A · el radio final del anillo, en px de pantalla. */
const ANILLO_RADIO = 30;
/** B · el radio del racimo (viewBox), cuántos vecinos prende como mucho, y cuánto tarda en llegar al borde. */
const RACIMO_RADIO = 60;
const RACIMO_MAX = 140;
const RACIMO_CORRE_MS = 560;
const RACIMO_APAGA_MS = 900;
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

/** La grilla del sorteo: los avisos de cada celda ocupada. */
function grillaSorteo(puntos: Float32Array): { celdas: Uint32Array[]; porCelda: Map<number, Uint32Array>; cols: number } {
  const cols = Math.ceil(proj.VW / CELDA_SORTEO);
  const listas = new Map<number, number[]>();
  for (let k = 0; k < puntos.length / 2; k++) {
    const c = Math.floor(puntos[k * 2 + 1] / CELDA_SORTEO) * cols + Math.floor(puntos[k * 2] / CELDA_SORTEO);
    const l = listas.get(c);
    if (l) l.push(k); else listas.set(c, [k]);
  }
  const porCelda = new Map<number, Uint32Array>();
  listas.forEach((l, c) => porCelda.set(c, Uint32Array.from(l)));
  return { celdas: Array.from(porCelda.values()), porCelda, cols };
}

/** El color del cubo, opaco y aclarado un 35 % hacia el blanco: el estallido tiene que notarse
 *  sobre la tinta, y el azul de las zonas con poca oferta, a color pleno, casi no se ve. */
function fuerte(rgba: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgba);
  if (!m) return rgba;
  const c = (v: string) => Math.round(Number(v) + (255 - Number(v)) * 0.35);
  return `rgb(${c(m[1])},${c(m[2])},${c(m[3])})`;
}

interface Estallido {
  t0: number;
  k: number;
  /** B · los vecinos que prende, con el retardo de cada uno. */
  vecinos?: { k: number; d: number }[];
}

export function MapaPuntos() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const variante: Variante = new URLSearchParams(window.location.search).get("mapa") === "b" ? "b" : "a";
    let cancelado = false;
    let raf = 0;
    let puntos: Float32Array | null = null;
    let cubo: Uint8Array | null = null;
    let colores: string[] = [];
    let fuertes: string[] = [];
    let grilla: ReturnType<typeof grillaSorteo> | null = null;
    /** La base: todos los avisos, pintados una vez. */
    let base: HTMLCanvasElement | null = null;
    let visible = false;
    let entrada0 = 0;
    let ultimo = 0;
    let estallidos: Estallido[] = [];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const medir = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        base = null;
      }
      return { w, h, dpr };
    };

    const tamPunto = (dpr: number) => (dpr >= 2 ? 3 : 2);

    const pintarBase = (w: number, h: number, dpr: number) => {
      if (base || !puntos || !cubo) return;
      base = document.createElement("canvas");
      base.width = w;
      base.height = h;
      const ctx = base.getContext("2d");
      if (!ctx) return;
      const sx = w / proj.VW, sy = h / proj.VH;
      const px = tamPunto(dpr);
      const off = Math.floor(px / 2);
      for (let b = 0; b < colores.length; b++) {
        ctx.fillStyle = colores[b];
        for (let k = 0; k < cubo.length; k++) {
          if (cubo[k] !== b) continue;
          ctx.fillRect(Math.round(puntos[k * 2] * sx) - off, Math.round(puntos[k * 2 + 1] * sy) - off, px, px);
        }
      }
    };

    /** Un aviso sorteado por territorio: una celda ocupada al azar, y un aviso dentro de ella. */
    const sortear = (): number => {
      const celdas = grilla!.celdas;
      const c = celdas[Math.floor(Math.random() * celdas.length)];
      return c[Math.floor(Math.random() * c.length)];
    };

    /** B · los vecinos del aviso dentro del radio, con su retardo según la distancia. */
    const vecinosDe = (k: number): { k: number; d: number }[] => {
      if (!grilla || !puntos) return [];
      const x = puntos[k * 2], y = puntos[k * 2 + 1];
      const cx = Math.floor(x / CELDA_SORTEO), cy = Math.floor(y / CELDA_SORTEO);
      const cerca: { k: number; d: number }[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const l = grilla.porCelda.get((cy + dy) * grilla.cols + (cx + dx));
          if (!l) continue;
          for (let i = 0; i < l.length; i++) {
            const j = l[i];
            const d = Math.hypot(puntos[j * 2] - x, puntos[j * 2 + 1] - y);
            if (d <= RACIMO_RADIO) cerca.push({ k: j, d });
          }
        }
      }
      cerca.sort((a, b) => a.d - b.d);
      return cerca.slice(0, RACIMO_MAX).map((v) => ({ k: v.k, d: (v.d / RACIMO_RADIO) * RACIMO_CORRE_MS }));
    };

    const cuadro = (t: number) => {
      if (cancelado || !puntos || !cubo || !visible) return;
      const { w, h, dpr } = medir();
      pintarBase(w, h, dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx || !base) return;
      if (!entrada0) entrada0 = t;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = ALPHA_BASE * Math.min(1, (t - entrada0) / ENTRADA_MS);
      ctx.drawImage(base, 0, 0);
      ctx.globalAlpha = 1;

      // nuevos estallidos, a su ritmo, desde que la base va por la mitad de su entrada
      const { cada, dura } = RITMO[variante];
      if (t - entrada0 > ENTRADA_MS * 0.6) {
        if (!ultimo) ultimo = t;
        while (t - ultimo >= cada) {
          ultimo += cada;
          const k = sortear();
          estallidos.push({ t0: ultimo, k, vecinos: variante === "b" ? vecinosDe(k) : undefined });
        }
      }
      estallidos = estallidos.filter((e) => t - e.t0 < dura);

      const sx = w / proj.VW, sy = h / proj.VH;
      ctx.globalCompositeOperation = "lighter";
      for (const e of estallidos) {
        const p = (t - e.t0) / dura;
        const x = puntos[e.k * 2] * sx, y = puntos[e.k * 2 + 1] * sy;
        const color = fuertes[cubo[e.k]];
        if (variante === "a") {
          // el anillo se abre con un ease-out y se apaga; el destello del centro, más rápido
          const abre = 1 - Math.pow(1 - p, 3);
          ctx.globalAlpha = Math.pow(1 - p, 1.1);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 * dpr;
          ctx.beginPath();
          ctx.arc(x, y, (3 + (ANILLO_RADIO - 3) * abre) * dpr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = Math.pow(1 - p, 2);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 3.2 * dpr, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // el halo del centro, y cada vecino se prende a su turno y se apaga
          const edad = t - e.t0;
          ctx.globalAlpha = Math.max(0, 1 - edad / (RACIMO_CORRE_MS + 300)) * 0.7;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 24 * dpr);
          g.addColorStop(0, color);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, 24 * dpr, 0, Math.PI * 2);
          ctx.fill();
          // los puntos del racimo, redondos y sin sumar luz: sumada, la chispa se quema a blanco
          ctx.globalCompositeOperation = "source-over";
          const radio = 1.9 * dpr;
          for (const v of e.vecinos ?? []) {
            const q = (edad - v.d) / RACIMO_APAGA_MS;
            if (q < 0 || q > 1) continue;
            ctx.globalAlpha = Math.pow(1 - q, 1.4);
            ctx.fillStyle = fuertes[cubo[v.k]];
            ctx.beginPath();
            ctx.arc(puntos[v.k * 2] * sx, puntos[v.k * 2 + 1] * sy, radio * (1 + 0.6 * (1 - q)), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalCompositeOperation = "lighter";
        }
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(cuadro);
    };

    const pintarQuieto = () => {
      const { w, h, dpr } = medir();
      pintarBase(w, h, dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx || !base) return;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = ALPHA_BASE;
      ctx.drawImage(base, 0, 0);
      ctx.globalAlpha = 1;
    };

    const reanudar = () => {
      if (!puntos || cancelado) return;
      if (reduce) { pintarQuieto(); return; }
      if (raf) cancelAnimationFrame(raf);
      // al volver a la pantalla los estallidos siguen desde ahora, sin ponerse al día
      ultimo = 0;
      estallidos = [];
      raf = requestAnimationFrame(cuadro);
    };
    const pausar = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const cargar = async () => {
      try {
        const r = await fetch("/api/landing/mapa-puntos");
        if (!r.ok) return;
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (cancelado) return;
        const decodificados = decodificarPuntos(bytes);
        if (decodificados.length === 0) return;
        puntos = decodificados;
        colores = escalaDensidad();
        fuertes = colores.map(fuerte);
        cubo = cubosPorDensidad(decodificados);
        grilla = grillaSorteo(decodificados);
        if (visible) reanudar();
      } catch {
        /* sin puntos el mapa igual muestra calles y etiquetas */
      }
    };

    // Datos: al acercarse. Estallidos: solo mientras el mapa está en pantalla.
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

    const ro = new ResizeObserver(() => { base = null; if (puntos && (reduce || !visible)) pintarQuieto(); });
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
