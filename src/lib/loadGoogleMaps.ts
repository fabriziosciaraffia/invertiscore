let loadPromise: Promise<void> | null = null;

/** La dirección del script de Google Maps. UNA sola fuente: /explorar la precarga desde el HTML (explorar/precarga-maps.ts) y
 *  el navegador solo reutiliza esa descarga si la dirección es EXACTAMENTE la misma. */
export const urlGoogleMaps = (apiKey: string): string => `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.resolve();

  loadPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]') as HTMLScriptElement | null;
    if (existing) {
      const check = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.src = urlGoogleMaps(apiKey);
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });

  return loadPromise;
}
