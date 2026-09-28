"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Capa de puntos del mapa: TODOS los avisos activos con coordenadas (~43.000),
// en <canvas>. Cada punto es un depto, 2 px a 1x y 3 px en retina, alpha baja
// para que la acumulación se lea como calor sin que el punto deje de ser un punto.
// Los datos llegan del endpoint ISR /api/landing/mapa-puntos (binario propio,
// ~110 KB) y se piden recién cuando el mapa se acerca.
//
// Color por DENSIDAD (FASE 1.8): cada punto toma un color de la escala del hero
// (azul → ciruela → rojo, leída de los tokens [data-verdict] de globals.css)
// según cuántos avisos hay en su celda, en escala logarítmica: las zonas con más
// oferta tiran a rojo, las de menos a azul. Es dato, no decoración.
//
// EL MAPA SE PUEBLA (27-sep-2026, decisión de Fabrizio). Los comparables aparecen en
// RACIMOS, más o menos desordenados por todo el territorio, y SE QUEDAN, hasta que el mapa
// queda lleno; el contador de «Por qué creerle» sube junto con el poblamiento y termina en
// la cifra de la fuente única. Después el mapa respira apenas y no vuelve a empezar.
//   · Cada racimo nace en un aviso que se sortea por TERRITORIO: una celda con avisos por
//     aparecer, con probabilidad ∝ √(los que le quedan), y un aviso dentro de ella. Sorteando
//     por aviso casi todo caería en el centro; parejo por celda, la periferia se llenaría
//     primero y el centro al final. La raíz reparte.
//   · El racimo prende los vecinos del aviso que todavía no aparecieron, del centro hacia
//     afuera, con un destello que se asienta en el color de su densidad.
//   · El ritmo va por AVISOS, no por racimos: el contador sube parejo con lo que se ve.
// Se pausa cuando el mapa sale de pantalla y retoma donde iba. Con prefers-reduced-motion,
// el mapa lleno y la cifra final desde el primer momento.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { decodificarPuntos } from "./mapa-puntos-codec";
import { useProgresoMapa } from "./Poblamiento";
import proj from "./mapa-santiago.proj.json";

/** Cuánto tarda en poblarse el mapa entero. */
const POBLAR_MS = 7200;
/** El destello de cada racimo antes de asentarse. */
const DESTELLO_MS = 650;
/** Celda del sorteo por territorio (unidades del viewBox de 900 × 1000). */
const CELDA_SORTEO = 40;
/** Radio del racimo (viewBox) y cuántos avisos prende como mucho. */
const RACIMO_RADIO = 46;
const RACIMO_MAX = 180;

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

/** Escala azul → ciruela → rojo en CUBOS pasos: el color asentado de cada cubo y el de su destello. */
function escalaDensidad(): { asentado: string[]; destello: string[] } {
  const azul = tokenVerdict("COMPRAR");
  const ciruela = tokenVerdict("AJUSTA SUPUESTOS");
  const rojo = tokenVerdict("BUSCAR OTRA");
  const asentado: string[] = [];
  const destello: string[] = [];
  for (let b = 0; b < CUBOS; b++) {
    const t = b / (CUBOS - 1);
    const alpha = t < 0.5 ? ALPHA_AZUL + (ALPHA_CIRUELA - ALPHA_AZUL) * t * 2 : ALPHA_CIRUELA + (ALPHA_ROJO - ALPHA_CIRUELA) * (t - 0.5) * 2;
    if (!azul || !ciruela || !rojo) {
      // sin tokens (no debería pasar): Signal Red plano, como antes de FASE 1.8
      asentado.push(`rgba(200,50,60,${ALPHA_ROJO})`);
      destello.push("rgb(230,140,146)");
      continue;
    }
    const [a, c] = t < 0.5 ? [azul, ciruela] : [ciruela, rojo];
    const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const mix = (i: number) => Math.round(a[i] + (c[i] - a[i]) * u);
    // el destello: el mismo color, opaco y aclarado un 40 % hacia el blanco (sobre la tinta, el
    // azul pleno de las zonas con poca oferta casi no se ve)
    const claro = (i: number) => Math.round(mix(i) + (255 - mix(i)) * 0.4);
    asentado.push(`rgba(${mix(0)},${mix(1)},${mix(2)},${alpha.toFixed(3)})`);
    destello.push(`rgb(${claro(0)},${claro(1)},${claro(2)})`);
  }
  return { asentado, destello };
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

/** El orden en que se puebla el mapa: los avisos, racimo por racimo. `inicio[r]` es dónde
 *  empieza el racimo r dentro de `orden`, y `semilla[r]` el aviso donde nace. */
function secuenciaDeRacimos(puntos: Float32Array): { orden: Uint32Array; inicio: Uint32Array; semilla: Uint32Array } {
  const n = puntos.length / 2;
  const cols = Math.ceil(proj.VW / CELDA_SORTEO);
  const listas = new Map<number, number[]>();
  for (let k = 0; k < n; k++) {
    const c = Math.floor(puntos[k * 2 + 1] / CELDA_SORTEO) * cols + Math.floor(puntos[k * 2] / CELDA_SORTEO);
    const l = listas.get(c);
    if (l) l.push(k); else listas.set(c, [k]);
  }
  const claves = Array.from(listas.keys());
  const quedan = claves.map((c) => listas.get(c)!.length);
  const pos = new Map<number, number>();
  claves.forEach((c, i) => pos.set(c, i));
  const visto = new Uint8Array(n);
  const orden = new Uint32Array(n);
  const inicio: number[] = [];
  const semilla: number[] = [];
  let hechos = 0;
  while (hechos < n) {
    // la celda: ∝ √(los que le quedan)
    let total = 0;
    for (let i = 0; i < quedan.length; i++) total += Math.sqrt(quedan[i]);
    let r = Math.random() * total;
    let ic = 0;
    for (; ic < quedan.length - 1; ic++) {
      r -= Math.sqrt(quedan[ic]);
      if (r <= 0 && quedan[ic] > 0) break;
    }
    while (quedan[ic] === 0) ic = (ic + 1) % quedan.length;
    const lista = listas.get(claves[ic])!;
    let s = -1;
    for (let tries = 0; tries < 8 && s < 0; tries++) {
      const k = lista[Math.floor(Math.random() * lista.length)];
      if (!visto[k]) s = k;
    }
    if (s < 0) s = lista.find((k) => !visto[k])!;
    // el racimo: los vecinos que faltan, del centro hacia afuera
    const x = puntos[s * 2], y = puntos[s * 2 + 1];
    const cx = Math.floor(x / CELDA_SORTEO), cy = Math.floor(y / CELDA_SORTEO);
    const cerca: { k: number; d: number }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const l = listas.get((cy + dy) * cols + (cx + dx));
        if (!l) continue;
        for (let i = 0; i < l.length; i++) {
          const j = l[i];
          if (visto[j]) continue;
          const d = Math.hypot(puntos[j * 2] - x, puntos[j * 2 + 1] - y);
          if (d <= RACIMO_RADIO) cerca.push({ k: j, d });
        }
      }
    }
    cerca.sort((a, b) => a.d - b.d);
    inicio.push(hechos);
    semilla.push(s);
    for (let i = 0; i < cerca.length && i < RACIMO_MAX; i++) {
      const j = cerca[i].k;
      visto[j] = 1;
      orden[hechos++] = j;
      const cj = Math.floor(puntos[j * 2 + 1] / CELDA_SORTEO) * cols + Math.floor(puntos[j * 2] / CELDA_SORTEO);
      quedan[pos.get(cj)!]--;
    }
  }
  return { orden, inicio: Uint32Array.from(inicio), semilla: Uint32Array.from(semilla) };
}

export function MapaPuntos() {
  const ref = useRef<HTMLCanvasElement>(null);
  const progreso = useProgresoMapa();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelado = false;
    let raf = 0;
    let puntos: Float32Array | null = null;
    let cubo: Uint8Array | null = null;
    let colores: { asentado: string[]; destello: string[] } = { asentado: [], destello: [] };
    let seq: ReturnType<typeof secuenciaDeRacimos> | null = null;
    /** Lo ya asentado, pintado una vez: cada cuadro solo suma lo nuevo. */
    let acumulado: HTMLCanvasElement | null = null;
    /** Cuántos avisos del `orden` están pintados en `acumulado`. */
    let pintados = 0;
    let visible = false;
    let hecho = false;
    /** Tiempo de poblamiento transcurrido (se congela al pausar). */
    let transcurrido = 0;
    let ultimoT = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const medir = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        acumulado = null;
      }
      return { w, h, dpr };
    };

    const tamPunto = (dpr: number) => (dpr >= 2 ? 3 : 2);

    /** Suma al acumulado los avisos `orden[desde..hasta)`, en su color asentado. */
    const asentar = (w: number, h: number, dpr: number, hasta: number) => {
      if (!puntos || !cubo || !seq) return;
      if (!acumulado) {
        acumulado = document.createElement("canvas");
        acumulado.width = w;
        acumulado.height = h;
        pintados = 0;
      }
      const ctx = acumulado.getContext("2d");
      if (!ctx) return;
      const sx = w / proj.VW, sy = h / proj.VH;
      const px = tamPunto(dpr);
      const off = Math.floor(px / 2);
      for (let i = pintados; i < hasta; i++) {
        const k = seq.orden[i];
        ctx.fillStyle = colores.asentado[cubo[k]];
        ctx.fillRect(Math.round(puntos[k * 2] * sx) - off, Math.round(puntos[k * 2 + 1] * sy) - off, px, px);
      }
      pintados = Math.max(pintados, hasta);
    };

    /** El índice del primer racimo que empieza en o después de `i` (búsqueda binaria). */
    const racimoDe = (i: number) => {
      const ini = seq!.inicio;
      let lo = 0, hi = ini.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (ini[mid] <= i) lo = mid; else hi = mid - 1;
      }
      return lo;
    };

    const cuadro = (t: number) => {
      if (cancelado || !puntos || !cubo || !seq || !visible || hecho) return;
      transcurrido += ultimoT ? Math.min(64, t - ultimoT) : 0;
      ultimoT = t;
      const n = seq.orden.length;
      // el ritmo va por avisos, con un leve ease-out al final
      const p = Math.min(1, transcurrido / POBLAR_MS);
      const frac = 1 - Math.pow(1 - p, 1.5);
      const hasta = Math.round(frac * n);
      const { w, h, dpr } = medir();
      asentar(w, h, dpr, hasta);
      const ctx = canvas.getContext("2d");
      if (!ctx || !acumulado) return;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(acumulado, 0, 0);

      // los destellos: lo que apareció hace menos de DESTELLO_MS, con su halo en la semilla
      const pDestello = Math.max(0, transcurrido - DESTELLO_MS) / POBLAR_MS;
      const desde = Math.round((1 - Math.pow(1 - Math.min(1, pDestello), 1.5)) * n);
      if (desde < hasta) {
        const sx = w / proj.VW, sy = h / proj.VH;
        const r0 = racimoDe(desde), r1 = racimoDe(Math.max(desde, hasta - 1));
        for (let r = r0; r <= r1; r++) {
          const a = seq.inicio[r];
          const b = r + 1 < seq.inicio.length ? seq.inicio[r + 1] : n;
          // la edad del racimo: cuánto hace que empezó a aparecer, en fracción del destello
          const fr = a / n;
          const tr = POBLAR_MS * (1 - Math.pow(1 - fr, 1 / 1.5));
          const edad = Math.min(1, Math.max(0, (transcurrido - tr) / DESTELLO_MS));
          const vive = 1 - edad;
          if (vive <= 0) continue;
          const s = seq.semilla[r];
          const x = puntos[s * 2] * sx, y = puntos[s * 2 + 1] * sy;
          const color = colores.destello[cubo[s]];
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = vive * 0.55;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 20 * dpr);
          g.addColorStop(0, color);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, 20 * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = Math.pow(vive, 1.3);
          // cuadrados y no círculos: son miles por cuadro, y en el teléfono el arco pesa
          const lado = Math.round(tamPunto(dpr) * (1 + 0.8 * vive));
          const medio = lado / 2;
          for (let i = a; i < Math.min(b, hasta); i++) {
            const k = seq.orden[i];
            ctx.fillStyle = colores.destello[cubo[k]];
            ctx.fillRect(Math.round(puntos[k * 2] * sx - medio), Math.round(puntos[k * 2 + 1] * sy - medio), lado, lado);
          }
        }
        ctx.globalAlpha = 1;
      }

      progreso?.set(hasta / n);
      if (p >= 1 && transcurrido >= POBLAR_MS + DESTELLO_MS) {
        terminar();
        return;
      }
      raf = requestAnimationFrame(cuadro);
    };

    /** El mapa lleno, quieto, y a respirar (CSS). No vuelve a empezar. */
    const terminar = () => {
      hecho = true;
      const { w, h, dpr } = medir();
      if (seq) asentar(w, h, dpr, seq.orden.length);
      const ctx = canvas.getContext("2d");
      if (ctx && acumulado) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(acumulado, 0, 0);
      }
      progreso?.set(1);
      canvas.classList.add("lleno");
    };

    const reanudar = () => {
      if (!seq || cancelado) return;
      if (hecho) { terminar(); return; }
      if (reduce) { terminar(); return; }
      if (raf) cancelAnimationFrame(raf);
      ultimoT = 0;
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
        if (!r.ok) throw new Error(String(r.status));
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (cancelado) return;
        const decodificados = decodificarPuntos(bytes);
        if (decodificados.length === 0) throw new Error("sin puntos");
        puntos = decodificados;
        colores = escalaDensidad();
        cubo = cubosPorDensidad(decodificados);
        seq = secuenciaDeRacimos(decodificados);
        if (visible) reanudar();
      } catch {
        // sin puntos el mapa igual muestra calles y etiquetas, y el contador va a la cifra final
        progreso?.set(1);
      }
    };

    // Datos: al acercarse. Poblamiento: solo mientras el mapa está en pantalla.
    let cargado = false;
    const obs = new IntersectionObserver(
      (es) => {
        const e = es[0];
        if (!e) return;
        if (e.isIntersecting && !cargado) { cargado = true; void cargar(); }
        visible = e.isIntersecting;
        if (visible) reanudar(); else pausar();
      },
      { rootMargin: "0px", threshold: 0.35 },
    );
    obs.observe(canvas);

    // Al cambiar de tamaño se repinta lo que ya estaba asentado.
    const ro = new ResizeObserver(() => {
      acumulado = null;
      if (!seq) return;
      const { w, h, dpr } = medir();
      const listos = hecho ? seq.orden.length : pintados;
      pintados = 0;
      asentar(w, h, dpr, listos);
      const ctx = canvas.getContext("2d");
      if (ctx && acumulado) { ctx.clearRect(0, 0, w, h); ctx.drawImage(acumulado, 0, 0); }
    });
    ro.observe(canvas);

    return () => {
      cancelado = true;
      obs.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [progreso]);

  return <canvas ref={ref} className="lv-map-puntos" aria-hidden="true" />;
}
