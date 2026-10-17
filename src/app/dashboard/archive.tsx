/**
 * «TUS INFORMES» — UNA SOLA LISTA (17-oct-2026, decisión de Fabrizio; antes «Archivo», debajo de «Continuar» y de la tira
 * de cifras, que se retiraron).
 *
 * Por fecha, el más reciente arriba, sin orden por columna. Columnas: nombre (con la marca «Franco» si salió de un aviso
 * que mostró Franco; lo del wizard no lleva nada), comuna, modalidad, veredicto con la tríada, puntaje, flujo y fecha.
 * Toda la fila abre el informe. Arriba, la búsqueda, «Agrupar por propiedad» y los filtros: modalidad, origen («De
 * Franco» / «Míos») y veredicto, con sus conteos. En el teléfono, cada informe es una tarjeta de UNA línea —nombre,
 * veredicto, flujo y fecha— y los filtros se desplazan de lado.
 *
 * Todo el estado vive en la URL (`?q=&mod=&v=&o=&page=&group=&open=`). Los chips y los chevrons de grupo son
 * <EnlaceCarga>, así que filtran y expanden sin JavaScript; lo único que necesita cliente es el input de búsqueda
 * (debounce) y el borrado. Lo fija el tier CASA §11.
 */

import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import type { AnalisisDashboardRow, DashboardStats } from "@/lib/dashboard-query";
import type { Veredicto } from "@/lib/types";
import type { ItemArchivo } from "./agrupar";
import { filaResumenGrupo } from "./agrupar";
import {
  ARCHIVO_COPY,
  buildHref,
  displayDireccion,
  fmtCLPSigned,
  fmtFechaCorta,
  fmtUF,
  hrefAnalisis,
  hrefPdf,
  modalidadLabel,
  toggleGrupoHref,
  grupoAbierto,
  grupoMuestraTodos,
  verTodosHref,
  veredictoDisplay,
  PAGE_SIZE,
  type DashboardParams,
} from "./dashboard-helpers";
import { Chevron, ModChip, colorDelPuntaje } from "./dashboard-ui";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { ArchiveSearch } from "./archive-search";
import { RowActions } from "./row-actions";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { textoOrigenArchivo, type OrigenInforme } from "@/lib/guia/seleccion-casa";

/** Hijos que se muestran al expandir un grupo antes de ofrecer «ver el resto». */
const HIJOS_VISIBLES = 8;

type GrupoItem = Extract<ItemArchivo, { kind: "grupo" }>;

/** Una entrada de la lista del teléfono: fila suelta, cabecera de grupo, o hija. */
interface ItemMobile {
  row: AnalisisDashboardRow;
  /** Presente solo en la cabecera de un grupo. */
  grupo?: GrupoItem;
  esHija?: boolean;
  mostrarPrecio?: boolean;
}

/**
 * Aplana los ítems agrupados a la lista lineal del teléfono: cabecera de grupo seguida de sus hijas cuando está
 * expandido.
 */
function aplanarParaMobile(items: ItemArchivo[], params: DashboardParams): ItemMobile[] {
  const out: ItemMobile[] = [];
  for (const i of items) {
    if (i.kind === "fila") { out.push({ row: i.row }); continue; }
    out.push({ row: i.grupo.vigente, grupo: i });
    if (!grupoAbierto(params, i.grupo.key)) continue;
    const visibles = grupoMuestraTodos(params, i.grupo.key)
      ? i.grupo.hijos
      : i.grupo.hijos.slice(0, HIJOS_VISIBLES);
    for (const h of visibles) {
      out.push({ row: h, esHija: true, mostrarPrecio: i.grupo.preciosDistintos });
    }
  }
  return out;
}

interface Props {
  /** Filas planas de la página (modo sin agrupar). */
  rows: AnalisisDashboardRow[];
  /** Ítems de la página en modo agrupado (grupos + filas sueltas). */
  items?: ItemArchivo[];
  siblings: Map<string, AnalisisDashboardRow>;
  total: number;
  hasMore: boolean;
  params: DashboardParams;
  stats: DashboardStats;
  /** Unidades representadas en pantalla (en agrupado ≠ cantidad de ítems). */
  unidadesVisibles: number;
  /** De los informes de Franco a la vista, de dónde salieron (la selección semanal o la guía): el título de la marca. */
  origenes?: Record<string, OrigenInforme>;
}

// ─── La marca de origen ─────────────────────────────────────────────────────

/** «Franco» al lado del nombre de lo que salió de un aviso que mostró Franco; lo del wizard no lleva nada. */
export function MarcaFranco({ row, origen }: { row: Pick<AnalisisDashboardRow, "de_franco">; origen: OrigenInforme | null }) {
  if (!row.de_franco) return null;
  return (
    <span
      className="relative z-10 shrink-0 rounded-full bg-[var(--franco-text)] px-1.5 text-[11px] font-semibold leading-[18px] text-[var(--franco-bg)]"
      title={origen ? textoOrigenArchivo(origen) : ARCHIVO_COPY.desdeAviso}
      data-archivo="franco"
    >
      {ARCHIVO_COPY.marca}
    </span>
  );
}

// ─── Chips ──────────────────────────────────────────────────────────────────

function Chip({ href, activo, children, rojo = false, filtro }: {
  href: string; activo: boolean; children: React.ReactNode; rojo?: boolean; filtro: string;
}) {
  const base = "shrink-0 whitespace-nowrap rounded-[7px] border px-2.5 py-1 font-body text-xs no-underline transition-colors";
  if (activo && rojo) {
    return (
      <EnlaceCarga
        href={href}
        className={`${base} font-medium`}
        data-filtro={filtro}
        style={{
          color: "var(--signal-red)",
          borderColor: "color-mix(in srgb, var(--signal-red) 40%, transparent)",
          background: "color-mix(in srgb, var(--signal-red) 6%, transparent)",
          borderWidth: 1.5,
        }}
      >
        {children}
      </EnlaceCarga>
    );
  }
  return (
    <EnlaceCarga
      href={href}
      data-filtro={filtro}
      className={`${base} ${
        activo
          ? "border-[var(--franco-text)] bg-[var(--franco-text)] font-medium text-[var(--franco-bg)]"
          : "border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
      }`}
    >
      {children}
    </EnlaceCarga>
  );
}

function Conteo({ n }: { n: number }) {
  return <span className="ml-1.5 text-[12.5px] opacity-65">{n}</span>;
}

const Separador = () => <span className="h-5 w-px shrink-0 bg-[var(--franco-border)]" aria-hidden="true" />;

// ─── Header de columna (sin orden: la lista va por fecha) ───────────────────

function Th({ label, num = false }: { label: string; num?: boolean }) {
  return (
    <th
      scope="col"
      className={`border-b border-[var(--franco-border-hover)] bg-[var(--franco-sunken,var(--franco-bg))] px-2.5 py-2 text-[12px] font-medium text-[var(--franco-text-muted)] ${
        num ? "text-right" : "text-left"
      }`}
    >
      {label}
    </th>
  );
}

// ─── Celdas numéricas compartidas: puntaje, flujo y fecha ───────────────────

function CeldasNumericas({ row }: { row: AnalisisDashboardRow }) {
  const flujo = Number(row.flujo);
  return (
    <>
      <td className="h-10 px-2.5 text-right align-middle">
        <span className="text-[13px] font-bold" style={{ color: colorDelPuntaje(veredictoDisplay(row)) }}>
          {row.score_efectivo}
        </span>
      </td>
      <td
        className="h-10 whitespace-nowrap px-2.5 text-right align-middle text-[13px] font-medium tabular-nums"
        style={{ color: flujo < 0 ? "var(--signal-red)" : "var(--franco-text)" }}
      >
        {fmtCLPSigned(flujo)}
      </td>
      <td className="h-10 whitespace-nowrap px-2.5 text-right align-middle text-[13px] text-[var(--franco-text-muted)]">
        {fmtFechaCorta(row.created_at)}
      </td>
    </>
  );
}

// ─── Fila de análisis (suelta o hija de un grupo) ───────────────────────────

function FilaAnalisis({
  row, siblings, hijo = false, mostrarPrecio = false, vigente = false, origen = null,
}: {
  row: AnalisisDashboardRow;
  siblings: Map<string, AnalisisDashboardRow>;
  hijo?: boolean;
  /** Solo true cuando el precio DIFIERE entre hermanas: ahí sí distingue. */
  mostrarPrecio?: boolean;
  vigente?: boolean;
  origen?: OrigenInforme | null;
}) {
  const str = row.ambas_group_id ? siblings.get(row.ambas_group_id) : undefined;
  const abrir = hrefAnalisis(row, str?.id);

  return (
    <tr
      className={`group relative border-b border-[var(--franco-border)] hover:bg-[var(--franco-elevated)] ${
        hijo ? "bg-[color-mix(in_srgb,var(--franco-text)_2%,transparent)]" : ""
      }`}
      data-archivo="fila"
    >
      <td className={`h-10 truncate px-2.5 align-middle ${hijo ? "pl-9" : ""}`}>
        <span className="flex min-w-0 items-center gap-2">
          {hijo ? (
            <>
              <span className="h-px w-2.5 shrink-0 bg-[var(--franco-border-hover)]" aria-hidden="true" />
              {/* La hija comparte dirección con sus hermanas: solo el precio, y solo cuando difiere. */}
              {mostrarPrecio && (
                <EnlaceCarga href={abrir} className="truncate text-[13px] text-[var(--franco-text-secondary)] no-underline">
                  {fmtUF(Number(row.precio))}
                </EnlaceCarga>
              )}
              {vigente && (
                <span className="shrink-0 rounded border border-[var(--franco-border-hover)] px-1.5 py-px text-[11px] font-semibold text-[var(--franco-text-muted)]">
                  Vigente
                </span>
              )}
              <MarcaFranco row={row} origen={origen} />
            </>
          ) : (
            <>
              <EnlaceCarga href={abrir} className="truncate text-[13.5px] font-semibold text-[var(--franco-text)] no-underline">
                {displayDireccion(row)}
              </EnlaceCarga>
              <MarcaFranco row={row} origen={origen} />
            </>
          )}
        </span>
      </td>
      <td className="h-10 truncate px-2.5 align-middle font-body text-[13px] text-[var(--franco-text-muted)]">
        {row.comuna}
      </td>
      <td className="h-10 px-2.5 align-middle"><ModChip label={modalidadLabel(row)} /></td>
      <td className="h-10 px-2.5 align-middle"><ChipVeredicto v={veredictoDisplay(row)} /></td>
      <CeldasNumericas row={row} />
      <td className="h-10 px-2.5 align-middle">
        {/* Capa que hace clickeable TODA la fila. Va acá y no como ::after del link del nombre: esa celda trunca
            (overflow hidden) y recortaría el overlay a su propio ancho. aria-hidden porque el link accesible es el del
            nombre. */}
        <EnlaceCarga href={abrir} aria-hidden="true" tabIndex={-1} className="absolute inset-0 z-0" />
        <RowActions id={row.id} groupId={row.ambas_group_id} hrefAbrir={abrir} hrefPdf={hrefPdf()} />
      </td>
    </tr>
  );
}

// ─── Fila de grupo ──────────────────────────────────────────────────────────

function FilaGrupo({ item, params, abierto }: { item: GrupoItem; params: DashboardParams; abierto: boolean }) {
  const { grupo } = item;
  const v = grupo.vigente;
  const resumen = filaResumenGrupo(grupo, params.sort);

  return (
    <tr className="border-b border-[var(--franco-border-hover)] bg-[var(--franco-sunken,var(--franco-bg))]">
      <td colSpan={4} className="h-11 px-2.5 align-middle">
        <EnlaceCarga href={toggleGrupoHref(params, grupo.key)} aria-expanded={abierto} className="flex min-w-0 items-center gap-2.5 no-underline">
          <Chevron abierto={abierto} />
          <span className="truncate text-[13.5px] font-semibold text-[var(--franco-text)]">{displayDireccion(v)}</span>
          <span className="shrink-0 rounded bg-[color-mix(in_srgb,var(--franco-text)_8%,transparent)] px-1.5 py-0.5 text-[12px] font-semibold text-[var(--franco-text)]">
            {grupo.hijos.length} análisis
          </span>
          <span className="truncate text-[12.5px] text-[var(--franco-text-muted)]">
            {v.comuna} · mejor {grupo.mejorScore}
            {grupo.tipologiasDistintas > 1 && ` · ${grupo.tipologiasDistintas} tipologías`}
          </span>
        </EnlaceCarga>
      </td>
      <CeldasNumericas row={resumen} />
      <td />
    </tr>
  );
}

// ─── La lista ───────────────────────────────────────────────────────────────

export function Archive({ rows, items, siblings, total, hasMore, params, stats, unidadesVisibles, origenes = {} }: Props) {
  const { por_modalidad: mod, por_veredicto: ver, por_origen: orig } = stats;
  const filtrando = params.q !== "" || params.mod !== "todas" || params.v !== "todos" || params.origen !== "todos";
  const veredictos: Veredicto[] = ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"];
  const agrupado = params.group && items !== undefined;
  const vacio = agrupado ? items.length === 0 : rows.length === 0;

  // El `id` es real: los <EnlaceCarga> de los chips apuntan a #archivo para que filtrar deje la lista a la vista.
  return (
    <section id="archivo" aria-label="Tus informes" className="scroll-mt-20" data-casa="archivo">
      <div className="overflow-hidden rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)]">
        {/* ── La búsqueda y «Agrupar por propiedad»; debajo, los filtros (en el teléfono, de lado) ── */}
        <div className="border-b border-[var(--franco-border)] p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
            <ArchiveSearch params={params} />
            {/* Toggle de agrupación: <EnlaceCarga> con role de switch para que se anuncie como control de dos estados
                sin necesitar JavaScript. */}
            <EnlaceCarga
              href={buildHref(params, { group: !params.group, open: [] })}
              role="switch"
              aria-checked={params.group}
              className="ml-auto flex shrink-0 items-center gap-2 font-body text-[13px] text-[var(--franco-text-secondary)] no-underline"
            >
              <span
                className="relative h-[17px] w-[30px] shrink-0 rounded-full transition-colors"
                style={{ background: params.group ? "var(--franco-text)" : "color-mix(in srgb, var(--franco-text) 14%, transparent)" }}
                aria-hidden="true"
              >
                <span
                  className="absolute top-0.5 h-[13px] w-[13px] rounded-full transition-all"
                  style={params.group ? { right: 2, background: "var(--franco-bg)" } : { left: 2, background: "var(--franco-text-muted)" }}
                />
              </span>
              Agrupar por propiedad
            </EnlaceCarga>
          </div>

          <div
            className="-mx-3 mt-2.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
            data-archivo="filtros"
          >
            <Chip filtro="todas" href={buildHref(params, { mod: "todas" })} activo={params.mod === "todas"}>
              Todas<Conteo n={stats.total} />
            </Chip>
            <Chip filtro="larga" href={buildHref(params, { mod: "long-term" })} activo={params.mod === "long-term"}>
              Renta larga<Conteo n={mod.long_term} />
            </Chip>
            <Chip filtro="corta" href={buildHref(params, { mod: "short-term" })} activo={params.mod === "short-term"}>
              Renta corta<Conteo n={mod.short_term} />
            </Chip>
            <Chip filtro="ambas" href={buildHref(params, { mod: "ambas" })} activo={params.mod === "ambas"}>
              Ambas<Conteo n={mod.ambas} />
            </Chip>
            <Separador />
            <Chip filtro="de-franco" href={buildHref(params, { origen: params.origen === "franco" ? "todos" : "franco" })} activo={params.origen === "franco"}>
              {ARCHIVO_COPY.deFranco}<Conteo n={orig.franco} />
            </Chip>
            <Chip filtro="mios" href={buildHref(params, { origen: params.origen === "mios" ? "todos" : "mios" })} activo={params.origen === "mios"}>
              {ARCHIVO_COPY.mios}<Conteo n={orig.mios} />
            </Chip>
            <Separador />
            {veredictos.map((v) => (
              <Chip
                key={v}
                filtro={v}
                href={buildHref(params, { v: params.v === v ? "todos" : v })}
                activo={params.v === v}
                rojo={v === "BUSCAR OTRA"}
              >
                {etiquetaVeredicto(v)}
                <Conteo n={ver[v] ?? 0} />
              </Chip>
            ))}
          </div>
        </div>

        {vacio ? (
          <div className="px-5 py-14 text-center">
            <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">Ningún análisis coincide con este filtro.</p>
            {filtrando && (
              <EnlaceCarga
                href={buildHref(params, { q: "", mod: "todas", v: "todos", origen: "todos" })}
                className="mt-3 inline-block text-[12.5px] text-[var(--franco-text)] underline underline-offset-4"
              >
                Limpiar filtros
              </EnlaceCarga>
            )}
          </div>
        ) : (
          <>
            {/* ── Desde 768: la tabla ── */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full table-fixed border-collapse">
                <caption className="sr-only">Tus informes</caption>
                <colgroup>
                  <col style={{ width: "33%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "4%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <Th label="Nombre" />
                    <Th label="Comuna" />
                    <Th label="Modalidad" />
                    <Th label="Veredicto" />
                    <Th label="Puntaje" num />
                    <Th label="Flujo" num />
                    <Th label="Fecha" num />
                    <th scope="col" className="border-b border-[var(--franco-border-hover)] bg-[var(--franco-sunken,var(--franco-bg))]">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* flatMap y no map: un grupo abierto emite su fila MÁS las de sus hijos, y <tbody> solo acepta <tr>. */}
                  {agrupado
                    ? items.flatMap((item) => {
                        if (item.kind === "fila") {
                          return [<FilaAnalisis key={item.row.id} row={item.row} siblings={siblings} origen={origenes[item.row.id] ?? null} />];
                        }
                        const { grupo } = item;
                        const abierto = grupoAbierto(params, grupo.key);
                        const filas = [<FilaGrupo key={grupo.key} item={item} params={params} abierto={abierto} />];
                        if (abierto) {
                          // Un grupo puede tener decenas de análisis: se muestran los más recientes y el resto queda a un click.
                          const todos = grupoMuestraTodos(params, grupo.key);
                          const visibles = todos ? grupo.hijos : grupo.hijos.slice(0, HIJOS_VISIBLES);
                          for (const hijo of visibles) {
                            filas.push(
                              <FilaAnalisis
                                key={hijo.id}
                                row={hijo}
                                siblings={siblings}
                                origen={origenes[hijo.id] ?? null}
                                hijo
                                mostrarPrecio={grupo.preciosDistintos}
                                vigente={hijo.id === grupo.vigente.id}
                              />,
                            );
                          }
                          const restantes = grupo.hijos.length - visibles.length;
                          if (restantes > 0) {
                            filas.push(
                              <tr key={`${grupo.key}-mas`} className="border-b border-[var(--franco-border)] bg-[color-mix(in_srgb,var(--franco-text)_2%,transparent)]">
                                <td colSpan={8} className="h-9 pl-9 align-middle">
                                  <EnlaceCarga href={verTodosHref(params, grupo.key)} className="text-[12.5px] text-[var(--franco-text-secondary)] no-underline hover:text-[var(--franco-text)]">
                                    Ver los {restantes} análisis restantes ↓
                                  </EnlaceCarga>
                                </td>
                              </tr>,
                            );
                          }
                        }
                        return filas;
                      })
                    : rows.map((row) => <FilaAnalisis key={row.id} row={row} siblings={siblings} origen={origenes[row.id] ?? null} />)}
                </tbody>
              </table>
            </div>

            {/* ── En el teléfono: tarjetas de UNA línea —nombre, veredicto, flujo y fecha—. El veredicto va entero, con la
                tríada, un punto más chico; y el «···» sin borde: así el nombre de un informe con la marca «Franco» se lee. En agrupado, el padre es una
                línea con su chevron y cuántos análisis tiene, y sus hijas aparecen debajo al expandir. ── */}
            <ul className="md:hidden" data-archivo="lista-telefono">
              {(agrupado ? aplanarParaMobile(items, params) : rows.map((row): ItemMobile => ({ row })))
                .map(({ row, grupo, esHija, mostrarPrecio }, idx) => {
                  const str = row.ambas_group_id ? siblings.get(row.ambas_group_id) : undefined;
                  const flujo = Number(row.flujo);
                  const abrir = hrefAnalisis(row, str?.id);
                  const esGrupo = grupo?.kind === "grupo";
                  const n = esGrupo ? grupo.grupo.hijos.length : 0;
                  const abierto = esGrupo ? grupoAbierto(params, grupo.grupo.key) : false;

                  return (
                    <li
                      key={`${row.id}-${esHija ? "h" : "p"}-${idx}`}
                      className={`relative flex min-h-[48px] items-center gap-1 [&_.chip-v]:px-1.5 [&_.chip-v]:text-[11.5px] [&_[data-archivo=franco]]:px-1 [&_[data-archivo=franco]]:text-[10.5px] border-b border-[var(--franco-border)] px-3 py-2 last:border-b-0 ${
                        esHija ? "pl-7 bg-[color-mix(in_srgb,var(--franco-text)_2%,transparent)]" : ""
                      }`}
                      data-archivo="tarjeta"
                    >
                      {/* El padre no navega al análisis: expande. */}
                      {esGrupo ? (
                        <EnlaceCarga href={toggleGrupoHref(params, grupo.grupo.key)} aria-expanded={abierto} className="absolute inset-0 z-0" aria-label={`${displayDireccion(row)}, ${n} análisis`} />
                      ) : (
                        <EnlaceCarga href={abrir} aria-label={displayDireccion(row)} className="absolute inset-0 z-0" />
                      )}

                      {esGrupo && <Chevron abierto={abierto} />}

                      <span className="flex min-w-0 flex-1 items-center gap-1">
                        <span className="truncate text-[14px] font-semibold text-[var(--franco-text)]">
                          {esHija ? (mostrarPrecio ? fmtUF(Number(row.precio)) : modalidadLabel(row) === "CORTA" ? "Renta corta" : modalidadLabel(row) === "AMBAS" ? "Ambas" : "Renta larga") : displayDireccion(row)}
                        </span>
                        {esGrupo ? (
                          <span className="shrink-0 text-[12px] text-[var(--franco-text-muted)]">{n} análisis</span>
                        ) : (
                          <MarcaFranco row={row} origen={origenes[row.id] ?? null} />
                        )}
                      </span>

                      {!esGrupo && <ChipVeredicto v={veredictoDisplay(row)} />}
                      <span className="shrink-0 text-[12.5px] font-medium tabular-nums" style={{ color: flujo < 0 ? "var(--signal-red)" : "var(--franco-text)" }}>
                        {fmtCLPSigned(flujo)}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-[var(--franco-text-muted)]">{fmtFechaCorta(row.created_at)}</span>

                      {/* El padre no tiene acciones propias: no es un análisis. */}
                      {!esGrupo && (
                        <RowActions id={row.id} groupId={row.ambas_group_id} hrefAbrir={abrir} hrefPdf={hrefPdf()} variant="menu" />
                      )}
                    </li>
                  );
                })}
            </ul>

            {/* ── Pie ── */}
            <div className="flex items-center justify-between gap-3 border-t border-[var(--franco-border)] px-3.5 py-2.5">
              <span className="text-[12.5px] text-[var(--franco-text-muted)]">
                {agrupado
                  ? `Mostrando ${items.length} propiedades · ${unidadesVisibles} de ${total}`
                  : `Mostrando ${rows.length} de ${total}`}
                {filtrando ? " que coinciden" : ""}
              </span>
              {hasMore && (
                <EnlaceCarga
                  href={buildHref(params, { page: params.page + 1 })}
                  className="rounded-[7px] border border-[var(--franco-border-hover)] px-3.5 py-1.5 text-[12.5px] text-[var(--franco-text)] no-underline hover:border-[var(--franco-border-strong)]"
                >
                  Cargar {PAGE_SIZE} más ↓
                </EnlaceCarga>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
