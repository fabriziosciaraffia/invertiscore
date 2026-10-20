// ─────────────────────────────────────────────────────────────────────────
// Hero de veredicto de la página de comuna: "¿el arriendo paga el dividendo?"
// más la CAPA DE PALANCA (a qué precio sí se paga sola, o cuánto margen queda).
//
// Contrato: assets-export/mockup-comunas-enriquecido.html (rev. 4), tabs A/B/C.
// El bloque cambia de FUNCIÓN según la comuna — objetivo de negociación cuando
// falta poco, prueba de que negociar no alcanza cuando el caso es estructural,
// y techo de protección cuando la tipología ya se paga sola.
//
// VEREDICTO POR FILA. El hero cuenta y encabeza con `veredictoFila`, no con la
// aritmética del punto medio: una fila estimada cuyo rango cruza la cuota
// "depende del arriendo real" y no suma a favor ni en contra, no encabeza y no
// entra al CTA. Si todas dependen, no hay líder y el hero lo dice sin inventar
// un veredicto.
//
// Signal Red SOLO en la brecha negativa (uso #2 de Capa 1). El caso positivo va
// en Ink, sin verde. La marca de muestra chica va en Ink + tipografía: una
// advertencia de calidad de dato no es uso permitido del rojo.
//
// Diseño plano (20-oct-2026): tarjeta con borde, sin sombra ni borde lateral de color; rótulos en Inter, cifras en
// Inter con números tabulares (comunas.css). El texto no cambió.
// ─────────────────────────────────────────────────────────────────────────

import type { ComunaStats, BandaEsfuerzo, TipologiaStats } from "@/lib/data/comunas-seo";
import { fmtCLP, tipologiaLider } from "@/lib/data/comunas-seo";
import { COPY_DEPENDE, brechaRango } from "@/lib/veredicto-fila";

const NOMBRE_TIPOLOGIA: Record<number, string> = {
  1: "1 dormitorio",
  2: "2 dormitorios",
  3: "3 dormitorios",
  4: "4 dormitorios",
};

const ETIQUETA_BANDA: Record<BandaEsfuerzo, string> = {
  // Los nombres de `ETIQUETA_BANDA` (25-sep-2026): los mismos que la card y el pop-up.
  normal: "Banda 1 · fácil de negociar",
  "con-argumentos": "Banda 2 · con argumentos",
  dificil: "Banda 3 · difícil de negociar",
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
function lista(ts: TipologiaStats[]): string {
  return ts.map((t) => corto(t.dorms)).join(", ").replace(/, ([^,]*)$/, " y $1");
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
    <span className="cm-chip">
      {estimada ? `Arriendo estimado · m² comunal` : `Muestra chica · ${t.nArriendos} arriendos`}
    </span>
  );
}

function Dato({ label, valor, critico = false, unidad }: { label: string; valor: string; critico?: boolean; unidad?: string }) {
  return (
    <div className="cm-dato">
      {label}
      <b className={`cm-cifra${critico ? " cm-negativo" : ""}`}>{valor}</b>
      {unidad && <span className="cm-unidad">{unidad}</span>}
    </div>
  );
}

/**
 * Sin líder: todas las filas publicadas dependen del arriendo real. No hay
 * veredicto que titular ni palanca que ofrecer; se muestra qué pasa en cada
 * extremo del rango y se manda la decisión al análisis del depto.
 */
function HeroSinVeredicto({ stats, dependen }: { stats: ComunaStats; dependen: TipologiaStats[] }) {
  return (
    <div className="cm-tarjeta" data-comuna="veredicto">
      <p className="cm-rotulo">
        ¿El arriendo paga el dividendo?
      </p>
      <p className="cm-titular">
        En {stats.nombre} todavía no se puede decir: el arriendo es estimado y, en{" "}
        {dependen.length === 1 ? `el ${corto(dependen[0].dorms)}` : `las ${dependen.length} tipologías`}, su rango cruza la
        cuota.
      </p>
      <p className="cm-texto" style={{ marginTop: 12 }}>
        {COPY_DEPENDE} Franco no convierte un rango que cruza la cuota en un veredicto: con el arriendo real en la
        mano, el análisis del depto sí lo decide.
      </p>
      <div className="cm-separa">
        <p className="cm-rotulo">
          Qué pasa en cada extremo del rango
        </p>
        <div className="cm-datos">
          {dependen.map((t) => {
            const r = brechaRango(t);
            if (!r) return null;
            return (
              <div key={t.dorms} className="cm-datos" style={{ marginTop: 0 }}>
                <Dato label={`${corto(t.dorms)} · con el piso`} valor={`−${fmtCLP(Math.abs(r.min))}`} critico unidad="al mes" />
                <Dato label={`${corto(t.dorms)} · con el techo`} valor={`+${fmtCLP(Math.abs(r.max))}`} unidad="al mes" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function VeredictoCuota({ stats }: { stats: ComunaStats }) {
  const tips = stats.tipologias;
  if (!tips.length) return null;

  // Veredicto PUBLICADO por fila: las que dependen del arriendo real no cuentan
  // ni a favor ni en contra, y nunca encabezan.
  const cubren = tips.filter((t) => t.veredictoFila === "sePagaSola");
  const dependen = tips.filter((t) => t.veredictoFila === "dependeDelArriendoReal");
  const decididas = tips.filter((t) => t.veredictoFila !== "dependeDelArriendoReal");
  const lider = tipologiaLider(tips);
  if (!lider) return <HeroSinVeredicto stats={stats} dependen={dependen} />;

  const ningunaCubre = cubren.length === 0;
  const unaSola = decididas.length === 1;
  const conVeredicto = dependen.length ? " con veredicto" : "";
  const liderEstimado = lider.referencia.fuente === "comunalPorM2";
  // Con una sola fila, el titular dice de dónde sale: mediana propia o estimado.
  const unicaConFuente = (t: TipologiaStats) =>
    t.referencia.fuente === "comunalPorM2"
      ? `${NOMBRE_TIPOLOGIA[t.dorms]} (con arriendo estimado desde el m² comunal)`
      : NOMBRE_TIPOLOGIA[t.dorms];
  // Las filas sin veredicto se nombran en el titular, con el copy canónico.
  const notaDepende = dependen.length ? (
    <>
      {" "}
      El {lista(dependen)} {dependen.length === 1 ? "queda" : "quedan"} sin veredicto: {COPY_DEPENDE}
    </>
  ) : null;

  // ── Titular: cambia de signo, no de adjetivo ──────────────────────────────
  let titular: React.ReactNode;
  if (ningunaCubre) {
    titular = unaSola ? (
      <>
        En {stats.nombre} solo se puede publicar{dependen.length ? " con veredicto" : ""} el {unicaConFuente(decididas[0])}, y{" "}
        <span className="cm-negativo">no se paga solo</span>: faltan{" "}
        {fmtCLP(Math.abs(decididas[0].brechaCLP))} cada mes.
        {notaDepende}
      </>
    ) : (
      <>
        En {stats.nombre},{" "}
        <span className="cm-negativo">
          ninguna de las {decididas.length} tipologías{conVeredicto} se paga sola
        </span>{" "}
        al precio de lista.
        {notaDepende}
      </>
    );
  } else if (cubren.length === decididas.length) {
    titular = unaSola ? (
      <>
        En {stats.nombre}, el {unicaConFuente(decididas[0])} <strong>se paga solo</strong>: sobran{" "}
        {fmtCLP(decididas[0].brechaCLP)} al mes por sobre la cuota.
        {notaDepende}
      </>
    ) : (
      <>
        En {stats.nombre}, las {decididas.length} tipologías{conVeredicto || " con muestra"} <strong>se pagan solas</strong>. Un{" "}
        {corto(lider.dorms)} deja {fmtCLP(lider.brechaCLP)} al mes por sobre la cuota.
        {notaDepende}
      </>
    );
  } else {
    titular = (
      <>
        En {stats.nombre}, {cubren.length} de {decididas.length} tipologías{conVeredicto}{" "}
        <strong>se pagan solas</strong>. La que más margen deja es el {corto(lider.dorms)}, con{" "}
        {fmtCLP(lider.brechaCLP)} al mes.
        {notaDepende}
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

  const restantes = tips.filter((t) => t.dorms !== lider.dorms && t.veredictoFila === "noSePagaSola");
  const otrasQueCubren = tips.filter((t) => t.dorms !== lider.dorms && t.veredictoFila === "sePagaSola");

  return (
    <div className="cm-tarjeta" data-comuna="veredicto">
      <p className="cm-rotulo">
        ¿El arriendo paga el dividendo?
      </p>
      <p className="cm-titular">
        {titular}
      </p>
      <p className="cm-texto" style={{ marginTop: 12 }}>{bajada}</p>

      <div className="cm-separa">
        <p className="cm-rotulo">
          {encabezadoPalanca}
        </p>

        {ningunaCubre ? (
          <>
            <p className="cm-titular-chico">
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
            <div className="cm-datos">
              <Dato label={`Precio de equilibrio · ${corto(lider.dorms)}`} valor={uf(lider.precioCuotaUF)} unidad={UNIDAD_DEPTO} />
              <Dato label="Bajo la mediana" valor={`−${pct(lider.deltaPct)}`} critico={estructural} />
              {lider.pieNecesarioPct !== null && (
                <Dato label="O bien, pie de" valor={`${lider.pieNecesarioPct}%`} critico={estructural} />
              )}
            </div>
          </>
        ) : (
          <>
            <p className="cm-titular-chico">
              Un {corto(lider.dorms)} deja de pagarse solo recién sobre{" "}
              <strong>{uf(lider.precioCuotaUF)}</strong> por el departamento completo. La mediana de la comuna
              es {uf(lider.ventaUF)}, así que tienes un {pct(lider.deltaPct)} de margen sobre el precio de
              lista.
              <ChipRespaldo t={lider} />
            </p>
            <div className="cm-datos">
              <Dato label={`Precio de equilibrio · ${corto(lider.dorms)}`} valor={uf(lider.precioCuotaUF)} unidad={UNIDAD_DEPTO} />
              <Dato label="Margen sobre la mediana" valor={`+${pct(lider.deltaPct)}`} />
            </div>
          </>
        )}

        {lider.banda && (
          <p className="cm-linea">
            <span className={`cm-chip cm-chip-solo${estructural ? " cm-negativo" : ""}`}>{ETIQUETA_BANDA[lider.banda]}</span>
          </p>
        )}

        {/* Cierre de la palanca: qué significa, y qué pasa con las demás. */}
        <p className="cm-texto-chico">
          {estructural ? (
            <>
              Ni el precio ni el pie son palancas razonables acá. Lo que dicen estos números no es que este
              depto esté caro, sino que hoy {stats.nombre} se vende a precios que sus arriendos no sostienen.
              Si buscas que el arriendo cubra la cuota, la palanca real es{" "}
              <a href="/comunas" className="cm-enlace">
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
              {otrasQueCubren.length > 0 && (
                <>
                  {" "}
                  {otrasQueCubren
                    .map((t) => `El ${corto(t.dorms)} aguanta hasta ${uf(t.precioCuotaUF)} (+${pct(t.deltaPct)})`)
                    .join(". ")}
                  .
                </>
              )}
            </>
          )}
        </p>

        {liderEstimado && lider.referencia.fuente === "comunalPorM2" && (
          <p className="cm-chico">
            Ojo con el respaldo de este número: el {corto(lider.dorms)} no junta arriendos publicados propios
            ({lider.nArriendos}). Su arriendo es un estimado desde el metro cuadrado de los{" "}
            {lider.referencia.nComunal.toLocaleString("es-CL")} arriendos de la comuna, ajustado por tipología, y va entre{" "}
            {fmtCLP(lider.referencia.rangoCLP.min)} y {fmtCLP(lider.referencia.rangoCLP.max)}. El precio de
            equilibrio de arriba usa el punto medio: tómalo como orden de magnitud, no como cifra para negociar.
          </p>
        )}
        {!liderEstimado && lider.muestraChica && (
          <p className="cm-chico">
            Ojo con el respaldo de este número: el {corto(lider.dorms)} se apoya en {lider.nArriendos} arriendos
            publicados, la muestra más chica de las que se muestran acá. Con esa cantidad la mediana se mueve
            más — tómalo como una señal de por dónde mirar, no como una promesa.
          </p>
        )}
      </div>
    </div>
  );
}
