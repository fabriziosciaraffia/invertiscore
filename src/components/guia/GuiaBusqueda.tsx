"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Después de pagar el pack (renta larga), UNA idea (01-oct-2026, decisión de Fabrizio): «compraste 3
// análisis; empieza por estos». El título «Tienes 3 análisis. Empieza por estos.», la frase de la guía
// (la normal, la del pie y plazo ajustados o la de ninguno), los chips con qué se buscó, hasta tres
// deptos publicados que CONVIENEN con los números de la persona y, debajo, una línea para analizar otro
// depto con sus números ya cargados. Sin el bloque de color ni la frase por veredicto.
// Sin enlace al aviso, sin fotos, sin textos del aviso. Las tarjetas en Inter, sin mono ni mayúsculas.
// «Analizar este» genera el informe con un crédito del pack, sin wizard. Quien pagó SIN cuenta escribe
// el código en la misma tarjeta (RegistroEnTarjeta) y el informe sale al entrar, sin salir de acá.
// Copy fijado en lib/guia/copy.ts.
//
// 02-oct-2026: el título y «usa 1 de tus N» dicen el saldo real (`saldo`, de /api/payments/status; sin
// él, la frase no inventa un número). La guía ya no se lee sin más: el servidor pide la sesión del dueño
// del informe o la firma del pago (`pago`, la de la vuelta de Flow). Las dos props son opcionales: con
// sesión (p.ej. desde el dashboard) basta con `analysisId`.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { rutaPrecarga } from "@/lib/lo-que-sigue/oferta-pack";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { GUIA, GUIA_SALDO } from "@/lib/guia/copy";
import { urlGuia, type LlavePago } from "@/lib/lo-que-sigue/retorno-pago";
import { RegistroEnTarjeta } from "./RegistroEnTarjeta";
import "./guia.css";

type Item = { avisoId: string; comuna: string; tipologia: string | null; m2: number; precioUF: number; distancia: string; veredicto: string | null; score: number | null; flujo: number | null };
export type RespuestaGuia = Respuesta;
type Respuesta =
  | { disponible: false }
  | { disponible: true; estado: "normal" | "ajustada" | "ninguno"; origen: { tipologia: string | null; m2: number; precioUF: number }; combinacion: { piePct: number; plazoAnios: number } | null; radioM: number | null; items: Item[] };

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/** `muestra`: la demo (/dev/lo-que-sigue) pasa la respuesta hecha; no pide nada y «Analizar este» no genera.
 *  `sinGuia`: lo que se muestra si el informe no tiene guía (sin coordenadas, o la guía falló).
 *  `saldo`: los análisis que le quedan a la cuenta (`null`/ausente = no se sabe; la frase no dice número).
 *  `pago`: la llave del pago (order + firma) para leer la guía sin sesión.
 *  `enCasa`: la guía dentro del dashboard (la casa, 02-oct-2026): otro título, un h2, y no cuenta como
 *  la pantalla de después de pagar. */
export function GuiaBusqueda({ analysisId, veredicto, conSesion: conSesionInicial, muestra, sinGuia = null, saldo = null, pago = null, enCasa }: { analysisId: string; veredicto: string; conSesion: boolean; muestra?: RespuestaGuia; sinGuia?: ReactNode; saldo?: number | null; pago?: LlavePago | null; enCasa?: { titulo: string } }) {
  const posthog = usePostHog();
  const router = useRouter();
  const ctx: ContextoLqs = { analysisId, veredicto, modalidad: "ltr" };
  const [conSesion, setConSesion] = useState(conSesionInicial);
  const [r, setR] = useState<Respuesta | null>(muestra ?? null);
  const [fallo, setFallo] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
  const precarga = rutaPrecarga(analysisId);

  useEffect(() => {
    if (muestra) return;
    // La pantalla de después de pagar es esta: el evento de siempre, con la modalidad del informe.
    if (!enCasa) capturarLqs(posthog, EVENTOS_LQS.postPagoVisto, { analysisId, veredicto, modalidad: "ltr" }, { con_sesion: conSesionInicial });
    let vivo = true;
    fetch(urlGuia(analysisId, pago))
      .then((x) => (x.ok ? x.json() : Promise.reject(new Error(String(x.status)))))
      .then((d: Respuesta) => {
        if (!vivo) return;
        setR(d);
        if (d.disponible) capturarLqs(posthog, EVENTOS_LQS.guiaVista, ctx, { estado: d.estado, n: d.items.length, radio_m: d.radioM, pie_pct: d.combinacion?.piePct ?? null, plazo: d.combinacion?.plazoAnios ?? null, en_casa: !!enCasa });
      })
      .catch(() => vivo && setFallo(true));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  if (fallo || (r && !r.disponible)) return <>{sinGuia}</>;

  // Un aviso que se despublicó entre la guía y el clic: la tarjeta lo dice un momento y la guía se arma de
  // nuevo sin él (el servidor ya borró la guardada). El crédito no se tocó.
  async function reemplazar() {
    try {
      const [nueva] = await Promise.all([
        fetch(urlGuia(analysisId, pago)).then((x) => (x.ok ? (x.json() as Promise<Respuesta>) : null)),
        new Promise((ok) => setTimeout(ok, 2500)),
      ]);
      if (nueva) { setR(nueva); setError(null); }
    } catch {
      /* queda la tarjeta con su aviso; el resto de la guía sigue */
    }
  }

  async function analizar(it: Item, sesion = conSesion) {
    if (generando || !r || !r.disponible || !r.combinacion) return;
    if (!muestra) capturarLqs(posthog, EVENTOS_LQS.guiaAnalizarClick, ctx, { aviso_id: it.avisoId, score: it.score, estado: r.estado, con_sesion: sesion });
    // Sin cuenta: el código se pide en la misma tarjeta; al entrar, el informe sale sin salir de acá.
    if (!sesion) { setError(null); setRegistrando(it.avisoId); return; }
    // La demo muestra el registro de la tarjeta, pero no genera informes.
    if (muestra) return;
    setError(null);
    setRegistrando(null);
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
        if (res.status === 401) { setConSesion(false); setGenerando(null); setRegistrando(it.avisoId); return; }
        if (res.status === 410 && d.error === "despublicado") {
          setError({ avisoId: it.avisoId, texto: GUIA.despublicado });
          setGenerando(null);
          void reemplazar();
          return;
        }
        setError({ avisoId: it.avisoId, texto: d.error === "sin-creditos" ? GUIA.sinCreditos : d.error === "origen" ? GUIA.otraCuenta : GUIA.error });
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

  const usaUno = GUIA_SALDO.usaUno(saldo);
  const frase = !r ? null : !r.disponible ? null : r.estado === "ninguno" ? GUIA.ninguno : r.estado === "ajustada" ? GUIA.ajustada : GUIA.cuerpo;

  return (
    <section className="guia" data-guia={r ? (r.disponible ? r.estado : "no") : "cargando"} aria-busy={!r}>
      {enCasa ? <h2 className="guia-titulo">{enCasa.titulo}</h2> : <h1 className="guia-titulo">{GUIA_SALDO.titulo(saldo)}</h1>}
      {frase && <p className={r && r.disponible && r.estado !== "normal" ? "guia-ajustada" : "guia-txt"}>{frase}</p>}
      {!r && (
        <div className="guia-lista" aria-hidden="true">
          {[0, 1, 2].map((k) => <div key={k} className="guia-av guia-fantasma" />)}
        </div>
      )}
      {r && r.disponible && r.estado !== "ninguno" && r.combinacion && (
        <>
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
                  {registrando === it.avisoId ? (
                    <RegistroEnTarjeta ctx={ctx} next={typeof window === "undefined" ? "/" : window.location.pathname + window.location.search} alEntrar={() => { setConSesion(true); void analizar(it, true); }} />
                  ) : (
                    <div className="guia-acc">
                      <button type="button" className="guia-an" onClick={() => analizar(it)} disabled={!!generando} data-presionado={generando === it.avisoId ? "1" : undefined}>
                        {generando === it.avisoId ? GUIA.analizando : GUIA.analizar}
                      </button>
                      {usaUno && <span className="guia-cr">· {usaUno}</span>}
                    </div>
                  )}
                  {error?.avisoId === it.avisoId && <p className="guia-error" role="alert">{error.texto}</p>}
                </article>
              );
            })}
          </div>
        </>
      )}
      {r && r.disponible && (
        <p className="guia-otro" data-guia="otro-depto">
          {GUIA.otroDepto}{" "}
          <EnlaceCarga href={conSesion ? precarga : `/registro?next=${encodeURIComponent(precarga)}`} className="guia-otro-enlace">
            {GUIA.otroDeptoEnlace}<span aria-hidden="true"> →</span>
          </EnlaceCarga>
        </p>
      )}
      {r && r.disponible && r.estado !== "ninguno" && (
        <p className="guia-pie">{GUIA.antiguedad} {GUIA.pie}</p>
      )}
    </section>
  );
}
