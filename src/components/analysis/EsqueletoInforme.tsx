import { DocTokens } from "./portada/PortadaInforme";

/**
 * LA CARGA DE LA PÁGINA DEL INFORME (24-sep-2026) · `loading.tsx` de LTR, STR y AMBAS.
 *
 * Reemplaza a `LoadingEditorial`, que al abrir un informe YA HECHO narraba cinco pasos que no
 * ocurren («Comparando propiedades cercanas», «Redactando veredicto final»…), prometía «hasta
 * 60 segundos» y estaba en mono. Medido en producción el 24-sep-2026 (refranco.ai, seis cargas
 * por fila): LTR primer byte 0,5–0,8 s y la página completa 2,0–2,5 s; STR, que no tenía
 * loading, 2,5–3,2 s sin nada en pantalla. Para eso no hay pasos que contar ni tiempo que
 * prometer: se muestra la FORMA del informe en barras, sin texto, sin logo y sin tiempo.
 *
 * Usa las clases del informe (`doc-dictamen`, `doc-sec`, `doc-hero`, `rec-card`) para que la
 * geometría y los tokens sean los del informe que viene, en los dos temas. El CSS propio va por
 * `dangerouslySetInnerHTML`: un `<style>` con comillas como hijo de texto no hidrata igual en
 * servidor y cliente (el error de `ProsaSkeleton`).
 */
export function EsqueletoInforme() {
  const barras = (n: number, anchos: string[]) =>
    Array.from({ length: n }, (_, i) => <i key={i} className="esq-b" style={{ width: anchos[i % anchos.length] }} />);
  return (
    <div className="min-h-screen bg-[var(--franco-bg)] doc-lienzo" aria-busy="true" aria-label="Cargando el análisis">
      <div className="esq-nav" aria-hidden="true" />
      <div className="container mx-auto max-w-6xl px-4 py-8" aria-hidden="true">
        <div className="doc-dictamen">
          <DocTokens />
          <div className="doc-page doc-page--secciones">
            {/* portada */}
            <section className="doc-sec doc-sec--caja">
              <div className="doc-portada doc-hero">
                <div className="doc-hero-bg" />
                <div className="esq-hero">
                  <i className="esq-b" style={{ width: "46%" }} />
                  <i className="esq-b esq-pill" />
                  <i className="esq-b" style={{ width: "34%" }} />
                  <i className="esq-b esq-tit" style={{ width: "92%" }} />
                  <i className="esq-b esq-tit" style={{ width: "58%" }} />
                  <i className="esq-b esq-cifra" style={{ width: "66%" }} />
                  <i className="esq-b" style={{ width: "40%" }} />
                </div>
              </div>
            </section>
            {/* hallazgos */}
            <section className="doc-sec">
              <i className="esq-b esq-t" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="esq-fila">
                  <i className="esq-b" style={{ width: "72%" }} />
                  <i className="esq-b" style={{ width: "64px" }} />
                </div>
              ))}
            </section>
            {/* recomendación */}
            <section className="doc-sec doc-sec--caja">
              <div className="rec-card">
                {/* Sin veredicto todavía: el tono profundo de la caja es neutro (tinta), no el de un
                    veredicto que no se conoce. */}
                <div className="rec-bg" style={{ ["--verdict-deep" as string]: "var(--ink-800, #27272A)" }} />
                <div className="esq-rec">
                  <i className="esq-b" style={{ width: "58%" }} />
                  <i className="esq-b" style={{ width: "42%" }} />
                  <i className="esq-b esq-caja" />
                  <i className="esq-b" style={{ width: "80%" }} />
                  <i className="esq-b esq-pill" />
                </div>
              </div>
            </section>
            {/* las seis cifras */}
            <section className="doc-sec">
              <i className="esq-b esq-t" />
              <div className="esq-cifras">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="esq-cifra-c">
                    {barras(3, ["40%", "30%", "86%"])}
                  </div>
                ))}
              </div>
            </section>
            {/* detalle de la inversión */}
            <section className="doc-sec">
              <i className="esq-b esq-t" />
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="esq-cap">
                  <i className="esq-b" style={{ width: "44%" }} />
                  <i className="esq-b" style={{ width: "88px" }} />
                </div>
              ))}
            </section>
            {/* la zona */}
            <section className="doc-sec">
              <i className="esq-b esq-t" />
              <div className="esq-zona">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="esq-zona-c">
                    {barras(3, ["44%", "56%", "72%"])}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .esq-nav{height:64px;border-bottom:1px solid var(--franco-border)}
            .esq-b{display:block;height:12px;border-radius:6px;background:var(--doc-inset-1);margin:0 0 10px;animation:esqPulso 1.6s ease-in-out infinite}
            .doc-hero .esq-b,.rec-card .esq-b{background:rgba(255,255,255,.13)}
            .esq-hero,.esq-rec{position:relative;z-index:2}
            .esq-pill{width:124px;height:30px;border-radius:99px;margin:16px 0}
            .esq-tit{height:26px;margin-top:6px}
            .esq-cifra{height:20px;margin-top:14px}
            .esq-t{width:60%;height:26px;margin-bottom:18px}
            .esq-fila{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--doc-line)}
            .esq-fila .esq-b,.esq-cap .esq-b{margin:0}
            .esq-fila .esq-b:first-child,.esq-cap .esq-b:first-child{flex:0 1 auto;min-width:0}
            .esq-fila .esq-b:last-child,.esq-cap .esq-b:last-child{flex:none}
            .esq-caja{height:120px;border-radius:12px;margin:16px 0}
            .esq-cifras{display:grid;grid-template-columns:1fr;column-gap:32px}
            .esq-cifra-c{min-height:104px;padding:12px 0;border-bottom:1px solid var(--doc-line)}
            .esq-cifra-c .esq-b:nth-child(2){height:20px}
            .esq-cap{display:flex;justify-content:space-between;align-items:center;gap:16px;background:var(--doc-inset-1);border-radius:12px;padding:18px 16px;margin-bottom:8px}
            .esq-cap .esq-b{background:var(--doc-inset-2, var(--doc-line))}
            .esq-zona{display:grid;grid-template-columns:1fr;gap:10px}
            .esq-zona-c{min-height:118px;background:var(--doc-inset-1);border-radius:12px;padding:16px}
            .esq-zona-c .esq-b{background:var(--doc-inset-2, var(--doc-line))}
            @media (min-width:768px){.esq-cifras{grid-template-columns:1fr 1fr}.esq-zona{grid-template-columns:1fr 1fr 1fr}}
            @keyframes esqPulso{0%,100%{opacity:.6}50%{opacity:1}}
            @media (prefers-reduced-motion: reduce){.esq-b{animation:none}}
          `,
        }}
      />
    </div>
  );
}
