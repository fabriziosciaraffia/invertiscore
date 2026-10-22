import { redirect } from "next/navigation";
import { hrefSeleccion } from "@/lib/guia/seleccion-casa";

// ─────────────────────────────────────────────────────────────────────────────
// /semanal (02-oct-2026): adonde llevaba el correo semanal. Desde el 21-oct-2026 (recorrido real de Fabrizio por la
// puerta B; decisión suya) hay UNA sola página para la selección: el dashboard, que la dibuja como tarjetas con el mismo
// componente (dashboard/seleccion-en-casa.tsx, la misma fuente: lib/guia/seleccion-pagina-servidor.ts). Esta ruta queda
// para los enlaces ya enviados y redirige ahí con el token y el depto; sin sesión, el dashboard la manda a entrar y vuelve.
// El clic del correo se sigue midiendo en /api/semanal/clic, que ya aterriza en el dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
const TOKEN = /^[0-9a-f]{20,80}$/i;

export default function SemanalPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const t = searchParams.t && TOKEN.test(searchParams.t) ? searchParams.t : null;
  redirect(hrefSeleccion(t, searchParams.a ?? null, searchParams.d === "1"));
}
