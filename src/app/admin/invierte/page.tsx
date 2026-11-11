import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { filtroNoTest, getTestAccountIds, leerIncludeTest } from "@/lib/admin-rpc";
import { fmtDateShort, fmtNumber } from "@/lib/admin-format";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { INVIERTE_COPY, esEstado, esPie, esUrgencia } from "@/lib/invierte/invierte";
import { leerInscripciones } from "@/lib/invierte/invierte-servidor";
import { TestToggle } from "../test-toggle";
import { EstadoSelect } from "./estado-select";

export const dynamic = "force-dynamic";

/**
 * «Invierte con Franco» (11-nov-2026, goal «Pronto: Invierte con Franco»): las inscripciones, una por persona y depto, con el
 * depto, las respuestas (cuándo compra, el pie, el WhatsApp), la campaña, la fecha y el estado (nuevo, contactado,
 * descartado), que se cambia acá. Cada una llegó además a hola@ por correo.
 */
export default async function AdminInviertePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { sb } = await requireAdminPage();
  const includeTest = leerIncludeTest(searchParams.test);
  const noTest = includeTest ? null : filtroNoTest(await getTestAccountIds(sb));
  const { filas, sinTabla } = await leerInscripciones(sb, noTest);
  const H = INVIERTE_COPY.hoja;
  const esteMes = filas.filter((f) => f.urgencia === "este_mes").length;
  const nuevos = filas.filter((f) => f.estado === "nuevo").length;

  return (
    <div data-admin="invierte">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 font-heading text-2xl font-bold">Invierte con Franco</h1>
          <p className="m-0 mt-1 font-body text-[13px] text-[var(--franco-text-secondary)]">
            {fmtNumber(filas.length)} inscripciones · {fmtNumber(esteMes)} piensan comprar este mes · {fmtNumber(nuevos)} sin contactar.
          </p>
        </div>
        <TestToggle includeTest={includeTest} href={includeTest ? "/admin/invierte" : "/admin/invierte?test=1"} />
      </div>
      {sinTabla && (
        <p className="mb-4 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-3 font-body text-[13px]" role="alert">
          La tabla <code>invierte_inscripciones</code> todavía no existe: falta aplicar la migración 20261111_invierte_inscripciones.
        </p>
      )}
      <section className="overflow-x-auto rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm">
        <table className="w-full min-w-[1080px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--franco-border)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Persona</th>
              <th className="px-3 py-2 font-medium">Depto</th>
              <th className="px-3 py-2 font-medium">Veredicto</th>
              <th className="px-3 py-2 font-medium">¿Cuándo?</th>
              <th className="px-3 py-2 font-medium">¿Pie?</th>
              <th className="px-3 py-2 font-medium">WhatsApp</th>
              <th className="px-3 py-2 font-medium">Desde · campaña</th>
              <th className="px-3 py-2 font-medium">Correo</th>
              <th className="px-3 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-[var(--franco-text-muted)]">Todavía nadie se inscribió.</td></tr>
            )}
            {filas.map((f) => (
              <tr key={f.id} className="border-b border-[var(--franco-border)] align-top last:border-0" data-urgencia={f.urgencia}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px]" title={f.actualizadaAt !== f.creadaAt ? `Actualizada ${fmtDateShort(f.actualizadaAt)}` : undefined}>{fmtDateShort(f.creadaAt)}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/usuarios/${f.userId}`} className="text-[var(--franco-text)] underline decoration-[var(--franco-border)] underline-offset-2">{f.persona}</Link>
                </td>
                <td className="px-3 py-2">
                  {f.linea ?? f.avisoId}
                  {f.precioUF != null && <span className="font-mono text-[12px]"> · UF {Math.round(f.precioUF).toLocaleString("es-CL")}</span>}
                  {f.analysisId && <> · <Link href={`/analisis/${f.analysisId}`} className="underline underline-offset-2">informe</Link></>}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{f.veredicto ? etiquetaVeredicto(f.veredicto, "frase") : "—"}{f.score != null ? ` · ${f.score}` : ""}</td>
                <td className={`whitespace-nowrap px-3 py-2 ${f.urgencia === "este_mes" ? "font-semibold" : ""}`}>{esUrgencia(f.urgencia) ? H.urgencias[f.urgencia] : f.urgencia}</td>
                <td className="whitespace-nowrap px-3 py-2">{esPie(f.pie) ? H.pies[f.pie] : f.pie}{f.pieUF != null && <span className="text-[var(--franco-text-muted)]"> (UF {f.pieUF.toLocaleString("es-CL")})</span>}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px]"><a href={`https://wa.me/${f.whatsapp.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{f.whatsapp}</a></td>
                <td className="px-3 py-2 text-[12px] text-[var(--franco-text-secondary)]">{f.origen} · {f.campana}</td>
                <td className="whitespace-nowrap px-3 py-2 text-[var(--franco-text-secondary)]">{f.correo ? "Llegó" : "Sin enviar"}</td>
                <td className="whitespace-nowrap px-3 py-2"><EstadoSelect id={f.id} inicial={esEstado(f.estado) ? f.estado : "nuevo"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
