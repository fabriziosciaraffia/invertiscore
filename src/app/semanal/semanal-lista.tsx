"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Los deptos del correo semanal en Franco (02-oct-2026). Las tarjetas son las de la guía (guia.css): el
// precio, el veredicto con su puntaje y el flujo con el pie y el plazo de la persona. «Analizar este»
// genera el informe por la misma ruta que la guía (un crédito, una vez por persona y aviso, la ficha
// releída antes de cobrar). Sin saldo, el único botón es el rojo: comprar el suelto.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { GUIA } from "@/lib/guia/copy";
import { RUTA_SUELTO_SEMANAL, SEMANAL_PAGINA } from "@/lib/guia/semanal";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { ItemSemanal } from "@/lib/guia/semanal-servidor";
import "@/components/guia/guia.css";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export function SemanalLista({ token, origenId, combinacion, items, destacado, despublicado, saldo }: {
  token: string;
  origenId: string | null;
  combinacion: { piePct: number; plazoAnios: number } | null;
  items: ItemSemanal[];
  destacado: string | null;
  despublicado: boolean;
  saldo: EstadoSaldo;
}) {
  const router = useRouter();
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
  const [fuera, setFuera] = useState<Set<string>>(() => new Set(despublicado && destacado ? [destacado] : []));
  const conSaldo = saldo.tipo !== "sin";
  const usa = saldo.tipo === "con" ? SEMANAL_PAGINA.usaUno(saldo.n) : saldo.tipo === "regalo" ? SEMANAL_PAGINA.usaRegalo : null;

  async function analizar(it: ItemSemanal) {
    if (generando || !origenId || !combinacion) return;
    setError(null);
    setGenerando(it.avisoId);
    try {
      for (let intento = 0; intento < 8; intento++) {
        const res = await fetch("/api/lo-que-sigue/guia/analizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origenId, avisoId: it.avisoId, piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios, semanal: token }),
        });
        if (res.status === 409) { await new Promise((ok) => setTimeout(ok, 4000)); continue; }
        const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (res.ok && d.id) { router.push(`/analisis/${d.id}`); return; }
        if (res.status === 410 && d.error === "despublicado") { setFuera((s) => new Set(s).add(it.avisoId)); break; }
        setError({ avisoId: it.avisoId, texto: d.error === "sin-creditos" ? SEMANAL_PAGINA.sinCreditos : GUIA.error });
        break;
      }
    } catch {
      setError({ avisoId: it.avisoId, texto: GUIA.error });
    }
    setGenerando(null);
  }

  const vivos = items.filter((i) => !fuera.has(i.avisoId));

  return (
    <section className="guia" data-semanal="lista">
      <h1 className="guia-titulo">{SEMANAL_PAGINA.titulo}</h1>
      {combinacion && <p className="guia-txt">{SEMANAL_PAGINA.bajada(pct(combinacion.piePct), combinacion.plazoAnios)}</p>}
      {saldo.tipo === "regalo" && <p className="guia-txt" data-semanal="regalo"><b>{SEMANAL_PAGINA.regalo}</b></p>}
      {despublicado && destacado && <p className="guia-error" role="alert" data-semanal="despublicado">{GUIA.despublicado}</p>}
      {vivos.length === 0 ? (
        <p className="guia-txt" data-semanal="vacia">{SEMANAL_PAGINA.vacia}</p>
      ) : (
        <div className="guia-lista">
          {vivos.map((it) => {
            const neg = (it.flujo ?? 0) < 0;
            return (
              <article key={it.avisoId} className="guia-av" data-destacado={it.avisoId === destacado ? "1" : undefined}>
                <div className="guia-top">
                  <span className="guia-ojo">{[it.comuna, it.tipologia, `${miles(it.m2)} m²`].filter(Boolean).join(" · ")}</span>
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
                {conSaldo && (
                  <div className="guia-acc">
                    <button type="button" className="guia-an" onClick={() => analizar(it)} disabled={!!generando} data-presionado={generando === it.avisoId ? "1" : undefined}>
                      {generando === it.avisoId ? GUIA.analizando : GUIA.analizar}
                    </button>
                    {usa && <span className="guia-cr">· {usa}</span>}
                  </div>
                )}
                {error?.avisoId === it.avisoId && <p className="guia-error" role="alert">{error.texto}</p>}
              </article>
            );
          })}
        </div>
      )}
      {!conSaldo && vivos.length > 0 && (
        <div className="mt-6 flex flex-col items-start gap-2" data-semanal="comprar">
          <EnlaceCarga href={RUTA_SUELTO_SEMANAL} className="inline-flex h-12 items-center rounded-full px-7 text-[16px] font-semibold text-white" style={{ background: "var(--signal-red)" }}>
            {SEMANAL_PAGINA.comprar}
          </EnlaceCarga>
          <p className="text-[13px] text-[var(--franco-text-secondary)]">{SEMANAL_PAGINA.comprarBajada}</p>
        </div>
      )}
      <p className="guia-pie">{SEMANAL_PAGINA.pie}</p>
    </section>
  );
}
