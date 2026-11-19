"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LAS FOTOS DE UN DEPTO (entrega 3 de las láminas del 19-nov-2026, 3.2-resultado y 3.x-detalles-desde-invierte): flechas para
// pasarlas ahí mismo, sin abrir nada, con el contador y los puntos; en el celular también se deslizan con el dedo. Las sirve la
// ruta propia (solo a quien firmó). Sin fotos, no dibuja nada; si la foto no carga, la tarjeta queda sin foto, sin hueco.
// `chica`: la foto de una alternativa, sin flechas.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from "react";
import { ALTERNATIVAS_COPY as A } from "@/lib/invierte-v2/alternativas";
import { urlFoto } from "@/lib/invierte-v2/fotos";

export function FotosDepto({ avisoId, n, chica = false, clase = "" }: { avisoId: string; n: number; chica?: boolean; clase?: string }) {
  const [i, setI] = useState(0);
  const [rota, setRota] = useState(false);
  const toque = useRef<number | null>(null);
  if (!n || rota) return null;
  const ir = (d: number) => setI((x) => (x + d + n) % n);
  return (
    <div className={`iv2-fotos${chica ? " iv2-fotos-chica" : ""} ${clase}`.trim()} data-inv2={chica ? "foto-chica" : "fotos"}
      onTouchStart={(e) => { toque.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => { const x0 = toque.current; toque.current = null; const x1 = e.changedTouches[0]?.clientX; if (chica || x0 == null || x1 == null || Math.abs(x1 - x0) < 40) return; ir(x1 < x0 ? 1 : -1); }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- la sirve la ruta propia, con su caché; no pasa por el optimizador */}
      <img src={urlFoto(avisoId, chica ? 0 : i)} alt={chica ? "" : A.foto(i + 1, n)} loading={chica ? "lazy" : "eager"} decoding="async" onError={() => setRota(true)} />
      {!chica && n > 1 && (
        <>
          <button type="button" className="iv2-foto-flecha iv2-foto-ant" aria-label={A.fotoAnterior} onClick={() => ir(-1)} data-inv2="foto-anterior">‹</button>
          <button type="button" className="iv2-foto-flecha iv2-foto-sig" aria-label={A.fotoSiguiente} onClick={() => ir(1)} data-inv2="foto-siguiente">›</button>
          <span className="iv2-foto-cuenta" aria-live="polite" data-inv2="foto-cuenta">{i + 1} / {n}</span>
          <span className="iv2-foto-puntos" aria-hidden="true">
            {Array.from({ length: Math.min(n, 8) }, (_, k) => <span key={k} data-activo={k === Math.min(i, 7) ? "1" : undefined} />)}
          </span>
        </>
      )}
    </div>
  );
}
