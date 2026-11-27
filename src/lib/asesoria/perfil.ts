// ─────────────────────────────────────────────────────────────────────────────
// EL PERFIL DE LA ASESORÍA (27-nov-2026): lo que llega al crear la cuenta, validado, y la fila de `inv_perfiles` —el perfil declarado
// único (plan del 27-nov-2026, etapa 1)—. Se crea sin orden (preaprobado y comunas tienen defecto desde la migración
// 20261127_asesoria_e1). «No sé» en el objetivo va como «ambas» y el tipo queda «equilibrado». Puro. Tier ASESORIA.
// ─────────────────────────────────────────────────────────────────────────────
import { esAporte, type Aporte } from "./aporte";
import {
  capacidad, numerosValidos, objetivoDePerfil, tipoPerfil,
  type Capacidad, type Experiencia, type Numeros, type ObjetivoAsesoria, type TipoPerfil,
} from "./capacidad";
import type { Donde, Lupa, ModoDonde } from "./estado";

export interface PedidoPerfilAsesoria {
  experiencia: Experiencia;
  objetivo: ObjetivoAsesoria;
  numeros: Numeros;
  aporte: Aporte;
  donde: Donde;
  lupa: Lupa;
  /** «Avísame» de los nuevos (27-nov-2026). */
  interesNuevos: boolean;
}

const EXPERIENCIAS: readonly Experiencia[] = ["primera", "uno", "varios"];
const OBJETIVOS: readonly ObjetivoAsesoria[] = ["arriendo", "plusvalia", "ambas", "no_se"];
const MODOS: readonly ModoDonde[] = ["comunas", "metro", "rinde"];
const LUPAS: readonly Lupa[] = ["si", "no", "prefiero"];

export function validarPedidoPerfil(b: Record<string, unknown> | null | undefined): { ok: true; pedido: PedidoPerfilAsesoria } | { ok: false; error: string } {
  if (!b) return { ok: false, error: "vacio" };
  if (!EXPERIENCIAS.includes(b.experiencia as Experiencia)) return { ok: false, error: "experiencia" };
  if (!OBJETIVOS.includes(b.objetivo as ObjetivoAsesoria)) return { ok: false, error: "objetivo" };
  if (!numerosValidos(b.numeros as Partial<Record<keyof Numeros, unknown>>)) return { ok: false, error: "numeros" };
  if (!esAporte(b.aporte)) return { ok: false, error: "aporte" };
  if (!LUPAS.includes(b.lupa as Lupa)) return { ok: false, error: "lupa" };
  const d = b.donde as Partial<Donde> | null;
  if (!d || !MODOS.includes(d.modo as ModoDonde)) return { ok: false, error: "donde" };
  const comunas = Array.isArray(d.comunas) ? d.comunas.filter((c): c is string => typeof c === "string" && c.length > 0 && c.length <= 40).slice(0, 20) : [];
  if ((d.modo === "comunas" || d.modo === "rinde") && comunas.length === 0) return { ok: false, error: "comunas" };
  const n = b.numeros as Numeros;
  return {
    ok: true,
    pedido: {
      experiencia: b.experiencia as Experiencia, objetivo: b.objetivo as ObjetivoAsesoria,
      numeros: { renta: n.renta, tipoRenta: n.tipoRenta, edad: n.edad, pie: n.pie, deudas: n.deudas, preaprobado: n.preaprobado },
      aporte: b.aporte, donde: { modo: d.modo as ModoDonde, comunas }, lupa: b.lupa as Lupa, interesNuevos: b.interesNuevos === true,
    },
  };
}

/** El `donde` de inv_perfiles (su check: cerca, comuna, convenga). */
export const dondeDePerfil = (m: ModoDonde): "cerca" | "comuna" | "convenga" => (m === "comunas" ? "comuna" : m === "rinde" ? "convenga" : "cerca");

export interface PerfilCalculado { cap: Capacidad; tipo: TipoPerfil }

export function calcularPerfil(p: PedidoPerfilAsesoria, cfg: { tasaPct: number; uf: number }): PerfilCalculado {
  return { cap: capacidad(p.numeros, cfg), tipo: tipoPerfil(p.experiencia, p.objetivo) };
}

/** La fila de inv_perfiles. `existe`: si ya había perfil (de Invierte), no se le cambia el origen. */
export function filaPerfil(userId: string, p: PedidoPerfilAsesoria, c: PerfilCalculado, o: { esPrueba: boolean; existe: boolean; elegidos: string[] }): Record<string, unknown> {
  return {
    user_id: userId,
    ...(o.existe ? {} : { origen: "asesoria" }),
    objetivo: objetivoDePerfil(p.objetivo),
    experiencia: p.experiencia,
    tipo_perfil: c.tipo,
    comunas: p.donde.comunas,
    donde: dondeDePerfil(p.donde.modo),
    preaprobado: p.numeros.preaprobado,
    pie_tiene: c.cap.pieUF == null ? "parte" : "si",
    pie_uf: c.cap.pieUF,
    renta_liquida_clp: c.cap.rentaCLP,
    otras_cuotas_clp: c.cap.deudasCLP,
    no_dice_renta: false,
    tipo_renta: p.numeros.tipoRenta,
    rango_edad: c.cap.rangoEdad,
    plazo_anios: c.cap.plazo,
    aporte_mensual_clp: p.aporte,
    lupa: p.lupa === "prefiero" ? null : p.lupa === "si",
    tope_uf: c.cap.topeUF,
    // Los dos topes por separado y el camino del pie (27-nov-2026, migración 20261127_asesoria_dos_topes).
    camino: c.cap.camino,
    tope_renta_uf: c.cap.topeRentaUF,
    tope_pie_uf: c.cap.topePieUF,
    // «Avísame» de los nuevos: se guarda solo si lo tocó (un perfil rehecho sin tocarlo no borra un sí anterior).
    ...(p.interesNuevos ? { interes_nuevos: true, interes_nuevos_at: new Date().toISOString() } : {}),
    // «renta» como en Invierte: hubo renta (lo que limita queda en los supuestos). «solo_pie» es sin renta, y acá siempre la hay.
    tope_fuente: "renta",
    tope_supuestos: {
      fuente: "asesoria", version: 1, plazoAnios: c.cap.plazo, tasaPct: c.cap.tasaPct, rentaComputablePct: c.cap.rentaComputablePct,
      cargaMaxPct: c.cap.cargaMaxPct, piePct: 20, dividendoMaxPct: 25, limita: c.cap.limita, pieNoSabe: c.cap.pieUF == null,
    },
    elegidos: o.elegidos,
    es_prueba: o.esPrueba,
    updated_at: new Date().toISOString(),
  };
}
