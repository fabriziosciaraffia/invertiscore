// ─────────────────────────────────────────────────────────────────────────────
// LA FRANJA «ORDEN FIRMADA» (láminas del 19-nov-2026, 3.1-perfil-paso1). Al firmar, la persona cae directo en el paso 1 del perfil:
// arriba, a todo el ancho, la franja azul claro con «✓ Orden firmada» y «Ver», que abre la orden en la ventana de siempre (la
// misma de Partimos). En chico, la línea de la copia por correo (decisión de Fabrizio, 19-nov-2026): honesta si todavía no salió.
// Va SOLO la primera vez, no cuando la persona edita su perfil (lo decide la página).
// ─────────────────────────────────────────────────────────────────────────────
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { fechaFirmaLarga, partesDeTexto, registroDeFirma } from "@/lib/invierte-v2/orden";
import type { OrdenInv } from "@/lib/invierte-v2/servidor";
import { VerOrden } from "./VerOrden";

const P = FLUJO_COPY.partimos;

export function FranjaOrden({ orden }: { orden: OrdenInv }) {
  const texto = partesDeTexto(orden.texto);
  return (
    <div className="iv2-franja-orden" data-inv2="franja-orden">
      <div className="iv2-franja-textos">
        <span className="iv2-franja-t">✓ {P.estado}</span>
        <span className="iv2-franja-copia" data-inv2={orden.copiaEnviadaAt ? "copia-enviada" : "copia-pendiente"}>
          {orden.copiaEnviadaAt ? P.guardada : P.copiaPendiente}
        </span>
      </div>
      <VerOrden etiqueta={FLUJO_COPY.franjaVer} clase="iv2-franja-ver" estado={P.estado} firmada={fechaFirmaLarga(orden.firmadoAt)}
        version={orden.textoVersion} parrafos={texto.parrafos} registro={registroDeFirma(orden)} />
    </div>
  );
}
