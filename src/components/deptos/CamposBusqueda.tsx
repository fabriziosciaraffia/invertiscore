"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LOS TRES CAMPOS DE LA BÚSQUEDA (23-oct-2026, mockup `docs/puerta-b-mockups/1b-deptos.html`): Comuna, Tipología y Rango
// de precio, con nombre, como <select> nativos —el teléfono abre su rueda, sin buscador ni chips—. Los usa /deptos (la
// tarjeta «¿Qué buscas?», una comuna) y el perfil del dashboard (casa.tsx, `multiple`: la primera comuna en el select y
// las demás como chips, con «+ agregar otra comuna»). Solo presentación: quien lo monta guarda, y mientras guarda marca el
// campo con `ocupado` (el aro del estándar de carga, lib/carga-global.ts › chipOcupado).
// ─────────────────────────────────────────────────────────────────────────────
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { chipOcupado } from "@/lib/carga-global";
import { COMUNAS_DESTACADAS, DEPTOS_COPY, MAX_COMUNAS_PERFIL, RANGOS_UF, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";

export type CampoBusqueda = "comuna" | "tipologia" | "rango";
export interface ValorBusqueda { comunas: string[]; tipologia: string; rango: string }

const DESTACADAS = COMUNAS_DESTACADAS as readonly string[];
const RESTO = (COMUNAS_DISPONIBLES as readonly string[]).filter((c) => !DESTACADAS.includes(c)).slice().sort((a, b) => a.localeCompare(b, "es"));

export const CAMPOS_COPY = {
  masBuscadas: "Las más buscadas",
  todas: "Todas las comunas",
  agregarComuna: "+ agregar otra comuna",
  quitar: "Quitar",
} as const;

export function CamposBusqueda({ valor, onChange, campos = ["comuna", "tipologia", "rango"], multiple = false, ocupado = null, tipologiaExtra = null, rangoExtra = null, ids = "db" }: {
  valor: ValorBusqueda;
  /** Qué cambió y el valor entero ya cambiado. */
  onChange: (campo: CampoBusqueda, valor: ValorBusqueda) => void;
  /** Qué campos dibujar (la primera selección pide solo los que faltan). */
  campos?: CampoBusqueda[];
  /** El perfil del dashboard: más de una comuna. */
  multiple?: boolean;
  /** El campo que se está guardando (el aro). */
  ocupado?: CampoBusqueda | null;
  /** El perfil con dormitorios que no son una tipología de la lista («1D y 2D»): se muestra como opción actual. */
  tipologiaExtra?: string | null;
  /** El perfil con un rango que no es uno de los cuatro («Hasta UF 4.500»): se muestra como opción actual. */
  rangoExtra?: { id: string; chip: string } | null;
  /** El prefijo de los ids (dos montajes en la misma página no se pisan). */
  ids?: string;
}) {
  const comuna = valor.comunas[0] ?? "";
  const extras = valor.comunas.slice(1);
  const libres = (COMUNAS_DISPONIBLES as readonly string[]).filter((c) => !valor.comunas.includes(c));
  const cambiar = (campo: CampoBusqueda, v: Partial<ValorBusqueda>) => onChange(campo, { ...valor, ...v });
  return (
    <div className="dp-campos" data-campos="busqueda">
      {campos.includes("comuna") && (
        <div className="dp-campo-b">
          <label htmlFor={`${ids}-comuna`} className="dp-etq" {...chipOcupado(ocupado === "comuna")}>{DEPTOS_COPY.comuna}</label>
          <select id={`${ids}-comuna`} className="dp-select" data-campo="comuna" data-vacio={comuna ? undefined : "1"} value={comuna}
            onChange={(e) => { const c = e.target.value; if (c) cambiar("comuna", { comunas: [c, ...extras.filter((x) => x !== c)] }); }}>
            <option value="" disabled>{DEPTOS_COPY.eligeComuna}</option>
            <optgroup label={CAMPOS_COPY.masBuscadas}>
              {DESTACADAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
            <optgroup label={CAMPOS_COPY.todas}>
              {RESTO.map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          </select>
          {multiple && (extras.length > 0 || (comuna && valor.comunas.length < MAX_COMUNAS_PERFIL)) && (
            <div className="dp-extras" data-campo="comunas-extra">
              {extras.map((c) => (
                <button key={c} type="button" className="dp-extra" onClick={() => cambiar("comuna", { comunas: valor.comunas.filter((x) => x !== c) })} aria-label={`${CAMPOS_COPY.quitar} ${c}`}>
                  {c}<span aria-hidden="true">×</span>
                </button>
              ))}
              {comuna && valor.comunas.length < MAX_COMUNAS_PERFIL && libres.length > 0 && (
                <label className="dp-mas">
                  <span aria-hidden="true">{CAMPOS_COPY.agregarComuna}</span>
                  <select aria-label={CAMPOS_COPY.agregarComuna} className="dp-select-invisible" value="" onChange={(e) => { if (e.target.value) cambiar("comuna", { comunas: [...valor.comunas, e.target.value] }); }}>
                    <option value="" />
                    {libres.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>
      )}
      {(campos.includes("tipologia") || campos.includes("rango")) && (
        <div className="dp-dos">
          {campos.includes("tipologia") && (
            <div className="dp-campo-b">
              <label htmlFor={`${ids}-tipologia`} className="dp-etq" {...chipOcupado(ocupado === "tipologia")}>{DEPTOS_COPY.tipologia}</label>
              <select id={`${ids}-tipologia`} className="dp-select" data-campo="tipologia" value={valor.tipologia} onChange={(e) => cambiar("tipologia", { tipologia: e.target.value })}>
                {tipologiaExtra && <option value="">{tipologiaExtra}</option>}
                {TIPOLOGIAS_DEPTOS.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
          )}
          {campos.includes("rango") && (
            <div className="dp-campo-b">
              <label htmlFor={`${ids}-rango`} className="dp-etq" {...chipOcupado(ocupado === "rango")}>{DEPTOS_COPY.rango}</label>
              <select id={`${ids}-rango`} className="dp-select" data-campo="rango" value={valor.rango} onChange={(e) => cambiar("rango", { rango: e.target.value })}>
                {rangoExtra && <option value={rangoExtra.id}>{rangoExtra.chip}</option>}
                {RANGOS_UF.map((r) => <option key={r.id} value={r.id}>{r.chip}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
