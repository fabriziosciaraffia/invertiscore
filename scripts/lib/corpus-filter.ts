// ─────────────────────────────────────────────────────────────────────────────
// Filtro de corpus para los barridos — qué filas de `analisis` NO cuentan.
//
// Motivación: el CoC de −73.890% que aparecía en los barridos del parque no era
// un bug del motor, era una fila con el precio en escala rota (`01d52540`,
// precio UF 0,1004 por una doble conversión CLP→UF en el wizard de marzo 2026).
// Filas así ensucian cualquier mediana, mínimo o desviación que se calcule sobre
// el corpus, y obligan a explicar el mismo outlier una y otra vez.
//
// DECISIÓN: no se marcan ni se borran. La exclusión se DERIVA.
//
// Por qué derivar y no marcar:
//   · No inventa columna ni tabla, y no escribe en producción.
//   · Se auto-mantiene: una fila futura con escala rota se excluye sola, sin que
//     nadie se acuerde de marcarla.
//   · Reusa `evaluarPlausibilidad`, que YA es la fuente única de umbrales — el
//     mismo guard que rechaza el input en las rutas de creación, aplicado ahora
//     como filtro de LECTURA. Si los rangos cambian, cambian en un solo lugar.
//
// Dos motivos de exclusión, deliberadamente separados: uno dice "esta fila no es
// de un usuario real", el otro "esta fila no es una propiedad real".
// ─────────────────────────────────────────────────────────────────────────────

import { evaluarPlausibilidad } from "../../src/lib/plausibilidad";
import type { AnalisisInput } from "../../src/lib/types";

export type MotivoExclusion = "cuenta_interna" | "input_implausible";

export interface FilaCorpus {
  id: string;
  user_id?: string | null;
  input_data?: AnalisisInput | null;
  results?: { metrics?: { precioCLP?: number } } | null;
}

/**
 * UF congelada de la fila. Se deriva de la propia fila (`precioCLP / precio`) en
 * vez de usar la UF de hoy: es la que el motor usó para calcularla, y es la
 * única con la que los derivados (UF/m², yield) dan lo que el usuario vio.
 */
export function ufCongelada(fila: FilaCorpus): number {
  const clp = fila.results?.metrics?.precioCLP;
  const uf = fila.input_data?.precio;
  if (!(typeof clp === "number" && typeof uf === "number" && uf > 0)) return NaN;
  const d = clp / uf;
  return Number.isFinite(d) && d > 0 ? d : NaN;
}

/**
 * `null` ⇒ la fila cuenta para el corpus. Si no, el motivo por el que se salta.
 *
 * `testUserIds` viene de `getTestAccountIds` (tabla `test_accounts`, el mismo
 * mecanismo que ya usa el panel admin). Se pasa como Set para no re-consultar
 * por fila.
 */
export function motivoExclusion(
  fila: FilaCorpus,
  testUserIds: ReadonlySet<string>,
): MotivoExclusion | null {
  if (fila.user_id && testUserIds.has(fila.user_id)) return "cuenta_interna";

  const input = fila.input_data;
  const ufCLP = ufCongelada(fila);
  // Fail-open, igual que el guard en las rutas: sin los insumos no se juzga.
  if (!input || !Number.isFinite(ufCLP)) return null;

  const anomalias = evaluarPlausibilidad({
    precioUF: Number(input.precio),
    superficieM2: Number(input.superficie),
    ufCLP,
    tasaAnualPct: Number(input.tasaInteres),
    arriendoMensualCLP: Number(input.arriendo),
    piePct: Number(input.piePct),
  });
  return anomalias.length > 0 ? "input_implausible" : null;
}

export interface ResumenCorpus<T> {
  /** Las filas que cuentan. */
  corpus: T[];
  /** Las que no, con su motivo. */
  excluidas: Array<{ id: string; motivo: MotivoExclusion }>;
  /** Conteo por motivo, para el encabezado del barrido. */
  porMotivo: Record<MotivoExclusion, number>;
}

/**
 * Parte una lista de filas en corpus + excluidas. Todo barrido del parque
 * debería empezar por acá y REPORTAR `porMotivo`: una exclusión silenciosa se
 * lee igual que "no había nada que excluir".
 */
export function partirCorpus<T extends FilaCorpus>(
  filas: T[],
  testUserIds: ReadonlySet<string>,
): ResumenCorpus<T> {
  const corpus: T[] = [];
  const excluidas: Array<{ id: string; motivo: MotivoExclusion }> = [];
  const porMotivo: Record<MotivoExclusion, number> = { cuenta_interna: 0, input_implausible: 0 };
  for (const f of filas) {
    const motivo = motivoExclusion(f, testUserIds);
    if (motivo) {
      excluidas.push({ id: f.id, motivo });
      porMotivo[motivo]++;
    } else {
      corpus.push(f);
    }
  }
  return { corpus, excluidas, porMotivo };
}
