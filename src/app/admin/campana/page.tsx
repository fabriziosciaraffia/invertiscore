import { requireAdminPage } from "@/lib/admin-auth";
import { fmtNumber } from "@/lib/admin-format";
import { armarPanelCampana, leerDatosCampana, type Ventana } from "@/lib/admin-campana";
import { GastoInput } from "./gasto-input";

export const dynamic = "force-dynamic";

/** Desde cuándo se cuentan las cuentas (la campaña de noviembre); `?desde=AAAA-MM-DD` lo cambia. */
const DESDE_POR_DEFECTO = "2026-11-01";

/**
 * La campaña (12-nov-2026, campaña de noviembre fase 0): por conjunto (utm_content) y semana de llegada, leído de nuestra base
 * y solo con cuentas reales. El gasto se ingresa a mano. Las reglas, en lib/admin-campana.ts.
 */
export default async function AdminCampanaPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { sb } = await requireAdminPage();
  const d = typeof searchParams.desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.desde) ? searchParams.desde : DESDE_POR_DEFECTO;
  const filas = armarPanelCampana(await leerDatosCampana(sb, `${d}T00:00:00-03:00`));
  const clp = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("es-CL")}`);
  const pct = (n: number | null) => (n == null ? "—" : `${String(n).replace(".", ",")} %`);
  const celdas = (v: Ventana) => (
    <>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[12px]">{pct(v.regaloPct)} <span className="text-[var(--franco-text-muted)]">({v.regalo})</span></td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[12px]">{pct(v.invierte_pct)} <span className="text-[var(--franco-text-muted)]">({v.invierte})</span></td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[12px]">{fmtNumber(v.compras)}</td>
    </>
  );
  const totalRegistros = filas.reduce((s, f) => s + f.registros, 0);
  const totalGasto = filas.reduce((s, f) => s + (f.gasto ?? 0), 0);

  return (
    <div data-admin="campana">
      <div className="mb-6">
        <h1 className="m-0 font-heading text-2xl font-bold">Campaña</h1>
        <p className="m-0 mt-1 font-body text-[13px] text-[var(--franco-text-secondary)]">
          Desde el {d.split("-").reverse().join("-")} · {fmtNumber(totalRegistros)} registros de cuentas reales · gasto ingresado {clp(totalGasto)}.
          Por conjunto (utm_content) y semana de llegada (el clic del anuncio o, sin clic, la creación de la cuenta). Las cuentas de prueba no cuentan.
        </p>
        <p className="m-0 mt-1 font-body text-[12px] text-[var(--franco-text-muted)]">
          «Regalo»: su análisis de regalo ya se usó y tiene un análisis en la ventana. «Invierte»: se inscribió en Invierte con Franco. Compras: pagos con monto. A 30 días, desde cada registro; «en curso» si la semana no cumplió 30 días.
        </p>
      </div>
      <section className="overflow-x-auto rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm">
        <table className="w-full min-w-[1100px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--franco-border)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">
              <th className="px-3 py-2 font-medium">Semana</th>
              <th className="px-3 py-2 font-medium">Conjunto</th>
              <th className="px-3 py-2 text-right font-medium">Gasto</th>
              <th className="px-3 py-2 text-right font-medium">Registros</th>
              <th className="px-3 py-2 text-right font-medium">Costo por registro</th>
              <th className="px-3 py-2 text-right font-medium">Regalo 24 h</th>
              <th className="px-3 py-2 text-right font-medium">Invierte 24 h</th>
              <th className="px-3 py-2 text-right font-medium">Compras 24 h</th>
              <th className="px-3 py-2 text-right font-medium">Regalo 30 d</th>
              <th className="px-3 py-2 text-right font-medium">Invierte 30 d</th>
              <th className="px-3 py-2 text-right font-medium">Compras 30 d</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-[var(--franco-text-muted)]">Todavía no hay registros desde esa fecha.</td></tr>
            )}
            {filas.map((f) => (
              <tr key={f.clave} className="border-b border-[var(--franco-border)] last:border-0" data-admin="campana-fila" data-conjunto={f.conjunto}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px]">{f.semana.split("-").reverse().join("-")}{f.enCurso && <span className="ml-1 text-[var(--franco-text-muted)]">· en curso</span>}</td>
                <td className="px-3 py-2">{f.conjunto}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right"><GastoInput clave={f.clave} inicial={f.gasto} /></td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[12px]">{fmtNumber(f.registros)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[12px]">{clp(f.costoPorRegistro)}</td>
                {celdas(f.h24)}
                {celdas(f.d30)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
