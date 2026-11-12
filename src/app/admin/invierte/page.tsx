import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { filtroNoTest, getTestAccountIds, leerIncludeTest } from "@/lib/admin-rpc";
import { fmtDateShort, fmtNumber } from "@/lib/admin-format";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { INVIERTE_COPY, esEstado, esPie, esUrgencia, esFiltroCondicion } from "@/lib/invierte/invierte";
import { leerInscripciones } from "@/lib/invierte/invierte-servidor";
import { TestToggle } from "../test-toggle";
import { EstadoSelect } from "./estado-select";
import { publicadoresDeAvisos, type PublicadorDelAviso } from "@/lib/publicadores/publicadores-servidor";
import { estadoRelleno } from "@/lib/publicadores/relleno-servidor";
import { ETIQUETA_CLASE, type TipoPublicador } from "@/lib/publicadores/publicador";

const TIPO_SIN_FICHA: Record<TipoPublicador, string> = { corredor: "Corredor", dueno: "Dueño directo", inmobiliaria: "Inmobiliaria" };

/** Quién publica el depto y cómo contactarlo, cuando se conoce. Sin contacto abierto, la ficha del aviso es la puerta. */
function CeldaPublicador({ p }: { p: PublicadorDelAviso | undefined }) {
  if (!p) return <span className="text-[var(--franco-text-muted)]">—</span>;
  const clase = p.clase ? ETIQUETA_CLASE[p.clase] : p.tipo ? TIPO_SIN_FICHA[p.tipo] : null;
  return (
    <div data-publicador={p.leido ? "leido" : "sin-leer"}>
      <div className="font-medium">{p.nombre ?? (p.leido ? "Sin nombre en la ficha" : "Sin leer todavía")}</div>
      {clase && (
        <div className="text-[12px] text-[var(--franco-text-secondary)]">
          {clase}
          {p.avisosActivos != null && ` · ${fmtNumber(p.avisosActivos)} avisos`}
          {p.avisosConvienen ? ` · ${fmtNumber(p.avisosConvienen)} convienen` : ""}
        </div>
      )}
      <div className="text-[12px]">
        {p.telefono && <><a href={`tel:${p.telefono.replace(/\s+/g, "")}`} className="underline underline-offset-2">{p.telefono}</a> · </>}
        {p.correo && <><a href={`mailto:${p.correo}`} className="underline underline-offset-2">{p.correo}</a> · </>}
        {p.sitioWeb && <><a href={p.sitioWeb} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">sitio</a> · </>}
        {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">contactar en el aviso</a>}
      </div>
    </div>
  );
}

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
  const { filas: todas, sinTabla } = await leerInscripciones(sb, noTest);
  // Nuevo de inmobiliaria o usado (12-nov-2026): el filtro `?condicion=nuevo|usado`.
  const condicion = esFiltroCondicion(searchParams.condicion) ? searchParams.condicion : null;
  const filas = condicion ? todas.filter((f) => f.condicion === condicion) : todas;
  const hrefCon = (c: "nuevo" | "usado" | null) => `/admin/invierte${[c ? `condicion=${c}` : "", includeTest ? "test=1" : ""].filter(Boolean).join("&").replace(/^./, (x) => `?${x}`)}`;
  // Quién publica cada depto (12-nov-2026): uso interno, con el service role de la página de admin; no viaja a otra parte.
  const [publicadores, relleno] = await Promise.all([publicadoresDeAvisos(sb, filas.map((f) => f.avisoId)), estadoRelleno(sb)]);
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
          <p className="m-0 mt-1 font-body text-[12px] text-[var(--franco-text-muted)]" data-relleno={relleno.fusible ? "fusible" : relleno.configurado ? "andando" : "sin-credencial"}>
            Publicadores: {relleno.publicadores != null ? fmtNumber(relleno.publicadores) : "—"} conocidos · {relleno.leidas24h != null ? fmtNumber(relleno.leidas24h) : "—"} fichas leídas por el relleno en 24 horas
            {!relleno.configurado && " · el relleno no lee: falta DECODO_RELLENO_URL"}
            {relleno.fusible && ` · fusible: ${relleno.fusible.detalle}, detenido hasta ${fmtDateShort(relleno.fusible.hasta.toISOString())}`}
          </p>
        </div>
        <TestToggle includeTest={includeTest} href={`/admin/invierte${[condicion ? `condicion=${condicion}` : "", includeTest ? "" : "test=1"].filter(Boolean).join("&").replace(/^./, (x) => `?${x}`)}`} />
      </div>
      <nav className="mb-4 flex flex-wrap gap-2 font-body text-[13px]" aria-label="Filtrar por condición" data-admin="invierte-filtro">
        {([[null, `Todas (${fmtNumber(todas.length)})`], ["nuevo", `Nuevos (${fmtNumber(todas.filter((f) => f.condicion === "nuevo").length)})`], ["usado", `Usados (${fmtNumber(todas.filter((f) => f.condicion === "usado").length)})`]] as const).map(([c, rotulo]) => (
          <Link key={rotulo} href={hrefCon(c)} aria-current={condicion === c ? "page" : undefined} className={`rounded-full border px-3 py-1 ${condicion === c ? "border-[var(--franco-text)] text-[var(--franco-text)]" : "border-[var(--franco-border)] text-[var(--franco-text-secondary)]"}`} data-condicion={c ?? "todas"}>{rotulo}</Link>
        ))}
      </nav>
      {sinTabla && (
        <p className="mb-4 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-3 font-body text-[13px]" role="alert">
          La tabla <code>invierte_inscripciones</code> todavía no existe: falta aplicar la migración 20261111_invierte_inscripciones.
        </p>
      )}
      <section className="overflow-x-auto rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm">
        <table className="w-full min-w-[1280px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--franco-border)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Persona</th>
              <th className="px-3 py-2 font-medium">Depto</th>
              <th className="px-3 py-2 font-medium">Condición</th>
              <th className="px-3 py-2 font-medium">Publica</th>
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
              <tr><td colSpan={12} className="px-3 py-6 text-center text-[var(--franco-text-muted)]">Todavía nadie se inscribió.</td></tr>
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
                <td className="whitespace-nowrap px-3 py-2" data-admin="invierte-condicion">{f.condicion === "nuevo" ? "Nuevo" : f.condicion === "usado" ? "Usado" : "—"}</td>
                <td className="min-w-[200px] px-3 py-2"><CeldaPublicador p={publicadores.get(f.avisoId)} /></td>
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
