"use client";

/**
 * Acciones de fila del archivo: abrir · PDF · eliminar.
 *
 * Dos variantes del mismo componente:
 *  · `inline` — desktop, los tres botones aparecen en hover de la fila.
 *  · `menu`   — mobile, un «···» que abre el mismo set (no swipe: el swipe
 *               compite con el scroll horizontal y no se descubre).
 *
 * El delete conserva el comportamiento del dashboard viejo: confirm explícito,
 * group-aware para los pares AMBAS (borra las DOS filas por `ambas_group_id`,
 * con el alcance dicho en el confirm) y el análisis demo no se puede eliminar.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, FileText, ArrowRight, MoreHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEMO_ID } from "./dashboard-helpers";

interface Props {
  id: string;
  groupId: string | null;
  hrefAbrir: string;
  hrefPdf: string;
  variant?: "inline" | "menu";
}

export function RowActions({ id, groupId, hrefAbrir, hrefPdf, variant = "inline" }: Props) {
  const router = useRouter();
  const [borrando, setBorrando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const esDemo = id === DEMO_ID;

  useEffect(() => {
    if (!abierto) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [abierto]);

  const eliminar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (esDemo) return;

    const mensaje = groupId
      ? "Esto elimina la comparativa y sus dos análisis (renta larga y renta corta). ¿Continuar?"
      : "¿Estás seguro de eliminar este análisis?";
    if (!confirm(mensaje)) return;

    setBorrando(true);
    const supabase = createClient();
    if (groupId) await supabase.from("analisis").delete().eq("ambas_group_id", groupId);
    else await supabase.from("analisis").delete().eq("id", id);
    setAbierto(false);
    setBorrando(false);
    router.refresh();
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (variant === "menu") {
    return (
      <div ref={wrapRef} className="relative z-20 shrink-0" onClick={stop}>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAbierto((v) => !v); }}
          aria-label="Acciones del análisis"
          aria-expanded={abierto}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--franco-border)] text-[var(--franco-text-secondary)]"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {abierto && (
          <div
            className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-xl border border-[var(--franco-border-hover)] bg-[var(--franco-card)]"
            style={{ boxShadow: "var(--franco-shadow-pop)" }}
          >
            <a href={hrefAbrir} className="flex items-center gap-2.5 px-3.5 py-2.5 font-body text-[13px] text-[var(--franco-text)] no-underline">
              <ArrowRight className="h-3.5 w-3.5" /> Abrir análisis
            </a>
            <a href={hrefPdf} className="flex items-center gap-2.5 border-t border-[var(--franco-border)] px-3.5 py-2.5 font-body text-[13px] text-[var(--franco-text)] no-underline">
              <FileText className="h-3.5 w-3.5" /> Descargar PDF
            </a>
            {!esDemo && (
              <button
                type="button"
                onClick={eliminar}
                disabled={borrando}
                className="flex w-full items-center gap-2.5 border-t border-[var(--franco-border)] px-3.5 py-2.5 text-left font-body text-[13px] text-signal-red disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> {borrando ? "Eliminando…" : "Eliminar"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative z-20 flex justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
      onClick={stop}
    >
      <a
        href={hrefAbrir}
        title="Abrir análisis"
        aria-label="Abrir análisis"
        className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[var(--franco-border-hover)] bg-[var(--franco-card)] text-[var(--franco-text-secondary)] no-underline"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
      <a
        href={hrefPdf}
        title="Descargar PDF"
        aria-label="Descargar PDF"
        className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[var(--franco-border-hover)] bg-[var(--franco-card)] text-[var(--franco-text-secondary)] no-underline"
      >
        <FileText className="h-3.5 w-3.5" />
      </a>
      {!esDemo && (
        <button
          type="button"
          onClick={eliminar}
          disabled={borrando}
          title={groupId ? "Eliminar comparativa (borra ambos análisis)" : "Eliminar análisis"}
          aria-label="Eliminar análisis"
          className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border bg-[var(--franco-card)] text-signal-red disabled:opacity-50"
          style={{ borderColor: "color-mix(in srgb, var(--signal-red) 30%, transparent)" }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
