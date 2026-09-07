"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Capa de puntos del mapa: TODOS los avisos activos con coordenadas (~44.000),
// un píxel cada uno en papel al .35 sobre tinta, en <canvas>. Los datos llegan
// del endpoint ISR /api/landing/mapa-puntos (binario propio, ~100 KB) y se
// piden recién cuando el mapa se acerca a pantalla.
//
// Animación: oleadas desde el centro (Plaza de Armas) hasta llenar; el estado
// final es el mapa denso. Con prefers-reduced-motion se pinta todo de una vez.
// El canvas se dibuja a la resolución del dispositivo para que el píxel sea
// píxel, y se redibuja si cambia el tamaño del contenedor.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { decodificarPuntos } from "./mapa-puntos-codec";
import proj from "./mapa-santiago.proj.json";

/** Centro de las oleadas: Plaza de Armas, en unidades del viewBox. */
const CENTRO = {
  x: (-70.6506 - proj.W) * proj.kLat * proj.s + proj.ox,
  y: (proj.N - -33.4378) * proj.s + proj.oy,
};
const DURACION_MS = 2600;
const OLEADAS = 4;

export function MapaPuntos() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelado = false;
    let raf = 0;
    let puntos: Float32Array | null = null;
    let orden: Uint32Array | null = null;
    let inicio = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const medir = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return { w, h, dpr };
    };

    // Pinta los primeros `hasta` puntos del orden (por distancia al centro).
    const pintar = (hasta: number) => {
      if (!puntos || !orden) return;
      const { w, h, dpr } = medir();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(250,250,248,0.35)";
      const sx = w / proj.VW, sy = h / proj.VH;
      const px = Math.max(1, Math.round(dpr)); // 1 px CSS
      for (let i = 0; i < hasta; i++) {
        const k = orden[i] * 2;
        ctx.fillRect(Math.round(puntos[k] * sx), Math.round(puntos[k + 1] * sy), px, px);
      }
    };

    const animar = (t: number) => {
      if (cancelado || !orden) return;
      if (!inicio) inicio = t;
      const p = Math.min(1, (t - inicio) / DURACION_MS);
      // oleadas: la fracción pintada avanza a saltos suaves (ease-out por oleada)
      const ol = Math.min(OLEADAS - 1, Math.floor(p * OLEADAS));
      const dentro = p * OLEADAS - ol;
      const frac = (ol + (1 - Math.pow(1 - dentro, 3))) / OLEADAS;
      pintar(Math.round(frac * orden.length));
      if (p < 1) raf = requestAnimationFrame(animar);
    };

    const arrancar = async () => {
      try {
        const r = await fetch("/api/landing/mapa-puntos");
        if (!r.ok) return;
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (cancelado) return;
        puntos = decodificarPuntos(bytes);
        const n = puntos.length / 2;
        // orden por distancia al centro → las oleadas
        const d = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const dx = puntos[i * 2] - CENTRO.x, dy = puntos[i * 2 + 1] - CENTRO.y;
          d[i] = dx * dx + dy * dy;
        }
        orden = new Uint32Array(n);
        for (let i = 0; i < n; i++) orden[i] = i;
        orden.sort((a, b) => d[a] - d[b]);
        if (reduce) pintar(n);
        else raf = requestAnimationFrame(animar);
      } catch {
        /* sin puntos el mapa igual muestra calles, etiquetas y pin */
      }
    };

    // Se pide al acercarse a pantalla, no al cargar la página.
    const obs = new IntersectionObserver(
      (es) => {
        if (!es[0]?.isIntersecting) return;
        obs.disconnect();
        void arrancar();
      },
      { rootMargin: "400px 0px" },
    );
    obs.observe(canvas);

    // Al cambiar el tamaño (rotar el teléfono) se repinta el estado final.
    const ro = new ResizeObserver(() => { if (orden && !raf) pintar(orden.length); });
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
