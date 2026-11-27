import { cookies } from "next/headers";
import { requireAdminPage } from "@/lib/admin-auth";
import { estadoAsesoria } from "@/lib/asesoria/acceso-servidor";
import { TABLA_ACCESO_ASESORIA } from "@/lib/asesoria/acceso";
import { huellaDeCabeceras } from "@/lib/regalo-alta-servidor";
import { COOKIE_DISPOSITIVO } from "@/lib/dispositivo";
import { fmtDateShort } from "@/lib/admin-format";
import { EsteDispositivo } from "./controles";

export const dynamic = "force-dynamic";

/**
 * La asesoría en el mapa (27-nov-2026): el modo del interruptor (`config.asesoria_modo`) y los dispositivos que la ven mientras está
 * en «lista». «Habilitar este dispositivo» guarda el de este navegador: después se cierra sesión y se prueba sin cuenta acá mismo.
 * El modo lo cambia Claude en la base (no hay botón a propósito: abrirla a todos es una decisión, no un clic).
 */
export default async function AdminAsesoriaPage() {
  const { sb } = await requireAdminPage();
  const [{ modo }, { data: dispositivos }] = await Promise.all([
    estadoAsesoria(),
    sb.from(TABLA_ACCESO_ASESORIA).select("dispositivo_hash, nota, creado_at").order("creado_at", { ascending: false }).range(0, 199),
  ]);
  const esteHash = huellaDeCabeceras({ get: () => null }, cookies().get(COOKIE_DISPOSITIVO)?.value ?? null).dispositivo;
  const habilitado = !!esteHash && (dispositivos ?? []).some((d) => d.dispositivo_hash === esteHash);
  return (
    <div data-admin="asesoria">
      <h1 className="m-0 font-heading text-2xl font-bold">La asesoría en el mapa</h1>
      <p className="m-0 mt-1 font-body text-[13px] text-[var(--franco-text-secondary)]">Modo: <strong data-admin="asesoria-modo">{modo}</strong> · {(dispositivos ?? []).length} dispositivos habilitados</p>
      <section className="mt-6 rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 shadow-sm">
        <h2 className="m-0 mb-2 font-heading text-lg font-bold">Este dispositivo</h2>
        <EsteDispositivo habilitado={habilitado} sinCookie={!esteHash} />
      </section>
      <section className="mt-6 rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 shadow-sm">
        <h2 className="m-0 mb-2 font-heading text-lg font-bold">Habilitados</h2>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 font-body text-[13px]">
          {(dispositivos ?? []).map((d) => (
            <li key={d.dispositivo_hash as string}>{d.nota as string} · {fmtDateShort(d.creado_at as string)}{d.dispositivo_hash === esteHash ? " · este" : ""}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
