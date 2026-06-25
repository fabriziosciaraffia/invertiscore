/**
 * Formatters compartidos del panel admin. Extraídos de src/app/admin/page.tsx
 * (eran locales no exportados) para reutilizarlos en las nuevas pantallas de la
 * mesa de operaciones (lista de usuarios, vista de usuario). Comportamiento
 * idéntico al original — no cambiar sin verificar el render del /admin actual.
 */

export function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

export function fmtNumber(n: number): string {
  return n.toLocaleString("es-CL");
}

export function fmtRelative(date: string | null | undefined): string {
  if (!date) return "—";
  const ms = Date.now() - new Date(date).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "hace minutos";
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export function fmtDateShort(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}
