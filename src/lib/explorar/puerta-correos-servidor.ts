// ─────────────────────────────────────────────────────────────────────────────
// La puerta a Explorar de los correos, del lado del servidor (02-nov-2026; las reglas en puerta-correos.ts): el número único
// de la noche (convienenHoy) y el enlace por la ruta del clic. Los tres correos —el semanal, el aviso inmediato y el correo del
// día— la piden acá, así ninguno cuenta «convienen» por su cuenta. Sin el número, null: el correo sale sin la línea.
// ─────────────────────────────────────────────────────────────────────────────
import { convienenHoy } from "./portal-cache";
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

/** La línea y el enlace del correo. `deps.convienen` solo para probar: el de verdad es convienenHoy. */
export async function puertaExplorarCorreo(p: PedidoPuertaCorreo, deps: { convienen?: () => Promise<number | null> } = {}): Promise<PuertaExplorarCorreo | null> {
  const total = await (deps.convienen ?? convienenHoy)().catch(() => null);
  const linea = lineaConvienen(p.n, total);
  if (!linea) return null;
  const consulta = p.perfil ? consultaExplorar(p.perfil, { combo: p.combo ?? null, modalidad: p.modalidad }) : "";
  return { linea, url: enlacePuertaCorreo(p.baseClic, consulta, p.de) };
}
