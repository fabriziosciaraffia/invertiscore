"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Sección 2 — "La respuesta, en fácil": tres análisis reales rotando.
//
// Lo que se muestra es una MINIATURA DEL HERO DEL INFORME, no una banda: misma
// tarjeta oscura con el gradiente del contrato (135°, brightness 1.10 saturate .90,
// grano al 16 % en overlay), mismo eyebrow, mismo botón de veredicto —signo ·
// rótulo · punto con doble anillo—, mismo score en texto plano, mismo titular en
// serif con plumón y misma cifra clave con su caption en línea. Debajo, UNA línea
// de hallazgo con su flecha y su cifra, armada con las funciones del informe.
//
// Por qué: la banda prometía algo que el informe ya no entrega. La sección que
// convierte tiene que enseñar lo que el visitante va a recibir.
//
// DESVÍO DOCUMENTADO DEL CONTRATO §3 (11-sep-2026, decisión de Fabrizio): el
// eyebrow del informe es «dirección · comuna» con la dirección en negrita. La
// landing nunca publicó la dirección de los ejemplos y este goal no es el lugar
// para empezar, así que acá va la COMUNA en negrita, en el lugar de la calle, y
// la tipología con los metros («2D2B 60 m²»), que sin calle ni ficha es lo único
// que dice qué depto es. La modalidad va como en el informe: negrita, 13 px.
//
// La rotación vive en `Rotacion.tsx` y la comparte con la sección 3 («Lo que
// haría Franco»): un solo estado mueve las dos. Esta sección es la que la arranca
// (al entrar en pantalla) y sus filas son las que la detienen.
//
// El contenido viene del backend (server component → props): etiqueta del
// veredicto, titular DEL MOTOR (el mismo de la portada, `titularMotor`) con su
// plumón, cifra + caption del catálogo y la primera fila de «Esto es lo que pesa»,
// cruda, que acá se formatea igual que en el informe.
//
// SIN SALTOS AL ROTAR (27-sep-2026, decisión de Fabrizio): los tres ejemplos tienen
// textos de distinto largo, así que la miniatura los apila en la MISMA celda de una
// grilla y muestra uno. La celda mide lo que mide el más alto, siempre: al pasar de
// un ejemplo a otro no se mueve nada, ni la miniatura ni lo que viene debajo.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { captionDeCifraClave, type CifraClave } from "@/lib/cifra-clave";
import type { EjemploLanding } from "@/lib/landing-vivo";
import { findingDisplay } from "@/components/analysis/GenericFindingCard";
import { referenciaHallazgo } from "@/components/analysis/referencia-hallazgo";
import { Glifo } from "./Marca";
import { EXPLICACION_VEREDICTO } from "./explicaciones";
import { BarraProgreso, useRotacion } from "./Rotacion";


/** `**…**` → <mark>. Igual que la portada del informe, sin cifras en el titular. */
export function conPlumon(titular: string): ReactNode {
  const partes = titular.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <mark key={i}>{p.slice(2, -2)}</mark> : <span key={i}>{p}</span>,
  );
}

function fmtCifra(cifra: CifraClave): string {
  if (cifra.tipo === "pct") return `${cifra.valorPct.toLocaleString("es-CL")}%`;
  const signo = cifra.signo < 0 ? "–" : "+";
  return `${signo}$${cifra.valorClp.toLocaleString("es-CL")}`;
}

export function Respuesta() {
  const { ejemplos, i, out, elegir, arrancar, delay } = useRotacion();
  const raiz = useRef<HTMLDivElement>(null);

  // Arranca la rotación compartida al entrar en pantalla (una vez).
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (es) => {
        if (!es[0]?.isIntersecting) return;
        arrancar();
        obs.disconnect();
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [arrancar]);

  if (!ejemplos[i]) return null;

  return (
    <div ref={raiz} className="lv-s2-grid-inner">
      <div className="lv-idx">La respuesta, en fácil</div>
      {/* la miniatura del informe; a su lado, en PC, las tres explicaciones */}
      <article className="lv-ans lv-mini" aria-live="polite">
        <div className="lv-mini-fondo" aria-hidden="true" />
        <div className="lv-mini-cuerpo">
          <div className="lv-pila">
            {ejemplos.map((x, j) => (
              <Miniatura key={x.id} x={x} activo={j === i} out={out} delay={delay} />
            ))}
          </div>
          <BarraProgreso />
        </div>
      </article>
      {/* las tres explicaciones son también el control: mobile al pie (los chips
          murieron el 08-sep, eran redundantes con estas filas), PC en la columna derecha */}
      <div className="lv-lista" role="tablist" aria-label="Qué significa cada veredicto">
        <span className="lv-lbl">Tres respuestas posibles</span>
        {ejemplos.map((e, j) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            aria-selected={j === i}
            className={`lv-fila${j === i ? " on" : ""}`}
            data-verdict={e.veredicto}
            onClick={() => elegir(j, "fila")}
          >
            <span className="lv-fila-banda"><Glifo veredicto={e.veredicto} />{e.etiqueta}</span>
            <span className="lv-fila-razon">{EXPLICACION_VEREDICTO[e.veredicto]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Un ejemplo de la miniatura. Los tres viven en la misma celda (`.lv-pila`); el que no
 *  está en pantalla queda oculto y fuera del árbol de accesibilidad, pero sigue midiendo. */
function Miniatura({
  x,
  activo,
  out,
  delay,
}: {
  x: EjemploLanding;
  activo: boolean;
  out: boolean;
  delay: (k: number) => CSSProperties;
}) {
  const caption = x.cifra ? captionDeCifraClave(x.cifra) : null;
  // La línea de hallazgo, con las MISMAS funciones que «Esto es lo que pesa» del
  // informe: la frase es el titular del motor, la cifra `findingDisplay` y la
  // referencia `referenciaHallazgo`. Siempre en pesos: la landing no tiene toggle.
  const h = x.hallazgo;
  const linea = h ? { kpi: findingDisplay(h, "CLP", x.valorUF).kpi, ref: referenciaHallazgo(h, "CLP", x.valorUF) } : null;
  const flecha = h?.direccion === "adverso" ? "↓" : h?.direccion === "favorable" ? "↑" : "";
  // el que no está en pantalla queda en su estado de salida: así, al entrar, aparece con la
  // entrada escalonada de siempre
  const fx = `lv-x${out || !activo ? " out" : ""}`;
  const d = (k: number) => (activo ? delay(k) : undefined);
  return (
    <div className={`lv-pila-item${activo ? " on" : ""}`} data-verdict={x.veredicto} aria-hidden={!activo}>
      <div className={`lv-mini-eyebrow ${fx}`} style={d(0)}>
        <span>
          <b>{x.comuna}</b>
          {x.detalle && <> · {x.detalle}</>}
        </span>
        <span className="lv-mini-modalidad">{x.modalidad}</span>
      </div>
      {/* EL BOTÓN DE VEREDICTO, como en el hero: signo · rótulo · punto. El signo
          pertenece al veredicto y viaja pegado a su palabra; el punto es indicador
          de vida y va solo al otro extremo, latiendo con dos anillos a medio ciclo. */}
      <div className="lv-pill lv-mini-pill" aria-label={`Veredicto: ${x.etiqueta}`}>
        <Glifo veredicto={x.veredicto} />
        {x.etiqueta}
        <i aria-hidden="true" />
      </div>
      {x.score != null && (
        <div className={`lv-mini-score ${fx}`} style={d(1)}>
          Franco Score {x.score} de 100
        </div>
      )}
      <h2 className={`lv-mini-titular ${fx}`} style={d(1)}>
        {x.titular ? conPlumon(x.titular) : null}
      </h2>
      <div className={`lv-mini-cifra ${fx}`} style={d(2)}>
        {x.cifra ? fmtCifra(x.cifra) : null}
        {caption && <small>{caption}</small>}
      </div>
      {h && (
        <div className={`lv-mini-hallazgo ${fx}`} style={d(3)} data-dir={h.direccion}>
          <span className="lv-mini-flecha" aria-hidden="true">{flecha}</span>
          <span className="lv-mini-frase">{h.titular}</span>
          {linea?.kpi && (
            <span className="lv-mini-num">
              {linea.kpi}
              {linea.ref && <small>{linea.ref}</small>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
