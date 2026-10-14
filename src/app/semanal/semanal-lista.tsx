"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Los deptos del correo semanal en Franco (02-oct-2026). Las tarjetas son las de la guía (guia.css): el
// precio, el veredicto con su puntaje y el flujo con el pie y el plazo de la persona. «Analizar este»
// genera el informe por la misma ruta que la guía (un crédito, una vez por persona y aviso, la ficha
// releída antes de cobrar). Desde el 13-oct-2026 «Analizar este» abre primero el aviso (AvisoAntesDeAnalizar:
// el pop-up del wizard con los datos del depto, el pie y el plazo del perfil y «Usa 1 de tus N análisis.»); sin saldo, el aviso ofrece el pack de tres, y abajo el botón rojo
// compra el pack en lugar del suelto. Después de pagar, vuelve a esta página.
// La página está VIVA (05-oct-2026): un depto que ya no está publicado lo dice —«Este ya no está
// publicado»— y en su lugar va el siguiente mejor del perfil, chequeado (lo arma el servidor:
// seleccionViva). Si «Analizar este» descubre que se dio de baja, la página se vuelve a pedir.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { GUIA } from "@/lib/guia/copy";
import { MARCA_NEGOCIAR, SEMANAL_PAGINA, textoVence, type FilaPaginaSemanal } from "@/lib/guia/semanal";
import { MARCA_ZONA, NO_DA, SEMANAL_STR } from "@/lib/guia/semanal-str";
import { rutaTres } from "@/lib/tres-analisis";
import { AvisoAntesDeAnalizar } from "@/components/guia/AvisoAntesDeAnalizar";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { ItemSemanal } from "@/lib/guia/semanal-servidor";
import "@/components/guia/guia.css";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const ojoDe = (it: ItemSemanal) => [it.comuna, it.tipologia, `${miles(it.m2)} m²`].filter(Boolean).join(" · ");

export function SemanalLista({
  token, origenId, combinacion, filas, destacado, saldo, variante, inmediato = false, finanzas = { tasa: null, uf: null, arriendos: {} },
  modalidad = "ltr", bloque = null, conTitulo = true, cierre = true,
}: {
  token: string;
  origenId: string | null;
  combinacion: { piePct: number; plazoAnios: number } | null;
  filas: Array<FilaPaginaSemanal<ItemSemanal>>;
  destacado: string | null;
  saldo: EstadoSaldo;
  variante: "banda" | "tarjetas" | null;
  /** Vino de un aviso inmediato (05-oct-2026): la compra se marca como venida del aviso. */
  inmediato?: boolean;
  /** Para el aviso antes de gastar (13-oct-2026): la tasa, la UF y el arriendo evaluado de cada depto (en renta corta, el
   *  ingreso estimado por zona). */
  finanzas?: { tasa: number | null; uf: number | null; arriendos: Record<string, number> };
  /** LOS DOS BLOQUES (14-oct-2026): el de renta corta va estimado por zona, se analiza por /api/semanal/analizar-str y,
   *  si la medición fina no da, muestra NO_DA con los siguientes. `bloque`: su título cuando la página trae los dos;
   *  `conTitulo` y `cierre`: el título de la página y el cierre (comprar, pie) van una sola vez. */
  modalidad?: "ltr" | "str";
  bloque?: string | null;
  conTitulo?: boolean;
  cierre?: boolean;
}) {
  const router = useRouter();
  const corta = modalidad === "str";
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
  // Renta corta: la medición fina cambió el veredicto. No se cobró; se muestran los siguientes de la selección.
  const [noDa, setNoDa] = useState<{ avisoId: string; alternativas: string[] } | null>(null);
  // El aviso antes de gastar (13-oct-2026). `sin`: el servidor dijo que no quedan, aunque la página creyera que sí.
  const [confirmar, setConfirmar] = useState<{ it: ItemSemanal; sin: boolean } | null>(null);
  const conSaldo = saldo.tipo !== "sin";
  // El pack de tres, con el origen del correo y la vuelta a esta selección (con el depto, si se compró desde uno).
  const rutaCompra = (avisoId?: string) =>
    rutaTres(inmediato ? "inmediato" : "semanal", { variante: inmediato ? null : variante, volver: `/semanal?t=${token}${avisoId ? `&a=${avisoId}` : ""}` });
  const usa = saldo.tipo === "con" ? SEMANAL_PAGINA.usaUno(saldo.n) : saldo.tipo === "regalo" ? SEMANAL_PAGINA.usaRegalo : null;

  async function analizar(it: ItemSemanal) {
    if (generando || !origenId || !combinacion) return;
    setError(null);
    setNoDa(null);
    setGenerando(it.avisoId);
    try {
      for (let intento = 0; intento < 8; intento++) {
        const res = corta
          ? await fetch("/api/semanal/analizar-str", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, avisoId: it.avisoId }),
            })
          : await fetch("/api/lo-que-sigue/guia/analizar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ origenId, avisoId: it.avisoId, piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios, semanal: token }),
            });
        if (res.status === 409) { await new Promise((ok) => setTimeout(ok, 4000)); continue; }
        const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string; estado?: string; alternativas?: string[] };
        if (res.ok && d.id) { router.push(corta ? `/analisis/renta-corta/${d.id}` : `/analisis/${d.id}`); return; }
        // Renta corta: con los datos de su dirección no da. No se cobró.
        if (res.ok && d.estado === "no-da") { setNoDa({ avisoId: it.avisoId, alternativas: d.alternativas ?? [] }); break; }
        // Se dio de baja recién: el servidor lo marca y trae el siguiente.
        if (res.status === 410 && d.error === "despublicado") { router.refresh(); break; }
        // Sin análisis: el mismo aviso, con el pack (ya no el callejón «Ya usaste tus análisis.»).
        if (d.error === "sin-creditos") { setConfirmar({ it, sin: true }); break; }
        setError({ avisoId: it.avisoId, texto: GUIA.error });
        break;
      }
    } catch {
      setError({ avisoId: it.avisoId, texto: GUIA.error });
    }
    setGenerando(null);
  }

  const porId = new Map(filas.flatMap((f) => [f.item, ...(f.reemplazo ? [f.reemplazo] : [])]).map((i) => [i.avisoId, i]));
  // Los siguientes de su selección que se ofrecen cuando uno no da (los elige el servidor, en orden).
  const alternativas = noDa ? noDa.alternativas.map((id) => porId.get(id)).filter((i): i is ItemSemanal => !!i) : [];
  const tarjeta = (it: ItemSemanal, clave: string = it.avisoId): JSX.Element => {
    const neg = (it.flujo ?? 0) < 0;
    const card = (
      <article key={clave} className="guia-av" data-destacado={it.avisoId === destacado ? "1" : undefined} data-reemplazo={it.reemplazaA ? "1" : undefined}>
        <div className="guia-top">
          <span className="guia-ojo">{ojoDe(it)}</span>
        </div>
        <div className="guia-precio">UF {miles(it.precioUF)}</div>
        {corta && <p className="guia-negociar" data-semanal="zona">{MARCA_ZONA}</p>}
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
        <div className="guia-acc">
          <button type="button" className="guia-an" onClick={() => { setError(null); setConfirmar({ it, sin: false }); }} disabled={!!generando} data-presionado={generando === it.avisoId ? "1" : undefined}>
            {generando === it.avisoId ? GUIA.analizando : GUIA.analizar}
          </button>
          {usa && <span className="guia-cr">· {usa}</span>}
        </div>
        {error?.avisoId === it.avisoId && <p className="guia-error" role="alert">{error.texto}</p>}
      </article>
    );
    // Renta corta, cuando la medición fina no da: el aviso y los siguientes de su selección, debajo del depto.
    if (noDa?.avisoId !== it.avisoId || clave !== it.avisoId) return card;
    return (
      <div key={clave} className="guia-caido-grupo" data-semanal="no-da">
        {card}
        <div className="guia-caido" role="alert">
          <p className="guia-caido-txt">{NO_DA}</p>
        </div>
        {alternativas.map((a) => tarjeta(a, `alt-${a.avisoId}`))}
      </div>
    );
  };

  const visibles = filas.filter((f) => !f.caido || f.reemplazo).length;

  return (
    <section className="guia" data-semanal="lista" data-modalidad={modalidad}>
      {conTitulo && <h1 className="guia-titulo">{SEMANAL_PAGINA.titulo}</h1>}
      {bloque && <h2 className="guia-titulo" data-semanal="bloque">{bloque}</h2>}
      {combinacion && <p className="guia-txt">{SEMANAL_PAGINA.bajada(pct(combinacion.piePct), combinacion.plazoAnios)}</p>}
      {corta && <p className="guia-txt" data-semanal="zona">{SEMANAL_STR.zona}</p>}
      {conTitulo && saldo.tipo === "regalo" && <p className="guia-txt" data-semanal="regalo"><b>{SEMANAL_PAGINA.regalo}</b>{saldo.vence ? ` ${textoVence(saldo.vence)}` : ""}</p>}
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
      {visibles === 0 && <p className="guia-txt" data-semanal="vacia">{corta ? SEMANAL_STR.sinCorto : SEMANAL_PAGINA.vacia}</p>}
      {cierre && !conSaldo && visibles > 0 && (
        <div className="mt-6 flex flex-col items-start gap-2" data-semanal="comprar">
          <EnlaceCarga href={rutaCompra()} className="inline-flex h-12 items-center rounded-full px-7 text-[16px] font-semibold text-white" style={{ background: "var(--signal-red)" }}>
            {SEMANAL_PAGINA.comprar}
          </EnlaceCarga>
          <p className="text-[13px] text-[var(--franco-text-secondary)]">{SEMANAL_PAGINA.comprarBajada}</p>
        </div>
      )}
      {cierre && <p className="guia-pie">{SEMANAL_PAGINA.pie}</p>}
      {confirmar && combinacion && (
        <AvisoAntesDeAnalizar
          modalidad={modalidad}
          depto={confirmar.it}
          combinacion={combinacion}
          finanzas={{ tasa: finanzas.tasa, uf: finanzas.uf, arriendo: finanzas.arriendos[confirmar.it.avisoId] ?? null }}
          uso={confirmar.sin ? { tipo: "sin" } : saldo}
          rutaCompra={rutaCompra(confirmar.it.avisoId)}
          alAnalizar={() => { const it = confirmar.it; setConfirmar(null); void analizar(it); }}
          alCancelar={() => setConfirmar(null)}
        />
      )}
    </section>
  );
}
