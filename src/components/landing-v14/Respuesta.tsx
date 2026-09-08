"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Sección 2 — "La respuesta, en fácil": tres análisis reales rotando.
//
// Contrato (seccion2-transiciones.html, modo B): salida de los cuatro bloques
// junta; a los 900 ms se cambia el veredicto (`data-verdict` → tríada de
// globals.css) y el contenido, y los bloques entran escalonados 0/140/280/420
// ms; espera 6 s con barra de progreso; arranca al entrar en pantalla; se
// detiene al tocar un chip (decisión del goal: el toque es una elección, no un
// reinicio); `prefers-reduced-motion` deja BUSCAR OTRO fijo con los chips vivos.
//
// El contenido viene del backend (server component → props): etiqueta del
// veredicto, titular de la IA con sus marcas, cifra + caption del catálogo.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";
import type { EjemploLanding } from "@/lib/landing-vivo";
import { captionDeCifraClave, type CifraClave } from "@/lib/cifra-clave";
import { EV } from "./eventos";
import type { Veredicto } from "@/lib/types";

/** Qué significa obtener cada veredicto, explicado en simple (tres filas bajo la
 *  respuesta, en PC y en mobile). No habla de un informe en particular: es la
 *  explicación del veredicto, por eso no lleva cifra. Dos frases y este largo:
 *  el veredicto mira más que el flujo (rentabilidad, flujo, plusvalía,
 *  eficiencia). Copy propuesto en FASE 1.8; Fabrizio lo ajusta. */
const EXPLICACION: Record<Veredicto, string> = {
  "BUSCAR OTRA": "Ni el arriendo ni la plusvalía esperada justifican el precio. Hay mejores opciones en la misma zona.",
  "AJUSTA SUPUESTOS": "El depto sirve, los supuestos no. A otro precio, con más pie o a otro plazo, el negocio cierra.",
  COMPRAR: "Rentabilidad, flujo y precio de entrada juegan a favor. Se paga solo y compite bien con la zona.",
};

const DUR = 900;
const HOLD = 6000;

/** Glifo de veredicto (FASE 1.8, punto 5): ✕ · — · ✓ en papel, a la izquierda de la
 *  palabra. Refuerza el veredicto sin depender del color (ciruela y azul se
 *  confunden con daltonismo) y recupera la lectura de semáforo. Decorativo: la
 *  palabra ya lo dice, así que va con aria-hidden y sin aria-label. SVG inline,
 *  sin librería de iconos. Contrato: refuerzo-veredicto.html, bloque A. Solo la
 *  landing por ahora; al informe se lleva después como parte de la banda. */
const GLIFO: Record<Veredicto, string> = {
  "BUSCAR OTRA": "M5 5l14 14M19 5L5 19",
  "AJUSTA SUPUESTOS": "M4 12h16",
  COMPRAR: "M4 13l5 5L20 6",
};

function Glifo({ veredicto }: { veredicto: Veredicto }) {
  return (
    <svg className="lv-glifo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={GLIFO[veredicto]} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
    </svg>
  );
}

/** `**…**` → <mark>. Igual que la portada del informe, sin cifras en el titular. */
function conPlumon(titular: string): ReactNode {
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

export function Respuesta({ ejemplos }: { ejemplos: EjemploLanding[] }) {
  const posthog = usePostHog();
  const [i, setI] = useState(0);
  const [out, setOut] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [progreso, setProgreso] = useState<"quieto" | "corriendo" | "reinicio">("quieto");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const swap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const detenido = useRef(false);
  const reduce = useRef(false);

  const mostrar = (j: number) => {
    if (swap.current) clearTimeout(swap.current);
    setOut(true);
    setEntrando(false);
    setProgreso("reinicio");
    swap.current = setTimeout(() => {
      setI(j);
      setOut(false);
      setEntrando(true);
      // dos frames: que el ancho 0 se pinte antes de la transición a 100%
      requestAnimationFrame(() => requestAnimationFrame(() => setProgreso(detenido.current ? "quieto" : "corriendo")));
    }, DUR);
  };

  const parar = () => {
    detenido.current = true;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const loop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setI((actual) => {
        mostrar((actual + 1) % ejemplos.length);
        return actual;
      });
    }, HOLD + DUR * 2);
  };

  // Arranca al entrar en pantalla (una vez). Con reduced-motion no rota.
  useEffect(() => {
    if (ejemplos.length < 2) return;
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) return;
    const el = raiz.current;
    if (!el) return;
    let arrancado = false;
    const obs = new IntersectionObserver(
      (es) => {
        if (!es[0]?.isIntersecting || arrancado || detenido.current) return;
        arrancado = true;
        setProgreso("corriendo");
        loop();
        obs.disconnect();
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timer.current) clearInterval(timer.current);
      if (swap.current) clearTimeout(swap.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejemplos.length]);

  const elegir = (j: number) => {
    parar();
    posthog?.capture(EV.ejemplo, { ejemplo: ejemplos[j]?.etiqueta, origen: "fila" });
    if (j !== i) mostrar(j);
    else setProgreso("quieto");
  };

  const x = ejemplos[i];
  if (!x) return null;
  const delay = (k: number) => ({ transitionDelay: out ? "0ms" : entrando ? `${k * 140}ms` : "0ms" });
  const caption = x.cifra ? captionDeCifraClave(x.cifra) : null;

  return (
    <div ref={raiz} className="lv-s2-grid-inner">
      <div className="lv-idx">La respuesta, en fácil</div>
      {/* la banda usa todo el ancho del contenido; debajo, el ejemplo. En PC el
          bloque .lv-ans se disuelve en la grilla (display: contents) para que la
          banda cruce las dos columnas y las explicaciones queden al pie del
          bloque; los tokens del veredicto se siguen heredando. */}
      <div className="lv-ans" data-verdict={x.veredicto} aria-live="polite">
        <div className="lv-band">
          <span className={`lv-x${out ? " out" : ""}`} style={delay(0)}>
            <Glifo veredicto={x.veredicto} />
            {x.etiqueta}
          </span>
        </div>
        <div className="lv-ans-cuerpo">
          <div className="lv-ans-izq">
            <h2 className={`lv-why lv-x${out ? " out" : ""}`} style={delay(1)}>
              {x.titular ? conPlumon(x.titular) : null}
            </h2>
            <div className={`lv-num lv-x${out ? " out" : ""}`} style={delay(2)}>
              {x.cifra ? fmtCifra(x.cifra) : null}
              {caption && <small>{caption}</small>}
            </div>
            <div className={`lv-ey lv-x${out ? " out" : ""}`} style={delay(3)}>{x.eyebrow}</div>
            <div className="lv-prog" aria-hidden="true">
              <i
                style={
                  progreso === "corriendo"
                    ? { transition: `width ${HOLD}ms linear`, width: "100%" }
                    : { transition: "none", width: progreso === "quieto" && detenido.current ? "100%" : "0" }
                }
              />
            </div>
          </div>
        </div>
      </div>
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
            onClick={() => elegir(j)}
          >
            <span className="lv-fila-banda"><Glifo veredicto={e.veredicto} />{e.etiqueta}</span>
            <span className="lv-fila-razon">{EXPLICACION[e.veredicto]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
