"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Los deptos del correo semanal en Franco (02-oct-2026). Las tarjetas son las de la guía (guia.css): el
// precio, el veredicto con su puntaje y el flujo con el pie y el plazo de la persona. «Analizar este»
// genera el informe por la misma ruta que la guía (un crédito, una vez por persona y aviso, la ficha
// releída antes de cobrar). Sin saldo, el único botón es el rojo: comprar el suelto.
// La página está VIVA (05-oct-2026): un depto que ya no está publicado lo dice —«Este ya no está
// publicado»— y en su lugar va el siguiente mejor del perfil, chequeado (lo arma el servidor:
// seleccionViva). Si «Analizar este» descubre que se dio de baja, la página se vuelve a pedir.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { GUIA } from "@/lib/guia/copy";
import { MARCA_NEGOCIAR, SEMANAL_PAGINA, rutaSueltoSemanal, textoVence, type FilaPaginaSemanal } from "@/lib/guia/semanal";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { ItemSemanal } from "@/lib/guia/semanal-servidor";
import "@/components/guia/guia.css";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const ojoDe = (it: ItemSemanal) => [it.comuna, it.tipologia, `${miles(it.m2)} m²`].filter(Boolean).join(" · ");

export function SemanalLista({ token, origenId, combinacion, filas, destacado, saldo, variante }: {
  token: string;
  origenId: string | null;
  combinacion: { piePct: number; plazoAnios: number } | null;
  filas: Array<FilaPaginaSemanal<ItemSemanal>>;
  destacado: string | null;
  saldo: EstadoSaldo;
  variante: "banda" | "tarjetas" | null;
}) {
  const router = useRouter();
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
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
        // Se dio de baja recién: el servidor lo marca y trae el siguiente.
        if (res.status === 410 && d.error === "despublicado") { router.refresh(); break; }
        setError({ avisoId: it.avisoId, texto: d.error === "sin-creditos" ? SEMANAL_PAGINA.sinCreditos : GUIA.error });
        break;
      }
    } catch {
      setError({ avisoId: it.avisoId, texto: GUIA.error });
    }
    setGenerando(null);
  }

  const tarjeta = (it: ItemSemanal) => {
    const neg = (it.flujo ?? 0) < 0;
    return (
      <article key={it.avisoId} className="guia-av" data-destacado={it.avisoId === destacado ? "1" : undefined} data-reemplazo={it.reemplazaA ? "1" : undefined}>
        <div className="guia-top">
          <span className="guia-ojo">{ojoDe(it)}</span>
        </div>
        <div className="guia-precio">UF {miles(it.precioUF)}</div>
        {it.tramo === "negociar" && <p className="guia-negociar" data-semanal="negociar">{MARCA_NEGOCIAR}</p>}
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
  };

  const visibles = filas.filter((f) => !f.caido || f.reemplazo).length;

  return (
    <section className="guia" data-semanal="lista">
      <h1 className="guia-titulo">{SEMANAL_PAGINA.titulo}</h1>
      {combinacion && <p className="guia-txt">{SEMANAL_PAGINA.bajada(pct(combinacion.piePct), combinacion.plazoAnios)}</p>}
      {saldo.tipo === "regalo" && <p className="guia-txt" data-semanal="regalo"><b>{SEMANAL_PAGINA.regalo}</b>{saldo.vence ? ` ${textoVence(saldo.vence)}` : ""}</p>}
      <div className="guia-lista">
        {filas.map((f) => (f.caido ? (
          <div key={f.item.avisoId} className="guia-caido-grupo">
            <div className="guia-caido" data-semanal="caido">
              <span className="guia-ojo">{ojoDe(f.item)} · UF {miles(f.item.precioUF)}</span>
              <p className="guia-caido-txt">{SEMANAL_PAGINA.caido}</p>
              {f.reemplazo && <p className="guia-caido-sub">{SEMANAL_PAGINA.enSuLugar}</p>}
            </div>
            {f.reemplazo && tarjeta(f.reemplazo)}
          </div>
        ) : tarjeta(f.item)))}
      </div>
      {visibles === 0 && <p className="guia-txt" data-semanal="vacia">{SEMANAL_PAGINA.vacia}</p>}
      {!conSaldo && visibles > 0 && (
        <div className="mt-6 flex flex-col items-start gap-2" data-semanal="comprar">
          <EnlaceCarga href={rutaSueltoSemanal(variante)} className="inline-flex h-12 items-center rounded-full px-7 text-[16px] font-semibold text-white" style={{ background: "var(--signal-red)" }}>
            {SEMANAL_PAGINA.comprar}
          </EnlaceCarga>
          <p className="text-[13px] text-[var(--franco-text-secondary)]">{SEMANAL_PAGINA.comprarBajada}</p>
        </div>
      )}
      <p className="guia-pie">{SEMANAL_PAGINA.pie}</p>
    </section>
  );
}
