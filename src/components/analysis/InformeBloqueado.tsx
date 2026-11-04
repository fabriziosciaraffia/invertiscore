// La portada bloqueada (04-nov-2026, lib/informe-bloqueado.ts): mientras el informe espera su pago, la página dice de qué
// depto es y, a su dueño, cómo abrirlo. Sin veredicto, puntaje ni cifras. Pantalla plana, como la compra y la vuelta de
// Flow (components/plano). Lo fija el tier DATOS-Y-PLATA.
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { PLANO, UI_PLANO } from "@/components/plano/plano";
import { INFORME_BLOQUEADO_COPY as C } from "@/lib/informe-bloqueado";

export function InformeBloqueado({ titulo, esDueno, rutaPago, sesion }: {
  /** El nombre del depto, como se rotula (etiquetaAnalisis). */
  titulo: string;
  esDueno: boolean;
  rutaPago: string;
  sesion: { email: string } | null;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)] text-[var(--franco-text)]" data-informe-bloqueado={esDueno ? "dueno" : "ajeno"}>
      <HeaderFranco sesion={sesion} />
      <main className={PLANO.main} style={{ fontFamily: UI_PLANO }}>
        <h1 className={PLANO.titulo}>{titulo}</h1>
        <p className={PLANO.bajada}>{esDueno ? C.dueno.bajada : C.ajeno.bajada}</p>
        <div className={PLANO.seccion}>
          <EnlaceCarga href={esDueno ? rutaPago : "/"} className={PLANO.principal} data-informe-bloqueado-boton>
            {esDueno ? C.dueno.boton : C.ajeno.boton}
          </EnlaceCarga>
        </div>
      </main>
      <AppFooter variant="informe" />
    </div>
  );
}
