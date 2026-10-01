import FrancoLogo from "@/components/franco-logo";
import { SEMANAL_PAGINA } from "@/lib/guia/semanal";

// La confirmación de la baja del correo semanal (02-oct-2026). Sin sesión: el token del correo bastó.
export default function BajaSemanalPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const error = searchParams.error === "1";
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
