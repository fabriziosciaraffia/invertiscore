"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL PERFIL DE BÚSQUEDA DEL DASHBOARD (24-oct-2026, mockup docs/puerta-b-mockups/3b-dashboard.html, decisión de
// Fabrizio): una fila plegada —«Tu perfil de búsqueda», la etiqueta «2 preguntas pendientes» mientras falten, la línea
// corta del perfil— que se abre en «¿Qué buscas?»: la frase del perfil con «Editar» (al tocarlo se despliegan los mismos
// tres campos de /deptos, CamposBusqueda, más Pie y Plazo, y «+ agregar otra comuna»); después, en rojo, las dos
// preguntas pendientes («¿Cómo lo arriendas?» y «¿Cuándo piensas comprar?», solo a quien entró por /deptos o por
// invitación: lib/casa/reglas.ts › preguntasPendientes) con la regla de la frecuencia; «Guardar» y «Tu próxima selección
// se arma con esto.». Todo se guarda junto, con «Guardar» (PUT /api/perfil-busqueda), y la página se vuelve a pedir
// para que la selección diga lo nuevo. Sistema de /deptos: Inter, píldoras, el rojo solo en lo pendiente y el error.
// AL GUARDAR (24-oct-2026, recorrido de Fabrizio): los campos y las preguntas se pliegan, la fila vuelve a su línea con el
// resumen completo («Providencia · 2D · UF 4.000 a 6.000 · 20 % · 25 años · Arriendo tradicional · Quiero comprar ya»), la
// etiqueta de las pendientes se va y «Guardado.» se ve dos segundos en la fila. «Guardar» solo está a la vista cuando hay
// algo que guardar. Al abrir de nuevo: la frase con «Editar» y las preguntas ya contestadas, editables.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import "./casa.css";
import "@/app/deptos/deptos.css";
import { botonOcupado } from "@/lib/carga-global";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import type { Horizonte, Modalidad } from "@/lib/perfil-busqueda";
import { ajusteDeParametro, SEMANAL_VACIO } from "@/lib/guia/semanal";
import { etiquetaPendientes, type PreguntaPendiente } from "@/lib/casa/reglas";
import { CASA, frasePerfil, lineaCorta } from "./casa-copy";
import { lista, RANGOS_UF, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";
import { CamposBusqueda, type CampoBusqueda, type ValorBusqueda } from "@/components/deptos/CamposBusqueda";

const UI = "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif";
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export const RUTA_SUELTO = "/checkout?product=single";
export const RUTA_NUEVO = "/analisis/nuevo-v4";

/** El pie y el plazo que ofrece el perfil (los mismos del pop-up de la selección). */
const PIES = [10, 15, 20, 25, 30, 40, 50];
const PLAZOS = [15, 20, 25, 30];

export interface PerfilEditable {
  dormitorios: number[];
  comunas: string[];
  precioMaxUf: number | null;
  /** El piso elegido en /deptos (16-oct-2026): con él, el precio es un rango. */
  precioMinUf?: number | null;
  modalidad: Modalidad;
  piePct: number | null;
  plazoAnios: number | null;
  horizonte: Horizonte | null;
}

const RANGO_ACTUAL = "actual";

/**
 * LOS TRES CAMPOS DEL PERFIL (23-oct-2026, mockups `1b-deptos.html` y `3b-dashboard.html`): la comuna, la tipología y el
 * rango se editan con los mismos <select> de /deptos (CamposBusqueda, con más de una comuna). Lo que el perfil tiene y no
 * es una de las opciones —dormitorios de varios informes («1 y 2 dormitorios»), un tope sin piso («Hasta UF 4.500»)— se
 * muestra como la opción actual, y al elegir otra se guarda la de la lista.
 */
export function valorDePerfil(p: Pick<PerfilEditable, "comunas" | "dormitorios" | "precioMinUf" | "precioMaxUf">): { valor: ValorBusqueda; tipologiaExtra: string | null; rangoExtra: { id: string; chip: string } | null } {
  const dorms = [...p.dormitorios].sort((a, b) => a - b);
  const t = TIPOLOGIAS_DEPTOS.find((x) => x.dorms.length === dorms.length && x.dorms.every((d, i) => d === dorms[i]));
  const tipologiaExtra = t ? null : dorms.length === 0 ? CASA.perfil.sinTipologia : CASA.perfil.varias(dorms);
  const r = p.precioMaxUf != null ? RANGOS_UF.find((x) => x.max === p.precioMaxUf && (x.min ?? null) === (p.precioMinUf ?? null)) : undefined;
  const rangoExtra = r ? null : { id: RANGO_ACTUAL, chip: p.precioMaxUf == null ? CASA.perfil.sinTope : p.precioMinUf != null ? CASA.perfil.rango(miles(p.precioMinUf), miles(p.precioMaxUf)) : CASA.perfil.tope(miles(p.precioMaxUf)) };
  return { valor: { comunas: p.comunas, tipologia: t?.id ?? "", rango: r?.id ?? RANGO_ACTUAL }, tipologiaExtra, rangoExtra };
}

/** «Providencia · 2 dormitorios · UF 3.000 a 4.000 · Pie 20 % · 25 años» (la frase) y «Providencia · 2D · UF 3.000 a
 *  4.000 · 20 % · 25 años» (la línea corta de la fila plegada). */
export function textosDelPerfil(p: PerfilEditable): { frase: string; corta: string } {
  const c = valorDePerfil(p);
  const t = TIPOLOGIAS_DEPTOS.find((x) => x.id === c.valor.tipologia);
  const r = RANGOS_UF.find((x) => x.id === c.valor.rango);
  const rango = r?.chip ?? c.rangoExtra?.chip ?? null;
  const linea = [lista(p.comunas), t?.nombre ?? c.tipologiaExtra, rango].filter(Boolean).join(" · ");
  return {
    frase: frasePerfil({ linea, piePct: p.piePct, plazoAnios: p.plazoAnios }),
    corta: lineaCorta({ comunas: p.comunas, dormitorios: p.dormitorios, rango, piePct: p.piePct, plazoAnios: p.plazoAnios }),
  };
}

/** Cuánto se ve «Guardado.» en la fila del perfil. */
export const GUARDADO_VISIBLE_MS = 2000;

/** La fila cerrada del perfil: «Providencia · 2D · UF 4.000 a 6.000 · 20 % · 25 años · Arriendo tradicional · Quiero
 *  comprar ya». Cómo lo arrienda y cuándo piensa comprar, solo si ya lo dijo (`dichas`). */
export function resumenDeFila(p: PerfilEditable, dichas: { modalidad: boolean; cuando: boolean }): string {
  return [
    textosDelPerfil(p).corta,
    dichas.modalidad && p.modalidad ? CASA.perfil.modalidad[p.modalidad] : null,
    dichas.cuando && p.horizonte ? CASA.perfil.horizonte[p.horizonte] : null,
  ].filter(Boolean).join(" · ");
}

/** Lo que se manda al PUT: solo lo que cambió respecto de lo que había. `contestadas`: las preguntas pendientes que la
 *  persona contestó en esta pantalla; su respuesta va aunque coincida con lo inferido (la cuenta nace con la modalidad
 *  sin contestar y el perfil la supone renta larga: elegir «Arriendo tradicional» tiene que quedar escrito). */
export function cambiosDelPerfil(antes: PerfilEditable, ahora: PerfilEditable, contestadas: PreguntaPendiente[] = []): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if (antes.comunas.join("|") !== ahora.comunas.join("|") && ahora.comunas.length > 0) c.comunas = ahora.comunas;
  if (antes.dormitorios.join() !== ahora.dormitorios.join() && ahora.dormitorios.length > 0) c.dormitorios = ahora.dormitorios;
  if (antes.precioMaxUf !== ahora.precioMaxUf || (antes.precioMinUf ?? null) !== (ahora.precioMinUf ?? null)) { c.precioMaxUf = ahora.precioMaxUf; c.precioMinUf = ahora.precioMinUf ?? null; }
  if (antes.piePct !== ahora.piePct && ahora.piePct != null) c.piePct = ahora.piePct;
  if (antes.plazoAnios !== ahora.plazoAnios && ahora.plazoAnios != null) c.plazoAnios = ahora.plazoAnios;
  if (antes.modalidad !== ahora.modalidad || contestadas.includes("modalidad")) c.modalidad = ahora.modalidad;
  if ((antes.horizonte !== ahora.horizonte || contestadas.includes("cuando")) && ahora.horizonte != null) c.horizonte = ahora.horizonte;
  return c;
}

async function guardar(cambios: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambios) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Una fila plegada del dashboard (<details>): el título, la etiqueta roja, la línea de abajo y el chevron. Con
 *  `controlada`, quien la monta decide si está abierta (el perfil la pliega al guardar). `aviso`: una nota en la fila. */
export function FilaPlegada({ id, titulo, n, etiqueta, sub, abierta = false, children, marca, controlada, aviso }: {
  id: string; titulo: string; n?: number | null; etiqueta?: string | null; sub?: string | null; abierta?: boolean; children: ReactNode; marca: string;
  controlada?: { abierta: boolean; alCambiar: (abierta: boolean) => void };
  aviso?: string | null;
}) {
  return (
    <details id={id} className="ca-plegada" open={controlada ? controlada.abierta : abierta || undefined} onToggle={controlada ? (e) => controlada.alCambiar(e.currentTarget.open) : undefined} data-casa={marca} style={{ scrollMarginTop: 80 }}>
      <summary>
        <span>
          <span className="ca-plegada-t">
            {titulo}
            {n != null && <span className="ca-plegada-n">{n}</span>}
            {etiqueta && <span className="ca-etiqueta-roja" data-casa="pendientes-etiqueta">{etiqueta}</span>}
            {aviso && <span className="ca-plegada-aviso" role="status" data-casa="guardado">{aviso}</span>}
          </span>
          {sub && <span className="ca-plegada-s">{sub}</span>}
        </span>
        <span className="ca-chevron" aria-hidden="true">▾</span>
      </summary>
      {children}
    </details>
  );
}

/** Abre la fila plegada que nombra el ancla de la dirección (`/dashboard#perfil`, el «Editar» de «Estás dentro»). */
export function AbrirPorAncla() {
  useEffect(() => {
    const abrir = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (!id) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) { el.open = true; el.scrollIntoView({ block: "start" }); }
    };
    abrir();
    window.addEventListener("hashchange", abrir);
    return () => window.removeEventListener("hashchange", abrir);
  }, []);
  return null;
}

export function PerfilBusquedaCasa({ inicial, pendientes, modalidadRespondida }: {
  inicial: PerfilEditable;
  /** Las preguntas que faltan (lib/casa/reglas.ts): vacío para quien entró con su informe. */
  pendientes: PreguntaPendiente[];
  /** Si ya contestó «¿Cómo lo arriendas?» (lo editado a mano): con la respuesta, la pregunta se ve contestada. */
  modalidadRespondida: boolean;
}) {
  const router = useRouter();
  const [base, setBase] = useState<PerfilEditable>(inicial);
  const [p, setP] = useState<PerfilEditable>(inicial);
  const [editando, setEditando] = useState(false);
  const [estado, setEstado] = useState<"quieto" | "guardando" | "guardado" | "error">("quieto");
  const [respondida, setRespondida] = useState<{ modalidad: boolean; cuando: boolean }>({ modalidad: modalidadRespondida, cuando: inicial.horizonte != null });
  // Las contestadas que ya se guardaron: después de «Guardar» no cuentan como cambio (hasta que el servidor vuelva a dibujar).
  const [enviadas, setEnviadas] = useState<PreguntaPendiente[]>([]);
  // La fila, controlada: se pliega al guardar. «Guardado.» se ve dos segundos en la fila y se va.
  const [abierta, setAbierta] = useState(false);
  const [vistoGuardado, setVistoGuardado] = useState(false);
  const reloj = useRef<number | null>(null);
  useEffect(() => () => { if (reloj.current) window.clearTimeout(reloj.current); }, []);
  // Lo ya guardado de las dos preguntas (lo que la fila dice cerrada): no lo que se está eligiendo.
  const guardadas = { modalidad: modalidadRespondida || enviadas.includes("modalidad"), cuando: inicial.horizonte != null || enviadas.includes("cuando") };
  // Las pendientes de verdad: las que la cuenta debe y todavía no eligió en esta pantalla.
  const faltan = pendientes.filter((q) => (q === "modalidad" ? !respondida.modalidad : !respondida.cuando));
  // Las que contestó acá (pendientes al entrar y ya elegidas): van al PUT aunque coincidan con lo inferido.
  const contestadas = pendientes.filter((q) => !faltan.includes(q) && !enviadas.includes(q) && (q === "modalidad" ? !modalidadRespondida : inicial.horizonte == null));
  const cambios = cambiosDelPerfil(base, p, contestadas);
  const hayCambios = Object.keys(cambios).length > 0;

  const campos = valorDePerfil(p);
  const cambiarCampo = (campo: CampoBusqueda, v: ValorBusqueda) => {
    if (campo === "comuna") { setP((x) => ({ ...x, comunas: v.comunas })); return; }
    if (campo === "tipologia") { const t = TIPOLOGIAS_DEPTOS.find((x) => x.id === v.tipologia); if (t) setP((x) => ({ ...x, dormitorios: [...t.dorms] })); return; }
    const r = RANGOS_UF.find((x) => x.id === v.rango);
    if (r) setP((x) => ({ ...x, precioMinUf: r.min, precioMaxUf: r.max }));
  };
  const pies = p.piePct != null && !PIES.includes(p.piePct) ? [...PIES, p.piePct].sort((a, b) => a - b) : PIES;
  const plazos = p.plazoAnios != null && !PLAZOS.includes(p.plazoAnios) ? [...PLAZOS, p.plazoAnios].sort((a, b) => a - b) : PLAZOS;

  async function guardarTodo() {
    if (!hayCambios || estado === "guardando") return;
    setEstado("guardando");
    const ok = await guardar(cambios);
    if (!ok) { setEstado("error"); return; }
    setBase(p);
    setEnviadas((xs) => Array.from(new Set([...xs, ...contestadas])));
    setEditando(false);
    setEstado("guardado");
    setAbierta(false);
    setVistoGuardado(true);
    if (reloj.current) window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => setVistoGuardado(false), GUARDADO_VISIBLE_MS);
    // La selección de arriba y la línea del perfil se dibujan en el servidor: se piden de nuevo.
    router.refresh();
  }

  // El ajuste en un toque del correo vacío (20-oct-2026): llega con `?ajuste=` ya guardado; acá se dice qué cambió.
  const [ajusteHecho, setAjusteHecho] = useState<string | null>(null);
  useEffect(() => {
    try {
      const a = ajusteDeParametro(new URLSearchParams(window.location.search).get("ajuste"), new Set(COMUNAS_DISPONIBLES as readonly string[]));
      if (a) setAjusteHecho(a.tipo === "pie" ? `tu pie quedó en ${a.pie} %` : `${a.comuna} quedó en tu búsqueda`);
    } catch {
      /* sin ventana */
    }
  }, []);

  const textos = textosDelPerfil(p);
  // La etiqueta de la fila cuenta lo GUARDADO: elegir una respuesta sin guardar no la saca.
  const etiqueta = etiquetaPendientes(pendientes.filter((q) => !guardadas[q === "modalidad" ? "modalidad" : "cuando"]).length);
  const resumen = resumenDeFila(base, { modalidad: !pendientes.includes("modalidad") || guardadas.modalidad, cuando: guardadas.cuando });
  // «Guardar» y su línea, solo con algo que guardar (o mientras guarda, o si falló).
  const conGuardar = hayCambios || estado === "guardando" || estado === "error";
  return (
    <FilaPlegada id="perfil" titulo={CASA.perfil.titulo} etiqueta={etiqueta} sub={resumen} marca="perfil" controlada={{ abierta, alCambiar: setAbierta }} aviso={vistoGuardado ? CASA.perfil.guardado : null}>
      <div className="ca-plegada-cuerpo" style={{ fontFamily: UI }} data-casa="perfil-abierto">
        {ajusteHecho && <p className="mb-3 text-[14px] font-semibold" role="status" data-casa="ajuste-hecho">{SEMANAL_VACIO.ajusteListo(ajusteHecho)}</p>}
        <h3 className="ca-perfil-h">{CASA.perfil.queBuscas}</h3>
        {!editando ? (
          <div className="ca-perfil-frase" data-casa="perfil-frase">
            <span>{textos.frase}</span>
            <button type="button" className="ca-perfil-editar" onClick={() => setEditando(true)} data-casa="editar">{CASA.perfil.editar}</button>
          </div>
        ) : (
          <div className="ca-perfil-campos" data-casa="campos">
            {/* Los tres campos de /deptos (23-oct-2026): la comuna (y las demás, con «+ agregar otra comuna»), la tipología y el
                rango, como <select>; más el pie y el plazo con los mismos campos. Se guardan todos con «Guardar». */}
            <CamposBusqueda multiple valor={campos.valor} tipologiaExtra={campos.tipologiaExtra} rangoExtra={campos.rangoExtra} onChange={cambiarCampo} ids="casa" />
            <div className="ca-perfil-grid">
              <label className="dp-campo" htmlFor="casa-pie">
                <span className="dp-etq">{CASA.perfil.pieEtiqueta}</span>
                <select id="casa-pie" className="dp-select" data-campo="pie" value={p.piePct ?? 20} onChange={(e) => { const v = Number(e.target.value); setP((x) => ({ ...x, piePct: v })); }}>
                  {pies.map((x) => <option key={x} value={x}>{pct(x)} %</option>)}
                </select>
              </label>
              <label className="dp-campo" htmlFor="casa-plazo">
                <span className="dp-etq">{CASA.perfil.plazoEtiqueta}</span>
                <select id="casa-plazo" className="dp-select" data-campo="plazo" value={p.plazoAnios ?? 25} onChange={(e) => { const v = Number(e.target.value); setP((x) => ({ ...x, plazoAnios: v })); }}>
                  {plazos.map((x) => <option key={x} value={x}>{CASA.perfil.plazo(x)}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}

        {/* LAS DOS PREGUNTAS (solo a quien entró por /deptos o por invitación; a quien entró con su informe ya se las sabemos). */}
        {pendientes.length > 0 && (
          <div className="ca-pendientes" data-casa="preguntas" data-pendientes={faltan.length}>
            {faltan.length > 0 && <p className="ca-pendientes-k" data-casa="pendientes-titulo">{faltan.length === 1 ? CASA.perfil.pendiente : CASA.perfil.pendientes}</p>}
            {pendientes.includes("modalidad") && (
              <div className="ca-pregunta" data-casa="pregunta-modalidad">
                <span className="ca-pregunta-q">{CASA.perfil.como}</span>
                <div className="ca-opciones">
                  {(["ltr", "str"] as const).map((m) => (
                    <button key={m} type="button" className="ca-opcion" aria-pressed={respondida.modalidad && p.modalidad === m} onClick={() => { setP((x) => ({ ...x, modalidad: m })); setRespondida((r) => ({ ...r, modalidad: true })); }}>
                      {CASA.perfil.modalidad[m]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {pendientes.includes("cuando") && (
              <div className="ca-pregunta" data-casa="pregunta-cuando">
                <span className="ca-pregunta-q">{CASA.perfil.cuando}</span>
                <div className="ca-opciones">
                  {(["ya", "meses", "mirando"] as const).map((h) => (
                    <button key={h} type="button" className="ca-opcion" aria-pressed={p.horizonte === h} onClick={() => { setP((x) => ({ ...x, horizonte: h })); setRespondida((r) => ({ ...r, cuando: true })); }}>
                      {CASA.perfil.horizonte[h]}
                    </button>
                  ))}
                </div>
                <p className="ca-nota" data-casa="nota-frecuencia">{CASA.perfil.nota}</p>
              </div>
            )}
          </div>
        )}

        {conGuardar && (
          <>
            <button type="button" className="ca-guardar" onClick={() => void guardarTodo()} disabled={!hayCambios || estado === "guardando"} {...botonOcupado(estado === "guardando")} data-casa="guardar">
              {estado === "guardando" ? CASA.perfil.guardando : CASA.perfil.guardar}
            </button>
            <p className="ca-proxima" data-casa="proxima">{CASA.perfil.proxima}</p>
          </>
        )}
        {estado === "error" && <p role="alert" className="ca-error">{CASA.perfil.error}</p>}
      </div>
    </FilaPlegada>
  );
}
