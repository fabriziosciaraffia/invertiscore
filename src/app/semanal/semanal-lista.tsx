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
import { botonOcupado, claveActual, iniciarCarga } from "@/lib/carga-global";
import { compraDeLaSeleccion, comprasDelDepto, ticketConSaldoDelDepto } from "@/lib/guia/compra-desde-depto";
import { cuandoVenceCorto } from "@/lib/lo-que-sigue/oferta-pack";
import { recalcularAviso } from "@/lib/explorar/recalcular-cliente";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { GUIA } from "@/lib/guia/copy";
import { MARCA_NEGOCIAR, MARCA_SIN_CONFIRMAR, MARCA_VISTO, SEMANAL_PAGINA, textoVence, type FilaPaginaSemanal } from "@/lib/guia/semanal";
import { MARCA_NO_DA, MARCA_ZONA, MIDIENDO, MIDIENDO_TARDO, MIDIENDO_TOPE_MS, REINTENTAR, SEMANAL_STR, YA_ANALIZADO, textoAnalizarIgual } from "@/lib/guia/semanal-str";
import { AvisoAntesDeAnalizar, type EleccionAnalizar } from "@/components/guia/AvisoAntesDeAnalizar";
import { PopupNoDa } from "@/components/guia/PopupNoDa";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { ItemSemanal } from "@/lib/guia/semanal-servidor";
import { lineaDepto } from "@/lib/guia/linea-depto";
import "@/components/guia/guia.css";
import "@/app/deptos/deptos.css";
import "@/app/dashboard/casa.css";
import { CASA } from "@/app/dashboard/casa-copy";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
/** La línea del depto, con «· Usado» o «· Nuevo» si el aviso lo dice (28-oct-2026, linea-depto.ts). */
const ojoDe = (it: ItemSemanal) => lineaDepto(it);
const ESPERA_EN_CURSO_MS = 4000;
/** «usa 1 de tus N» / «usa tu análisis de regalo»; null con el plan (no descuenta) o sin saldo. */
const usoDelSaldo = (s: EstadoSaldo): string | null =>
  s.tipo === "con" ? (s.proximoRegalo ? SEMANAL_PAGINA.usaRegalo : SEMANAL_PAGINA.usaUno(s.n)) : s.tipo === "regalo" ? SEMANAL_PAGINA.usaRegalo : null;
// Recién pagado, el crédito puede tardar unos segundos en llegar al ledger: se reintenta antes de ofrecer comprar otra vez.
const ESPERA_CREDITO_MS = 2500;
const REINTENTOS_CREDITO = 4;

export function SemanalLista({
  token, origenId, combinacion, filas, destacado, saldo, variante, inmediato = false, finanzas = { tasa: null, uf: null, arriendos: {} },
  modalidad = "ltr", bloque = null, conTitulo = true, cierre = true, noDan = [], informes = {}, ticket = false, cuentaCreadaAt = null, autoAnalizar = null, enCasa = false, aLaVista = null, desdeN = 1,
}: {
  token: string;
  origenId: string | null;
  combinacion: { piePct: number; plazoAnios: number; tasaPct?: number | null } | null;
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
  /** Con el ticket vivo (22-oct-2026): cuándo nació la cuenta, para la línea del ticket con saldo en el pop-up. */
  cuentaCreadaAt?: string | null;
  /** Volvió pagado desde este depto (`analizar=1`): se analiza solo. */
  autoAnalizar?: string | null;
  /** En el dashboard (24-oct-2026, mockup 3b): sin título ni bajada propios —los pone la página—, las tarjetas numeradas
   *  con el pin rojo (deptos.css › .sel-*), el ya analizado como fila compacta en su misma posición y, con `aLaVista`,
   *  solo esas a la vista y «Ver los N que faltan». */
  enCasa?: boolean;
  aLaVista?: number | null;
  /** El número de la primera tarjeta (28-oct-2026): con dos bloques, el segundo sigue la cuenta del primero, como el mapa. */
  desdeN?: number;
}) {
  const router = useRouter();
  const corta = modalidad === "str";
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
  // Renta corta: la medición pasó de MIDIENDO_TOPE_MS (error con «Reintentar»).
  const [tardo, setTardo] = useState<string | null>(null);
  // Renta corta: los que no dieron en esta visita, y el pop-up con sus parecidos.
  const [noDanAhora, setNoDanAhora] = useState<string[]>([]);
  // Desde el 27-oct-2026 el pop-up lleva también el enlace a la publicación, por qué no da y el uso de «Analizar igual»
  // (con el saldo con que midió el servidor, que tras un pago recién hecho puede ser más nuevo que el de la página).
  const [popup, setPopup] = useState<{ it: ItemSemanal; parecidos: string[]; publicacion: string | null; porQue: string | null; uso: string | null } | null>(null);
  // «Analizar igual» en curso: el pop-up queda abierto con el botón girando hasta que abre el informe.
  const [analizandoIgual, setAnalizandoIgual] = useState(false);
  // Las tarjetas a la vista (24-oct-2026): las primeras `aLaVista`, y «Ver los N que faltan» para el resto.
  const [verTodos, setVerTodos] = useState(false);
  // El aviso antes de gastar (13-oct-2026). `sin`: el servidor dijo que no quedan, aunque la página creyera que sí.
  // `analizando` (21-oct-2026): renta larga, generando con el aviso abierto.
  const [confirmar, setConfirmar] = useState<{ it: ItemSemanal; sin: boolean; analizando?: boolean } | null>(null);
  const conSaldo = saldo.tipo !== "sin";
  const noDa = new Set([...noDan, ...noDanAhora]);
  // Las compras, con el origen del correo y la vuelta a la selección en el dashboard (con el depto, si se compra desde uno).
  const origenCompra = inmediato ? "inmediato" as const : "semanal" as const;
  const varianteCompra = inmediato ? null : variante;
  const comprarSeleccion = compraDeLaSeleccion({ token, origen: origenCompra, variante: varianteCompra, ticket });
  const usa = usoDelSaldo(saldo);

  // `eleccion` (23-oct-2026, mockup D2): el pie y el plazo que cambió en el pop-up, y si quedan como su perfil.
  // `igual` (27-oct-2026): «Analizar igual» desde el pop-up «no da» de renta corta; el pop-up queda abierto, girando.
  async function analizar(it: ItemSemanal, recienPagado = false, eleccion?: EleccionAnalizar, igual = false) {
    // Sin informe de origen (16-oct-2026, la puerta B) se analiza igual: la ruta valida la selección por el token.
    if (generando || !combinacion) return;
    const conCombo = eleccion?.combinacion ?? combinacion;
    setError(null);
    setTardo(null);
    if (igual) setAnalizandoIgual(true);
    else setPopup(null);
    setGenerando(it.avisoId);
    // Renta larga (21-oct-2026): el aviso queda abierto, cargando, con la barra del header, hasta que abre el informe.
    const soltar = corta ? null : iniciarCarga(claveActual());
    if (!corta) setConfirmar({ it, sin: false, analizando: true });
    // La casilla del pop-up: la combinación elegida queda como su perfil de búsqueda antes de analizar.
    if (eleccion?.guardarPerfil) {
      await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ piePct: conCombo.piePct, plazoAnios: conCombo.plazoAnios, tasaPct: conCombo.tasaPct ?? null }) }).catch(() => null);
    }
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
              body: JSON.stringify({ token, avisoId: it.avisoId, ...(igual ? { igual: true } : {}) }),
              signal: control.signal,
            })
          : await fetch("/api/lo-que-sigue/guia/analizar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ origenId, avisoId: it.avisoId, piePct: conCombo.piePct, plazoAnios: conCombo.plazoAnios, tasaPct: conCombo.tasaPct ?? null, semanal: token }),
            });
        if (res.status === 409) {
          if (corta && Date.now() - t0 + ESPERA_EN_CURSO_MS >= MIDIENDO_TOPE_MS) { setTardo(it.avisoId); break; }
          await new Promise((ok) => setTimeout(ok, ESPERA_EN_CURSO_MS));
          continue;
        }
        const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string; estado?: string; alternativas?: string[]; publicacion?: string | null; porQue?: string | null; saldo?: EstadoSaldo | null };
        if (res.ok && d.id) { router.push(corta ? `/analisis/renta-corta/${d.id}` : `/analisis/${d.id}`); return; }
        // Renta corta: con los datos de su dirección no da Comprar. No se cobró: la tarjeta queda marcada y el
        // resultado va en el pop-up —con el enlace a la publicación, el porqué y «Analizar igual»—, con los parecidos
        // que sobreviven.
        if (res.ok && d.estado === "no-da") {
          setNoDanAhora((xs) => [...xs, it.avisoId]);
          setPopup({ it, parecidos: d.alternativas ?? [], publicacion: d.publicacion ?? null, porQue: d.porQue ?? null, uso: usoDelSaldo(d.saldo ?? saldo) });
          break;
        }
        // Lo que sigue cierra el pop-up de «Analizar igual» si estaba abierto: el informe no salió.
        setPopup(null);
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
      setPopup(null);
      if (corta && control.signal.aborted) setTardo(it.avisoId);
      else setError({ avisoId: it.avisoId, texto: GUIA.error });
    } finally {
      if (reloj != null) window.clearTimeout(reloj);
    }
    soltar?.();
    setGenerando(null);
    setAnalizandoIgual(false);
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
  const nombre = (it: ItemSemanal) => [ojoDe(it), `UF ${miles(it.precioUF)}`, it.veredicto ? `${etiquetaVeredicto(it.veredicto, "frase")}${it.score != null ? ` ${it.score}` : ""}` : null].filter(Boolean).join(" · ");
  const acciones = (it: ItemSemanal): JSX.Element => {
    // Renta corta: medido fino y no dio. Queda dicho, sin botón.
    if (corta && noDa.has(it.avisoId)) return <p className="sel-estado" data-semanal="no-da">{MARCA_NO_DA}</p>;
    if (corta && generando === it.avisoId) {
      return (
        <div className="sel-ya" role="status" aria-live="polite" data-semanal="midiendo">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
          <span>{MIDIENDO}</span>
        </div>
      );
    }
    if (corta && tardo === it.avisoId) {
      return (
        <div data-semanal="tardo">
          <p className="sel-error" role="alert">{MIDIENDO_TARDO}</p>
          <button type="button" className="sel-btn" onClick={() => void analizar(it)} disabled={!!generando}>{REINTENTAR}</button>
        </div>
      );
    }
    return (
      <button type="button" className="sel-btn" data-primario="1" onClick={() => { setError(null); setPopup(null); setConfirmar({ it, sin: false }); }} disabled={!!generando} {...botonOcupado(generando === it.avisoId)} data-semanal="analizar">
        {generando === it.avisoId ? GUIA.analizando : usa === SEMANAL_PAGINA.usaRegalo ? CASA.seleccion.analizarRegalo : CASA.seleccion.analizar}
      </button>
    );
  };

  // EL YA ANALIZADO, EN SU POSICIÓN (24-oct-2026, mockup 3b): una fila compacta y gris —el pin, el depto con su veredicto,
  // «Ya lo analizaste» y «Ver informe»—, no una tarjeta ni al final.
  const filaAnalizada = (it: ItemSemanal, informe: string, n: number | null): JSX.Element => (
    <EnlaceCarga key={it.avisoId} href={corta ? `/analisis/renta-corta/${informe}` : `/analisis/${informe}`} className="sel-fila" data-semanal="ya-analizado" data-n={n ?? undefined}>
      <span className="sel-fila-txt">
        <span className="sel-fila-ojo">{n != null && <span className="sel-pin" aria-hidden="true">{n}</span>}{nombre(it)}</span>
        <span className="sel-fila-ya">{YA_ANALIZADO.texto}</span>
      </span>
      <span className="sel-fila-ver">{YA_ANALIZADO.enlace}</span>
    </EnlaceCarga>
  );

  const tarjeta = (it: ItemSemanal, clave: string = it.avisoId, n: number | null = null): JSX.Element => {
    const informe = informeDe(it);
    if (informe) return filaAnalizada(it, informe, n);
    const neg = (it.flujo ?? 0) < 0;
    return (
      <article key={clave} className="sel-av" data-destacado={it.avisoId === destacado ? "1" : undefined} data-reemplazo={it.reemplazaA ? "1" : undefined} data-no-da={corta && noDa.has(it.avisoId) ? "1" : undefined} data-n={n ?? undefined}>
        <div className="sel-ojo">{n != null && <span className="sel-pin" aria-hidden="true">{n}</span>}{ojoDe(it)}</div>
        <div className="sel-precio">UF {miles(it.precioUF)}</div>
        {corta && <p className="sel-estado" data-semanal="zona">{MARCA_ZONA}</p>}
        {it.tramo === "negociar" && <p className="sel-estado" data-semanal="negociar">{MARCA_NEGOCIAR}</p>}
        {/* El relleno (20-oct-2026): lo vio anoche publicado en el portal, sin ficha leída; «Analizar este» la relee antes de cobrar. */}
        {it.sinConfirmar && <p className="sel-estado" data-semanal="sin-confirmar">{MARCA_SIN_CONFIRMAR}</p>}
        {/* Lo ya visto (19-oct-2026), marcado («Ya lo analizaste» ya es la fila compacta). */}
        {it.visto && it.visto !== "analizado" && <p className="sel-estado" data-semanal="visto">{MARCA_VISTO[it.visto]}</p>}
        <div className="sel-dos">
          <div>
            <span className="sel-k">{GUIA.veredicto}</span>
            <span className="sel-v" data-veredicto={it.veredicto ?? undefined}>{it.veredicto ? etiquetaVeredicto(it.veredicto, "frase") : "—"}{it.score != null ? ` · ${it.score}` : ""}</span>
          </div>
          <div>
            <span className="sel-k">{GUIA.flujo}</span>
            {it.flujo != null && (
              <span className={`sel-flujo${neg ? " sel-neg" : ""}`}>
                {neg ? "−" : "+"}${miles(Math.abs(it.flujo))} <small>{neg ? GUIA.saleDeTuBolsillo : GUIA.teQueda}</small>
              </span>
            )}
          </div>
        </div>
        {acciones(it)}
        {error?.avisoId === it.avisoId && <p className="sel-error" role="alert">{error.texto}</p>}
      </article>
    );
  };

  const visibles = filas.filter((f) => !f.caido || f.reemplazo).length;
  // El orden es el de la selección (lib/guia/semanal.ts › ordenFijo), numerado desde 1; a la vista, las primeras.
  const filasALaVista = aLaVista != null && !verTodos ? filas.slice(0, aLaVista) : filas;
  const faltanPorVer = filas.length - filasALaVista.length;

  return (
    <section className="guia ca-tarjetas" data-semanal="lista" data-modalidad={modalidad}>
      {/* En la casa (24-oct-2026) la página pone el título y la línea del perfil; fuera de ella, el titular de siempre. */}
      {conTitulo && !enCasa && <h1 className="guia-titulo">{SEMANAL_PAGINA.titulo}</h1>}
      {bloque && <h2 className="guia-bloque" data-semanal="bloque">{bloque}</h2>}
      {!enCasa && combinacion && <p className="guia-txt">{SEMANAL_PAGINA.bajada(pct(combinacion.piePct), combinacion.plazoAnios)}</p>}
      {corta && <p className="guia-txt" data-semanal="zona">{SEMANAL_STR.zona}</p>}
      {!enCasa && conTitulo && saldo.tipo === "regalo" && <p className="guia-txt" data-semanal="regalo"><b>{SEMANAL_PAGINA.regalo}</b>{saldo.vence ? ` ${textoVence(saldo.vence)}` : ""}</p>}
      <div className="sel-lista" data-semanal="tarjetas">
        {filasALaVista.map((f, i) => (f.caido ? (
          <div key={f.item.avisoId} className="guia-caido-grupo">
            <div className="guia-caido" data-semanal="caido">
              <span className="guia-ojo">{ojoDe(f.item)} · UF {miles(f.item.precioUF)}</span>
              <p className="guia-caido-txt">{SEMANAL_PAGINA.caido}</p>
              {f.reemplazo && <p className="guia-caido-sub">{SEMANAL_PAGINA.enSuLugar}</p>}
            </div>
            {f.reemplazo && tarjeta(f.reemplazo, f.reemplazo.avisoId, i + desdeN)}
          </div>
        ) : tarjeta(f.item, f.item.avisoId, i + desdeN)))}
        {faltanPorVer > 0 && <button type="button" className="sel-mas" onClick={() => setVerTodos(true)} data-semanal="ver-mas">{CASA.seleccion.verMas(faltanPorVer)}</button>}
      </div>
      {visibles === 0 && <p className="guia-txt" data-semanal="vacia">{corta ? SEMANAL_STR.sinCorto : SEMANAL_PAGINA.vacia}</p>}
      {cierre && !enCasa && !conSaldo && visibles > 0 && (
        <div className="mt-6 flex flex-col items-start gap-2" data-semanal="comprar">
          <EnlaceCarga href={comprarSeleccion.href} className="inline-flex h-12 items-center rounded-full px-7 text-[16px] font-semibold text-white" style={{ background: "var(--signal-red)" }}>
            {comprarSeleccion.label}
          </EnlaceCarga>
          <p className="text-[13px] text-[var(--franco-text-secondary)]">{SEMANAL_PAGINA.comprarBajada}</p>
        </div>
      )}
      {cierre && !enCasa && <p className="guia-pie">{SEMANAL_PAGINA.pie}</p>}
      {popup && (
        <PopupNoDa
          parecidos={parecidos.length}
          alCerrar={() => { if (!analizandoIgual) setPopup(null); }}
          publicacion={popup.publicacion}
          porQue={popup.porQue}
          analizarIgual={{ texto: textoAnalizarIgual(popup.uso), ocupado: analizandoIgual, alTocar: () => void analizar(popup.it, false, undefined, true) }}
        >
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
          ticketConSaldo={ticket && !corta ? ticketConSaldoDelDepto({ token, avisoId: confirmar.it.avisoId, origen: origenCompra, variante: varianteCompra, cuentaCreadaAt }) : null}
          // Sin saldo y con el ticket vivo (24-oct-2026, mockup A): la tarjeta roja de la oferta dice hasta cuándo.
          ticketVence={ticket && cuentaCreadaAt ? cuandoVenceCorto(cuentaCreadaAt) : null}
          rutaCompra={comprarSeleccion.href}
          analizando={!!confirmar.analizando}
          // El pop-up recalcula (23-oct-2026, D2): solo en renta larga, con el token de la selección.
          cambio={corta || !confirmar.it.veredicto ? null : { recalcular: (combo) => recalcularAviso(confirmar.it.avisoId, combo), base: { veredicto: confirmar.it.veredicto, score: confirmar.it.score, flujo: confirmar.it.flujo } }}
          // Renta corta: el aviso se cierra y la tarjeta mide. Renta larga: queda abierto, cargando, hasta el informe.
          alAnalizar={(eleccion) => { const it = confirmar.it; if (corta) setConfirmar(null); void analizar(it, false, corta ? undefined : eleccion); }}
          alCancelar={() => { if (!confirmar.analizando) setConfirmar(null); }}
          avisoId={confirmar.it.avisoId}
        />
      )}
    </section>
  );
}
