// ─────────────────────────────────────────────────────────────────────────────
// El degradado liso del material, pedido desde el <head> (20-oct-2026, LCP en el teléfono). En /deptos, /i/CÓDIGO y
// /pricing lo más grande de la primera pantalla es una banda o tarjeta con ese fondo (`.dp-banda`, `.pl-pack`), y como
// fondo de CSS el navegador recién lo pedía después del primer layout: llegaba tarde al primer cuadro y la banda se pintaba
// después de que bajara todo el JS. Precargado, está listo para el primer pintado. El mismo archivo que pide el CSS en
// cada ancho (m2x en el teléfono, d1x desde 768); el de grano NO se precarga: entra con la página quieta.
// ─────────────────────────────────────────────────────────────────────────────

export function PrecargaMaterialLiso() {
  return (
    <>
      <link rel="preload" as="image" href="/landing/hero-liso-m2x.webp" media="(max-width: 767px)" fetchPriority="high" />
      <link rel="preload" as="image" href="/landing/hero-liso-d1x.webp" media="(min-width: 768px)" fetchPriority="high" />
    </>
  );
}
