// ─────────────────────────────────────────────────────────────────────────────
// La puerta a Explorar de los correos, del lado del servidor (02-nov-2026; las reglas en puerta-correos.ts): el número único
// de la noche y el enlace por la ruta del clic. Los tres correos —el semanal, el aviso inmediato y el correo del día— la piden
// acá, así ninguno cuenta «convienen» por su cuenta. Sin el número, null: el correo sale sin la línea.
// EL NÚMERO, GUARDADO (02-nov-2026, goal de los cortes por statement_timeout): el que el cron de la evaluación contó sobre el
// universo del mapa y guardó en config (convienen-guardado.ts), el mismo que leen la landing y la portada de /deptos. Los
// correos ya no cuentan el universo: cada envío con la caché vencida llamaba a explorar_mapa.
// ─────────────────────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/service";
import { leerConvienenMapa } from "./convienen-guardado";
import { enlacePuertaCorreo, lineaConvienen, type CorreoConPuerta, type PuertaExplorarCorreo } from "./puerta-correos";
import { consultaExplorar, type PerfilParaExplorar } from "./puerta-correos-filtros";
import type { ModalidadPortal } from "./portal";

export interface PedidoPuertaCorreo {
  /** El enlace base del correo por la ruta del clic: `${sitio}/api/semanal/clic?t=TOKEN`. */
  baseClic: string;
  de: CorreoConPuerta;
  /** Los deptos del correo que convienen (convienenEnSeleccion); 0 en el vacío. */
  n: number;
  /** El perfil y la combinación de la selección; sin perfil (el vacío), la vista global. */
  perfil?: PerfilParaExplorar | null;
  combo?: { piePct: number; plazoAnios: number; tasaPct?: number | null } | null;
  modalidad?: ModalidadPortal;
}

const convienenGuardado = () => leerConvienenMapa(createServiceClient());

/** La línea y el enlace del correo. `deps.convienen` solo para probar: el de verdad es el número guardado de la noche. */
export async function puertaExplorarCorreo(p: PedidoPuertaCorreo, deps: { convienen?: () => Promise<number | null> } = {}): Promise<PuertaExplorarCorreo | null> {
  const total = await (deps.convienen ?? convienenGuardado)().catch(() => null);
  const linea = lineaConvienen(p.n, total);
  if (!linea) return null;
  const consulta = p.perfil ? consultaExplorar(p.perfil, { combo: p.combo ?? null, modalidad: p.modalidad }) : "";
  return { linea, url: enlacePuertaCorreo(p.baseClic, consulta, p.de) };
}
