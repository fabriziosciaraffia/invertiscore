import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { fmtDateShort, fmtNumber } from "@/lib/admin-format";
import { INVIERTE_COPY, esPie, esUrgencia } from "@/lib/invierte/invierte";
import { estadoInterruptor } from "@/lib/invierte-v2/acceso-servidor";
import { leerCrm } from "@/lib/invierte-v2/servidor";
import { VERSION_ORDEN } from "@/lib/invierte-v2/orden";
import { AgregarCorreo, ModoSelect, NumeroWhatsapp, QuitarCorreo, ReenviarCopia, ReiniciarPrueba } from "./controles";
import { numeroFranco } from "@/lib/invierte-v2/base-servidor";

export const dynamic = "force-dynamic";

/**
 * «Invierte con Franco, comprador» (etapa 1, 18-nov-2026): el interruptor (modo y lista de correos) y el CRM mínimo —una fila por
 * persona del flujo nuevo con su estado (contacto, firmó), sus respuestas, su WhatsApp y «Ver» la orden firmada—. Solo
 * administradores de ADMIN_EMAIL. Las inscripciones de Pronto siguen en /admin/invierte, aparte.
 */
export default async function AdminInvierteV2Page() {
  const { sb } = await requireAdminPage();
  const [{ modo, lista }, { filas, sinTabla }, whatsapp, { data: tareas }] = await Promise.all([
    estadoInterruptor(), leerCrm(sb), numeroFranco(sb),
    sb.from("inv_tareas").select("user_id").eq("estado", "pendiente").limit(1000),
  ]);
  // Las tareas pendientes por persona (entrega 2): se ven y se marcan en su ficha.
  const pendientes = new Map<string, number>();
  for (const t of tareas ?? []) if (t.user_id) pendientes.set(t.user_id as string, (pendientes.get(t.user_id as string) ?? 0) + 1);
  const H = INVIERTE_COPY.hoja;
  const firmaron = filas.filter((f) => f.orden).length;
  const sinCopia = filas.filter((f) => f.orden && !f.orden.copia).length;

  return (
    <div data-admin="invierte-v2">
      <div className="mb-6">
        <h1 className="m-0 font-heading text-2xl font-bold">Invierte con Franco · comprador</h1>
        <p className="m-0 mt-1 font-body text-[13px] text-[var(--franco-text-secondary)]">
          {fmtNumber(filas.length)} {filas.length === 1 ? "persona" : "personas"} · {fmtNumber(firmaron)} {firmaron === 1 ? "firmó" : "firmaron"} la orden · orden vigente: versión {VERSION_ORDEN}
        </p>
        {sinCopia > 0 && (
          <p className="m-0 mt-2 inline-flex rounded-full border border-[var(--signal-red)] px-3 py-1 font-body text-[12px] font-semibold text-[var(--signal-red)]" data-admin="inv2-sin-copia">
            {fmtNumber(sinCopia)} {sinCopia === 1 ? "copia sin enviar" : "copias sin enviar"}
          </p>
        )}
      </div>
      {sinTabla && (
        <p className="mb-4 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-3 font-body text-[13px]" role="alert">
          Las tablas del flujo nuevo todavía no existen: falta aplicar la migración 20261118_invierte_v2_etapa1.
        </p>
      )}

      <section className="mb-6 rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 shadow-sm" data-admin="inv2-interruptor">
        <h2 className="m-0 mb-3 font-heading text-lg font-bold">Interruptor</h2>
        <div className="mb-3 flex flex-wrap items-center gap-3 font-body text-[13px]">
          <span>Modo:</span> <ModoSelect inicial={modo} />
          <span className="text-[12px] text-[var(--franco-text-muted)]">Puede tardar hasta un minuto en llegar a todos los servidores.</span>
        </div>
        <ul className="m-0 mb-3 flex list-none flex-col gap-2 p-0 font-body text-[13px]" data-admin="inv2-lista">
          {lista.size === 0 && <li className="text-[var(--franco-text-muted)]">La lista está vacía.</li>}
          {Array.from(lista).sort().map((e) => (
            <li key={e} className="flex items-center gap-3"><span className="font-mono text-[12px]">{e}</span><QuitarCorreo email={e} /></li>
          ))}
        </ul>
        <AgregarCorreo />
        <div className="mt-4 flex flex-wrap items-center gap-3 font-body text-[13px]">
          <span>WhatsApp de «Escribirle» (modo prueba):</span> <NumeroWhatsapp inicial={whatsapp} />
          {!whatsapp && <span className="text-[12px] text-[var(--franco-text-muted)]">Sin número, la base no muestra «Escribirle».</span>}
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm">
        <table className="w-full min-w-[1100px] border-collapse font-body text-[13px]" data-admin="inv2-crm">
          <thead>
            <tr className="border-b border-[var(--franco-border)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">
              <th className="px-3 py-2 font-medium">Actualizado</th>
              <th className="px-3 py-2 font-medium">Persona</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Depto</th>
              <th className="px-3 py-2 font-medium">¿Cuándo?</th>
              <th className="px-3 py-2 font-medium">¿Pie?</th>
              <th className="px-3 py-2 font-medium">WhatsApp</th>
              <th className="px-3 py-2 font-medium">Orden</th>
              <th className="px-3 py-2 font-medium">Prueba</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-[var(--franco-text-muted)]">Todavía nadie entró al flujo nuevo.</td></tr>}
            {filas.map((f) => (
              <tr key={f.userId} className="border-b border-[var(--franco-border)] align-top last:border-0" data-estado={f.orden ? "firmo" : "contacto"}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px]">{fmtDateShort(f.updatedAt)}</td>
                <td className="px-3 py-2"><Link href={`/admin/invierte-v2/${f.userId}`} className="underline decoration-[var(--franco-border)] underline-offset-2" data-admin="inv2-ficha">{f.email ?? f.userId}</Link>{(pendientes.get(f.userId) ?? 0) > 0 && <div className="text-[12px] font-semibold" data-admin="inv2-pendientes">{pendientes.get(f.userId)} {pendientes.get(f.userId) === 1 ? "tarea pendiente" : "tareas pendientes"}</div>}</td>
                <td className="whitespace-nowrap px-3 py-2 font-semibold">{f.orden ? "Firmó" : "Contacto"}</td>
                <td className="px-3 py-2">{f.linea ?? f.avisoOrigen}{f.precioUF != null && <span className="font-mono text-[12px]"> · UF {Math.round(f.precioUF).toLocaleString("es-CL")}</span>}<div className="text-[12px] text-[var(--franco-text-muted)]">desde {f.origen} · {f.campanaTexto}</div></td>
                <td className="whitespace-nowrap px-3 py-2">{esUrgencia(f.urgencia) ? H.urgencias[f.urgencia] : f.urgencia}</td>
                <td className="whitespace-nowrap px-3 py-2">{esPie(f.pie) ? H.pies[f.pie] : f.pie}{f.pieUF != null && <span className="text-[var(--franco-text-muted)]"> (UF {f.pieUF.toLocaleString("es-CL")})</span>}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px]"><a href={`https://wa.me/${f.whatsapp.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{f.whatsapp}</a><div className="font-body text-[11px] text-[var(--franco-text-muted)]">permiso {fmtDateShort(f.permisoWhatsappAt)}</div></td>
                <td className="whitespace-nowrap px-3 py-2">
                  {f.orden ? (
                    <>
                      <a href={`/api/admin/invierte-v2?orden=${f.orden.id}`} target="_blank" rel="noopener" className="underline underline-offset-2" data-admin="inv2-ver">Ver</a>
                      <span className="text-[12px] text-[var(--franco-text-muted)]"> · v{f.orden.version} · {fmtDateShort(f.orden.firmadoAt)}{!f.orden.pdf && " · sin PDF"}</span>
                      {!f.orden.copia && (
                        <div className="mt-1 text-[12px] text-[var(--signal-red)]" data-admin="inv2-copia-pendiente">
                          Copia sin enviar · {f.orden.copiaIntentos} {f.orden.copiaIntentos === 1 ? "intento" : "intentos"}{f.orden.copiaUltimoAt ? ` · último ${fmtDateShort(f.orden.copiaUltimoAt)}` : ""}{f.orden.copiaMotivo ? ` · ${f.orden.copiaMotivo}` : ""}
                          <div className="mt-1"><ReenviarCopia ordenId={f.orden.id} /></div>
                        </div>
                      )}
                    </>
                  ) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{f.esPrueba ? <ReiniciarPrueba userId={f.userId} email={f.email} /> : <span className="text-[var(--franco-text-muted)]">Real</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
