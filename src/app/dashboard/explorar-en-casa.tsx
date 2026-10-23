// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR EN EL DASHBOARD (23-oct-2026, docs/puerta-b-mockups/3b-dashboard.html): «Explorar los 312 en el mapa» lleva a
// /explorar, el mapa de todos los deptos que convienen con la búsqueda de la persona (lib/explorar). El número sale de la
// misma RPC que los pines, con los filtros de su perfil; sin perfil que alcance, «Explorar en el mapa» a secas.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { conteoExplorar, filtrosDeLaCuenta } from "@/lib/explorar/servidor";
import { CASA } from "./casa-copy";

export interface DatosExplorarCasa {
  n: number;
  desdePerfil: boolean;
}

export async function datosExplorarCasa(admin: SupabaseClient, userId: string): Promise<DatosExplorarCasa> {
  try {
    const { filtros, desdePerfil } = await filtrosDeLaCuenta(admin, userId);
    return { n: desdePerfil ? await conteoExplorar(admin, filtros) : 0, desdePerfil };
  } catch {
    return { n: 0, desdePerfil: false };
  }
}

export function ExplorarEnCasa({ datos }: { datos: DatosExplorarCasa }) {
  return (
    <section className="ca-plano-sec" data-casa="explorar">
      <h2 className="ca-plano-t">{CASA.explorar.titulo}</h2>
      <p className="mb-3 max-w-[640px] text-[14px] text-[var(--franco-text-secondary)]">{CASA.explorar.bajada}</p>
      <EnlaceCarga href="/explorar" className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--franco-text)] px-5 text-[14.5px] font-semibold text-[var(--franco-card)]" data-casa="explorar-boton" data-n={datos.n}>
        {CASA.explorar.boton(datos.n)}
      </EnlaceCarga>
    </section>
  );
}
