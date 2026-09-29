"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El dashboard vacío (29-sep-2026): la bienvenida de quien no tiene informes —lo primero que ve quien
// entra por /registro— y el estado vacío de quien ya pasó el onboarding. Sistema nuevo: Inter, sin
// mono, el wordmark del sitio (FrancoLogo), los números de los pasos en tinta, los chips de la tríada
// como en el informe. El único rojo es el botón (la acción principal) y el «.ai» del wordmark.
// Si la persona tiene perfil, «Franco busca para ti:» con sus chips editables (mismo POST que
// «Estás dentro»); si no, se dice que se arma con el primer análisis. `demo` no escribe.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useRouter } from "next/navigation";
import FrancoLogo from "@/components/franco-logo";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { PRICING_PLANS, SINGLE_PRICE, productKeyFor, fmtCLP } from "@/lib/pricing";
import { TIPOLOGIAS_CHIP, type PerfilChips } from "@/lib/lo-que-sigue/perfil-chips";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { ESTAS_DENTRO } from "@/lib/lo-que-sigue/copy";
import { BIENVENIDA } from "./bienvenida-copy";

const UI = "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif";

const PLANES = PRICING_PLANS.filter((p) => ["plan10", "plan50", "unlimited"].includes(p.id)).map((p) => ({
  id: p.id,
  label: p.label,
  precio: p.monthly ? `${fmtCLP(p.monthly)}/mes` : "",
  // La etiqueta ya dice la cantidad («10 análisis / mes»); abajo va para quién es (pricing.ts).
  blurb: p.title,
  href: `/checkout?product=${productKeyFor(p.id, "monthly")}`,
}));
const PRECIO_UNITARIO = fmtCLP(SINGLE_PRICE);

export interface PerfilBienvenida {
  analysisId: string;
  chips: PerfilChips;
}

export function Bienvenida({
  nombre,
  gratis,
  perfil,
  onboarding,
  conPlanes = true,
  demo = false,
}: {
  nombre: string | null;
  gratis: boolean;
  perfil: PerfilBienvenida | null;
  /** Quien todavía no pasó el onboarding: al tocar un botón se marca completo. */
  onboarding: boolean;
  conPlanes?: boolean;
  demo?: boolean;
}) {
  const router = useRouter();
  const [yendo, setYendo] = useState(false);

  async function ir(href: string) {
    if (yendo) return;
    setYendo(true);
    if (onboarding && !demo) {
      try {
        await fetch("/api/user/complete-onboarding", { method: "POST" });
      } catch {
        /* no bloquea la navegación */
      }
    }
    router.push(href);
  }

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]" style={{ fontFamily: UI }} data-bienvenida="1">
      <div className="mx-auto max-w-[620px] px-5 py-12 sm:py-16">
        <div className="flex justify-center">
          <FrancoLogo size="lg" />
        </div>

        <p className="mt-8 text-[15px] text-[var(--franco-text-secondary)]">{BIENVENIDA.saludo(nombre)}</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold leading-[1.2] sm:text-[32px]">{BIENVENIDA.titular}</h1>

        <div className="mt-7 flex flex-col gap-6">
          {BIENVENIDA.hace.map((h, i) => (
            <div key={h.titulo}>
              <p className="text-[16px] font-semibold">{h.titulo}</p>
              <p className="mt-1 text-[15px] leading-[1.55] text-[var(--franco-text-secondary)]">{h.texto}</p>
              {i === 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2" data-bienvenida="triada">
                  <ChipVeredicto v="COMPRAR" />
                  <ChipVeredicto v="AJUSTA SUPUESTOS" />
                  <ChipVeredicto v="BUSCAR OTRA" />
                </div>
              )}
            </div>
          ))}
        </div>

        <BuscaParaTi perfil={perfil} demo={demo} />

        <div className="mt-10 border-t border-[var(--franco-border)] pt-8">
          <p className="text-[14px] font-semibold text-[var(--franco-text-secondary)]">{BIENVENIDA.pasosTitulo}</p>
          <ol className="mt-4 flex flex-col gap-4" data-bienvenida="pasos">
            {BIENVENIDA.pasos.map((p, i) => (
              <li key={p.titulo} className="flex gap-4">
                <span className="w-5 shrink-0 font-heading text-[20px] font-bold leading-[1.2] text-[var(--franco-text)]" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{p.titulo}</p>
                  <p className="mt-0.5 text-[14px] leading-[1.5] text-[var(--franco-text-secondary)]">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => ir("/analisis/nuevo-v4")}
            disabled={yendo}
            data-bienvenida="accion"
            className="w-full max-w-[420px] rounded-[10px] px-9 py-4 text-[16px] font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--signal-red)", fontFamily: UI }}
          >
            {yendo ? BIENVENIDA.cargando : BIENVENIDA.boton(gratis)}
          </button>
          <p className="text-[13px] text-[var(--franco-text-secondary)]">{BIENVENIDA.bajoBoton(gratis, PRECIO_UNITARIO)}</p>
          <EnlaceCarga href="/demo" className="text-[14px] text-[var(--franco-text)] underline underline-offset-4">
            {BIENVENIDA.ejemplo}
          </EnlaceCarga>
        </div>

        {conPlanes && (
          <div className="mt-12 border-t border-[var(--franco-border)] pt-8">
            <p className="text-center text-[15px] font-semibold">{BIENVENIDA.planesTitulo}</p>
            <p className="mx-auto mt-1 max-w-[440px] text-center text-[14px] leading-[1.5] text-[var(--franco-text-secondary)]">{BIENVENIDA.planesTexto(gratis)}</p>
            <div className="mt-5 flex flex-col gap-[10px]">
              {PLANES.map((plan) => (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => ir(plan.href)}
                  disabled={yendo}
                  className="flex items-center justify-between gap-4 rounded-[10px] border border-[var(--franco-border)] bg-[var(--franco-card)] px-4 py-3.5 text-left transition-colors hover:border-[var(--franco-border-hover)] disabled:opacity-60"
                  style={{ fontFamily: UI }}
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold">{plan.label}</div>
                    <div className="mt-0.5 text-[13px] text-[var(--franco-text-secondary)]">{plan.blurb}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-heading text-[16px] font-bold">{plan.precio}</div>
                    <div className="mt-0.5 text-[13px] text-[var(--franco-text)] underline underline-offset-4">{BIENVENIDA.verPlan}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => ir("/pricing")} disabled={yendo} className="text-[14px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] disabled:opacity-60" style={{ fontFamily: UI }}>
                {BIENVENIDA.todosLosPlanes}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

async function guardar(analysisId: string, cambios: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch("/api/lo-que-sigue/perfil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId, ...cambios }) });
    return res.ok;
  } catch {
    return false;
  }
}

/** «Franco busca para ti:» con los chips editables, o la frase de que se arma con el primer análisis. */
function BuscaParaTi({ perfil, demo }: { perfil: PerfilBienvenida | null; demo: boolean }) {
  const [pref, setPref] = useState<PerfilChips | null>(perfil?.chips ?? null);
  const [error, setError] = useState(false);

  if (!perfil || !pref) {
    return (
      <p className="mt-8 rounded-[12px] border border-[var(--franco-border)] bg-[var(--franco-card)] px-4 py-3.5 text-[14px] leading-[1.55] text-[var(--franco-text-secondary)]" data-bienvenida="sin-perfil">
        {BIENVENIDA.sinPerfil}
      </p>
    );
  }

  async function cambiar(campo: "tipologia" | "comuna" | "modalidad", valor: string) {
    setPref((p) => (p ? ({ ...p, [campo]: valor } as PerfilChips) : p));
    if (demo || !perfil) return;
    setError(!(await guardar(perfil.analysisId, { [campo]: valor })));
  }

  const comunas = pref.comuna && !(COMUNAS_DISPONIBLES as readonly string[]).includes(pref.comuna) ? [pref.comuna, ...COMUNAS_DISPONIBLES] : [...COMUNAS_DISPONIBLES];
  const tipologias = pref.tipologia && !(TIPOLOGIAS_CHIP as readonly string[]).includes(pref.tipologia) ? [pref.tipologia, ...TIPOLOGIAS_CHIP] : [...TIPOLOGIAS_CHIP];
  const chip = "inline-flex h-8 items-center rounded-full border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[14px] font-semibold text-[var(--franco-text)]";
  const select = "cursor-pointer appearance-none bg-transparent pr-1 outline-none";

  return (
    <div className="mt-8" data-bienvenida="busca-para-ti">
      <p className="text-[15px] font-semibold">{BIENVENIDA.buscaParaTi}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className={chip}>
          <select aria-label="Tipología" className={select} value={pref.tipologia ?? ""} onChange={(e) => cambiar("tipologia", e.target.value)}>
            {!pref.tipologia && <option value="">Tipología</option>}
            {tipologias.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className={chip}>
          <select aria-label="Comuna" className={select} value={pref.comuna ?? ""} onChange={(e) => cambiar("comuna", e.target.value)}>
            {!pref.comuna && <option value="">Comuna</option>}
            {comunas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className={chip}>
          <select aria-label="Modalidad" className={select} value={pref.modalidad} onChange={(e) => cambiar("modalidad", e.target.value)}>
            <option value="ltr">{ESTAS_DENTRO.modalidad.ltr}</option>
            <option value="str">{ESTAS_DENTRO.modalidad.str}</option>
          </select>
        </label>
        <span className="text-[13px] text-[var(--franco-text-secondary)]">{BIENVENIDA.tocaCambiar}</span>
      </div>
      {error && <p className="mt-2 text-[13px] text-[var(--franco-text)]" role="alert">{BIENVENIDA.errorGuardar}</p>}
    </div>
  );
}
