// ─────────────────────────────────────────────────────────────────────────────
// «Estoy en el depto» — la ubicación del teléfono
//
// Envuelve `navigator.geolocation` en una promesa con un resultado cerrado. El permiso lo pide el
// navegador; acá solo se distingue qué pasó, porque cada caso cae en un lugar distinto: con
// ubicación, el mapa arranca con el pin ahí; sin ella, el mismo mapa sin pin y un aviso.
// ─────────────────────────────────────────────────────────────────────────────

export type ResultadoUbicacion =
  | { estado: "concedido"; lat: number; lng: number; margenM: number }
  | { estado: "negado" | "no_disponible" | "error" };

export function pedirUbicacion(timeoutMs = 12000): Promise<ResultadoUbicacion> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ estado: "no_disponible" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          estado: "concedido",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          margenM: Math.round(pos.coords.accuracy ?? 0),
        }),
      (err) => resolve({ estado: err.code === err.PERMISSION_DENIED ? "negado" : "error" }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}
