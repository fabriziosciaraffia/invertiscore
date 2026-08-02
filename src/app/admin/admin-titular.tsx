import { fmtNumber } from "@/lib/admin-format";

/**
 * Titular en prosa: lo primero que se lee, y lo único que hace falta leer si hay
 * quince segundos. No está escrito a mano — se arma desde los mismos números que
 * alimentan el funnel, así que cambia solo cuando cambia el negocio.
 *
 * La última frase es la que más se mueve: mientras nadie pague dice que nadie
 * llegó al checkout; en cuanto haya un pago pasa a contarlo.
 */
export function AdminTitular({
  registrados,
  nuevos30d,
  activaron,
  iniciaronCheckout,
  pagaron,
  includeTest,
}: {
  registrados: number;
  nuevos30d: number;
  activaron: number;
  iniciaronCheckout: number;
  pagaron: number;
  includeTest: boolean;
}) {
  // El número va un punto por debajo del texto que lo rodea: en mono, a igual
  // tamaño nominal, la caja tipográfica se ve más grande que la serif. A 390px
  // con el titular en 20px, un mono de 26px rompía la línea.
  const N = (n: number) => (
    <span className="font-mono text-[19px] font-bold sm:text-[26px]">{fmtNumber(n)}</span>
  );

  // Cierre: tres estados, del peor al mejor. Se elige el primero que aplique.
  const cierre =
    pagaron > 0 ? (
      <>
        {N(pagaron)} {pagaron === 1 ? "pagó" : "pagaron"}.
      </>
    ) : iniciaronCheckout > 0 ? (
      <span className="text-[var(--franco-text-muted)]">
        {fmtNumber(iniciaronCheckout)} {iniciaronCheckout === 1 ? "abrió" : "abrieron"} el checkout y
        nadie ha pagado.
      </span>
    ) : (
      <span className="text-[var(--franco-text-muted)]">Ninguno ha llegado al checkout.</span>
    );

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-5 py-5 sm:px-6 sm:py-6">
      <p className="font-heading text-xl font-bold leading-[1.36] tracking-tight sm:text-[27px] sm:leading-[1.32]">
        {N(registrados)} usuarios {includeTest ? "en total" : "reales"}
        {nuevos30d > 0 && <>, {N(nuevos30d)} del último mes</>}. {N(activaron)}{" "}
        {activaron === 1 ? "generó" : "generaron"} al menos un análisis. {cierre}
      </p>
    </div>
  );
}
