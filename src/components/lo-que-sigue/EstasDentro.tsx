"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «Estás dentro» (30-sep-2026): lo que queda en el lugar del banner después del código. Los chips del
// perfil —tipología, comuna, modalidad— se pueden tocar para cambiarlos; «¿Cuándo piensas comprar?»
// es opcional. Las dos cosas se guardan en el perfil del análisis (`perfiles_inversion`, columnas
// `pref_*` y `horizonte_compra`) por POST /api/lo-que-sigue/perfil, con la sesión recién creada.
// Nada más se pregunta. `demo` no escribe (la demo de «Lo que sigue» corre sin cuenta).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { ESTAS_DENTRO, notaChips, notaCuando, type HorizonteCompra } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import { TIPOLOGIAS_CHIP, type PerfilChips } from "@/lib/lo-que-sigue/perfil-chips";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";

type Campo = "tipologia" | "comuna" | "modalidad";

async function guardar(analysisId: string, cambios: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch("/api/lo-que-sigue/perfil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId, ...cambios }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function EstasDentro({ ctx, perfil, demo = false, horizonteInicial = null }: {
  ctx: ContextoLqs;
  perfil: PerfilChips;
  demo?: boolean;
  /** Si ya se sabe (la demo y el tier lo usan para dibujar el estado elegido). */
  horizonteInicial?: HorizonteCompra | null;
}) {
  const posthog = usePostHog();
  const [pref, setPref] = useState<PerfilChips>(perfil);
  const [horizonte, setHorizonte] = useState<HorizonteCompra | null>(horizonteInicial);
  // Tocados los chips, junto a ellos dice «Anotado · toca para cambiar» (08-oct-2026, segunda pasada).
  const [chipsCambiados, setChipsCambiados] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    capturarLqs(posthog, EVENTOS_LQS.dentroVisto, ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.analysisId]);

  async function cambiar(campo: Campo, valor: string) {
    const siguiente = { ...pref, [campo]: valor } as PerfilChips;
    setPref(siguiente);
    setChipsCambiados(true);
    capturarLqs(posthog, EVENTOS_LQS.preferenciaEditada, ctx, { campo, valor });
    if (demo) return;
    const ok = await guardar(ctx.analysisId, { [campo]: valor });
    setError(!ok);
  }

  async function elegir(h: HorizonteCompra) {
    setHorizonte(h);
    capturarLqs(posthog, EVENTOS_LQS.horizonteElegido, ctx, { horizonte: h });
    if (demo) return;
    const ok = await guardar(ctx.analysisId, { horizonte: h });
    setError(!ok);
  }

  const comunas = pref.comuna && !(COMUNAS_DISPONIBLES as readonly string[]).includes(pref.comuna) ? [pref.comuna, ...COMUNAS_DISPONIBLES] : [...COMUNAS_DISPONIBLES];
  const tipologias = pref.tipologia && !(TIPOLOGIAS_CHIP as readonly string[]).includes(pref.tipologia) ? [pref.tipologia, ...TIPOLOGIAS_CHIP] : [...TIPOLOGIAS_CHIP];

  const nota = notaCuando(horizonte);

  // Compacto (08-oct-2026, segunda pasada): título de una línea, los chips y la pregunta juntos, y lo
  // elegido se ve elegido —relleno y visto— con «Anotado · toca para cambiar» al lado.
  return (
    <div className="lqs-dentro" data-lqs="dentro">
      <h3 className="lqs-h3 lqs-h3-dentro">{ESTAS_DENTRO.titular}</h3>
      <p className="lqs-cuerpo lqs-gris">{ESTAS_DENTRO.cuerpo}</p>
      <div className="lqs-parati" data-lqs="chips-editables">
        <label className="lqs-chip lqs-chip-edit">
          <select aria-label="Tipología" value={pref.tipologia ?? ""} onChange={(e) => cambiar("tipologia", e.target.value)}>
            {!pref.tipologia && <option value="">Tipología</option>}
            {tipologias.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="lqs-chip lqs-chip-edit">
          <select aria-label="Comuna" value={pref.comuna ?? ""} onChange={(e) => cambiar("comuna", e.target.value)}>
            {!pref.comuna && <option value="">Comuna</option>}
            {comunas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="lqs-chip lqs-chip-edit">
          <select aria-label="Modalidad" value={pref.modalidad} onChange={(e) => cambiar("modalidad", e.target.value)}>
            <option value="ltr">{ESTAS_DENTRO.modalidad.ltr}</option>
            <option value="str">{ESTAS_DENTRO.modalidad.str}</option>
          </select>
        </label>
        <span className={chipsCambiados ? "lqs-toca lqs-anotado" : "lqs-toca"}>{notaChips(chipsCambiados)}</span>
      </div>
      <div className="lqs-cuando-fila">
        <p className="lqs-cuando-t">{ESTAS_DENTRO.cuando}</p>
        <div className="lqs-cuando" role="radiogroup" aria-label={ESTAS_DENTRO.cuando}>
          {ESTAS_DENTRO.horizontes.map((h) => (
            <button
              key={h.id}
              type="button"
              role="radio"
              aria-checked={horizonte === h.id}
              className="lqs-opcion"
              data-activa={horizonte === h.id ? "1" : "0"}
              onClick={() => elegir(h.id)}
            >
              {horizonte === h.id && <span className="lqs-visto" aria-hidden="true">✓</span>}
              {h.texto}
            </button>
          ))}
        </div>
        {nota && <span className="lqs-toca lqs-anotado" role="status">{nota}</span>}
      </div>
      <p className="lqs-legal lqs-aprende">{ESTAS_DENTRO.aprende}</p>
      {error && <p className="lqs-legal" role="alert">{ESTAS_DENTRO.errorGuardar}</p>}
    </div>
  );
}
