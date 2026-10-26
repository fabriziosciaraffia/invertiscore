"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «CON TU BÚSQUEDA NO HAY DEPTOS QUE CONVENGAN ESTA SEMANA» (26-oct-2026, decisión de Fabrizio): arriba de la selección,
// cuando con sus números no conviene ninguno en sus comunas. La frase, las salidas en una línea («Con pie 30 %, 14 sí. En
// Santiago, 810.») y un botón por salida que guarda el ajuste en un toque (PUT /api/perfil-busqueda, el mismo cambio que
// el correo vacío) y pide la página de nuevo. Sin salidas, cuántos había y «Cambiar mi búsqueda» abre el perfil.
// Va SIEMPRE montado (con `aviso` null no dibuja nada): así, después del toque, el «Listo: …» sobrevive al refresco aunque
// el servidor ya no mande el aviso. Tinta, sin rojo: no es un error ni un veredicto (franco-design-system › Signal Red).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cambiosDeAjuste, ORIGEN_SIN_OFERTA, queCambio, SIN_OFERTA, type AvisoSinOferta as Aviso } from "@/lib/casa/sin-oferta";
import { parametroDeAjuste, type AjustePerfil } from "@/lib/guia/semanal";

export function AvisoSinOferta({ aviso }: { aviso: Aviso | null }) {
  const router = useRouter();
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);

  if (hecho) {
    return <p className="ca-sin-oferta-listo" role="status" data-casa="sin-oferta-listo">{SIN_OFERTA.listo(hecho)}</p>;
  }
  if (!aviso) return null;
  const actual = aviso;

  async function ajustar(a: AjustePerfil) {
    if (guardando) return;
    const id = parametroDeAjuste(a);
    setGuardando(id);
    setError(false);
    try {
      const res = await fetch("/api/perfil-busqueda", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cambiosDeAjuste(a, actual.comunas), origen: ORIGEN_SIN_OFERTA }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setHecho(queCambio(a));
      // La línea del perfil, el mapa y este aviso se dibujan en el servidor: se piden de nuevo con el perfil nuevo.
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setGuardando(null);
    }
  }

  const salidas = actual.salidas;
  return (
    <div className="ca-sin-oferta" data-casa="sin-oferta" data-salidas={salidas.length}>
      <p className="ca-sin-oferta-t">{SIN_OFERTA.titulo}</p>
      <p className="ca-sin-oferta-p" data-casa="sin-oferta-salidas">
        {salidas.length > 0
          ? salidas.map((s) => s.texto).join(" ")
          : SIN_OFERTA.revisados(actual.revisados, actual.conPie30)}
      </p>
      <div className="ca-sin-oferta-botones">
        {salidas.length > 0
          ? salidas.map((s) => {
              const id = parametroDeAjuste(s.ajuste);
              return (
                <button key={id} type="button" className="ca-sin-oferta-btn" data-ajuste={id} disabled={guardando != null} aria-busy={guardando === id} onClick={() => void ajustar(s.ajuste)}>
                  {guardando === id ? SIN_OFERTA.guardando : s.boton}
                </button>
              );
            })
          : <a className="ca-sin-oferta-btn" href="#perfil" data-ajuste="perfil">{SIN_OFERTA.cambiar}</a>}
      </div>
      {error && <p className="ca-error" role="alert">{SIN_OFERTA.error}</p>}
    </div>
  );
}
