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
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { CASA_ARRIBA, type BloqueArriba } from "@/lib/casa-arriba";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { ESTAS_DENTRO } from "@/lib/lo-que-sigue/copy";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { Horizonte, Modalidad } from "@/lib/perfil-busqueda";
import { ajusteDeParametro, SEMANAL_VACIO, textoVence } from "@/lib/guia/semanal";
import { CASA } from "./casa-copy";
import { rutaTres } from "@/lib/tres-analisis";
import { SELECCION_CASA } from "@/lib/guia/seleccion-casa";
import { RANGOS_UF } from "@/lib/deptos/respuesta";

const UI = "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif";
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export const RUTA_SUELTO = "/checkout?product=single";
/** Sin análisis, el dashboard ofrece el pack de tres (13-oct-2026) y vuelve al dashboard después de pagar. */
export const RUTA_TRES_CASA = rutaTres("dashboard", { volver: "/dashboard" });
export const RUTA_NUEVO = "/analisis/nuevo-v4";


/**
 * EL BLOQUE DE ARRIBA (17-oct-2026, decisión de Fabrizio): lo más importante según el estado, en banner —el material del
 * banner del informe, texto en papel, UN botón en papel—. Qué bloque, lo decide casa-arriba.ts › bloqueDeArriba.
 */
export function BloqueArribaCasa({ bloque, informes }: { bloque: BloqueArriba; informes: number }) {
  if (bloque.tipo === "seleccion") {
    return (
      <section className="ca-banda" data-casa="arriba" data-arriba="seleccion">
        <h1 className="ca-banda-t">{SELECCION_CASA.titulo}</h1>
        <p className="ca-banda-s">{CASA_ARRIBA.seleccionBajada}</p>
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
        <p className="ca-banda-s">{informes === 0 ? CASA.sin.bajadaPrimero : CASA.sin.bajada}</p>
        <div className="ca-banda-fila">
          <EnlaceCarga href={RUTA_TRES_CASA} className="ca-banda-btn" data-casa="comprar-tres">
            {CASA.sin.boton}
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
export function SaldoPlano({ estado, arriba }: { estado: EstadoSaldo; arriba: BloqueArriba["tipo"] }) {
  if (estado.tipo === "regalo" && arriba === "regalo") return null;
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
        {estado.tipo === "sin" && (
          <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {arriba !== "pack" && (
              <EnlaceCarga href={RUTA_TRES_CASA} className={enlace} data-casa="comprar-tres-plano">{CASA.sin.boton}</EnlaceCarga>
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

const TOPES = [1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000, 10000, 12000, 15000];
const PIES = [10, 15, 20, 25, 30, 40, 50];
const PLAZOS = [15, 20, 25, 30];
const DORMS = [0, 1, 2, 3, 4];

async function guardar(cambios: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambios) });
    return res.ok;
  } catch {
    return false;
  }
}

const chip = "ca-chip relative inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold text-[var(--franco-text)]";
const chipMas = "relative inline-flex min-h-[32px] shrink-0 items-center rounded-full border border-dashed border-[var(--franco-border)] px-3 text-[13.5px] font-medium text-[var(--franco-text-secondary)] focus-within:border-[var(--franco-text)]";
const selectInvisible = "absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0";

export function PerfilBusquedaCasa({ inicial, comprador }: { inicial: PerfilEditable; comprador: boolean }) {
  const [p, setP] = useState<PerfilEditable>(inicial);
  const [error, setError] = useState(false);
  const [cambiandoHorizonte, setCambiandoHorizonte] = useState(false);

  async function cambiar(parche: Partial<PerfilEditable>, cuerpo: Record<string, unknown>) {
    setP((x) => ({ ...x, ...parche }));
    setError(!(await guardar(cuerpo)));
  }

  const quitarComuna = (c: string) => {
    const resto = p.comunas.filter((x) => x !== c);
    if (resto.length === 0) return;
    void cambiar({ comunas: resto }, { comunas: resto });
  };
  const sumarComuna = (c: string) => {
    if (!c || p.comunas.includes(c)) return;
    const todas = [...p.comunas, c];
    void cambiar({ comunas: todas }, { comunas: todas });
  };
  const quitarDorm = (d: number) => {
    const resto = p.dormitorios.filter((x) => x !== d);
    if (resto.length === 0) return;
    void cambiar({ dormitorios: resto }, { dormitorios: resto });
  };
  const sumarDorm = (d: number) => {
    if (p.dormitorios.includes(d)) return;
    const todos = [...p.dormitorios, d].sort((a, b) => a - b);
    void cambiar({ dormitorios: todos }, { dormitorios: todos });
  };

  const topes = p.precioMaxUf != null && !TOPES.includes(p.precioMaxUf) ? [...TOPES, p.precioMaxUf].sort((a, b) => a - b) : TOPES;
  const pies = p.piePct != null && !PIES.includes(p.piePct) ? [...PIES, p.piePct].sort((a, b) => a - b) : PIES;
  const plazos = p.plazoAnios != null && !PLAZOS.includes(p.plazoAnios) ? [...PLAZOS, p.plazoAnios].sort((a, b) => a - b) : PLAZOS;
  const comunasLibres = (COMUNAS_DISPONIBLES as readonly string[]).filter((c) => !p.comunas.includes(c));
  const dormsLibres = DORMS.filter((d) => !p.dormitorios.includes(d));
  const preguntar = p.horizonte == null || cambiandoHorizonte;
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
        <div className="flex flex-wrap gap-1.5">
          {p.dormitorios.map((d) => (
            <button key={`d${d}`} type="button" className={chip} onClick={() => quitarDorm(d)} aria-label={`${CASA.perfil.quitar} ${CASA.perfil.dormitorios(d)}`} disabled={p.dormitorios.length === 1} data-chip="dormitorios">
              {CASA.perfil.dormitorios(d)}{p.dormitorios.length > 1 && <span aria-hidden="true" className="text-[12px] text-[var(--franco-text-secondary)]">×</span>}
            </button>
          ))}
          {dormsLibres.length > 0 && (
            <label className={chipMas}>
              <span aria-hidden="true">{CASA.perfil.masDormitorio}</span>
              <select aria-label={CASA.perfil.masDormitorio} className={selectInvisible} value="" onChange={(e) => sumarDorm(Number(e.target.value))}>
                <option value="" />
                {dormsLibres.map((d) => <option key={d} value={d}>{CASA.perfil.dormitorios(d)}</option>)}
              </select>
            </label>
          )}
          {p.comunas.map((c) => (
            <button key={c} type="button" className={chip} onClick={() => quitarComuna(c)} aria-label={`${CASA.perfil.quitar} ${c}`} disabled={p.comunas.length === 1} data-chip="comuna">
              {c}{p.comunas.length > 1 && <span aria-hidden="true" className="text-[12px] text-[var(--franco-text-secondary)]">×</span>}
            </button>
          ))}
          <label className={chipMas}>
            <span aria-hidden="true">{CASA.perfil.masComuna}</span>
            <select aria-label={CASA.perfil.masComuna} className={selectInvisible} value="" onChange={(e) => sumarComuna(e.target.value)}>
              <option value="" />
              {comunasLibres.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {p.precioMinUf != null && p.precioMaxUf != null ? (
            // El rango de /deptos (16-oct-2026): se cambia por otro rango, con su piso y su tope.
            <label className={chip} data-chip="rango">
              <span aria-hidden="true">{CASA.perfil.rango(miles(p.precioMinUf), miles(p.precioMaxUf))}</span>
              <select aria-label={CASA.perfil.sinTope} className={selectInvisible} value={RANGOS_UF.find((r) => r.min === p.precioMinUf && r.max === p.precioMaxUf)?.id ?? ""} onChange={(e) => {
                const r = RANGOS_UF.find((x) => x.id === e.target.value);
                if (r) void cambiar({ precioMinUf: r.min, precioMaxUf: r.max }, { precioMinUf: r.min, precioMaxUf: r.max });
              }}>
                {!RANGOS_UF.some((r) => r.min === p.precioMinUf && r.max === p.precioMaxUf) && <option value="">{CASA.perfil.rango(miles(p.precioMinUf), miles(p.precioMaxUf))}</option>}
                {RANGOS_UF.map((r) => <option key={r.id} value={r.id}>{r.chip}</option>)}
              </select>
            </label>
          ) : (
            <label className={chip} data-chip="tope">
              <span aria-hidden="true">{p.precioMaxUf != null ? CASA.perfil.tope(miles(p.precioMaxUf)) : CASA.perfil.sinTope}</span>
              <select aria-label={CASA.perfil.sinTope} className={selectInvisible} value={p.precioMaxUf ?? ""} onChange={(e) => { const v = Number(e.target.value); void cambiar({ precioMaxUf: v }, { precioMaxUf: v }); }}>
                {p.precioMaxUf == null && <option value="">{CASA.perfil.sinTope}</option>}
                {topes.map((t) => <option key={t} value={t}>{CASA.perfil.tope(miles(t))}</option>)}
              </select>
            </label>
          )}
          <label className={chip} data-chip="modalidad">
            <span aria-hidden="true">{ESTAS_DENTRO.modalidad[p.modalidad]}</span>
            <select aria-label="Modalidad" className={selectInvisible} value={p.modalidad} onChange={(e) => { const v = e.target.value as Modalidad; void cambiar({ modalidad: v }, { modalidad: v }); }}>
              <option value="ltr">{ESTAS_DENTRO.modalidad.ltr}</option>
              <option value="str">{ESTAS_DENTRO.modalidad.str}</option>
            </select>
          </label>
          <label className={chip} data-chip="pie">
            <span aria-hidden="true">{CASA.perfil.pie(pct(p.piePct ?? 20))}</span>
            <select aria-label="Pie" className={selectInvisible} value={p.piePct ?? 20} onChange={(e) => { const v = Number(e.target.value); void cambiar({ piePct: v }, { piePct: v }); }}>
              {pies.map((x) => <option key={x} value={x}>{CASA.perfil.pie(pct(x))}</option>)}
            </select>
          </label>
          <label className={chip} data-chip="plazo">
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
          </p>
        )}
        {error && <p role="alert" className="mt-2 text-[13px] text-[var(--signal-red)]">{CASA.perfil.error}</p>}
      </div>
    </div>
  );
}
