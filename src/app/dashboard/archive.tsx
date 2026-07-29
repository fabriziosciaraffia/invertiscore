/**
 * ARCHIVO — la pieza que resuelve el problema de escala.
 *
 * Desktop: tabla densa (filas de 40px) con búsqueda siempre visible, chips de
 * modalidad y veredicto con conteos reales, orden por columna y agrupación por
 * propiedad opcional. Mobile: la misma información como lista compacta.
 *
 * Todo el estado vive en la URL (`?q=&mod=&v=&sort=&dir=&page=&group=&open=`).
 * Los chips, los headers de columna y los chevrons de grupo son <Link>, así que
 * filtran, ordenan y expanden sin JavaScript; lo único que necesita cliente es
 * el input de búsqueda (debounce) y el borrado.
 *
 * Sin checkboxes ni barra flotante de comparar: murieron con el dashboard viejo.
 */

import Link from "next/link";
import type { AnalisisDashboardRow, DashboardStats, DashboardSortKey } from "@/lib/dashboard-query";
import type { Veredicto } from "@/lib/types";
import type { ItemArchivo } from "./agrupar";
import { filaResumenGrupo } from "./agrupar";
import {
  buildHref,
  displayDireccion,
  fmtCap,
  fmtCLPSigned,
  fmtFechaCorta,
  fmtUF,
  fmtMultiplicador,
  hrefAnalisis,
  hrefPdf,
  modalidadLabel,
  sinDireccion,
  sortHref,
  toggleGrupoHref,
  grupoAbierto,
  grupoMuestraTodos,
  verTodosHref,
  veredictoDisplay,
  PAGE_SIZE,
  type DashboardParams,
} from "./dashboard-helpers";
import { Chevron, ModChip, VerdictBadge, ZoneLabel, scoreColor } from "./dashboard-ui";
import { ArchiveSearch } from "./archive-search";
import { RowActions } from "./row-actions";

/** Hijos que se muestran al expandir un grupo antes de ofrecer «ver el resto». */
const HIJOS_VISIBLES = 8;

type GrupoItem = Extract<ItemArchivo, { kind: "grupo" }>;

/** Una entrada de la lista mobile: fila suelta, cabecera de grupo, o hija. */
interface ItemMobile {
  row: AnalisisDashboardRow;
  /** Presente solo en la cabecera de un grupo. */
  grupo?: GrupoItem;
  esHija?: boolean;
  mostrarPrecio?: boolean;
}

/**
 * Aplana los ítems agrupados a la lista lineal que consume mobile: cabecera de
 * grupo seguida de sus hijas cuando está expandido. Se hace acá y no inline
 * para que la lista tenga un tipo con nombre en vez de una unión anónima.
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
}

// ─── Chips ──────────────────────────────────────────────────────────────────

function Chip({ href, activo, children, rojo = false }: {
  href: string; activo: boolean; children: React.ReactNode; rojo?: boolean;
}) {
  const base = "whitespace-nowrap rounded-[7px] border px-2.5 py-1 font-body text-xs no-underline transition-colors";
  if (activo && rojo) {
    return (
      <Link
        href={href}
        className={`${base} font-medium`}
        style={{
          color: "var(--signal-red)",
          borderColor: "color-mix(in srgb, var(--signal-red) 40%, transparent)",
          background: "color-mix(in srgb, var(--signal-red) 6%, transparent)",
          borderWidth: 1.5,
        }}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} ${
        activo
          ? "border-[var(--franco-text)] bg-[var(--franco-text)] font-medium text-[var(--franco-bg)]"
          : "border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
      }`}
    >
      {children}
    </Link>
  );
}

function Conteo({ n }: { n: number }) {
  return <span className="ml-1.5 font-mono text-[10px] opacity-65">{n}</span>;
}

// ─── Header de columna ordenable ────────────────────────────────────────────

function Th({
  params, sortKey, label, num = false,
}: {
  params: DashboardParams; sortKey?: DashboardSortKey; label: string; num?: boolean;
}) {
  const activo = sortKey !== undefined && params.sort === sortKey;
  const cls = `border-b border-[var(--franco-border-hover)] bg-[var(--franco-sunken,var(--franco-bg))] px-2.5 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.09em] ${
    num ? "text-right" : "text-left"
  } ${activo ? "text-[var(--franco-text)]" : "text-[var(--franco-text-muted)]"}`;

  if (!sortKey) return <th scope="col" className={cls}>{label}</th>;
  return (
    <th scope="col" className={cls} aria-sort={activo ? (params.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={sortHref(params, sortKey)} className="whitespace-nowrap text-inherit no-underline hover:text-[var(--franco-text)]">
        {label}
        <span className={`ml-1 text-[8px] ${activo ? "" : "opacity-0"}`} aria-hidden="true">
          {activo && params.dir === "asc" ? "↑" : "↓"}
        </span>
      </Link>
    </th>
  );
}

// ─── Celdas numéricas compartidas ───────────────────────────────────────────

function CeldasNumericas({ row, atenuado = false }: { row: AnalisisDashboardRow; atenuado?: boolean }) {
  const flujo = Number(row.flujo);
  const dim = atenuado ? "text-[var(--franco-text-muted)]" : "text-[var(--franco-text)]";
  return (
    <>
      <td className="h-10 px-2.5 text-right align-middle">
        <span className="font-mono text-[13px] font-bold" style={{ color: scoreColor(row.score_efectivo) }}>
          {row.score_efectivo}
        </span>
      </td>
      <td
        className="h-10 whitespace-nowrap px-2.5 text-right align-middle font-mono text-xs font-medium"
        style={{ color: flujo < 0 ? "var(--signal-red)" : "var(--franco-text)" }}
      >
        {fmtCLPSigned(flujo)}
      </td>
      <td className={`h-10 px-2.5 text-right align-middle font-mono text-xs font-medium ${dim}`}>
        {fmtCap(row.cap_rate === null ? null : Number(row.cap_rate))}
      </td>
      <td className={`h-10 px-2.5 text-right align-middle font-mono text-xs font-medium ${dim}`}>
        {fmtMultiplicador(row.multiplicador === null ? null : Number(row.multiplicador))}
      </td>
      <td className="h-10 whitespace-nowrap px-2.5 text-right align-middle font-mono text-xs text-[var(--franco-text-muted)]">
        {fmtFechaCorta(row.created_at)}
      </td>
    </>
  );
}

// ─── Fila de análisis (suelta o hija de un grupo) ───────────────────────────

function FilaAnalisis({
  row, siblings, hijo = false, mostrarPrecio = false, vigente = false,
}: {
  row: AnalisisDashboardRow;
  siblings: Map<string, AnalisisDashboardRow>;
  hijo?: boolean;
  /** Solo true cuando el precio DIFIERE entre hermanas: ahí sí distingue. */
  mostrarPrecio?: boolean;
  vigente?: boolean;
}) {
  const str = row.ambas_group_id ? siblings.get(row.ambas_group_id) : undefined;
  const abrir = hrefAnalisis(row, str?.id);

  return (
    <tr
      className={`group relative border-b border-[var(--franco-border)] hover:bg-[var(--franco-elevated)] ${
        hijo ? "bg-[color-mix(in_srgb,var(--franco-text)_2%,transparent)]" : ""
      }`}
    >
      <td className={`h-10 truncate px-2.5 align-middle ${hijo ? "pl-9" : ""}`}>
        <span className="flex items-center gap-2">
          {hijo ? (
            <>
              <span
                className="h-px w-2.5 shrink-0 bg-[var(--franco-border-hover)]"
                aria-hidden="true"
              />
              {/* Sin etiqueta derivada: la hija comparte dirección con sus
                  hermanas, así que repetirla (o inventar un rótulo) es ruido.
                  Lo único que se muestra es el precio, y solo cuando difiere
                  entre hermanas — ahí sí es lo que las distingue. */}
              {mostrarPrecio && (
                <Link
                  href={abrir}
                  className="truncate font-mono text-xs text-[var(--franco-text-secondary)] no-underline"
                >
                  {fmtUF(Number(row.precio))}
                </Link>
              )}
              {vigente && (
                <span className="shrink-0 rounded border border-[var(--franco-border-hover)] px-1.5 py-px font-mono text-[8px] font-bold tracking-[0.06em] text-[var(--franco-text-muted)]">
                  VIGENTE
                </span>
              )}
            </>
          ) : (
            <>
              <Link
                href={abrir}
                className="truncate font-heading text-[13.5px] font-bold tracking-[-0.01em] text-[var(--franco-text)] no-underline"
              >
                {displayDireccion(row)}
              </Link>
              {sinDireccion(row) && (
                <span className="shrink-0 font-mono text-[8px] tracking-[0.05em] text-[var(--franco-text-muted)]">
                  SIN DIRECCIÓN
                </span>
              )}
            </>
          )}
        </span>
      </td>
      <td className="h-10 truncate px-2.5 align-middle font-body text-[13px] text-[var(--franco-text-muted)]">
        {row.comuna}
      </td>
      <td className="h-10 px-2.5 align-middle"><ModChip label={modalidadLabel(row)} /></td>
      <td className="h-10 px-2.5 align-middle"><VerdictBadge verdict={veredictoDisplay(row)} mini /></td>
      <CeldasNumericas row={row} />
      <td className="h-10 px-2.5 align-middle">
        {/* Capa que hace clickeable TODA la fila. Va acá y no como ::after del
            link de la dirección: esa celda trunca (overflow hidden) y
            recortaría el overlay a su propio ancho. aria-hidden porque el link
            accesible es el de la primera celda. */}
        <Link href={abrir} aria-hidden="true" tabIndex={-1} className="absolute inset-0 z-0" />
        <RowActions id={row.id} groupId={row.ambas_group_id} hrefAbrir={abrir} hrefPdf={hrefPdf(row)} />
      </td>
    </tr>
  );
}

// ─── Fila de grupo ──────────────────────────────────────────────────────────

function FilaGrupo({
  item, params, abierto,
}: {
  item: Extract<ItemArchivo, { kind: "grupo" }>;
  params: DashboardParams;
  abierto: boolean;
}) {
  const { grupo } = item;
  const v = grupo.vigente;
  // En la columna por la que se ordena, el padre muestra el MEJOR valor del
  // grupo — es por ese valor que está en esa posición de la tabla.
  const resumen = filaResumenGrupo(grupo, params.sort);

  return (
    <tr className="border-b border-[var(--franco-border-hover)] bg-[var(--franco-sunken,var(--franco-bg))]">
      <td colSpan={4} className="h-11 px-2.5 align-middle">
        <Link
          href={toggleGrupoHref(params, grupo.key)}
          aria-expanded={abierto}
          className="flex min-w-0 items-center gap-2.5 no-underline"
        >
          <Chevron abierto={abierto} />
          <span className="truncate font-heading text-[13.5px] font-bold tracking-[-0.01em] text-[var(--franco-text)]">
            {displayDireccion(v)}
          </span>
          <span className="shrink-0 rounded bg-[color-mix(in_srgb,var(--franco-text)_8%,transparent)] px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.05em] text-[var(--franco-text)]">
            {grupo.hijos.length} análisis
          </span>
          {/* Comuna + mejor score (que es por lo que el grupo entra al orden) y,
              si las hijas no son la misma unidad, cuántas tipologías hay: el
              aviso de sobre-agrupación no se esconde, se ve antes de abrir. */}
          <span className="truncate font-mono text-[10px] tracking-[0.04em] text-[var(--franco-text-muted)]">
            {v.comuna} · mejor {grupo.mejorScore}
            {grupo.tipologiasDistintas > 1 && ` · ${grupo.tipologiasDistintas} tipologías`}
          </span>
        </Link>
      </td>
      <CeldasNumericas row={resumen} atenuado />
      <td />
    </tr>
  );
}

// ─── Archivo ────────────────────────────────────────────────────────────────

export function Archive({ rows, items, siblings, total, hasMore, params, stats, unidadesVisibles }: Props) {
  const { por_modalidad: mod, por_veredicto: ver } = stats;
  const filtrando = params.q !== "" || params.mod !== "todas" || params.v !== "todos";
  const veredictos: Veredicto[] = ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"];
  const agrupado = params.group && items !== undefined;
  const vacio = agrupado ? items.length === 0 : rows.length === 0;

  // El `id` es real: los <Link> de chips y headers apuntan a #archivo para que
  // filtrar u ordenar deje la tabla a la vista y no el tope de la página.
  return (
    <section id="archivo" aria-labelledby="archivo-label" className="scroll-mt-20">
      <ZoneLabel id="archivo-label">Archivo</ZoneLabel>

      <div className="overflow-hidden rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)]">
        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-[var(--franco-border)] p-3">
          <ArchiveSearch params={params} />

          <div className="flex flex-wrap gap-1.5">
            <Chip href={buildHref(params, { mod: "todas" })} activo={params.mod === "todas"}>
              Todas<Conteo n={stats.total} />
            </Chip>
            <Chip href={buildHref(params, { mod: "long-term" })} activo={params.mod === "long-term"}>
              Renta larga<Conteo n={mod.long_term} />
            </Chip>
            <Chip href={buildHref(params, { mod: "short-term" })} activo={params.mod === "short-term"}>
              Renta corta<Conteo n={mod.short_term} />
            </Chip>
            <Chip href={buildHref(params, { mod: "ambas" })} activo={params.mod === "ambas"}>
              Ambas<Conteo n={mod.ambas} />
            </Chip>
          </div>

          <span className="hidden h-5 w-px bg-[var(--franco-border)] sm:block" aria-hidden="true" />

          <div className="flex flex-wrap gap-1.5">
            {veredictos.map((v) => (
              <Chip
                key={v}
                href={buildHref(params, { v: params.v === v ? "todos" : v })}
                activo={params.v === v}
                rojo={v === "BUSCAR OTRA"}
              >
                {v === "COMPRAR" ? "Comprar" : v === "AJUSTA SUPUESTOS" ? "Ajusta supuestos" : "Buscar otra"}
                <Conteo n={ver[v] ?? 0} />
              </Chip>
            ))}
          </div>

          {/* Toggle de agrupación: <Link> con role de switch para que se anuncie
              como control de dos estados sin necesitar JavaScript. */}
          <Link
            href={buildHref(params, { group: !params.group, open: [] })}
            role="switch"
            aria-checked={params.group}
            className="ml-auto flex shrink-0 items-center gap-2 font-body text-xs text-[var(--franco-text-secondary)] no-underline"
          >
            <span
              className="relative h-[17px] w-[30px] shrink-0 rounded-full transition-colors"
              style={{ background: params.group ? "var(--franco-text)" : "color-mix(in srgb, var(--franco-text) 14%, transparent)" }}
              aria-hidden="true"
            >
              <span
                className="absolute top-0.5 h-[13px] w-[13px] rounded-full transition-all"
                style={
                  params.group
                    ? { right: 2, background: "var(--franco-bg)" }
                    : { left: 2, background: "var(--franco-text-muted)" }
                }
              />
            </span>
            Agrupar por propiedad
          </Link>
        </div>

        {vacio ? (
          <div className="px-5 py-14 text-center">
            <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">
              Ningún análisis coincide con este filtro.
            </p>
            {filtrando && (
              <Link
                href={buildHref(params, { q: "", mod: "todas", v: "todos" })}
                className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.08em] text-signal-red no-underline"
              >
                Limpiar filtros →
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* ── Desktop: tabla densa ── */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full table-fixed border-collapse">
                <caption className="sr-only">Archivo de análisis</caption>
                <colgroup>
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "7%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <Th params={params} label="Dirección" />
                    <Th params={params} label="Comuna" />
                    <Th params={params} label="Mod." />
                    <Th params={params} label="Veredicto" />
                    <Th params={params} sortKey="score" label="Score" num />
                    <Th params={params} sortKey="flujo" label="Flujo" num />
                    <Th params={params} sortKey="cap" label="Cap" num />
                    <Th params={params} sortKey="multiplicador" label="Retorno" num />
                    <Th params={params} sortKey="fecha" label="Fecha" num />
                    <th scope="col" className="border-b border-[var(--franco-border-hover)] bg-[var(--franco-sunken,var(--franco-bg))]">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* flatMap y no map: un grupo abierto emite su fila MÁS las de
                      sus hijos, y <tbody> solo acepta <tr> como hijos directos —
                      no se puede envolver el bloque en un fragmento con estilo. */}
                  {agrupado
                    ? items.flatMap((item) => {
                        if (item.kind === "fila") {
                          return [<FilaAnalisis key={item.row.id} row={item.row} siblings={siblings} />];
                        }
                        const { grupo } = item;
                        const abierto = grupoAbierto(params, grupo.key);
                        const filas = [
                          <FilaGrupo key={grupo.key} item={item} params={params} abierto={abierto} />,
                        ];
                        if (abierto) {
                          // Un grupo puede tener decenas de análisis (el mayor
                          // del set real tiene 67): expandirlo entero entierra
                          // el resto del archivo. Se muestran los más recientes
                          // y el resto queda a un click.
                          const todos = grupoMuestraTodos(params, grupo.key);
                          const visibles = todos ? grupo.hijos : grupo.hijos.slice(0, HIJOS_VISIBLES);
                          for (const hijo of visibles) {
                            filas.push(
                              <FilaAnalisis
                                key={hijo.id}
                                row={hijo}
                                siblings={siblings}
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
                                <td colSpan={10} className="h-9 pl-9 align-middle">
                                  <Link
                                    href={verTodosHref(params, grupo.key)}
                                    className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] no-underline hover:text-[var(--franco-text)]"
                                  >
                                    Ver los {restantes} análisis restantes ↓
                                  </Link>
                                </td>
                              </tr>,
                            );
                          }
                        }
                        return filas;
                      })
                    : rows.map((row) => <FilaAnalisis key={row.id} row={row} siblings={siblings} />)}
                </tbody>
              </table>
            </div>

            {/* ── Mobile: lista compacta ──
                En agrupado la lista replica la jerarquía del desktop: el padre
                es un item con contador y chevron, y sus hijas aparecen
                indentadas al expandir con su propio menú «···». Antes solo se
                veía la vigente y las hermanas eran inalcanzables desde el
                teléfono. */}
            <ul className="md:hidden">
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
                    className={`relative flex items-center gap-3 border-b border-[var(--franco-border)] px-3.5 py-3 last:border-b-0 ${
                      esHija ? "pl-8 bg-[color-mix(in_srgb,var(--franco-text)_2%,transparent)]" : ""
                    }`}
                  >
                    {/* El padre no navega al análisis: expande. */}
                    {esGrupo ? (
                      <Link href={toggleGrupoHref(params, grupo.grupo.key)} aria-expanded={abierto} className="absolute inset-0 z-0" aria-label={`${displayDireccion(row)}, ${n} análisis`} />
                    ) : (
                      <Link href={abrir} aria-hidden="true" tabIndex={-1} className="absolute inset-0 z-0" />
                    )}

                    {esGrupo && <Chevron abierto={abierto} />}

                    <div className="min-w-0 flex-1">
                      {esHija ? (
                        <div className="flex items-center gap-2">
                          {mostrarPrecio && (
                            <span className="font-mono text-xs text-[var(--franco-text-secondary)]">
                              {fmtUF(Number(row.precio))}
                            </span>
                          )}
                          <ModChip label={modalidadLabel(row)} />
                          <VerdictBadge verdict={veredictoDisplay(row)} mini />
                        </div>
                      ) : (
                        <>
                          <span className="relative z-10 block truncate font-heading text-sm font-bold text-[var(--franco-text)]">
                            {displayDireccion(row)}
                          </span>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="font-body text-[11px] text-[var(--franco-text-secondary)]">{row.comuna}</span>
                            {esGrupo ? (
                              <span className="rounded bg-[color-mix(in_srgb,var(--franco-text)_8%,transparent)] px-1.5 py-0.5 font-mono text-[8px] font-bold text-[var(--franco-text)]">
                                {n} ANÁLISIS
                              </span>
                            ) : (
                              <>
                                <ModChip label={modalidadLabel(row)} />
                                <VerdictBadge verdict={veredictoDisplay(row)} mini />
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <div
                        className="font-mono text-[13px] font-medium"
                        style={{ color: flujo < 0 ? "var(--signal-red)" : "var(--franco-text)" }}
                      >
                        {fmtCLPSigned(flujo)}
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase text-[var(--franco-text-muted)]">
                        {row.score_efectivo} · {fmtFechaCorta(row.created_at)}
                      </div>
                    </div>

                    {/* El padre no tiene acciones propias: no es un análisis. */}
                    {!esGrupo && (
                      <RowActions
                        id={row.id}
                        groupId={row.ambas_group_id}
                        hrefAbrir={abrir}
                        hrefPdf={hrefPdf(row)}
                        variant="menu"
                      />
                    )}
                  </li>
                );
              })}
            </ul>

            {/* ── Pie ── */}
            <div className="flex items-center justify-between gap-3 border-t border-[var(--franco-border)] px-3.5 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">
                {agrupado
                  ? `Mostrando ${items.length} propiedades · ${unidadesVisibles} de ${total}`
                  : `Mostrando ${rows.length} de ${total}`}
                {filtrando ? " que coinciden" : ""}
              </span>
              {hasMore && (
                <Link
                  href={buildHref(params, { page: params.page + 1 })}
                  className="rounded-[7px] border border-[var(--franco-border-hover)] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text)] no-underline hover:border-[var(--franco-border-strong)]"
                >
                  Cargar {PAGE_SIZE} más ↓
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
