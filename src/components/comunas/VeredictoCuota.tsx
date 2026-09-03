// ─────────────────────────────────────────────────────────────────────────
// Hero de veredicto de la página de comuna: "¿el arriendo paga el dividendo?"
// más la CAPA DE PALANCA (a qué precio sí se paga sola, o cuánto margen queda).
//
// Contrato: assets-export/mockup-comunas-enriquecido.html (rev. 4), tabs A/B/C.
// El bloque cambia de FUNCIÓN según la comuna — objetivo de negociación cuando
// falta poco, prueba de que negociar no alcanza cuando el caso es estructural,
// y techo de protección cuando la tipología ya se paga sola.
//
// Signal Red SOLO en la brecha negativa (uso #2 de Capa 1). El caso positivo va
// en Ink, sin verde. La marca de muestra chica va en Ink + tipografía: una
// advertencia de calidad de dato no es uso permitido del rojo.
// ─────────────────────────────────────────────────────────────────────────

import type { ComunaStats, BandaEsfuerzo, TipologiaStats } from "@/lib/data/comunas-seo";
import { fmtCLP, tipologiaLider } from "@/lib/data/comunas-seo";

const NOMBRE_TIPOLOGIA: Record<number, string> = {
  1: "1 dormitorio",
  2: "2 dormitorios",
  3: "3 dormitorios",
  4: "4 dormitorios",
};

const ETIQUETA_BANDA: Record<BandaEsfuerzo, string> = {
  normal: "Banda 1 · negociación normal",
  "con-argumentos": "Banda 2 · alcanzable con argumentos",
  dificil: "Banda 3 · difícil, requiere vendedor motivado",
  estructural: "Banda 4 · estructural",
};

function pct(n: number): string {
  return `${Math.abs(n).toFixed(1).replace(".", ",")}%`;
}
function uf(n: number): string {
  return `UF ${n.toLocaleString("es-CL")}`;
}
/**
 * UF con la unidad dicha, no deducida. La página muestra dos magnitudes en UF a
 * pocos centímetros —el depto completo acá, el m² en la sección de plusvalía— y
 * son órdenes distintos (UF 10.000 vs UF 106). Ninguna puede quedar sin rótulo.
 */
const UNIDAD_DEPTO = "UF del depto";
function corto(dorms: number): string {
  return `${dorms}D`;
}

/**
 * Respaldo del número del líder, en Ink + tipografía. Dos marcas distintas:
 * mediana propia con pocos avisos, o arriendo ESTIMADO desde el m² comunal.
 * Una fila estimada nunca lleva la marca de muestra chica: no es una mediana.
 */
function ChipRespaldo({ t }: { t: TipologiaStats }) {
  const estimada = t.referencia.fuente === "comunalPorM2";
  if (!estimada && !t.muestraChica) return null;
  return (
    <span className="ml-2 inline-block rounded-full border border-[var(--franco-border)] bg-[var(--franco-sunken,var(--franco-bg))] px-2 py-0.5 align-middle font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--franco-text-secondary)]">
      {estimada ? `Arriendo estimado · m² comunal` : `Muestra chica · ${t.nArriendos} arriendos`}
    </span>
  );
}

function Dato({ label, valor, critico = false, unidad }: { label: string; valor: string; critico?: boolean; unidad?: string }) {
  return (
    <div className="font-body text-xs text-[var(--franco-text-muted)]">
      {label}
      <b
        className="mt-0.5 block font-mono text-lg font-bold"
        style={{ color: critico ? "#C8323C" : "var(--franco-text)" }}
      >
        {valor}
      </b>
      {unidad && (
        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)]">
          {unidad}
        </span>
      )}
    </div>
  );
}

export function VeredictoCuota({ stats }: { stats: ComunaStats }) {
  const tips = stats.tipologias;
  if (!tips.length) return null;

  const cubren = tips.filter((t) => t.cubre);
  const lider = tipologiaLider(tips);
  if (!lider) return null;
  const ningunaCubre = cubren.length === 0;
  const unaSola = tips.length === 1;
  const liderEstimado = lider.referencia.fuente === "comunalPorM2";
  // Con una sola fila, el titular dice de dónde sale: mediana propia o estimado.
  const unicaConFuente = (t: TipologiaStats) =>
    t.referencia.fuente === "comunalPorM2"
      ? `${NOMBRE_TIPOLOGIA[t.dorms]} (con arriendo estimado desde el m² comunal)`
      : NOMBRE_TIPOLOGIA[t.dorms];

  // ── Titular: cambia de signo, no de adjetivo ──────────────────────────────
  let titular: React.ReactNode;
  if (ningunaCubre) {
    titular = unaSola ? (
      <>
        En {stats.nombre} solo se puede publicar el {unicaConFuente(tips[0])}, y{" "}
        <span className="text-[#C8323C]">no se paga solo</span>: faltan{" "}
        {fmtCLP(Math.abs(tips[0].brechaCLP))} cada mes.
      </>
    ) : (
      <>
        En {stats.nombre},{" "}
        <span className="text-[#C8323C]">
          ninguna de las {tips.length} tipologías se paga sola
        </span>{" "}
        al precio de lista.
      </>
    );
  } else if (cubren.length === tips.length) {
    titular = unaSola ? (
      <>
        En {stats.nombre}, el {unicaConFuente(tips[0])} <strong>se paga solo</strong>: sobran{" "}
        {fmtCLP(tips[0].brechaCLP)} al mes por sobre la cuota.
      </>
    ) : (
      <>
        En {stats.nombre}, las {tips.length} tipologías con muestra <strong>se pagan solas</strong>. Un{" "}
        {corto(lider.dorms)} deja {fmtCLP(lider.brechaCLP)} al mes por sobre la cuota.
      </>
    );
  } else {
    titular = (
      <>
        En {stats.nombre}, {cubren.length} de {tips.length} tipologías{" "}
        <strong>se pagan solas</strong>. La que más margen deja es el {corto(lider.dorms)}, con{" "}
        {fmtCLP(lider.brechaCLP)} al mes.
      </>
    );
  }

  // ── Bajada ────────────────────────────────────────────────────────────────
  const bajada = ningunaCubre
    ? `Comprar acá para arrendar significa poner plata de tu bolsillo todos los meses. Cuánta, depende de qué compres y a qué precio lo compres.`
    : `El precio de equilibrio deja de ser un objetivo de negociación y pasa a ser un techo: es hasta cuánto podrías pagar y aun así mantener la cuota cubierta.`;

  // ── Capa de palanca ───────────────────────────────────────────────────────
  const estructural = lider.banda === "estructural";
  const encabezadoPalanca = ningunaCubre
    ? estructural
      ? "Acá la palanca no es el precio"
      : "A qué precio sí se paga sola"
    : "Cuánto margen tienes antes de que deje de pagarse sola";

  const restantes = tips.filter((t) => t.dorms !== lider.dorms && !t.cubre);

  return (
    <div
      className="mt-7 rounded-r-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-7 shadow-sm"
      style={{ borderLeft: `3px solid ${ningunaCubre ? "#C8323C" : "var(--franco-text)"}` }}
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--franco-text-tertiary)]">
        ¿El arriendo paga el dividendo?
      </p>
      <p className="mt-3 font-heading text-2xl font-bold leading-tight tracking-[-0.01em] text-[var(--franco-text)]">
        {titular}
      </p>
      <p className="mt-3.5 max-w-[66ch] font-body text-sm text-[var(--franco-text-secondary)]">{bajada}</p>

      <div className="mt-5 border-t border-dashed border-[var(--franco-border)] pt-5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--franco-text-tertiary)]">
          {encabezadoPalanca}
        </p>

        {ningunaCubre ? (
          <>
            <p className="mt-3 font-heading text-lg font-bold leading-snug text-[var(--franco-text)]">
              {estructural ? (
                <>
                  Para que un {corto(lider.dorms)} se pagara solo habría que comprarlo a{" "}
                  <strong>{uf(lider.precioCuotaUF)}</strong> por el departamento completo, un{" "}
                  {pct(lider.deltaPct)} bajo la mediana de la comuna. Con estos supuestos, eso no es negociar.
                </>
              ) : (
                <>
                  El {NOMBRE_TIPOLOGIA[lider.dorms]} está a un {pct(lider.deltaPct)} de lograrlo: comprando a{" "}
                  <strong>{uf(lider.precioCuotaUF)}</strong> en vez de la mediana de {uf(lider.ventaUF)} —ambas
                  por el departamento completo—, el arriendo cubre la cuota completa.
                </>
              )}
              <ChipRespaldo t={lider} />
            </p>
            <div className="mt-4 flex flex-wrap gap-6">
              <Dato label={`Precio de equilibrio · ${corto(lider.dorms)}`} valor={uf(lider.precioCuotaUF)} unidad={UNIDAD_DEPTO} />
              <Dato label="Bajo la mediana" valor={`−${pct(lider.deltaPct)}`} critico={estructural} />
              {lider.pieNecesarioPct !== null && (
                <Dato label="O bien, pie de" valor={`${lider.pieNecesarioPct}%`} critico={estructural} />
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 font-heading text-lg font-bold leading-snug text-[var(--franco-text)]">
              Un {corto(lider.dorms)} deja de pagarse solo recién sobre{" "}
              <strong>{uf(lider.precioCuotaUF)}</strong> por el departamento completo. La mediana de la comuna
              es {uf(lider.ventaUF)}, así que tienes un {pct(lider.deltaPct)} de margen sobre el precio de
              lista.
              <ChipRespaldo t={lider} />
            </p>
            <div className="mt-4 flex flex-wrap gap-6">
              <Dato label={`Precio de equilibrio · ${corto(lider.dorms)}`} valor={uf(lider.precioCuotaUF)} unidad={UNIDAD_DEPTO} />
              <Dato label="Margen sobre la mediana" valor={`+${pct(lider.deltaPct)}`} />
            </div>
          </>
        )}

        {lider.banda && (
          <span className="mt-4 inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em]"
            style={
              estructural
                ? { color: "#C8323C", background: "rgba(200,50,60,0.07)" }
                : { color: "var(--franco-text-secondary)", background: "var(--franco-sunken, var(--franco-bg))" }
            }
          >
            {ETIQUETA_BANDA[lider.banda]}
          </span>
        )}

        {/* Cierre de la palanca: qué significa, y qué pasa con las demás. */}
        <p className="mt-4 max-w-[68ch] font-body text-[13px] text-[var(--franco-text-secondary)]">
          {estructural ? (
            <>
              Ni el precio ni el pie son palancas razonables acá. Lo que dicen estos números no es que este
              depto esté caro, sino que hoy {stats.nombre} se vende a precios que sus arriendos no sostienen.
              Si buscas que el arriendo cubra la cuota, la palanca real es{" "}
              <a href="/comunas" className="underline hover:text-[var(--franco-text)]">
                mirar otra comuna
              </a>
              .
            </>
          ) : ningunaCubre ? (
            <>
              {lider.pieNecesarioPct !== null && (
                <>
                  La otra vía es igual de concreta: con {lider.pieNecesarioPct}% de pie en lugar de{" "}
                  {stats.supuestos.piePct}%, ese mismo {corto(lider.dorms)} se paga solo sin tocar el precio.{" "}
                </>
              )}
              {restantes.length > 0 && (
                <>
                  Las demás tipologías necesitan más:{" "}
                  {restantes
                    .sort((a, b) => b.deltaPct - a.deltaPct)
                    .map((t) => `el ${corto(t.dorms)} pide ${pct(t.deltaPct)} bajo la mediana`)
                    .join(", ")}
                  .
                </>
              )}
            </>
          ) : (
            <>
              Ese colchón es lo que te protege si el arriendo baja o la tasa sube.
              {tips.length > 1 && (
                <>
                  {" "}
                  {tips
                    .filter((t) => t.dorms !== lider.dorms && t.cubre)
                    .map((t) => `El ${corto(t.dorms)} aguanta hasta ${uf(t.precioCuotaUF)} (+${pct(t.deltaPct)})`)
                    .join(". ")}
                  {tips.filter((t) => t.dorms !== lider.dorms && t.cubre).length > 0 && "."}
                </>
              )}
            </>
          )}
        </p>

        {liderEstimado && lider.referencia.fuente === "comunalPorM2" && (
          <p className="mt-3 max-w-[68ch] font-body text-[13px] italic text-[var(--franco-text-muted)]">
            Ojo con el respaldo de este número: el {corto(lider.dorms)} no junta arriendos publicados propios
            ({lider.nArriendos}). Su arriendo es un estimado desde el metro cuadrado de los{" "}
            {lider.referencia.nComunal.toLocaleString("es-CL")} arriendos de la comuna, ajustado por tipología, y va entre{" "}
            {fmtCLP(lider.referencia.rangoCLP.min)} y {fmtCLP(lider.referencia.rangoCLP.max)}. El precio de
            equilibrio de arriba usa el punto medio: tómalo como orden de magnitud, no como cifra para negociar.
          </p>
        )}
        {!liderEstimado && lider.muestraChica && (
          <p className="mt-3 max-w-[68ch] font-body text-[13px] italic text-[var(--franco-text-muted)]">
            Ojo con el respaldo de este número: el {corto(lider.dorms)} se apoya en {lider.nArriendos} arriendos
            publicados, la muestra más chica de las que se muestran acá. Con esa cantidad la mediana se mueve
            más — tómalo como una señal de por dónde mirar, no como una promesa.
          </p>
        )}
      </div>
    </div>
  );
}
