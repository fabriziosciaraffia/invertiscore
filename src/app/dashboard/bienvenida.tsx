"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El dashboard vacío (29-sep-2026; corto desde el 01-oct-2026): la bienvenida de quien no tiene
// informes —lo primero que ve quien entra por /registro— y el estado vacío de quien ya pasó el
// onboarding. Queda lo esencial: el saludo, «Esto es lo que Franco hace por ti.», los dos bloques y el
// botón al primer análisis. Sistema nuevo: Inter, sin mono, el wordmark del sitio (FrancoLogo), los
// chips de la tríada como en el informe. El único rojo es el botón y el «.ai» del wordmark.
// Si la persona tiene perfil, sus chips (editables, mismo POST que «Estás dentro») van en una línea
// dentro del segundo bloque. `demo` no escribe.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useRouter } from "next/navigation";
import FrancoLogo from "@/components/franco-logo";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { TIPOLOGIAS_CHIP, type PerfilChips } from "@/lib/lo-que-sigue/perfil-chips";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { ESTAS_DENTRO } from "@/lib/lo-que-sigue/copy";
import { BIENVENIDA } from "./bienvenida-copy";

const UI = "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif";

export interface PerfilBienvenida {
  analysisId: string;
  chips: PerfilChips;
}

export function Bienvenida({
  nombre,
  gratis,
  perfil,
  onboarding,
  demo = false,
}: {
  /** El nombre REAL (nombreReal en lib/welcome): sin él, «Hola.». */
  nombre: string | null;
  gratis: boolean;
  perfil: PerfilBienvenida | null;
  /** Quien todavía no pasó el onboarding: al tocar el botón se marca completo. */
  onboarding: boolean;
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
              {i === 1 && perfil && <ChipsPerfil perfil={perfil} demo={demo} />}
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center">
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
        </div>
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

/** Los chips del perfil, editables, en UNA línea dentro del bloque de oportunidades. */
function ChipsPerfil({ perfil, demo }: { perfil: PerfilBienvenida; demo: boolean }) {
  const [pref, setPref] = useState<PerfilChips>(perfil.chips);
  const [error, setError] = useState(false);

  async function cambiar(campo: "tipologia" | "comuna" | "modalidad", valor: string) {
    setPref((p) => ({ ...p, [campo]: valor } as PerfilChips));
    if (demo) return;
    setError(!(await guardar(perfil.analysisId, { [campo]: valor })));
  }

  const comunas = pref.comuna && !(COMUNAS_DISPONIBLES as readonly string[]).includes(pref.comuna) ? [pref.comuna, ...COMUNAS_DISPONIBLES] : [...COMUNAS_DISPONIBLES];
  const tipologias = pref.tipologia && !(TIPOLOGIAS_CHIP as readonly string[]).includes(pref.tipologia) ? [pref.tipologia, ...TIPOLOGIAS_CHIP] : [...TIPOLOGIAS_CHIP];
  // El chip mide lo que su valor: el texto se ve y el <select> va encima, invisible (un <select> nativo
  // mide lo que su opción más larga —«Estación Central»— y a 390 px los tres no cabían en una línea).
  const chip = "relative inline-flex h-8 shrink-0 items-center rounded-full border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[14px] font-semibold text-[var(--franco-text)] focus-within:border-[var(--franco-text)]";
  const select = "absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0";

  return (
    <div className="mt-3" data-bienvenida="perfil">
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        <label className={chip}>
          <span aria-hidden="true">{pref.tipologia || "Tipología"}</span>
          <select aria-label="Tipología" className={select} value={pref.tipologia ?? ""} onChange={(e) => cambiar("tipologia", e.target.value)}>
            {!pref.tipologia && <option value="">Tipología</option>}
            {tipologias.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className={chip}>
          <span aria-hidden="true">{pref.comuna || "Comuna"}</span>
          <select aria-label="Comuna" className={select} value={pref.comuna ?? ""} onChange={(e) => cambiar("comuna", e.target.value)}>
            {!pref.comuna && <option value="">Comuna</option>}
            {comunas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className={chip}>
          <span aria-hidden="true">{ESTAS_DENTRO.modalidad[pref.modalidad]}</span>
          <select aria-label="Modalidad" className={select} value={pref.modalidad} onChange={(e) => cambiar("modalidad", e.target.value)}>
            <option value="ltr">{ESTAS_DENTRO.modalidad.ltr}</option>
            <option value="str">{ESTAS_DENTRO.modalidad.str}</option>
          </select>
        </label>
      </div>
      {error && <p className="mt-2 text-[13px] text-[var(--franco-text)]" role="alert">{BIENVENIDA.errorGuardar}</p>}
    </div>
  );
}
