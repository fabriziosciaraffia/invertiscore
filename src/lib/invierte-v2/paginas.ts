// ─────────────────────────────────────────────────────────────────────────────
// LO COMÚN DE LAS PÁGINAS /invierte/… (etapa 1 de Invierte con Franco, 18-nov-2026): quién entra y con qué depto.
//   · Sin acceso (interruptor): 404, como si la página no existiera. Con el modo «todos», el contacto se abre sin sesión.
//   · Solo deptos usados: un nuevo de inmobiliaria o un aviso que no existe es 404 (su botón sigue llevando a Pronto).
//   · Dinámicas siempre: leen la sesión; nada de esto entra a un caché compartido.
// ─────────────────────────────────────────────────────────────────────────────
import type { Metadata } from "next";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { esOrigen, type OrigenInvierte } from "@/lib/invierte/invierte";
import { accesoInvierteV2 } from "./acceso-servidor";
import { deptoDeEntrada } from "./servidor";
import type { DeptoFlujo } from "@/components/invierte-v2/ContactoForm";

export const METADATA_FLUJO: Metadata = { title: "Invierte con Franco", robots: { index: false, follow: false } };

export async function sesionYAcceso(): Promise<{ user: User | null; acceso: boolean }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { user: user ?? null, acceso: await accesoInvierteV2(user ?? null) };
}

export async function deptoParaPagina(avisoId: string): Promise<DeptoFlujo | null> {
  const aviso = await deptoDeEntrada(createServiceClient(), decodeURIComponent(avisoId));
  if (!aviso) return null;
  const veredicto = aviso.veredicto === "COMPRAR" ? "COMPRAR" : aviso.veredicto === "AJUSTA SUPUESTOS" && aviso.negociable ? "AJUSTA SUPUESTOS" : null;
  return { avisoId: aviso.avisoId, linea: aviso.linea, precioUF: aviso.precioUF, veredicto, score: aviso.score };
}

export function origenDe(sp: Record<string, string | string[] | undefined>): OrigenInvierte {
  const d = sp.desde;
  return esOrigen(d) ? d : "explorar";
}

/** Adónde vuelve «Volver»: a la superficie de donde salió (el mapa con su depto, la selección o el informe), nunca a la página de
 *  respaldo del contacto. */
export function volverAlOrigen(avisoId: string, origen: OrigenInvierte, analysisId: string | null): string {
  if (origen === "explorar") return `/explorar?a=${encodeURIComponent(avisoId)}`;
  if (origen === "seleccion") return "/dashboard#seleccion";
  return analysisId ? `/analisis/${analysisId}` : "/dashboard";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function analysisDe(sp: Record<string, string | string[] | undefined>): string | null {
  const a = sp.a;
  return typeof a === "string" && UUID.test(a) ? a : null;
}
