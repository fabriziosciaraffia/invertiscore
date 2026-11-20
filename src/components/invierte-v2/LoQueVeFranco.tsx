"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «LO QUE VE FRANCO» EN PANTALLA (entrega 4 de las láminas del 19-nov-2026; rehecho tras la prueba de Fabrizio del 20-nov-2026).
// Tres formas, de la misma lectura guardada por depto:
//   · elegido (resultado): UN bloque «Lo que ve Franco» con las tres líneas de la corta; si hay alerta, es la primera línea, con su
//     chip («Revisar» o «Grave», en ciruela). «Lo que el puntaje no considera» ya no va en el resultado.
//   · linea (una alternativa): el mismo recuadro con UNA línea —la alerta si existe; si no, la primera de la corta—, dos renglones
//     como máximo. Siempre el mismo fondo azul claro (el de las tarjetas que explican); la alerta, solo por su chip; nunca rojo.
//   · detalles: «Lo que el puntaje no considera» (grave o revisar) arriba, y la versión larga (Estado, Para arrendar, Edificio,
//     Ubicación, Ojo).
// Si la lectura no está, se pide aparte (POST /api/invierte-v2/lectura) y la tarjeta se completa sola; mientras tanto no se dibuja
// nada y nada espera. Si la publicación todavía no se leyó, la ruta la lee por el carril y escribe la lectura; la tarjeta sigue
// preguntando mientras la respuesta sea «generando» (20-nov-2026), y con la lectura llegan las fotos (`alFotos`). Un mismo depto se
// pide una sola vez aunque esté dos veces en la página.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { LECTURA_COPY as L, alertaPrimero, lineaAlternativa, lineasElegido, partirLinea, type LecturaFranco } from "@/lib/invierte-v2/lectura-franco";

export const URL_LECTURA = "/api/invierte-v2/lectura";
const PAUSA_MS = 6000;
/** Unos dos minutos: leer la publicación por el carril y escribir la lectura toma ~20 s, más la cola si otra pantalla la pidió. */
export const INTENTOS_LECTURA = 20;

interface Llegada { lectura: LecturaFranco | null; fotos: number | null }
const enCurso = new Map<string, Promise<Llegada>>();

/** Como mucho DOS lecturas pedidas a la vez desde la página (20-nov-2026, Fabrizio: las tres alternativas se pedían en el mismo
 *  segundo); las demás esperan su turno. */
export const LECTURAS_EN_PARALELO = 2;
let enVuelo = 0;
const turnos: (() => void)[] = [];
async function conTurno<T>(f: () => Promise<T>): Promise<T> {
  if (enVuelo >= LECTURAS_EN_PARALELO) await new Promise<void>((ok) => turnos.push(ok));
  enVuelo++;
  try { return await f(); } finally { enVuelo--; turnos.shift()?.(); }
}
/** La espera ante un límite de pedidos o un corte: crece con cada intento (6, 12, 24 s…, hasta 48). */
export const esperaReintento = (n: number) => Math.min(PAUSA_MS * 2 ** n, 48_000);

/** Las fotos no esperan a la lectura (20-nov-2026): la primera respuesta que dice cuántas hay se las pasa a la tarjeta, aunque la
 *  lectura siga generándose o termine en error. */
const oyentesFotos = new Map<string, Set<(n: number) => void>>();
const avisarFotos = (avisoId: string, n: number) => oyentesFotos.get(avisoId)?.forEach((f) => f(n));

async function pedirLectura(avisoId: string): Promise<Llegada> {
  let fotos: number | null = null;
  let cortes = 0;
  for (let i = 0; i < INTENTOS_LECTURA; i++) {
    let espera = PAUSA_MS;
    try {
      const r = await conTurno(() => fetch(URL_LECTURA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId }) }));
      const d = (await r.json().catch(() => null)) as { estado?: string; lectura?: LecturaFranco; fotos?: number } | null;
      if (typeof d?.fotos === "number" && d.fotos !== fotos) { fotos = d.fotos; avisarFotos(avisoId, fotos); }
      if (d?.estado === "lista" && d.lectura) return { lectura: d.lectura, fotos };
      // Un límite de pedidos o un corte del servidor: se reintenta con espera creciente.
      if (r.status === 429 || r.status >= 500) espera = esperaReintento(cortes++);
      else if (r.status !== 202) return { lectura: null, fotos }; // sin datos, tope o error: la tarjeta queda sin el recuadro
    } catch {
      espera = esperaReintento(cortes++); // se cortó la conexión: se reintenta
    }
    await new Promise((ok) => setTimeout(ok, espera));
  }
  return { lectura: null, fotos };
}

/** La lectura de un depto: la que vino del servidor o, si no, la que se pide (una vez por depto en la página). */
export function useLectura(avisoId: string, inicial: LecturaFranco | null, alLlegar?: (l: LecturaFranco) => void, alFotos?: (n: number) => void): LecturaFranco | null {
  const [l, setL] = useState<LecturaFranco | null>(inicial);
  useEffect(() => {
    if (inicial) { alLlegar?.(inicial); return; }
    let vivo = true;
    const oyente = (n: number) => { if (vivo) alFotos?.(n); };
    if (!oyentesFotos.has(avisoId)) oyentesFotos.set(avisoId, new Set());
    oyentesFotos.get(avisoId)!.add(oyente);
    let p = enCurso.get(avisoId);
    if (!p) { p = pedirLectura(avisoId); enCurso.set(avisoId, p); }
    void p.then((x) => {
      if (!vivo) return;
      if (x.fotos != null) alFotos?.(x.fotos);
      if (x.lectura) { setL(x.lectura); alLlegar?.(x.lectura); }
    });
    return () => { vivo = false; oyentesFotos.get(avisoId)?.delete(oyente); };
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

/** El recuadro del resultado: la etiqueta chica «LO QUE VE FRANCO» y, si hay alerta, su chip; siempre el mismo fondo azul claro. */
function Caja({ l, lineas, variante }: { l: LecturaFranco; lineas: string[]; variante: "elegido" | "linea" }) {
  if (!lineas.length) return null;
  const alerta = alertaPrimero(l) ? (l.alerta.nivel === "grave" ? "grave" : "revisar") : null;
  return (
    <section className={`iv2-lectura-caja iv2-lectura-${variante}`} data-alerta={alerta ?? undefined} data-inv2={variante === "linea" ? "lectura-linea" : "lectura-corta"}>
      <span className="iv2-lectura-cab">
        <span className="iv2-lectura-rotulo">{L.rotulo}</span>
        {alerta && <span className="iv2-lectura-chip" data-inv2="lectura-chip">{L.alertaNivel[alerta]}</span>}
      </span>
      <div className="iv2-lectura-lineas">{lineas.map((t, i) => <Linea key={i} t={t} />)}</div>
    </section>
  );
}

export function LoQueVeFranco({ avisoId, variante, inicial = null, alLlegar, alFotos }: { avisoId: string; variante: "elegido" | "detalles" | "linea"; inicial?: LecturaFranco | null; alLlegar?: (l: LecturaFranco) => void; /** Cuántas fotos hay, cuando la publicación se leyó en segundo plano. */ alFotos?: (n: number) => void }) {
  const l = useLectura(avisoId, inicial, alLlegar, alFotos);
  if (!l) return null;
  if (variante === "elegido") return <Caja l={l} variante="elegido" lineas={lineasElegido(l)} />;
  if (variante === "linea") { const t = lineaAlternativa(l); return t ? <Caja l={l} variante="linea" lineas={[t]} /> : null; }
  const lineas = l.larga.map((x) => <span key={x.etiqueta}><b>{x.etiqueta}.</b> {x.texto}</span>);
  return (
    <>
      <Alerta l={l} />
      {lineas.length > 0 && (
        <section className="iv2-lectura-caja" data-inv2="lectura-larga">
          <span className="iv2-lectura-rotulo">{L.rotulo}</span>
          <div className="iv2-lectura-lineas">{lineas}</div>
        </section>
      )}
    </>
  );
}
