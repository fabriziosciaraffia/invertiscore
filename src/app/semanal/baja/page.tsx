import FrancoLogo from "@/components/franco-logo";
import { SEMANAL_PAGINA } from "@/lib/guia/semanal";
import { INMEDIATO } from "@/lib/guia/inmediato";

// La confirmación de la baja del correo semanal (02-oct-2026). Sin sesión: el token del correo bastó.
// También la de los avisos inmediatos y la respuesta a «¿Cuándo piensas comprar?» (05-oct-2026, `tipo`).
export default function BajaSemanalPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const error = searchParams.error === "1";
  const tipo = searchParams.tipo;
  if (tipo === "inmediato" || tipo === "horizonte") {
    const P = INMEDIATO.pregunta;
    const titulo = tipo === "inmediato" ? (error ? SEMANAL_PAGINA.bajaError : INMEDIATO.bajaLista) : error ? P.error : P.gracias;
    const bajada = error ? null : tipo === "inmediato" ? INMEDIATO.bajaVolver : searchParams.h === "ya" ? P.graciasYa : P.graciasOtro;
    return (
      <main className="min-h-screen bg-[var(--franco-bg)] px-5 py-16 text-[var(--franco-text)]">
        <div className="mx-auto max-w-[480px]">
          <FrancoLogo size="lg" />
          <p className="mt-8 text-[17px] font-semibold" data-inmediato={tipo}>{titulo}</p>
          {bajada && <p className="mt-2 text-[15px] text-[var(--franco-text-secondary)]">{bajada}</p>}
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[var(--franco-bg)] px-5 py-16 text-[var(--franco-text)]">
      <div className="mx-auto max-w-[480px]">
        <FrancoLogo size="lg" />
        <p className="mt-8 text-[17px] font-semibold" data-semanal="baja">{error ? SEMANAL_PAGINA.bajaError : SEMANAL_PAGINA.bajaLista}</p>
        {!error && <p className="mt-2 text-[15px] text-[var(--franco-text-secondary)]">{SEMANAL_PAGINA.bajaVolver}</p>}
      </div>
    </main>
  );
}
