"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA TARJETA DEL PIN (28-oct-2026, estado C de 5b-explorar-portal.html): chica, sobre el mapa. La imagen de la calle
// (etiqueta «Vista de la calle», nunca «el edificio») o, si no hay foto que cumpla, el mapa chico con el pin en la cuadra
// (lib/explorar/calle.ts); comuna · tipología · m² · Usado/Nuevo; el precio; veredicto y puntaje; el flujo mensual; cap rate
// y UF por m²; el corazón para guardar y «Analizar este», que abre el pop-up de siempre. Se desliza de lado entre los pines
// cercanos (los puntos de abajo). SIN «visto publicado», SIN «revisado con pie y plazo», SIN caja gris: lo fija el tier
// EXPLORAR-PORTAL.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { botonOcupado } from "@/lib/carga-global";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { GUIA } from "@/lib/guia/copy";
import { lineaDepto } from "@/lib/guia/linea-depto";
import { capRatePct, flujoTexto, pctUno, ufPorM2 } from "@/lib/explorar/explorar";
import { PORTAL_COPY, type PinMapa } from "@/lib/explorar/portal";
import { CALLE_COPY, rutaImagenCalle } from "@/lib/explorar/calle";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** Foto o mapa de cada aviso (la etiqueta «Vista de la calle» va solo con la foto). Se pide una vez por grupo de cercanos. */
export function useCalle(ids: string[]): Record<string, "foto" | "mapa"> {
  const [tipos, setTipos] = useState<Record<string, "foto" | "mapa">>({});
  const clave = ids.join(",");
  useEffect(() => {
    if (!ids.length) return;
    let vivo = true;
    void fetch("/api/explorar/calle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, "foto" | "mapa">) => { if (vivo) setTipos((t) => ({ ...t, ...d })); })
      .catch(() => undefined);
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return tipos;
}

/** La imagen de un depto: la de la calle o el mapa chico (la ruta decide y la sirve desde la caché). */
export function ImagenDepto({ avisoId, tipo, clase, carga = "eager" }: { avisoId: string; tipo: "foto" | "mapa" | undefined; clase: string; carga?: "eager" | "lazy" }) {
  return (
    <span className={clase} data-explorar="imagen" data-calle={tipo ?? undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={rutaImagenCalle(avisoId)} alt={tipo === "foto" ? CALLE_COPY.etiqueta : tipo === "mapa" ? CALLE_COPY.mapa : ""} loading={carga} decoding="async" width={96} height={96} />
      {tipo === "foto" && <span className="ex-img-etq" data-explorar="vista-calle">{CALLE_COPY.etiqueta}</span>}
    </span>
  );
}

/** El corazón: guardar el depto (aparece en el dashboard, en «Guardados»). */
export function Corazon({ guardado, alTocar }: { guardado: boolean; alTocar: () => void }) {
  return (
    <button type="button" className="ex-corazon" aria-pressed={guardado} aria-label={guardado ? `${PORTAL_COPY.guardado}. Quitar` : PORTAL_COPY.guardar} data-explorar="corazon" data-guardado={guardado ? "1" : undefined} onClick={(e) => { e.stopPropagation(); alTocar(); }}>
      <span aria-hidden="true">{guardado ? "♥" : "♡"}</span>
    </button>
  );
}

/** «Comprar · 84»: el veredicto (el color de la tríada) y el puntaje. */
export const veredictoConPuntaje = (p: Pick<PinMapa, "veredicto" | "score">): string => `${etiquetaVeredicto(p.veredicto, "frase")}${p.score != null ? ` · ${p.score}` : ""}`;

export function TarjetaPin({ pines, seleccionado, uf, analizados, guardados, generando, error, alCambiar, alCerrar, alGuardar, alAnalizar }: {
  /** Los cercanos, el tocado primero. */
  pines: PinMapa[];
  seleccionado: string;
  uf: number | null;
  analizados: Record<string, string>;
  guardados: ReadonlySet<string>;
  generando: string | null;
  error: { avisoId: string; texto: string } | null;
  alCambiar: (avisoId: string) => void;
  alCerrar: () => void;
  alGuardar: (avisoId: string) => void;
  alAnalizar: (p: PinMapa) => void;
}) {
  const fila = useRef<HTMLDivElement>(null);
  const tipos = useCalle(pines.map((p) => p.avisoId));
  const i = Math.max(0, pines.findIndex((p) => p.avisoId === seleccionado));
  const desdeAfuera = useRef(true);

  // El elegido cambia desde el mapa: la fila se mueve a su tarjeta (sin animar, para no disparar el cambio de vuelta).
  useEffect(() => {
    const el = fila.current;
    if (!el || !desdeAfuera.current) { desdeAfuera.current = true; return; }
    el.scrollTo({ left: i * el.clientWidth, behavior: "auto" });
  }, [i, pines.length]);

  // Deslizar: al detenerse, la tarjeta a la vista pasa a ser la elegida.
  const tope = useRef<number | null>(null);
  const alDeslizar = () => {
    const el = fila.current;
    if (!el) return;
    if (tope.current) window.clearTimeout(tope.current);
    tope.current = window.setTimeout(() => {
      const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      const p = pines[Math.min(Math.max(k, 0), pines.length - 1)];
      if (p && p.avisoId !== seleccionado) { desdeAfuera.current = false; alCambiar(p.avisoId); }
    }, 90);
  };
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [alCerrar]);

  return (
    <section className="ex-tarjeta-wrap" aria-label="Depto elegido" data-explorar="tarjeta-pin">
      <div className="ex-tarjetas" ref={fila} onScroll={alDeslizar} data-explorar="carrusel">
        {pines.map((p) => {
          const informe = analizados[p.avisoId];
          const cap = capRatePct(p.arriendo, p.precioUF, uf);
          const m2 = ufPorM2(p.precioUF, p.m2);
          const neg = (p.flujo ?? 0) < 0;
          return (
            <article key={p.avisoId} className="ex-tarjeta" data-explorar="tarjeta" data-aviso={p.avisoId} data-sel={p.avisoId === seleccionado ? "1" : undefined} aria-current={p.avisoId === seleccionado ? "true" : undefined}>
              <div className="ex-tarjeta-caja">
              <div className="ex-tarjeta-fila">
                <ImagenDepto avisoId={p.avisoId} tipo={tipos[p.avisoId]} clase="ex-img" />
                <div className="ex-tarjeta-datos">
                  <div className="ex-tarjeta-cab">
                    <span className="ex-ojo" data-explorar="linea">{lineaDepto(p)}</span>
                    <Corazon guardado={guardados.has(p.avisoId)} alTocar={() => alGuardar(p.avisoId)} />
                  </div>
                  <b className="ex-precio" data-explorar="precio">UF {miles(p.precioUF)}</b>
                  <span className="ex-linea2" data-explorar="veredicto">
                    <b className="ex-ver">{veredictoConPuntaje(p)}</b>
                    {p.flujo != null && <> · <b className={neg ? "ex-neg" : undefined}>{flujoTexto(p.flujo)}</b> {PORTAL_COPY.alMes}</>}
                  </span>
                  <span className="ex-linea3" data-explorar="cifras">
                    {[cap != null ? `${PORTAL_COPY.capRate} ${pctUno(cap)}` : null, m2 != null ? `${miles(m2)} ${PORTAL_COPY.porM2}` : null].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
              {informe ? (
                <EnlaceCarga href={`/analisis/${informe}`} className="ex-cta ex-cta-enlace" data-explorar="ver-informe">{PORTAL_COPY.analizado} · {PORTAL_COPY.verInforme}</EnlaceCarga>
              ) : (
                <button type="button" className="ex-cta" onClick={() => alAnalizar(p)} disabled={!!generando} {...botonOcupado(generando === p.avisoId)} data-explorar="analizar">
                  {generando === p.avisoId ? GUIA.analizando : PORTAL_COPY.analizar}
                </button>
              )}
              {error?.avisoId === p.avisoId && <p className="ex-error" role="alert">{error.texto}</p>}
              </div>
            </article>
          );
        })}
      </div>
      {pines.length > 1 && (
        <div className="ex-puntos" aria-hidden="true">
          {pines.map((p) => <span key={p.avisoId} className="ex-punto" data-on={p.avisoId === seleccionado ? "1" : undefined} />)}
        </div>
      )}
    </section>
  );
}
