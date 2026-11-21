"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LAS FOTOS DE UN DEPTO (entrega 3 de las láminas del 19-nov-2026, 3.2-resultado y 3.x-detalles-desde-invierte): flechas para
// pasarlas ahí mismo, sin abrir nada, con el contador y los puntos; en el celular también se deslizan con el dedo. Las sirve la
// ruta propia (solo a quien firmó). Sin fotos, no dibuja nada; si la foto no carga, la tarjeta queda sin foto, sin hueco.
// `chica`: la foto de una alternativa, más baja y con las mismas flechas, contador y puntos, más chicos (20-nov-2026, Fabrizio).
// La foto siempre se recorta para llenar el recuadro, sin deformarse (object-fit: cover).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { ALTERNATIVAS_COPY as A } from "@/lib/invierte-v2/alternativas";
import { urlFoto } from "@/lib/invierte-v2/fotos";

export function FotosDepto({ avisoId, n, chica = false, clase = "", etiqueta = null }: { avisoId: string; n: number; chica?: boolean; clase?: string; /** Sobre la foto, arriba a la izquierda (el cap rate de una alternativa, 20-nov-2026). */ etiqueta?: string | null }) {
  const [i, setI] = useState(0);
  // Las fotos que la fuente ya borró (404) se saltan, también la primera (20-nov-2026: una alternativa quedaba sin fotos porque su
  // primera foto estaba rota y las otras doce no); solo si no carga ninguna, la tarjeta va sin el bloque.
  const [rotas, setRotas] = useState<Set<number>>(() => new Set());
  // Mientras busca una foto que cargue (la primera falló), el bloque no se ve: nada de un recuadro vacío con flechas.
  const [buena, setBuena] = useState(false);
  const toque = useRef<number | null>(null);
  const img = useRef<HTMLImageElement>(null);
  // Una foto que falló antes de que la página despertara (sin `onError`) también se salta (21-nov-2026, como FotoPortada).
  useEffect(() => { const x = img.current; if (x?.complete && x.naturalWidth <= 1) romper(); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!n || rotas.size >= n) return null;
  const ir = (d: number) => setI((x) => { let k = x; for (let paso = 0; paso < n; paso++) { k = (k + d + n) % n; if (!rotas.has(k)) return k; } return x; });
  const siguiente = (x: number, sin: Set<number>) => { for (let paso = 1; paso <= n; paso++) { const k = (x + paso) % n; if (!sin.has(k)) return k; } return null; };
  const romper = () => { const nueva = new Set(rotas); nueva.add(i); setRotas(nueva); const k = siguiente(i, nueva); if (k != null) setI(k); };
  return (
    <div className={`iv2-fotos${chica ? " iv2-fotos-chica" : ""} ${clase}`.trim()} data-inv2={chica ? "foto-chica" : "fotos"} data-buscando={rotas.size > 0 && !buena ? "1" : undefined}
      onTouchStart={(e) => { toque.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => { const x0 = toque.current; toque.current = null; const x1 = e.changedTouches[0]?.clientX; if (x0 == null || x1 == null || Math.abs(x1 - x0) < 40) return; ir(x1 < x0 ? 1 : -1); }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- la sirve la ruta propia, con su caché; no pasa por el optimizador */}
      <img ref={img} src={urlFoto(avisoId, i)} alt={A.foto(i + 1, n)} loading={chica && i === 0 ? "lazy" : "eager"} decoding="async" onError={romper} onLoad={(e) => { if (e.currentTarget.naturalWidth <= 1) romper(); else setBuena(true); }} />
      {etiqueta && <span className="iv2-foto-etiqueta" data-inv2="foto-etiqueta">{etiqueta}</span>}
      {n > 1 && (
        <>
          <button type="button" className="iv2-foto-flecha iv2-foto-ant" aria-label={A.fotoAnterior} onClick={() => ir(-1)} data-inv2="foto-anterior">‹</button>
          <button type="button" className="iv2-foto-flecha iv2-foto-sig" aria-label={A.fotoSiguiente} onClick={() => ir(1)} data-inv2="foto-siguiente">›</button>
          <span className="iv2-foto-cuenta" aria-live="polite" data-inv2="foto-cuenta">{i + 1} / {n}</span>
          <span className="iv2-foto-puntos" aria-hidden="true">
            {Array.from({ length: Math.min(n, chica ? 5 : 8) }, (_, k) => <span key={k} data-activo={k === Math.min(i, chica ? 4 : 7) ? "1" : undefined} />)}
          </span>
        </>
      )}
    </div>
  );
}
