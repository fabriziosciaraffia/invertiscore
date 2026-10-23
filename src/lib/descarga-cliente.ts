// ─────────────────────────────────────────────────────────────────────────────
// DESCARGAR UN ARCHIVO QUE EL SERVIDOR ARMA (22-oct-2026, regla de carga: lo que tarda se ve cargando).
//
// Un <a href> a un PDF que el servidor renderiza en segundos no da ninguna señal hasta que llega: el navegador no navega
// ni avisa, y la pantalla queda igual. Acá se pide con fetch —quien llama deja el botón ocupado mientras tanto— y se
// entrega con el nombre que manda el servidor (Content-Disposition). Devuelve false si no se pudo, y quien llama decide
// (lo normal: abrir la URL de siempre, que se porta como antes).
// ─────────────────────────────────────────────────────────────────────────────

/** El nombre de archivo de un Content-Disposition (`attachment; filename="franco-x.pdf"`), o el de reserva. */
export function nombreDeDisposition(cabecera: string | null | undefined, porDefecto: string): string {
  const m = cabecera?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return m ? decodeURIComponent(m[1]) : porDefecto;
}

export async function descargarArchivo(url: string, porDefecto = "franco.pdf"): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;
    const blob = await res.blob();
    const nombre = nombreDeDisposition(res.headers.get("content-disposition"), porDefecto);
    const objeto = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objeto;
    a.download = nombre;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(objeto), 60_000);
    return true;
  } catch {
    return false;
  }
}
