"use client";

/**
 * Búsqueda del archivo. Siempre visible (el problema del dashboard viejo era no
 * tener ninguna).
 *
 * El estado vive en la URL, no en React: al tipear se hace `router.replace` con
 * `?q=` tras un debounce corto, y el Server Component re-consulta. Así la
 * búsqueda es compartible, sobrevive al back del browser y no obliga a traer
 * las 215 filas al cliente. El input es controlado y se re-sincroniza solo
 * cuando `?q=` cambia desde afuera (chip, stat, back del browser).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { buildHref, type DashboardParams } from "./dashboard-helpers";

export function ArchiveSearch({ params }: { params: DashboardParams }) {
  const router = useRouter();
  const [valor, setValor] = useState(params.q);
  const inputRef = useRef<HTMLInputElement>(null);
  const montado = useRef(false);

  // Sincroniza cuando el cambio vino de afuera (chip, stat, back del browser).
  useEffect(() => { setValor(params.q); }, [params.q]);

  useEffect(() => {
    if (!montado.current) { montado.current = true; return; }
    if (valor === params.q) return;
    const t = setTimeout(() => {
      router.replace(buildHref(params, { q: valor.trim() }), { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // `params` completo en deps re-dispararía en cada navegación; la búsqueda
    // solo depende de lo que el usuario tipeó.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  const limpiar = () => {
    setValor("");
    router.replace(buildHref(params, { q: "" }), { scroll: false });
    inputRef.current?.focus();
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border bg-[var(--franco-sunken,var(--franco-bg))] px-3 py-1.5 sm:w-[300px] ${
        valor ? "border-[var(--franco-border-strong)]" : "border-[var(--franco-border-hover)]"
      }`}
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-[var(--franco-text-muted)]" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Buscar por dirección o comuna…"
        aria-label="Buscar por dirección o comuna"
        className="min-w-0 flex-1 border-none bg-transparent font-body text-[13px] text-[var(--franco-text)] outline-none placeholder:text-[var(--franco-text-muted)]"
      />
      {valor && (
        <button
          type="button"
          onClick={limpiar}
          aria-label="Limpiar búsqueda"
          className="shrink-0 text-[var(--franco-text-muted)] hover:text-[var(--franco-text)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
