// ─────────────────────────────────────────────────────────────────────────────
// /registro (28-sep-2026 → 01-oct-2026): la entrada por código vive ahora en /entrar, con su copy por
// contexto (el de acá decía «este informe» aunque no hubiera informe). /registro sigue funcionando
// para los enlaces que ya apuntan acá (checkout, wizard, guía, retorno del pago, correos): redirige a
// /entrar con TODA su query (`next`, `ctx`), y /entrar valida el destino.
// ─────────────────────────────────────────────────────────────────────────────
import { redirect } from "next/navigation";
import { RUTA_ENTRAR } from "@/lib/entrar/entrada";

export default function RegistroPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v) && v[0] !== undefined) q.set(k, v[0]);
  }
  const s = q.toString();
  redirect(s ? `${RUTA_ENTRAR}?${s}` : RUTA_ENTRAR);
}
