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
// RENTA CORTA, DESPUÉS DE LA PRUEBA CON fsm@ (14-oct-2026, decisiones de Fabrizio):
//   · el título de cada bloque es un subtítulo de sección (`guia-bloque`), no otro título de página;
//   · el cuadradito del veredicto lleva su color de la tríada (`data-veredicto`), no siempre el azul de Comprar;
//   · al confirmar, el botón pasa a un indicador giratorio con `MIDIENDO`; pasados `MIDIENDO_TOPE_MS`, el error con
//     «Reintentar» (reintentar no cobra dos veces);
//   · si la medición fina no da, el resultado va en un POP-UP (PopupNoDa) con los parecidos que sobreviven, y la
//     tarjeta queda marcada `MARCA_NO_DA`, sin botón. Nada se inserta en la lista. La marca vuelve al recargar
//     (`noDan`, de las comparaciones guardadas).
// EN EL DASHBOARD (21-oct-2026, recorrido real de Fabrizio por la puerta B): la selección vive en el dashboard
// (dashboard/seleccion-en-casa.tsx) y /semanal redirige ahí. Además:
//   · «Analizar» deja el aviso abierto con «Franco está analizando este depto…» y la barra del header, como el wizard,
//     hasta que abre el informe (renta larga; la corta sigue midiendo en la tarjeta);
//   · sin saldo, el aviso ofrece el pack —al precio del ticket si la cuenta tiene menos de 24 horas— y «Comprar solo 1»,
//     con la vuelta a este depto (lib/guia/compra-desde-depto.ts); al volver pagado (`autoAnalizar`), se analiza solo;
//   · «Ya lo analizaste · Ver informe» también en renta larga, leído en vivo (`informes`).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { claveActual, iniciarCarga } from "@/lib/carga-global";
import { compraDeLaSeleccion, comprasDelDepto } from "@/lib/guia/compra-desde-depto";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { GUIA } from "@/lib/guia/copy";
import { MARCA_NEGOCIAR, MARCA_SIN_CONFIRMAR, MARCA_VISTO, SEMANAL_PAGINA, textoVence, type FilaPaginaSemanal } from "@/lib/guia/semanal";
import { MARCA_NO_DA, MARCA_ZONA, MIDIENDO, MIDIENDO_TARDO, MIDIENDO_TOPE_MS, REINTENTAR, SEMANAL_STR, YA_ANALIZADO } from "@/lib/guia/semanal-str";
import { AvisoAntesDeAnalizar } from "@/components/guia/AvisoAntesDeAnalizar";
import { PopupNoDa } from "@/components/guia/PopupNoDa";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { ItemSemanal } from "@/lib/guia/semanal-servidor";
import "@/components/guia/guia.css";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const ojoDe = (it: ItemSemanal) => [it.comuna, it.tipologia, `${miles(it.m2)} m²`].filter(Boolean).join(" · ");
const ESPERA_EN_CURSO_MS = 4000;
// Recién pagado, el crédito puede tardar unos segundos en llegar al ledger: se reintenta antes de ofrecer comprar otra vez.
const ESPERA_CREDITO_MS = 2500;
const REINTENTOS_CREDITO = 4;

export function SemanalLista({
  token, origenId, combinacion, filas, destacado, saldo, variante, inmediato = false, finanzas = { tasa: null, uf: null, arriendos: {} },
  modalidad = "ltr", bloque = null, conTitulo = true, cierre = true, noDan = [], informes = {}, ticket = false, autoAnalizar = null, enCasa = false,
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
  /** LOS DOS BLOQUES (14-oct-2026): el de renta corta va estimado por zona y se analiza por /api/semanal/analizar-str.
   *  `bloque`: su subtítulo cuando la página trae los dos; `conTitulo` y `cierre`: el título de la página y el cierre
   *  (comprar, pie) van una sola vez. */
  modalidad?: "ltr" | "str";
  bloque?: string | null;
  conTitulo?: boolean;
  cierre?: boolean;
  /** Renta corta: los que ya se midieron fino y no dieron (marcados, sin botón). */
  noDan?: string[];
  /** Los que ya analizó, por aviso, con su informe: en renta corta desde el 15-oct-2026, en renta larga desde el 21-oct-2026. */
  informes?: Record<string, string>;
  /** La cuenta tiene menos de 24 horas y no pagó el pack: va al precio del ticket. */
  ticket?: boolean;
  /** Volvió pagado desde este depto (`analizar=1`): se analiza solo. */
  autoAnalizar?: string | null;
  /** En el dashboard: el título es de sección, no de página. */
  enCasa?: boolean;
}) {
  const router = useRouter();
  const corta = modalidad === "str";
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
  // Renta corta: la medición pasó de MIDIENDO_TOPE_MS (error con «Reintentar»).
  const [tardo, setTardo] = useState<string | null>(null);
  // Renta corta: los que no dieron en esta visita, y el pop-up con sus parecidos.
  const [noDanAhora, setNoDanAhora] = useState<string[]>([]);
  const [popup, setPopup] = useState<{ avisoId: string; parecidos: string[] } | null>(null);
  // El aviso antes de gastar (13-oct-2026). `sin`: el servidor dijo que no quedan, aunque la página creyera que sí.
  // `analizando` (21-oct-2026): renta larga, generando con el aviso abierto.
  const [confirmar, setConfirmar] = useState<{ it: ItemSemanal; sin: boolean; analizando?: boolean } | null>(null);
  const conSaldo = saldo.tipo !== "sin";
  const noDa = new Set([...noDan, ...noDanAhora]);
  // Las compras, con el origen del correo y la vuelta a la selección en el dashboard (con el depto, si se compra desde uno).
  const origenCompra = inmediato ? "inmediato" as const : "semanal" as const;
  const varianteCompra = inmediato ? null : variante;
  const comprarSeleccion = compraDeLaSeleccion({ token, origen: origenCompra, variante: varianteCompra, ticket });
  const usa = saldo.tipo === "con" ? (saldo.proximoRegalo ? SEMANAL_PAGINA.usaRegalo : SEMANAL_PAGINA.usaUno(saldo.n)) : saldo.tipo === "regalo" ? SEMANAL_PAGINA.usaRegalo : null;

  async function analizar(it: ItemSemanal, recienPagado = false) {
    // Sin informe de origen (16-oct-2026, la puerta B) se analiza igual: la ruta valida la selección por el token.
    if (generando || !combinacion) return;
    setError(null);
    setTardo(null);
    setPopup(null);
    setGenerando(it.avisoId);
    // Renta larga (21-oct-2026): el aviso queda abierto, cargando, con la barra del header, hasta que abre el informe.
    const soltar = corta ? null : iniciarCarga(claveActual());
    if (!corta) setConfirmar({ it, sin: false, analizando: true });
    let sinCredito = 0;
    // Renta corta: la medición tiene tope. Pasado, se corta la espera y se ofrece reintentar.
    const t0 = Date.now();
    const control = new AbortController();
    const reloj = corta ? window.setTimeout(() => control.abort(), MIDIENDO_TOPE_MS) : null;
    try {
      for (let intento = 0; intento < 8 + REINTENTOS_CREDITO; intento++) {
        const res = corta
          ? await fetch("/api/semanal/analizar-str", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, avisoId: it.avisoId }),
              signal: control.signal,
            })
          : await fetch("/api/lo-que-sigue/guia/analizar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ origenId, avisoId: it.avisoId, piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios, semanal: token }),
            });
        if (res.status === 409) {
          if (corta && Date.now() - t0 + ESPERA_EN_CURSO_MS >= MIDIENDO_TOPE_MS) { setTardo(it.avisoId); break; }
          await new Promise((ok) => setTimeout(ok, ESPERA_EN_CURSO_MS));
          continue;
        }
        const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string; estado?: string; alternativas?: string[] };
        if (res.ok && d.id) { router.push(corta ? `/analisis/renta-corta/${d.id}` : `/analisis/${d.id}`); return; }
        // Renta corta: con los datos de su dirección no da Comprar. No se cobró: la tarjeta queda marcada y el
        // resultado va en el pop-up, con los parecidos que sobreviven.
        if (res.ok && d.estado === "no-da") {
          setNoDanAhora((xs) => [...xs, it.avisoId]);
          setPopup({ avisoId: it.avisoId, parecidos: d.alternativas ?? [] });
          break;
        }
        // Se dio de baja recién: el servidor lo marca y trae el siguiente.
        if (res.status === 410 && d.error === "despublicado") { setConfirmar(null); router.refresh(); break; }
        // Sin análisis: el mismo aviso, con el pack (ya no el callejón «Ya usaste tus análisis.»). Recién pagado, primero se
        // espera el crédito.
        if (d.error === "sin-creditos") {
          if (recienPagado && sinCredito++ < REINTENTOS_CREDITO) { await new Promise((ok) => setTimeout(ok, ESPERA_CREDITO_MS)); continue; }
          setConfirmar({ it, sin: true });
          break;
        }
        setConfirmar(null);
        setError({ avisoId: it.avisoId, texto: GUIA.error });
        break;
      }
    } catch {
      setConfirmar(null);
      if (corta && control.signal.aborted) setTardo(it.avisoId);
      else setError({ avisoId: it.avisoId, texto: GUIA.error });
    } finally {
      if (reloj != null) window.clearTimeout(reloj);
    }
    soltar?.();
    setGenerando(null);
  }

  // Volvió pagado desde este depto (21-oct-2026): se analiza solo, una vez. El `analizar=1` sale de la dirección antes, así
  // recargar o volver atrás no lo analiza de nuevo.
  const autoHecho = useRef(false);
  useEffect(() => {
    if (!autoAnalizar || autoHecho.current) return;
    const it = filas.flatMap((f) => [f.item, ...(f.reemplazo ? [f.reemplazo] : [])]).find((i) => i.avisoId === autoAnalizar);
    if (!it || it.informeId || informes[it.avisoId] || (corta && noDa.has(it.avisoId))) return;
    autoHecho.current = true;
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("analizar");
      window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`);
    } catch { /* sin limpiar la dirección: igual se analiza una vez */ }
    void analizar(it, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnalizar]);

  const porId = new Map(filas.flatMap((f) => [f.item, ...(f.reemplazo ? [f.reemplazo] : [])]).map((i) => [i.avisoId, i]));
  // Los parecidos que ofrece el pop-up (los elige el servidor, en orden, ya reevaluados con la medición nueva).
  const parecidos = popup ? popup.parecidos.map((id) => porId.get(id)).filter((i): i is ItemSemanal => !!i && !noDa.has(i.avisoId)) : [];

  // Ya lo analizó: en renta corta, el informe de la medición fina (15-oct-2026); en renta larga, el que trae el depto ya
  // visto (19-oct-2026) o, desde el 21-oct-2026, el que leyó el servidor recién (en vivo, al volver del informe).
  const informeDe = (it: ItemSemanal): string | undefined => it.informeId ?? informes[it.avisoId];
  const acciones = (it: ItemSemanal): JSX.Element => {
    // Renta corta: medido fino y no dio. Queda dicho, sin botón.
    if (corta && noDa.has(it.avisoId)) return <p className="guia-no-da" data-semanal="no-da">{MARCA_NO_DA}</p>;
    // Ya lo analizó (15-oct-2026): el informe, sin volver a medir ni a cobrar.
    const informe = informeDe(it);
    if (informe) {
      return (
        <div className="guia-acc" data-semanal="ya-analizado">
          <span className="guia-cr">{YA_ANALIZADO.texto} ·</span>
          <EnlaceCarga href={corta ? `/analisis/renta-corta/${informe}` : `/analisis/${informe}`} className="guia-ver-informe">{YA_ANALIZADO.enlace}</EnlaceCarga>
        </div>
      );
    }
    if (corta && generando === it.avisoId) {
      return (
        <div className="guia-acc guia-midiendo" role="status" aria-live="polite" data-semanal="midiendo">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
          <span>{MIDIENDO}</span>
        </div>
      );
    }
    if (corta && tardo === it.avisoId) {
      return (
        <div className="guia-tardo" data-semanal="tardo">
          <p className="guia-error" role="alert">{MIDIENDO_TARDO}</p>
          <div className="guia-acc">
            <button type="button" className="guia-an" onClick={() => void analizar(it)} disabled={!!generando}>{REINTENTAR}</button>
          </div>
        </div>
      );
    }
    return (
      <div className="guia-acc">
        <button type="button" className="guia-an" onClick={() => { setError(null); setPopup(null); setConfirmar({ it, sin: false }); }} disabled={!!generando} data-presionado={generando === it.avisoId ? "1" : undefined}>
          {generando === it.avisoId ? GUIA.analizando : GUIA.analizar}
        </button>
        {usa && <span className="guia-cr">· {usa}</span>}
      </div>
    );
  };

  const tarjeta = (it: ItemSemanal, clave: string = it.avisoId): JSX.Element => {
    const neg = (it.flujo ?? 0) < 0;
    return (
      <article key={clave} className="guia-av" data-destacado={it.avisoId === destacado ? "1" : undefined} data-reemplazo={it.reemplazaA ? "1" : undefined} data-no-da={corta && noDa.has(it.avisoId) ? "1" : undefined}>
        <div className="guia-top">
          <span className="guia-ojo">{ojoDe(it)}</span>
        </div>
        <div className="guia-precio">UF {miles(it.precioUF)}</div>
        {corta && <p className="guia-negociar" data-semanal="zona">{MARCA_ZONA}</p>}
        {it.tramo === "negociar" && <p className="guia-negociar" data-semanal="negociar">{MARCA_NEGOCIAR}</p>}
        {/* El relleno (20-oct-2026): lo vio anoche publicado en el portal, sin ficha leída; «Analizar este» la relee antes de cobrar. */}
        {it.sinConfirmar && <p className="guia-negociar" data-semanal="sin-confirmar">{MARCA_SIN_CONFIRMAR}</p>}
        {/* Lo ya visto (19-oct-2026), al final de la lista; «Ya lo analizaste» no se repite si ya lo dice el enlace al informe. */}
        {it.visto && !(it.visto === "analizado" && informeDe(it)) && <p className="guia-negociar" data-semanal="visto">{MARCA_VISTO[it.visto]}</p>}
        <div className="guia-dos">
          <div>
            <div className="guia-k">{GUIA.veredicto}</div>
            <span className="guia-ver" data-veredicto={it.veredicto ?? undefined}>{it.veredicto ? etiquetaVeredicto(it.veredicto, "frase") : "—"} <span className="guia-pt">{it.score ?? ""}</span></span>
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
        {acciones(it)}
        {error?.avisoId === it.avisoId && <p className="guia-error" role="alert">{error.texto}</p>}
      </article>
    );
  };

  const visibles = filas.filter((f) => !f.caido || f.reemplazo).length;

  return (
    <section className="guia" data-semanal="lista" data-modalidad={modalidad}>
      {/* En la casa, un título de sección plano como «Tu perfil de búsqueda» y «Tus informes» (casa.css), no otro titular. */}
      {conTitulo && (enCasa ? <h2 className="ca-plano-t" data-semanal="titulo">{SEMANAL_PAGINA.titulo}</h2> : <h1 className="guia-titulo">{SEMANAL_PAGINA.titulo}</h1>)}
      {bloque && <h2 className="guia-bloque" data-semanal="bloque">{bloque}</h2>}
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
          <EnlaceCarga href={comprarSeleccion.href} className="inline-flex h-12 items-center rounded-full px-7 text-[16px] font-semibold text-white" style={{ background: "var(--signal-red)" }}>
            {comprarSeleccion.label}
          </EnlaceCarga>
          <p className="text-[13px] text-[var(--franco-text-secondary)]">{SEMANAL_PAGINA.comprarBajada}</p>
        </div>
      )}
      {cierre && <p className="guia-pie">{SEMANAL_PAGINA.pie}</p>}
      {popup && (
        <PopupNoDa parecidos={parecidos.length} alCerrar={() => setPopup(null)}>
          {parecidos.map((p) => tarjeta(p, `pop-${p.avisoId}`))}
        </PopupNoDa>
      )}
      {confirmar && combinacion && (
        <AvisoAntesDeAnalizar
          modalidad={modalidad}
          depto={confirmar.it}
          combinacion={combinacion}
          finanzas={{ tasa: finanzas.tasa, uf: finanzas.uf, arriendo: finanzas.arriendos[confirmar.it.avisoId] ?? null }}
          uso={confirmar.sin ? { tipo: "sin" } : saldo}
          compras={comprasDelDepto({ token, avisoId: confirmar.it.avisoId, origen: origenCompra, variante: varianteCompra, ticket })}
          rutaCompra={comprarSeleccion.href}
          analizando={!!confirmar.analizando}
          // Renta corta: el aviso se cierra y la tarjeta mide. Renta larga: queda abierto, cargando, hasta el informe.
          alAnalizar={() => { const it = confirmar.it; if (corta) setConfirmar(null); void analizar(it); }}
          alCancelar={() => { if (!confirmar.analizando) setConfirmar(null); }}
        />
      )}
    </section>
  );
}
