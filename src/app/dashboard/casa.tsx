"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La casa (02-oct-2026): el saldo arriba y «Tu perfil de búsqueda» editable. El perfil se alimenta de
// todos los informes (lib/perfil-busqueda.ts); lo que se toca acá queda en `perfil_busqueda` y manda
// sobre lo inferido. Sistema nuevo: Inter, sin mono, Source Serif en los títulos. El único rojo es el
// botón de comprar del saldo vacío. Copy en casa-copy.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { ESTAS_DENTRO } from "@/lib/lo-que-sigue/copy";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { Horizonte, Modalidad } from "@/lib/perfil-busqueda";
import { textoVence } from "@/lib/guia/semanal";
import { CASA } from "./casa-copy";

const UI = "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif";
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export const RUTA_SUELTO = "/checkout?product=single";
export const RUTA_NUEVO = "/analisis/nuevo-v4";

const tarjeta = "rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)]";
const botonLleno = "inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-5 text-[14px] font-semibold text-white";
const botonBorde = "inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full border-[1.5px] border-[var(--franco-text)] px-5 text-[14px] font-semibold text-[var(--franco-text)]";

export function SaldoCasa({ estado, informes }: { estado: EstadoSaldo; informes: number }) {
  const n = estado.tipo === "con" ? estado.n : estado.tipo === "regalo" ? 1 : estado.tipo === "sin" ? 0 : null;
  const titulo =
    estado.tipo === "sin" ? CASA.sin.titulo(informes)
    : estado.tipo === "regalo" ? CASA.regalo.titulo
    : estado.tipo === "con" ? CASA.con.titulo(estado.n)
    : CASA.plan.titulo;
  const bajada =
    estado.tipo === "sin" ? CASA.sin.bajada
    : estado.tipo === "con" && estado.noVencen ? CASA.con.noVencen
    : estado.tipo === "plan" ? CASA.plan.bajada
    : estado.tipo === "regalo" && estado.vence ? textoVence(estado.vence)
    : null;

  return (
    <div className={`${tarjeta} flex flex-col items-stretch gap-3.5 p-4 sm:flex-row sm:items-center sm:justify-between`} data-casa="saldo" data-saldo={estado.tipo} style={{ fontFamily: UI }}>
      <div className="flex min-w-0 items-center gap-3.5">
        {n != null && estado.tipo !== "regalo" && (
          <span className="text-[34px] font-bold leading-none tracking-[-0.02em] tabular-nums">{n}</span>
        )}
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug">{titulo}</p>
          {bajada && <p className="mt-0.5 text-[13px] text-[var(--franco-text-secondary)]">{bajada}</p>}
        </div>
      </div>
      {estado.tipo === "sin" ? (
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <EnlaceCarga href={RUTA_SUELTO} className={botonLleno} style={{ background: "var(--signal-red)" }} data-casa="comprar-suelto">
            {CASA.sin.boton}
          </EnlaceCarga>
          <EnlaceCarga href="/pricing" className="text-center text-[13px] text-[var(--franco-text-secondary)] underline underline-offset-4" data-casa="planes">
            {CASA.sin.planes}
          </EnlaceCarga>
        </div>
      ) : (
        <EnlaceCarga href={RUTA_NUEVO} className={botonBorde} data-casa="analizar-otro">
          {estado.tipo === "regalo" ? CASA.regalo.boton : estado.tipo === "con" ? CASA.con.boton : CASA.plan.boton}
        </EnlaceCarga>
      )}
    </div>
  );
}

export interface PerfilEditable {
  dormitorios: number[];
  comunas: string[];
  precioMaxUf: number | null;
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

const chip = "relative inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[14px] font-semibold text-[var(--franco-text)] focus-within:border-[var(--franco-text)]";
const chipMas = "relative inline-flex min-h-[34px] shrink-0 items-center rounded-full border border-dashed border-[var(--franco-border)] px-3 text-[14px] font-medium text-[var(--franco-text-secondary)] focus-within:border-[var(--franco-text)]";
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

  return (
    <div style={{ fontFamily: UI }} data-casa="perfil">
      <h2 className="font-heading text-[21px] font-bold leading-[1.15] tracking-[-0.01em] sm:text-[24px]">{CASA.perfil.titulo}</h2>
      <p className="mb-3 mt-1.5 max-w-[640px] text-[14.5px] text-[var(--franco-text-secondary)]">{comprador ? CASA.perfil.bajadaComprador : CASA.perfil.bajada}</p>
      <div className={`${tarjeta} p-4`}>
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
          <label className={chip} data-chip="tope">
            <span aria-hidden="true">{p.precioMaxUf != null ? CASA.perfil.tope(miles(p.precioMaxUf)) : CASA.perfil.sinTope}</span>
            <select aria-label={CASA.perfil.sinTope} className={selectInvisible} value={p.precioMaxUf ?? ""} onChange={(e) => { const v = Number(e.target.value); void cambiar({ precioMaxUf: v }, { precioMaxUf: v }); }}>
              {p.precioMaxUf == null && <option value="">{CASA.perfil.sinTope}</option>}
              {topes.map((t) => <option key={t} value={t}>{CASA.perfil.tope(miles(t))}</option>)}
            </select>
          </label>
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
            <p className="mb-1.5 mt-3.5 text-[12.5px] text-[var(--franco-text-secondary)]">{CASA.perfil.cuando}</p>
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
          <p className="mt-3.5 border-t border-[var(--franco-border)] pt-3 text-[13px] text-[var(--franco-text-secondary)]" data-casa="horizonte-respondido">
            {CASA.perfil.respondido[p.horizonte as Horizonte]} ·{" "}
            <button type="button" className="underline underline-offset-4" onClick={() => setCambiandoHorizonte(true)}>{CASA.perfil.cambiar}</button>
          </p>
        )}
        {error && <p role="alert" className="mt-2 text-[13px] text-[var(--signal-red)]">{CASA.perfil.error}</p>}
      </div>
    </div>
  );
}
