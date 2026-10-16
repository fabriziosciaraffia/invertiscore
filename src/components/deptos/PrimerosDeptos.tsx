"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Los primeros deptos (16-oct-2026, la puerta B): al terminar «Estás dentro» en /deptos y en el dashboard de una cuenta
// sin informes. Las tarjetas de la guía (guia.css). Cada una dice cuándo Franco la vio publicada —«Visto publicado hoy a
// las 03:12», su último chequeo de ficha— o, si todavía no se chequea, que se confirma en el correo de esta hora. Sin
// enlace al aviso: «Ver y analizar» abre la selección del día (/semanal), con el aviso antes de gastar.
// ─────────────────────────────────────────────────────────────────────────────
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { marcaVisto } from "@/lib/guia/del-dia";
import { GUIA } from "@/lib/guia/copy";
import type { PrimerDepto } from "@/lib/deptos/servidor";
import "@/components/guia/guia.css";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export const PRIMEROS_COPY = {
  titulo: "Tus primeros deptos",
  porConfirmar: "Lo reviso ahora: el correo de esta hora te dice si sigue publicado.",
  /** En la casa, días después: viene de la evaluación de la noche y todavía no se chequeó su ficha. */
  porConfirmarCasa: "De la evaluación de anoche: todavía sin revisar si sigue publicado.",
  revisando: "Revisando uno por uno si siguen publicados…",
  ver: "Ver y analizar",
  ninguno: "Hoy no hay uno publicado que convenga con lo que buscas. Te aviso cuando aparezca uno.",
  vecinas: "En tus comunas no hay uno hoy: estos son de comunas vecinas. Te aviso cuando aparezca uno en las tuyas.",
} as const;

export function PrimerosDeptos({ items, token, revisando = false, titulo = true, contexto = "alta", vecinas = false }: { items: PrimerDepto[]; token: string | null; revisando?: boolean; titulo?: boolean; contexto?: "alta" | "casa"; vecinas?: boolean }) {
  const href = token ? `/semanal?t=${token}` : "/semanal";
  return (
    <section className="guia" data-deptos="primeros">
      {titulo && <h2 className="guia-bloque">{PRIMEROS_COPY.titulo}</h2>}
      {revisando && <p className="guia-txt" role="status" aria-live="polite" data-deptos="revisando">{PRIMEROS_COPY.revisando}</p>}
      {items.length === 0 && !revisando && <p className="guia-txt" data-deptos="ninguno">{PRIMEROS_COPY.ninguno}</p>}
      {vecinas && items.length > 0 && <p className="guia-txt" data-deptos="vecinas">{PRIMEROS_COPY.vecinas}</p>}
      {items.length > 0 && (
        <div className="guia-lista mt-3">
          {items.map((it) => {
            const neg = (it.flujo ?? 0) < 0;
            return (
              <article key={it.avisoId} className="guia-av" data-visto={it.vistoAt ? "1" : "0"}>
                <div className="guia-top">
                  <span className="guia-ojo">{[it.comuna, it.tipologia, `${miles(it.m2)} m²`].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="guia-precio">UF {miles(it.precioUF)}</div>
                <div className="guia-dos">
                  <div>
                    <div className="guia-k">{GUIA.veredicto}</div>
                    <span className="guia-ver" data-veredicto={it.veredicto}>{etiquetaVeredicto(it.veredicto, "frase")} <span className="guia-pt">{it.score ?? ""}</span></span>
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
                <p className="guia-cr mt-2.5" data-deptos="marca">{it.vistoAt ? marcaVisto(it.vistoAt) : contexto === "casa" ? PRIMEROS_COPY.porConfirmarCasa : PRIMEROS_COPY.porConfirmar}</p>
                {/* Solo los de su selección del día se analizan desde ahí; los de la noche, todavía sin chequear, no. */}
                {token && it.enSeleccion && (
                  <div className="guia-acc">
                    <EnlaceCarga href={`${href}&a=${it.avisoId}`} className="guia-an">{PRIMEROS_COPY.ver}</EnlaceCarga>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
