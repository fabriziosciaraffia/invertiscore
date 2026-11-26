"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA IMAGEN DE UN DEPTO (28-oct-2026; compartida desde el 30-oct-2026): la foto de la calle (etiqueta «Vista de la calle»,
// nunca «el edificio») o, si no hay foto que cumpla, el mapa chico con el pin en la cuadra (lib/explorar/calle.ts). La usan
// la tarjeta del pin y la lista de Explorar, y el pop-up de «Analizar este» en todas partes. EL MAPA CHICO SIGUE EL TEMA: en
// oscuro, su versión oscura (`?tema=oscuro`, guardada en caché aparte); cambia al momento si la persona cambia el tema.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { CALLE_COPY, rutaImagenCalle, type VeredictoImagen } from "@/lib/explorar/calle";
import { useTemaOscuro } from "@/lib/tema-vivo";

/** Foto o mapa de cada aviso (la etiqueta «Vista de la calle» va solo con la foto). Se pide una vez por grupo de ids. */
export function useCalle(ids: string[]): Record<string, "foto" | "mapa"> {
  const [tipos, setTipos] = useState<Record<string, "foto" | "mapa">>({});
  const clave = ids.join(",");
  useEffect(() => {
    if (!ids.length) return;
    let vivo = true;
    void fetch("/api/explorar/calle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, "foto" | "mapa">) => { if (vivo) setTipos((t) => ({ ...t, ...d })); })
      .catch(() => undefined);
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return tipos;
}

/** La imagen de un depto: la de la calle o el mapa chico (la ruta decide y la sirve desde la caché). `veredicto` (26-nov-2026; antes
 *  `ajustar`): el pin del mapa chico en el color de su veredicto —la clase de `claseDePin`, la misma del pin del mapa—. */
export function ImagenDepto({ avisoId, tipo, clase, carga = "eager", veredicto = "comprar" }: { avisoId: string; tipo: "foto" | "mapa" | undefined; clase: string; carga?: "eager" | "lazy"; veredicto?: VeredictoImagen }) {
  const oscuro = useTemaOscuro();
  const src = rutaImagenCalle(avisoId, oscuro, veredicto);
  // MIENTRAS CARGA, UN ESPACIO GRIS DEL MISMO TAMAÑO (26-nov-2026): la caja tiene su tamaño y su gris desde el primer momento, y la
  // imagen aparece recién cargada (data-cargada), sin pintarse a medias. Una imagen que ya estaba en la caché del navegador puede
  // terminar antes de que React escuche `onLoad`: por eso también se mira `complete` al montar.
  const img = useRef<HTMLImageElement>(null);
  const [cargada, setCargada] = useState<string | null>(null);
  useEffect(() => { const el = img.current; if (el?.complete && el.naturalWidth > 0) setCargada(src); }, [src]);
  return (
    <span className={clase} data-explorar="imagen" data-calle={tipo ?? undefined} data-cargada={cargada === src ? "1" : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} onLoad={() => setCargada(src)} src={src} alt={tipo === "foto" ? CALLE_COPY.etiqueta : tipo === "mapa" ? CALLE_COPY.mapa : ""} loading={carga} decoding="async" width={96} height={96} />
      {tipo === "foto" && <span className="ex-img-etq" data-explorar="vista-calle">{CALLE_COPY.etiqueta}</span>}
    </span>
  );
}
