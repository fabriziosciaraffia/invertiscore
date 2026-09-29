"use client";

// La vista de /comparar: el selector (dos o más) y la tabla lado a lado. Montos en pesos de hoy;
// el botón CLP/UF muestra lo mismo en las dos unidades.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import { COMPARAR } from "@/lib/lo-que-sigue/copy";
import { EVENTOS_LQS } from "@/lib/lo-que-sigue/eventos";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { COMPARAR_MAX, COMPARAR_MIN, type ColumnaComparar, type OpcionComparar } from "@/lib/lo-que-sigue/comparar";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export function CompararVista({ opciones, columnas, seleccion }: { opciones: OpcionComparar[]; columnas: ColumnaComparar[]; seleccion: string[] }) {
  const router = useRouter();
  const posthog = usePostHog();
  const [elegidos, setElegidos] = useState<string[]>(seleccion);
  const [moneda, setMoneda] = useState<"CLP" | "UF">("CLP");

  useEffect(() => {
    if (columnas.length >= COMPARAR_MIN) {
      try {
        posthog?.capture(EVENTOS_LQS.compararVisto, { oferta: "lo_que_sigue", n: columnas.length, modalidades: Array.from(new Set(columnas.map((c) => c.modalidad))).join(",") });
      } catch {
        /* la medición no rompe la vista */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnas.map((c) => c.id).join(",")]);

  const plata = (clp: number | null, uf: number) => {
    if (clp == null) return "—";
    return moneda === "UF" ? `UF ${miles(clp / (uf || 1))}` : `${clp < 0 ? "−" : ""}$${miles(Math.abs(clp))}`;
  };
  const precio = (c: ColumnaComparar) => (c.precioUF == null ? "—" : moneda === "UF" ? `UF ${miles(c.precioUF)}` : `$${miles(c.precioUF * c.uf)}`);

  const alternar = (id: string) =>
    setElegidos((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length >= COMPARAR_MAX ? xs : [...xs, id]));

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 sm:px-6" data-lqs="comparar">
      <h1 className="font-heading text-[24px] font-bold text-[var(--franco-text)]">{COMPARAR.titulo}</h1>
      <p className="mt-1 font-body text-sm text-[var(--franco-text-secondary)]">{COMPARAR.bajada}</p>

      {columnas.length >= COMPARAR_MIN && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm">
          <div className="flex justify-end gap-1 p-3">
            {(["CLP", "UF"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMoneda(m)} className={`rounded-full px-3 py-1 font-mono text-xs ${moneda === m ? "bg-[var(--franco-text)] text-[var(--franco-bg)]" : "text-[var(--franco-text-secondary)]"}`}>{m}</button>
            ))}
          </div>
          <table className="w-full min-w-[520px] border-collapse font-body text-sm" data-lqs="comparar-tabla">
            <thead>
              <tr>
                <th className="w-[150px] p-3 text-left font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)]" />
                {columnas.map((c) => (
                  <th key={c.id} className="p-3 text-left align-top">
                    <a href={c.modalidad === "str" ? `/analisis/renta-corta/${c.id}` : `/analisis/${c.id}`} className="font-heading text-[15px] font-bold text-[var(--franco-text)] underline-offset-2 hover:underline">{c.nombre}</a>
                    <div className="font-mono text-[11px] text-[var(--franco-text-secondary)]">{[c.comuna, c.modalidad === "str" ? "Renta corta" : "Renta larga"].filter(Boolean).join(" · ")}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                ["veredicto", (c: ColumnaComparar) => (c.veredicto ? etiquetaVeredicto(c.veredicto, "banda") : "—")],
                ["precio", precio],
                ["flujo", (c: ColumnaComparar) => plata(c.flujoMensualCLP, c.uf)],
                ["resultado", (c: ColumnaComparar) => plata(c.resultado10CLP, c.uf)],
              ] as const).map(([k, f]) => (
                <tr key={k} className="border-t border-[var(--franco-border)]">
                  <th className="p-3 text-left font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)]">{COMPARAR.filas[k]}</th>
                  {columnas.map((c) => (
                    <td key={c.id} className="p-3 font-mono text-[14px] text-[var(--franco-text)]" data-veredicto={k === "veredicto" ? c.veredicto ?? "" : undefined}>{f(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 pb-3 font-body text-xs text-[var(--franco-text-secondary)]">{COMPARAR.notaPesos}</p>
        </div>
      )}

      <div className="mt-8">
        <ul className="divide-y divide-[var(--franco-border)] rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)]">
          {opciones.map((o) => (
            <li key={o.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                <input type="checkbox" checked={elegidos.includes(o.id)} onChange={() => alternar(o.id)} />
                <span className="font-body text-sm text-[var(--franco-text)]">{o.nombre}</span>
                <span className="ml-auto font-mono text-[11px] text-[var(--franco-text-secondary)]">{[o.comuna, o.modalidad === "str" ? "Renta corta" : "Renta larga"].filter(Boolean).join(" · ")}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={elegidos.length < COMPARAR_MIN}
            onClick={() => router.push(`/comparar?ids=${elegidos.join(",")}`)}
            className="rounded-full bg-[var(--franco-text)] px-6 py-3 font-body text-sm font-semibold text-[var(--franco-bg)] disabled:opacity-40"
          >
            {COMPARAR.boton}
          </button>
          {elegidos.length < COMPARAR_MIN && <span className="font-body text-xs text-[var(--franco-text-secondary)]">{COMPARAR.minimo}</span>}
        </div>
      </div>
    </div>
  );
}
