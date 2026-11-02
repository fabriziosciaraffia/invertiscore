// ─────────────────────────────────────────────────────────────────────────────
// EL TOPE DE LAS FIRMAS (03-nov-2026, goal «los enlaces compartidos llevan una firma»): 60 por hora por SESIÓN y 60 por hora
// por IP, para que nadie las genere en serie (una firma destapa las cifras de un aviso en su enlace: firma-compartido.ts).
// La sesión es la cuenta si hay; sin cuenta, la cookie del dispositivo (dispositivo.ts); las dos y la IP van en hash, como en
// `regalos_alta`. Cada firma emitida deja una fila en `firmas_compartido` (migración 20261103_firmas_compartido) y el tope se
// cuenta sobre la última hora. Si el conteo falla, no se firma: el tope es la razón de ser de esto.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { firmarCompartido } from "./firma-compartido";

/** Las firmas que una sesión, o una IP, puede pedir en una hora. */
export const TOPE_FIRMAS_POR_HORA = 60;

/** Dónde se cuentan y se anotan (se inyecta para probar el tope sin base). */
export interface AlmacenFirmas {
  /** Las firmas de la última hora con esa sesión o esa IP (en hash). */
  contar(campo: "sesion_hash" | "ip_hash", valor: string, desde: Date): Promise<number>;
  anotar(fila: { aviso_id: string; sesion_hash: string | null; ip_hash: string | null; con_cuenta: boolean }): Promise<void>;
}

export function almacenFirmas(admin: SupabaseClient): AlmacenFirmas {
  return {
    async contar(campo, valor, desde) {
      const { count, error } = await admin.from("firmas_compartido").select("id", { count: "exact", head: true }).eq(campo, valor).gte("creada_at", desde.toISOString());
      if (error || count == null) throw new Error(`firmas_compartido: ${error?.message ?? "sin conteo"}`);
      return count;
    },
    async anotar(fila) {
      const { error } = await admin.from("firmas_compartido").insert(fila);
      if (error) throw new Error(`firmas_compartido: ${error.message}`);
    },
  };
}

/** La sesión en hash: la cuenta si hay; si no, el dispositivo (ya viene en hash de la huella del request). */
export const sesionDe = (userId: string | null, dispositivoHash: string | null): string | null =>
  userId ? createHash("sha256").update(`cuenta:${userId}`).digest("hex") : dispositivoHash;

/** ¿Esta sesión o esta IP ya pidieron sus firmas de la hora? */
export const topeAlcanzado = (c: { porSesion: number; porIp: number }): boolean => c.porSesion >= TOPE_FIRMAS_POR_HORA || c.porIp >= TOPE_FIRMAS_POR_HORA;

/**
 * LA FIRMA DE UN AVISO, con el tope: cuenta las de la última hora de esta sesión y de esta IP; si alguna llegó a 60, no
 * firma («tope»); si no, firma, la anota y la devuelve. Sin sesión ni IP no se puede contar: no firma.
 */
export async function emitirFirma(
  almacen: AlmacenFirmas,
  p: { avisoId: string; codigo: string | null; sesion: string | null; ip: string | null; conCuenta: boolean },
  ahora: Date = new Date(),
  firmar: (avisoId: string, codigo: string | null) => string | null = firmarCompartido,
): Promise<{ firma: string } | { error: "tope" | "sin-huella" | "sin-secreto" }> {
  if (!p.sesion && !p.ip) return { error: "sin-huella" };
  const desde = new Date(ahora.getTime() - 3600_000);
  const [porSesion, porIp] = await Promise.all([
    p.sesion ? almacen.contar("sesion_hash", p.sesion, desde) : Promise.resolve(0),
    p.ip ? almacen.contar("ip_hash", p.ip, desde) : Promise.resolve(0),
  ]);
  if (topeAlcanzado({ porSesion, porIp })) return { error: "tope" };
  const firma = firmar(p.avisoId, p.codigo);
  if (!firma) return { error: "sin-secreto" };
  await almacen.anotar({ aviso_id: p.avisoId, sesion_hash: p.sesion, ip_hash: p.ip, con_cuenta: p.conCuenta });
  return { firma };
}
