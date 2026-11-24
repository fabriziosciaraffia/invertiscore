"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL VISOR DE FOTOS (segunda vuelta del rediseño, 23-nov-2026, lámina fotos-visor; un solo componente, sin librerías). Se abre sobre la
// misma página al tocar una foto o su lupa: nunca se sale de la página ni se abre la publicación. Lo usan FotosDepto (resultado, página
// del depto, detalles) y FotoPortada (base, otras opciones, alternativas, sumar) con LupaFotos.
//   · PC: la foto grande completa sobre fondo oscuro, flechas, contador, miniaturas y cierre; flechas del teclado, Escape y tocar fuera.
//     El foco queda dentro mientras está abierto y vuelve a donde estaba (la lupa) al cerrar.
//   · Celular: pantalla completa; se pasa deslizando y se acerca pellizcando (y se mueve con un dedo mientras está acercada). Puntos en
//     vez de miniaturas.
//   · Las fotos van tal como vienen (object-fit: contain): completas, sin recortar ni tapar. Las que no cargan se saltan y el contador no
//     las cuenta. Con una sola foto no hay flechas ni miniaturas. Abre en la foto que se estaba viendo. Las fotos (grandes y miniaturas)
//     se piden recién al abrir: el visor no existe en la página hasta entonces. Las miniaturas se cargan todas al abrir (también en
//     celular, donde no se ven): así se sabe cuáles no cargan y el contador no las cuenta.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { urlFoto } from "@/lib/invierte-v2/fotos";
import { fotoSana } from "@/lib/invierte-v2/visita";

export const VISOR_COPY = { cerrar: "Cerrar las fotos", anterior: "Foto anterior", siguiente: "Foto siguiente", foto: (k: number, n: number) => `Foto ${k} de ${n}`, abrir: "Ver las fotos en grande", ninguna: "No pudimos cargar las fotos.", gesto: "Desliza para pasar · pellizca para acercar" } as const;

/** La siguiente foto sana en la dirección `d` (las rotas se saltan); la misma si no hay otra. */
export function siguienteSana(i: number, d: 1 | -1, n: number, rotas: ReadonlySet<number>): number {
  for (let paso = 1; paso <= n; paso++) { const k = (i + d * paso + n * paso) % n; if (!rotas.has(k)) return k; }
  return i;
}
/** El contador sin las rotas: «3 / 11». */
export function cuentaSana(i: number, n: number, rotas: ReadonlySet<number>): { k: number; total: number } {
  const sanas = Array.from({ length: n }, (_, j) => j).filter((j) => !rotas.has(j));
  return { k: Math.max(1, sanas.indexOf(i) + 1), total: sanas.length };
}

const distancia = (t: TouchEvent["touches"]) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

// Las fotos de la visita (24-nov-2026) usan el mismo visor: `src` da la foto grande y `mini` la miniatura (su copia liviana).
export function VisorFotos({ avisoId, n, inicio = 0, titulo = null, alCerrar, src, mini }: { avisoId: string; n: number; inicio?: number; titulo?: string | null; alCerrar: () => void; src?: (i: number) => string; mini?: (i: number) => string }) {
  const grande = src ?? ((k: number) => urlFoto(avisoId, k));
  const chica = mini ?? grande;
  const [i, setI] = useState(Math.min(Math.max(0, inicio), Math.max(0, n - 1)));
  const [rotas, setRotas] = useState<Set<number>>(() => new Set());
  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 });
  const caja = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;
  const gesto = useRef<{ x: number; y: number; d: number; s: number; zx: number; zy: number } | null>(null);
  const varias = n - rotas.size > 1;
  const ir = (d: 1 | -1) => { setI((x) => siguienteSana(x, d, n, rotas)); setZoom({ s: 1, x: 0, y: 0 }); };
  const romper = (k: number) => setRotas((r) => { if (r.has(k)) return r; const nueva = new Set(r); nueva.add(k); return nueva; });
  // Si la foto que se ve no carga, pasa a la siguiente sana.
  useEffect(() => { if (rotas.has(i)) setI(siguienteSana(i, 1, n, rotas)); }, [rotas, i, n]);

  // Teclado, foco atrapado, scroll bloqueado y el foco que vuelve a la lupa al cerrar.
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    caja.current?.querySelector<HTMLElement>("[data-inv2='visor-cerrar']")?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); cerrarRef.current(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); caja.current?.querySelector<HTMLButtonElement>("[data-inv2='visor-siguiente']")?.click(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); caja.current?.querySelector<HTMLButtonElement>("[data-inv2='visor-anterior']")?.click(); return; }
      if (e.key === "Tab" && caja.current) {
        const f = Array.from(caja.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (!f.length) return;
        const pri = f[0], ult = f[f.length - 1];
        if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
        else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
        else if (!caja.current.contains(document.activeElement)) { e.preventDefault(); pri.focus(); }
      }
    };
    window.addEventListener("keydown", tecla, true);
    return () => { window.removeEventListener("keydown", tecla, true); document.body.style.overflow = overflow; antes?.focus?.({ preventScroll: true }); };
  }, []);

  if (typeof document === "undefined") return null;
  const c = cuentaSana(i, n, rotas);
  const ninguna = c.total === 0;
  const toqueIni = (e: TouchEvent) => {
    if (e.touches.length === 2) gesto.current = { x: 0, y: 0, d: distancia(e.touches), s: zoom.s, zx: zoom.x, zy: zoom.y };
    else if (e.touches.length === 1) gesto.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, d: 0, s: zoom.s, zx: zoom.x, zy: zoom.y };
  };
  const toqueMueve = (e: TouchEvent) => {
    const g = gesto.current;
    if (!g) return;
    if (e.touches.length === 2 && g.d > 0) { const s = Math.min(4, Math.max(1, g.s * (distancia(e.touches) / g.d))); setZoom((z) => ({ s, x: s === 1 ? 0 : z.x, y: s === 1 ? 0 : z.y })); }
    else if (e.touches.length === 1 && zoom.s > 1) setZoom((z) => ({ ...z, x: g.zx + (e.touches[0].clientX - g.x), y: g.zy + (e.touches[0].clientY - g.y) }));
  };
  const toqueFin = (e: TouchEvent) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g || g.d > 0 || zoom.s > 1) return;
    const x1 = e.changedTouches[0]?.clientX;
    if (x1 == null || Math.abs(x1 - g.x) < 40 || !varias) return;
    ir(x1 < g.x ? 1 : -1);
  };
  return createPortal(
    <div className="iv2-visor" role="dialog" aria-modal="true" aria-label={titulo ?? VISOR_COPY.abrir} data-inv2="visor" ref={caja}
      onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.fondo === "1") alCerrar(); }}>
      <button type="button" className="iv2-visor-x" aria-label={VISOR_COPY.cerrar} onClick={alCerrar} data-inv2="visor-cerrar">✕</button>
      <div className="iv2-visor-cab" data-fondo="1">
        {titulo && <span className="iv2-visor-t">{titulo}</span>}
        {!ninguna && <span className="iv2-visor-cuenta" aria-live="polite" data-inv2="visor-cuenta">{c.k} / {c.total}</span>}
      </div>
      <div className="iv2-visor-escena" data-fondo="1" onTouchStart={toqueIni} onTouchMove={toqueMueve} onTouchEnd={toqueFin}>
        {ninguna ? <p className="iv2-visor-ninguna">{VISOR_COPY.ninguna}</p> : (
          // eslint-disable-next-line @next/next/no-img-element -- la sirve la ruta propia; completa, sin recortar (object-fit: contain)
          <img key={i} src={grande(i)} alt={VISOR_COPY.foto(c.k, c.total)} className="iv2-visor-img" data-inv2="visor-img" draggable={false}
            style={zoom.s > 1 ? { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` } : undefined}
            onError={() => romper(i)} onLoad={(e) => { if (!fotoSana(e.currentTarget.naturalWidth)) romper(i); }}
            onDoubleClick={() => setZoom((z) => (z.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2, x: 0, y: 0 }))} />
        )}
      </div>
      {varias && (
        <>
          <button type="button" className="iv2-visor-flecha iv2-visor-ant" aria-label={VISOR_COPY.anterior} onClick={() => ir(-1)} data-inv2="visor-anterior">‹</button>
          <button type="button" className="iv2-visor-flecha iv2-visor-sig" aria-label={VISOR_COPY.siguiente} onClick={() => ir(1)} data-inv2="visor-siguiente">›</button>
          <div className="iv2-visor-minis" data-inv2="visor-minis">
            {Array.from({ length: n }, (_, k) => k).filter((k) => !rotas.has(k)).map((k) => (
              <button key={k} type="button" className="iv2-visor-mini" aria-label={VISOR_COPY.foto(cuentaSana(k, n, rotas).k, c.total)} aria-current={k === i ? "true" : undefined} onClick={() => { setI(k); setZoom({ s: 1, x: 0, y: 0 }); }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura: la misma foto, cargada recién al abrir el visor */}
                <img src={chica(k)} alt="" onError={() => romper(k)} onLoad={(e) => { if (!fotoSana(e.currentTarget.naturalWidth)) romper(k); }} />
              </button>
            ))}
          </div>
          <p className="iv2-visor-gesto" aria-hidden="true">{VISOR_COPY.gesto}</p>
          <div className="iv2-visor-puntos" aria-hidden="true">
            {Array.from({ length: Math.min(c.total, 10) }, (_, k) => <span key={k} data-activo={k === Math.round(((c.k - 1) * (Math.min(c.total, 10) - 1)) / Math.max(1, c.total - 1)) ? "1" : undefined} />)}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

/** La lupa en la esquina de la foto: abre el visor. Fuera de cualquier enlace (en la base va al lado de la tarjeta, no adentro), así que
 *  tocarla nunca navega al depto. Sin fotos no se dibuja. */
export function LupaFotos({ avisoId, n, titulo = null, inicio = 0, clase = "" }: { avisoId: string; n: number; titulo?: string | null; inicio?: number; clase?: string }) {
  const [abierto, setAbierto] = useState(false);
  if (!n) return null;
  return (
    <>
      <button type="button" className={`iv2-lupa ${clase}`.trim()} aria-label={VISOR_COPY.abrir} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAbierto(true); }} data-inv2="lupa">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" /><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      {abierto && <VisorFotos avisoId={avisoId} n={n} inicio={inicio} titulo={titulo} alCerrar={() => setAbierto(false)} />}
    </>
  );
}
