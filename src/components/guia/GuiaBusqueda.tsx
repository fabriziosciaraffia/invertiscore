"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «Por dónde seguir buscando» (30-sep-2026), debajo de «Tienes 3 análisis»: hasta tres deptos
// publicados, parecidos y cercanos al que la persona analizó, que CONVIENEN con su pie y su plazo (o con
// la combinación ajustada, que los chips muestran). Sin enlace al aviso, sin fotos, sin textos del aviso.
// «Analizar este» genera el informe con un crédito del pack, sin wizard. Copy fijado en lib/guia/copy.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { GUIA } from "@/lib/guia/copy";
import "./guia.css";

type Item = { avisoId: string; comuna: string; tipologia: string | null; m2: number; precioUF: number; distancia: string; veredicto: string | null; score: number | null; flujo: number | null };
export type RespuestaGuia = Respuesta;
type Respuesta =
  | { disponible: false }
  | { disponible: true; estado: "normal" | "ajustada" | "ninguno"; origen: { tipologia: string | null; m2: number; precioUF: number }; combinacion: { piePct: number; plazoAnios: number } | null; radioM: number | null; items: Item[] };

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/** `muestra`: la demo (/dev/lo-que-sigue) pasa la respuesta hecha; no pide nada y «Analizar este» no genera. */
export function GuiaBusqueda({ analysisId, veredicto, conSesion, muestra }: { analysisId: string; veredicto: string; conSesion: boolean; muestra?: RespuestaGuia }) {
  const posthog = usePostHog();
  const router = useRouter();
  const ctx: ContextoLqs = { analysisId, veredicto, modalidad: "ltr" };
  const [r, setR] = useState<Respuesta | null>(muestra ?? null);
  const [fallo, setFallo] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);

  useEffect(() => {
    if (muestra) return;
    let vivo = true;
    fetch(`/api/lo-que-sigue/guia?a=${encodeURIComponent(analysisId)}`)
      .then((x) => (x.ok ? x.json() : Promise.reject(new Error(String(x.status)))))
      .then((d: Respuesta) => {
        if (!vivo) return;
        setR(d);
        if (d.disponible) capturarLqs(posthog, EVENTOS_LQS.guiaVista, ctx, { estado: d.estado, n: d.items.length, radio_m: d.radioM, pie_pct: d.combinacion?.piePct ?? null, plazo: d.combinacion?.plazoAnios ?? null });
      })
      .catch(() => vivo && setFallo(true));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  if (fallo || (r && !r.disponible)) return null;

  async function analizar(it: Item) {
    if (muestra || generando || !r || !r.disponible || !r.combinacion) return;
    capturarLqs(posthog, EVENTOS_LQS.guiaAnalizarClick, ctx, { aviso_id: it.avisoId, score: it.score, estado: r.estado, con_sesion: conSesion });
    if (!conSesion) {
      router.push(`/registro?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setError(null);
    setGenerando(it.avisoId);
    let resuelto = false;
    try {
      for (let intento = 0; intento < 8; intento++) {
        const res = await fetch("/api/lo-que-sigue/guia/analizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origenId: analysisId, avisoId: it.avisoId, piePct: r.combinacion.piePct, plazoAnios: r.combinacion.plazoAnios }),
        });
        if (res.status === 409) { await new Promise((ok) => setTimeout(ok, 4000)); continue; }
        const d = (await res.json().catch(() => ({}))) as { id?: string; estado?: string; error?: string };
        if (res.ok && d.id) {
          capturarLqs(posthog, EVENTOS_LQS.guiaInformeCreado, ctx, { aviso_id: it.avisoId, nuevo_id: d.id, ya: d.estado === "ya-creado" });
          router.push(`/analisis/${d.id}`);
          return;
        }
        if (res.status === 401) { router.push(`/registro?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
        setError({ avisoId: it.avisoId, texto: d.error === "sin-creditos" ? GUIA.sinCreditos : GUIA.error });
        resuelto = true;
        break;
      }
      // Ocho vueltas «en curso» sin informe: se dice que falló, sin volver a cobrar (el candado lo impide).
      if (!resuelto) setError({ avisoId: it.avisoId, texto: GUIA.error });
    } catch {
      setError({ avisoId: it.avisoId, texto: GUIA.error });
    }
    setGenerando(null);
  }

  return (
    <section className="guia" data-guia={r ? (r.disponible ? r.estado : "no") : "cargando"} aria-busy={!r}>
      <h2 className="guia-titulo">{GUIA.titulo}</h2>
      {!r && (
        <div className="guia-lista" aria-hidden="true">
          {[0, 1, 2].map((k) => <div key={k} className="guia-av guia-fantasma" />)}
        </div>
      )}
      {r && r.disponible && r.estado === "ninguno" && <p className="guia-ninguno">{GUIA.ninguno}</p>}
      {r && r.disponible && r.estado !== "ninguno" && r.combinacion && (
        <>
          <p className="guia-txt">{GUIA.bajada}</p>
          {r.estado === "ajustada" ? <p className="guia-ajustada">{GUIA.ajustada}</p> : <p className="guia-txt">{GUIA.cuerpo}</p>}
          <div className="guia-chips">
            <span>{GUIA.chipComo}<b>{[r.origen.tipologia, `${miles(r.origen.m2)} m²`, `UF ${miles(r.origen.precioUF)}`].filter(Boolean).join(" · ")}</b></span>
            {r.radioM && <span>{GUIA.chipRadio}<b>{r.radioM / 1000} km</b></span>}
            <span data-guia-combinacion>{GUIA.chipCombinacion}<b>{pct(r.combinacion.piePct)}% · {r.combinacion.plazoAnios} años</b></span>
          </div>
          <div className="guia-lista">
            {r.items.map((it) => {
              const neg = (it.flujo ?? 0) < 0;
              return (
                <article key={it.avisoId} className="guia-av">
                  <div className="guia-top">
                    <span className="guia-ojo">{[it.comuna, it.tipologia, `${miles(it.m2)} m²`].filter(Boolean).join(" · ")}</span>
                    <span className="guia-dist">a {it.distancia}</span>
                  </div>
                  <div className="guia-precio">UF {miles(it.precioUF)}</div>
                  <div className="guia-dos">
                    <div>
                      <div className="guia-k">{GUIA.veredicto}</div>
                      <span className="guia-ver">{it.veredicto ? etiquetaVeredicto(it.veredicto, "frase") : "—"} <span className="guia-pt">{it.score ?? ""}</span></span>
                    </div>
                    <div>
                      <div className="guia-k">{GUIA.flujo}</div>
                      {it.flujo != null && (
                        <div className={`guia-flujo${neg ? " guia-neg" : ""}`}>
                          {neg ? "−" : "+"}${miles(Math.abs(it.flujo))}
                          <small>{neg ? GUIA.saleDeTuBolsillo : GUIA.teQueda}</small>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="guia-acc">
                    <button type="button" className="guia-an" onClick={() => analizar(it)} disabled={!!generando} data-presionado={generando === it.avisoId ? "1" : undefined}>
                      {generando === it.avisoId ? GUIA.analizando : GUIA.analizar}
                    </button>
                    <span className="guia-cr">{GUIA.usaUno}</span>
                  </div>
                  {error?.avisoId === it.avisoId && <p className="guia-error" role="alert">{error.texto}</p>}
                </article>
              );
            })}
          </div>
          <p className="guia-pie">{GUIA.antiguedad}</p>
          <p className="guia-pie guia-pie-2">{GUIA.pie}</p>
        </>
      )}
    </section>
  );
}
