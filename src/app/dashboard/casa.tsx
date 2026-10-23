"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La casa (02-oct-2026): el saldo y «Tu perfil de búsqueda» editable. El perfil se alimenta de
// todos los informes (lib/perfil-busqueda.ts); lo que se toca acá queda en `perfil_busqueda` y manda
// sobre lo inferido. Sistema nuevo: Inter, sin mono, Source Serif en los títulos. Copy en casa-copy.ts.
// Desde el 17-oct-2026 la casa vende (casa.css): arriba el banner con lo más importante según el estado
// (BloqueArribaCasa, casa-arriba.ts) y su único botón en papel; después, plano, el saldo y el perfil.
// El único rojo es el del error.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import "./casa.css";
import "@/app/deptos/deptos.css";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { botonOcupado, chipOcupado } from "@/lib/carga-global";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { CASA_ARRIBA, type BloqueArriba } from "@/lib/casa-arriba";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { ESTAS_DENTRO } from "@/lib/lo-que-sigue/copy";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { Horizonte, Modalidad } from "@/lib/perfil-busqueda";
import { ajusteDeParametro, SEMANAL_VACIO, textoVence } from "@/lib/guia/semanal";
import { CASA, packDeCasa } from "./casa-copy";
import { SELECCION_CASA } from "@/lib/guia/seleccion-casa";
import { textoRenueva } from "@/lib/guia/renovacion";
import { RANGOS_UF, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";
import { CamposBusqueda, type CampoBusqueda, type ValorBusqueda } from "@/components/deptos/CamposBusqueda";

const UI = "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif";
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export const RUTA_SUELTO = "/checkout?product=single";
// Sin análisis, el pack de tres (13-oct-2026) o, en las primeras 24 horas de la cuenta, el del ticket (21-oct-2026):
// casa-copy.ts › packDeCasa. Vuelve al dashboard después de pagar.
export const RUTA_NUEVO = "/analisis/nuevo-v4";


/**
 * EL BLOQUE DE ARRIBA (17-oct-2026, decisión de Fabrizio): lo más importante según el estado, en banner —el material del
 * banner del informe, texto en papel, UN botón en papel—. Qué bloque, lo decide casa-arriba.ts › bloqueDeArriba.
 */
export function BloqueArribaCasa({ bloque, informes, ticketConSaldo = null, ticket = false }: { bloque: BloqueArriba; informes: number; /** Con saldo y el ticket vivo (22-oct-2026): cuándo nació la cuenta, para decir hasta cuándo. */ ticketConSaldo?: { cuentaCreadaAt: string } | null; ticket?: boolean }) {
  // Sin saldo, el pack al precio del ticket si la cuenta es nueva (21-oct-2026, casa-copy.ts › packDeCasa); con saldo y el
  // ticket vivo, la misma tarjeta con «3 más por $14.990» (22-oct-2026).
  const pack = packDeCasa(ticket, ticketConSaldo);
  if (bloque.tipo === "seleccion") {
    return (
      <section className="ca-banda" data-casa="arriba" data-arriba="seleccion">
        <h1 className="ca-banda-t">{SELECCION_CASA.titulo}</h1>
        <p className="ca-banda-s">{CASA_ARRIBA.seleccionBajada} <span data-casa="renueva">{textoRenueva()}</span></p>
        <div className="ca-banda-fila">
          <ul className="ca-sel" data-casa="seleccion">
            {bloque.bloques.map((b) => (
              <li key={b.modalidad} data-bloque={b.modalidad}>
                <b>{b.titulo}</b>
                <span className="ca-n">· {b.deptos === 0 ? SELECCION_CASA.ninguno : `${b.deptos} ${b.deptos === 1 ? "depto" : "deptos"}`}</span>
                {b.conteos.map((c) => (
                  <span key={c.v} className="ca-v">{b.conteos.length > 1 && <span className="ca-n">{c.n}</span>}<ChipVeredicto v={c.v} variante="sobre-fondo" /></span>
                ))}
                {b.modalidad === "str" && b.deptos > 0 && <span className="ca-n">· {SELECCION_CASA.zona}</span>}
              </li>
            ))}
          </ul>
          <EnlaceCarga href={SELECCION_CASA.href} className="ca-banda-btn" data-casa="ver-seleccion">
            {SELECCION_CASA.boton}
          </EnlaceCarga>
        </div>
      </section>
    );
  }
  if (bloque.tipo === "pack") {
    return (
      <section className="ca-banda" data-casa="arriba" data-arriba="pack">
        <h1 className="ca-banda-t">{CASA_ARRIBA.pack.titulo}</h1>
        <p className="ca-banda-s">{informes === 0 ? pack.bajadaPrimero : pack.bajada}</p>
        <div className="ca-banda-fila">
          <EnlaceCarga href={pack.href} className="ca-banda-btn" data-casa="comprar-tres" data-ticket={ticket ? "1" : undefined}>
            {pack.boton}
          </EnlaceCarga>
        </div>
      </section>
    );
  }
  if (bloque.tipo === "regalo") {
    return (
      <section className="ca-banda" data-casa="arriba" data-arriba="regalo">
        <h1 className="ca-banda-t">{CASA.regalo.titulo}</h1>
        <p className="ca-banda-s">{bloque.vence ? `${textoVence(bloque.vence)} ` : ""}{CASA_ARRIBA.regalo.bajada}</p>
        <div className="ca-banda-fila">
          <EnlaceCarga href={RUTA_NUEVO} className="ca-banda-btn" data-casa="analizar-otro">
            {informes === 0 ? CASA.regalo.botonPrimero : CASA.regalo.boton}
          </EnlaceCarga>
        </div>
      </section>
    );
  }
  return (
    <section className="ca-banda" data-casa="arriba" data-arriba="analizar">
      <h1 className="ca-banda-t">{CASA_ARRIBA.analizar.titulo}</h1>
      <p className="ca-banda-s">{CASA_ARRIBA.analizar.bajada}</p>
      <div className="ca-banda-fila">
        <EnlaceCarga href={RUTA_NUEVO} className="ca-banda-btn" data-casa="analizar-otro">
          {CASA_ARRIBA.analizar.boton}
        </EnlaceCarga>
      </div>
    </section>
  );
}

/**
 * EL SALDO, PLANO (17-oct-2026): una línea, sin tarjeta ni botón grande, después del segundo nivel. Lo que el banner ya
 * dice no se repite: con el regalo arriba no hay línea; con el pack arriba, la línea lleva solo el suelto y los planes.
 */
export function SaldoPlano({ estado, arriba, ticketConSaldo = null, ticket = false }: { estado: EstadoSaldo; arriba: BloqueArriba["tipo"]; /** Con saldo y el ticket vivo (22-oct-2026): la línea «Hoy, 3 más por $14.990 · vence mañana 11:17», como enlace. */ ticketConSaldo?: { cuentaCreadaAt: string } | null; ticket?: boolean }) {
  if (estado.tipo === "regalo" && arriba === "regalo") return null;
  const pack = packDeCasa(ticket, ticketConSaldo);
  // Con saldo, mientras el ticket esté vivo y la tarjeta de arriba no lo diga ya.
  const lineaTicket = ticket && ticketConSaldo && estado.tipo !== "sin" && estado.tipo !== "plan" && arriba !== "pack" ? pack.bajada : null;
  const linea =
    estado.tipo === "sin" ? CASA.sin.plano
    : estado.tipo === "regalo" ? `${CASA.regalo.titulo}${estado.vence ? ` ${textoVence(estado.vence)}` : ""}`
    : estado.tipo === "con" ? `${CASA.con.titulo(estado.n)}.${estado.noVencen ? ` ${CASA.con.noVencen}` : ""}`
    : `${CASA.plan.titulo} ${CASA.plan.bajada}`;
  const enlace = "text-[14px] text-[var(--franco-text-secondary)] underline underline-offset-4";
  return (
    <section className="ca-plano-sec" data-casa="saldo" data-saldo={estado.tipo} style={{ fontFamily: UI }}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <p className="m-0 text-[15px] font-semibold">{linea}</p>
        {lineaTicket && (
          <EnlaceCarga href={pack.href} className={enlace} data-casa="ticket-con-saldo">{lineaTicket}</EnlaceCarga>
        )}
        {estado.tipo === "sin" && (
          <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {arriba !== "pack" && (
              <EnlaceCarga href={pack.href} className={enlace} data-casa="comprar-tres-plano">{pack.boton}</EnlaceCarga>
            )}
            <EnlaceCarga href={RUTA_SUELTO} className={enlace} data-casa="comprar-suelto">
              {CASA.sin.suelto}
            </EnlaceCarga>
            <EnlaceCarga href="/pricing" className={enlace} data-casa="planes">
              {CASA.sin.planes}
            </EnlaceCarga>
          </span>
        )}
      </div>
    </section>
  );
}

export interface PerfilEditable {
  dormitorios: number[];
  comunas: string[];
  precioMaxUf: number | null;
  /** El piso elegido en /deptos (16-oct-2026): con él, el precio es un rango. */
  precioMinUf?: number | null;
  modalidad: Modalidad;
  piePct: number | null;
  plazoAnios: number | null;
  horizonte: Horizonte | null;
}

const PIES = [10, 15, 20, 25, 30, 40, 50];
const PLAZOS = [15, 20, 25, 30];

/**
 * LOS TRES CAMPOS DEL PERFIL (23-oct-2026, mockups `1b-deptos.html` y `3b-dashboard.html`): la comuna, la tipología y el
 * rango se editan con los mismos <select> de /deptos (CamposBusqueda, con más de una comuna). Lo que el perfil tiene y no
 * es una de las opciones —dormitorios de varios informes («1 y 2 dormitorios»), un tope sin piso («Hasta UF 4.500»)— se
 * muestra como la opción actual, y al elegir otra se guarda la de la lista.
 */
export function valorDePerfil(p: Pick<PerfilEditable, "comunas" | "dormitorios" | "precioMinUf" | "precioMaxUf">): { valor: ValorBusqueda; tipologiaExtra: string | null; rangoExtra: { id: string; chip: string } | null } {
  const dorms = [...p.dormitorios].sort((a, b) => a - b);
  const t = TIPOLOGIAS_DEPTOS.find((x) => x.dorms.length === dorms.length && x.dorms.every((d, i) => d === dorms[i]));
  const tipologiaExtra = t ? null : dorms.length === 0 ? CASA.perfil.sinTipologia : CASA.perfil.varias(dorms);
  const r = p.precioMaxUf != null ? RANGOS_UF.find((x) => x.max === p.precioMaxUf && (x.min ?? null) === (p.precioMinUf ?? null)) : undefined;
  const rangoExtra = r ? null : { id: RANGO_ACTUAL, chip: p.precioMaxUf == null ? CASA.perfil.sinTope : p.precioMinUf != null ? CASA.perfil.rango(miles(p.precioMinUf), miles(p.precioMaxUf)) : CASA.perfil.tope(miles(p.precioMaxUf)) };
  return { valor: { comunas: p.comunas, tipologia: t?.id ?? "", rango: r?.id ?? RANGO_ACTUAL }, tipologiaExtra, rangoExtra };
}
const RANGO_ACTUAL = "actual";

async function guardar(cambios: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambios) });
    return res.ok;
  } catch {
    return false;
  }
}

const chip = "ca-chip relative inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold text-[var(--franco-text)]";
const selectInvisible = "absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0";

export function PerfilBusquedaCasa({ inicial, comprador }: { inicial: PerfilEditable; comprador: boolean }) {
  const [p, setP] = useState<PerfilEditable>(inicial);
  const [error, setError] = useState(false);
  const [cambiandoHorizonte, setCambiandoHorizonte] = useState(false);
  // El chip que se guarda se ve guardándose (22-oct-2026, regla de carga): lo nombran las claves del cuerpo.
  const [guardando, setGuardando] = useState<string | null>(null);

  async function cambiar(parche: Partial<PerfilEditable>, cuerpo: Record<string, unknown>) {
    setP((x) => ({ ...x, ...parche }));
    setGuardando(Object.keys(cuerpo).join("+"));
    setError(!(await guardar(cuerpo)));
    setGuardando(null);
  }

  // Los tres campos (23-oct-2026): cada cambio se guarda solo, como los chips.
  const campos = valorDePerfil(p);
  const cambiarCampo = (campo: CampoBusqueda, v: ValorBusqueda) => {
    if (campo === "comuna") { if (v.comunas.length > 0) void cambiar({ comunas: v.comunas }, { comunas: v.comunas }); return; }
    if (campo === "tipologia") { const t = TIPOLOGIAS_DEPTOS.find((x) => x.id === v.tipologia); if (t) void cambiar({ dormitorios: [...t.dorms] }, { dormitorios: [...t.dorms] }); return; }
    const r = RANGOS_UF.find((x) => x.id === v.rango);
    if (r) void cambiar({ precioMinUf: r.min, precioMaxUf: r.max }, { precioMinUf: r.min, precioMaxUf: r.max });
  };
  const campoOcupado: CampoBusqueda | null = guardando === "comunas" ? "comuna" : guardando === "dormitorios" ? "tipologia" : guardando === "precioMinUf+precioMaxUf" ? "rango" : null;

  const pies = p.piePct != null && !PIES.includes(p.piePct) ? [...PIES, p.piePct].sort((a, b) => a - b) : PIES;
  const plazos = p.plazoAnios != null && !PLAZOS.includes(p.plazoAnios) ? [...PLAZOS, p.plazoAnios].sort((a, b) => a - b) : PLAZOS;
  // Mientras se guarda, los chips se quedan (el tocado, girando): si la línea los reemplazara al toque, el aro no se vería nunca
  // (lo cazó el QA del 22-oct-2026).
  const preguntar = p.horizonte == null || cambiandoHorizonte || guardando === "horizonte";
  // El ajuste en un toque del correo vacío (20-oct-2026): llega con `?ajuste=` ya guardado; acá se dice qué cambió.
  const [ajusteHecho, setAjusteHecho] = useState<string | null>(null);
  useEffect(() => {
    try {
      const a = ajusteDeParametro(new URLSearchParams(window.location.search).get("ajuste"), new Set(COMUNAS_DISPONIBLES as readonly string[]));
      if (a) setAjusteHecho(a.tipo === "pie" ? `tu pie quedó en ${a.pie} %` : `${a.comuna} quedó en tu búsqueda`);
    } catch {
      /* sin ventana */
    }
  }, []);

  return (
    <div id="perfil" className="ca-plano-sec" style={{ fontFamily: UI, scrollMarginTop: 80 }} data-casa="perfil">
      <h2 className="ca-plano-t">{CASA.perfil.titulo}</h2>
      {ajusteHecho && <p className="mb-3 text-[14px] font-semibold" role="status" data-casa="ajuste-hecho">{SEMANAL_VACIO.ajusteListo(ajusteHecho)}</p>}
      <p className="mb-3 max-w-[640px] text-[14px] text-[var(--franco-text-secondary)]">{comprador ? CASA.perfil.bajadaComprador : CASA.perfil.bajada}</p>
      <div>
        {/* Los tres campos de /deptos (23-oct-2026): la comuna (y las demás, con «+ agregar otra comuna»), la tipología y el
            rango, como <select>; cada cambio se guarda solo y el campo se ve guardándose. */}
        <div className="ca-perfil-campos" data-casa="campos">
          <CamposBusqueda multiple valor={campos.valor} tipologiaExtra={campos.tipologiaExtra} rangoExtra={campos.rangoExtra} ocupado={campoOcupado} onChange={cambiarCampo} ids="casa" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <label className={chip} data-chip="modalidad" {...chipOcupado(guardando === "modalidad")}>
            <span aria-hidden="true">{ESTAS_DENTRO.modalidad[p.modalidad]}</span>
            <select aria-label="Modalidad" className={selectInvisible} value={p.modalidad} onChange={(e) => { const v = e.target.value as Modalidad; void cambiar({ modalidad: v }, { modalidad: v }); }}>
              <option value="ltr">{ESTAS_DENTRO.modalidad.ltr}</option>
              <option value="str">{ESTAS_DENTRO.modalidad.str}</option>
            </select>
          </label>
          <label className={chip} data-chip="pie" {...chipOcupado(guardando === "piePct")}>
            <span aria-hidden="true">{CASA.perfil.pie(pct(p.piePct ?? 20))}</span>
            <select aria-label="Pie" className={selectInvisible} value={p.piePct ?? 20} onChange={(e) => { const v = Number(e.target.value); void cambiar({ piePct: v }, { piePct: v }); }}>
              {pies.map((x) => <option key={x} value={x}>{CASA.perfil.pie(pct(x))}</option>)}
            </select>
          </label>
          <label className={chip} data-chip="plazo" {...chipOcupado(guardando === "plazoAnios")}>
            <span aria-hidden="true">{CASA.perfil.plazo(p.plazoAnios ?? 30)}</span>
            <select aria-label="Plazo" className={selectInvisible} value={p.plazoAnios ?? 30} onChange={(e) => { const v = Number(e.target.value); void cambiar({ plazoAnios: v }, { plazoAnios: v }); }}>
              {plazos.map((x) => <option key={x} value={x}>{CASA.perfil.plazo(x)}</option>)}
            </select>
          </label>
        </div>

        {preguntar ? (
          <div data-casa="horizonte">
            <p className="mb-1.5 mt-3 text-[12.5px] text-[var(--franco-text-secondary)]">{CASA.perfil.cuando}</p>
            <div className="flex flex-wrap gap-1.5">
              {(["ya", "meses", "mirando"] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={p.horizonte === h}
                  {...botonOcupado(guardando === "horizonte" && p.horizonte === h)}
                  onClick={() => { setCambiandoHorizonte(false); void cambiar({ horizonte: h }, { horizonte: h }); }}
                  className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[14px] font-medium ${p.horizonte === h ? "border-[var(--franco-text)] bg-[var(--franco-text)] text-[var(--franco-card)]" : "border-[var(--franco-border)] text-[var(--franco-text)]"}`}
                >
                  {CASA.perfil.horizonte[h]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-[var(--franco-text-secondary)]" data-casa="horizonte-respondido">
            {CASA.perfil.respondido[p.horizonte as Horizonte]} ·{" "}
            <button type="button" className="underline underline-offset-4" onClick={() => setCambiandoHorizonte(true)}>{CASA.perfil.cambiar}</button>
            <br />
            <span data-casa="horizonte-que-cambia">{CASA.perfil.queCambia[p.horizonte as Horizonte]}</span>
          </p>
        )}
        {error && <p role="alert" className="mt-2 text-[13px] text-[var(--signal-red)]">{CASA.perfil.error}</p>}
      </div>
    </div>
  );
}
