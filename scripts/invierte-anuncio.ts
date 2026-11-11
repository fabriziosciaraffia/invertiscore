// ─────────────────────────────────────────────────────────────────────────────
// EL ANUNCIO DE «INVIERTE CON FRANCO» A LA BASE (11-nov-2026, goal «Pronto: Invierte con Franco», punto 7).
//
// POR DEFECTO NO ENVÍA NADA: cuenta la audiencia (las cuentas activas que no se dieron de baja, src/lib/invierte/anuncio.ts),
// dice cuántas quedan fuera y por qué, y deja la vista previa del correo en el archivo que se le pida.
//
//   node --env-file=.env.local --import tsx scripts/invierte-anuncio.ts [--preview=<archivo.html>]
//
// ENVIAR requiere `--enviar` Y el OK explícito de Fabrizio (no se corre con `--enviar` sin él). Uno por cuenta: la llave de
// idempotencia de Resend es `invierte-anuncio-<user_id>`, así que relanzarlo no duplica. De a uno, con pausa (tope de Resend).
//
//   node --env-file=.env.local --import tsx scripts/invierte-anuncio.ts --enviar
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { audienciaAnuncio, urlBajaAnuncio, urlSeleccionAnuncio, type CuentaAnuncio } from "../src/lib/invierte/anuncio";
import { correoAnuncioInvierte } from "../src/lib/email/correos";
import { nombreReal } from "../src/lib/welcome";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const args = process.argv.slice(2);
const ENVIAR = args.includes("--enviar");
const PREVIEW = args.find((a) => a.startsWith("--preview="))?.slice("--preview=".length) ?? null;

async function todasLasCuentas(): Promise<CuentaAnuncio[]> {
  const out: CuentaAnuncio[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      out.push({ id: u.id, email: u.email ?? null, createdAt: u.created_at ?? null, lastSignInAt: u.last_sign_in_at ?? null, appMetadata: (u.app_metadata ?? null) as Record<string, unknown> | null, nombre: nombreReal(u.user_metadata) });
    }
    if (data.users.length < 1000) break;
  }
  return out;
}

async function idsDe(tabla: string, col: string, filtro?: (q: ReturnType<typeof sb.from>) => unknown): Promise<Set<string>> {
  const s = new Set<string>();
  for (let desde = 0; ; desde += 1000) {
    let q = sb.from(tabla).select(col).order(col).range(desde, desde + 999);
    if (filtro) q = filtro(q as unknown as ReturnType<typeof sb.from>) as typeof q;
    const { data, error } = await q;
    if (error) throw new Error(`${tabla}: ${error.message}`);
    for (const f of (data ?? []) as unknown as Array<Record<string, string>>) s.add(f[col]);
    if ((data ?? []).length < 1000) break;
  }
  return s;
}

async function tokenDe(userId: string): Promise<string | null> {
  const { data } = await sb.from("semanal_selecciones").select("token, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
  return (data?.[0]?.token as string | undefined) ?? null;
}

async function main() {
  const [cuentas, bajas, prueba] = await Promise.all([
    todasLasCuentas(),
    idsDe("perfil_busqueda", "user_id", (q) => (q as unknown as { not: (c: string, o: string, v: null) => unknown }).not("semanal_baja_at", "is", null)),
    idsDe("test_accounts", "user_id"),
  ]);
  const a = audienciaAnuncio(cuentas, { bajas, prueba });
  console.log(`Cuentas: ${cuentas.length}`);
  console.log(`Reciben el anuncio: ${a.van.length}`);
  console.log(`Fuera — sin correo: ${a.fuera.sin_correo} · prueba: ${a.fuera.prueba} · eliminación pedida: ${a.fuera.eliminacion} · se dieron de baja: ${a.fuera.baja} · inactivas (90 días): ${a.fuera.inactiva}`);

  if (PREVIEW) {
    const c = correoAnuncioInvierte({ nombre: "Camila", urlSeleccion: urlSeleccionAnuncio(SITIO), urlBaja: urlBajaAnuncio(SITIO, "muestra") });
    writeFileSync(PREVIEW, c.html, "utf8");
    console.log(`Vista previa (asunto «${c.subject}») en ${PREVIEW}`);
  }
  if (!ENVIAR) {
    console.log("No se envió nada (falta --enviar).");
    return;
  }

  const { sendAnuncioInvierte } = await import("../src/lib/email");
  let ok = 0, fallo = 0;
  for (const c of a.van) {
    const r = await sendAnuncioInvierte(c.email!, { nombre: c.nombre, urlSeleccion: urlSeleccionAnuncio(SITIO), urlBaja: urlBajaAnuncio(SITIO, await tokenDe(c.id)) }, c.id);
    if (r.ok) ok++; else fallo++;
    await new Promise((res) => setTimeout(res, 600));
  }
  console.log(`Enviados: ${ok} · fallaron: ${fallo}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
