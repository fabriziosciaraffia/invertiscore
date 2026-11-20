"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «LO QUE VE FRANCO» EN PANTALLA (entrega 4 de las láminas del 19-nov-2026). Tres formas, de la misma lectura guardada por depto:
//   · alerta + elegido (resultado): «Lo que el puntaje no considera» (grave o revisar) va arriba de los tres datos; la versión
//     corta, debajo, sin repetir la alerta.
//   · detalles: igual, con la versión larga (Estado, Para arrendar, Edificio, Ubicación, Ojo).
//   · linea (una alternativa): la primera línea de la corta (si hay alerta, es la alerta).
// Si la lectura no está, se pide aparte (POST /api/invierte-v2/lectura) y la tarjeta se completa sola; mientras tanto no se dibuja
// nada y nada espera. Si la publicación todavía no se leyó, la ruta la lee por el carril y escribe la lectura; la tarjeta sigue
// preguntando mientras la respuesta sea «generando» (20-nov-2026), y con la lectura llegan las fotos (`alFotos`). Un mismo depto se
// pide una sola vez aunque esté dos veces en la página.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { LECTURA_COPY as L, alertaPrimero, cortaSinRepetirAlerta, partirLinea, type LecturaFranco } from "@/lib/invierte-v2/lectura-franco";

export const URL_LECTURA = "/api/invierte-v2/lectura";
const PAUSA_MS = 6000;
/** Unos dos minutos: leer la publicación por el carril y escribir la lectura toma ~20 s, más la cola si otra pantalla la pidió. */
export const INTENTOS_LECTURA = 20;

interface Llegada { lectura: LecturaFranco | null; fotos: number | null }
const enCurso = new Map<string, Promise<Llegada>>();

async function pedirLectura(avisoId: string): Promise<Llegada> {
  let fotos: number | null = null;
  for (let i = 0; i < INTENTOS_LECTURA; i++) {
    try {
      const r = await fetch(URL_LECTURA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId }) });
      const d = (await r.json().catch(() => null)) as { estado?: string; lectura?: LecturaFranco; fotos?: number } | null;
      if (typeof d?.fotos === "number") fotos = d.fotos;
      if (d?.estado === "lista" && d.lectura) return { lectura: d.lectura, fotos };
      if (r.status !== 202) return { lectura: null, fotos }; // sin datos, tope o error: la tarjeta queda sin el bloque
    } catch {
      return { lectura: null, fotos };
    }
    await new Promise((ok) => setTimeout(ok, PAUSA_MS));
  }
  return { lectura: null, fotos };
}

/** La lectura de un depto: la que vino del servidor o, si no, la que se pide (una vez por depto en la página). */
export function useLectura(avisoId: string, inicial: LecturaFranco | null, alLlegar?: (l: LecturaFranco) => void, alFotos?: (n: number) => void): LecturaFranco | null {
  const [l, setL] = useState<LecturaFranco | null>(inicial);
  useEffect(() => {
    if (inicial) { alLlegar?.(inicial); return; }
    let vivo = true;
    let p = enCurso.get(avisoId);
    if (!p) { p = pedirLectura(avisoId); enCurso.set(avisoId, p); }
    void p.then((x) => {
      if (!vivo) return;
      if (x.fotos != null) alFotos?.(x.fotos);
      if (x.lectura) { setL(x.lectura); alLlegar?.(x.lectura); }
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se pide una vez por depto
  }, [avisoId, inicial]);
  return l;
}

function Alerta({ l }: { l: LecturaFranco }) {
  if (!alertaPrimero(l)) return null;
  const nivel = l.alerta.nivel === "grave" ? "grave" : "revisar";
  return (
    <section className="iv2-alerta" data-nivel={nivel} data-inv2="alerta">
      <span className="iv2-alerta-cab"><span className="iv2-alerta-rotulo">{L.alertaRotulo}</span><span className="iv2-alerta-chip">{L.alertaNivel[nivel]}</span></span>
      <p className="iv2-alerta-t">{l.alerta.motivo}</p>
    </section>
  );
}

function Linea({ t }: { t: string }) {
  const p = partirLinea(t);
  return <span>{p.fuerte ? <b>{p.fuerte}</b> : null}{p.resto}</span>;
}

export function LoQueVeFranco({ avisoId, variante, inicial = null, alLlegar, alFotos }: { avisoId: string; variante: "alerta" | "elegido" | "detalles" | "linea"; inicial?: LecturaFranco | null; alLlegar?: (l: LecturaFranco) => void; /** Cuántas fotos hay, cuando la publicación se leyó en segundo plano. */ alFotos?: (n: number) => void }) {
  const l = useLectura(avisoId, inicial, alLlegar, alFotos);
  if (!l) return null;
  if (variante === "alerta") return <Alerta l={l} />;
  if (variante === "linea") return l.corta[0] ? <p className="iv2-lectura-linea" data-inv2="lectura-linea">{l.corta[0]}</p> : null;
  const lineas = variante === "detalles"
    ? l.larga.map((x) => <span key={x.etiqueta}><b>{x.etiqueta}.</b> {x.texto}</span>)
    : cortaSinRepetirAlerta(l).map((t, i) => <Linea key={i} t={t} />);
  return (
    <>
      {variante === "detalles" && <Alerta l={l} />}
      {lineas.length > 0 && (
        <section className="iv2-lectura-caja" data-inv2={variante === "detalles" ? "lectura-larga" : "lectura-corta"}>
          <span className="iv2-lectura-rotulo">{L.rotulo}</span>
          <div className="iv2-lectura-lineas">{lineas}</div>
        </section>
      )}
    </>
  );
}
