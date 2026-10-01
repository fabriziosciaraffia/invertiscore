import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { filtroNoTest, getTestAccountIds, leerIncludeTest } from "@/lib/admin-rpc";
import { fmtDateShort, fmtNumber } from "@/lib/admin-format";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { leerQuieroVerlo, resumirQuieroVerlo } from "@/lib/admin-quiero-verlo";
import { TestToggle } from "../test-toggle";

export const dynamic = "force-dynamic";

/**
 * «Quiero verlo» (01-oct-2026): quién pidió qué aviso, con su perfil y el veredicto del informe, y los
 * totales por comuna, por veredicto y por semana. Solo lectura: el correo a la persona sale solo
 * (src/lib/guia/quiero-verlo.ts) y acá no se gestiona nada.
 */
export default async function AdminQuieroVerloPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { sb } = await requireAdminPage();
  const includeTest = leerIncludeTest(searchParams.test);
  const noTest = includeTest ? null : filtroNoTest(await getTestAccountIds(sb));
  const filas = await leerQuieroVerlo(sb, noTest);
  const r = resumirQuieroVerlo(filas);
  const pct = (n: number | null) => (n == null ? "—" : `${String(Math.round(n * 100) / 100).replace(".", ",")}%`);

  const Totales = ({ titulo, items, rotulo }: { titulo: string; items: Array<{ k: string; n: number }>; rotulo?: (k: string) => string }) => (
    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 shadow-sm">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">{titulo}</div>
      {items.length === 0 ? (
        <p className="m-0 font-body text-[13px] text-[var(--franco-text-muted)]">Sin datos.</p>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0">
          {items.map((it) => (
            <li key={it.k} className="flex justify-between gap-3 font-body text-[13px]">
              <span className="text-[var(--franco-text-secondary)]">{rotulo ? rotulo(it.k) : it.k}</span>
              <span className="font-mono text-[var(--franco-text)]">{fmtNumber(it.n)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div data-admin="quiero-verlo">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 font-heading text-2xl font-bold">Quiero verlo</h1>
          <p className="m-0 mt-1 font-body text-[13px] text-[var(--franco-text-secondary)]">
            {fmtNumber(r.total)} pedidos. El aviso le llega a la persona al instante; acá solo se lee.
          </p>
        </div>
        <TestToggle includeTest={includeTest} href={includeTest ? "/admin/quiero-verlo" : "/admin/quiero-verlo?test=1"} />
      </div>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        <Totales titulo="Por comuna" items={r.porComuna} />
        <Totales titulo="Por veredicto" items={r.porVeredicto} rotulo={(k) => (k === "—" ? k : etiquetaVeredicto(k, "frase"))} />
        <Totales titulo="Por semana (desde el lunes)" items={r.porSemana} rotulo={(k) => fmtDateShort(`${k}T12:00:00`)} />
      </section>

      <section className="overflow-x-auto rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm">
        <table className="w-full min-w-[860px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--franco-border)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Persona</th>
              <th className="px-3 py-2 font-medium">Pie · plazo · tasa</th>
              <th className="px-3 py-2 font-medium">Comuna</th>
              <th className="px-3 py-2 font-medium">Tipología</th>
              <th className="px-3 py-2 text-right font-medium">Precio</th>
              <th className="px-3 py-2 font-medium">Veredicto</th>
              <th className="px-3 py-2 font-medium">Correo</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--franco-text-muted)]">Todavía nadie pidió un aviso.</td></tr>
            )}
            {filas.map((f) => (
              <tr key={f.analysisId} className="border-b border-[var(--franco-border)] last:border-0">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px]">{fmtDateShort(f.creadoAt)}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/usuarios/${f.userId}`} className="text-[var(--franco-text)] underline decoration-[var(--franco-border)] underline-offset-2">{f.persona}</Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px]">{pct(f.perfil.piePct)} · {f.perfil.plazo ?? "—"} años · {pct(f.perfil.tasa)}</td>
                <td className="px-3 py-2">{f.comuna || "—"}</td>
                <td className="px-3 py-2 font-mono text-[12px]">{f.tipologia ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[12px]">{f.precioUF != null ? `UF ${Math.round(f.precioUF).toLocaleString("es-CL")}` : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <Link href={`/analisis/${f.analysisId}`} className="text-[var(--franco-text)] underline decoration-[var(--franco-border)] underline-offset-2">
                    {f.veredicto ? etiquetaVeredicto(f.veredicto, "frase") : "—"}{f.score != null ? ` · ${f.score}` : ""}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-[var(--franco-text-secondary)]">
                  {f.correo === "enviado" ? "Enviado" : f.correo === "despublicado" ? "Aviso despublicado" : "Sin enviar"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
