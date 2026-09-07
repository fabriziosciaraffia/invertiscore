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

/** Qué significa obtener cada veredicto, explicado en simple (columna "Tres
 *  respuestas posibles" en desktop). No habla de un informe en particular: es la
 *  explicación del veredicto, por eso no lleva cifra. Copy de la landing,
 *  pendiente de OK de Fabrizio. */
const EXPLICACION: Record<Veredicto, string> = {
  "BUSCAR OTRA":
    "Deptos que no se pagan solos ni ajustando: pones plata todos los meses y la inversión no la recupera.",
  "AJUSTA SUPUESTOS":
    "Deptos que sirven, pero no con estos supuestos: a otro precio, con más pie o a otro plazo el negocio funciona.",
  COMPRAR:
    "Deptos que se pagan solos y entran a buen precio: el arriendo cubre la cuota y te queda plata cada mes.",
};

const DUR = 900;
const HOLD = 6000;

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
    posthog?.capture(EV.ejemplo, { ejemplo: ejemplos[j]?.etiqueta, origen: "chip" });
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
      {/* la banda usa todo el ancho del contenido; debajo, en desktop, el ejemplo a
          la izquierda y los tres veredictos con su definición a la derecha */}
      <div className="lv-ans" data-verdict={x.veredicto} aria-live="polite">
        <div className="lv-band"><span className={`lv-x${out ? " out" : ""}`} style={delay(0)}>{x.etiqueta}</span></div>
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
          <div className="lv-lista" role="tablist" aria-label="Veredictos">
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
                <span className="lv-fila-banda">{e.etiqueta}</span>
                <span className="lv-fila-razon">{EXPLICACION[e.veredicto]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="lv-nav">
        <span className="lv-lbl">Tres respuestas posibles</span>
        <div className="lv-chips" role="tablist" aria-label="Veredictos">
          {ejemplos.map((e, j) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={j === i}
              className={`lv-chip${j === i ? " on" : ""}`}
              data-verdict={e.veredicto}
              onClick={() => elegir(j)}
            >
              {e.etiqueta}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
