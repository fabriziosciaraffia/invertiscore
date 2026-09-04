"use client";

/**
 * CSS de las piezas compartidas LTR/STR (T1 · 04-sep-2026). Portado de
 * `docs/wireframes/rediseno-informe/mockup-tablas.html` (matriz `.matriz`, planilla
 * `.pl`, fila de dato `.drow`) y de `mockup-str-CONGELADO.html` (barra de tramos
 * `.fbar`, curva anual `.curva`, bloque del día 1 `.dia1`, colchón, chart de
 * patrimonio). Un solo CSS para las dos modalidades; tokens `--doc-*` de la portada.
 *
 * Se monta UNA vez por página, junto a `DocTokens` y `TokensHallazgos`. No toca los
 * bloques existentes: lo que ya vive en ellos (`.nums`, `.bar-row`, `.v-*`) se reusa.
 */
export function TokensShared() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      /* ── matriz de sensibilización (mockup-tablas) ── */
      .mx-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}
      .mx-toggle{display:inline-flex;border:1px solid var(--doc-line2);border-radius:4px;overflow:hidden}
      .mx-toggle button{font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:5px 11px;background:var(--doc-paper);color:var(--doc-tx3);border:none;cursor:pointer}
      .mx-toggle button+button{border-left:1px solid var(--doc-line2)}
      .mx-toggle button.on{background:var(--doc-tx);color:var(--doc-paper);font-weight:700}
      .matriz{--cell:88px;--rowh:58px;--axis:20px;--gap:3px;display:grid;grid-template-columns:var(--axis) minmax(0,1fr);gap:0 6px;max-width:calc(var(--axis) + 6px + var(--rowh) + var(--n,4)*var(--cell) + 5*var(--gap));margin-top:6px}
      .mz-axis-x{grid-column:2;font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--doc-tx3);padding-left:calc(var(--rowh) + var(--gap));margin-bottom:6px}
      .mz-axis-y{grid-row:2;writing-mode:vertical-rl;font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--doc-tx3);padding-top:calc(var(--cell) * .55 + var(--gap));white-space:nowrap}
      .mz-grid{grid-row:2;display:grid;grid-template-columns:var(--rowh) repeat(var(--n,4),var(--cell));grid-auto-rows:auto;gap:var(--gap);align-items:stretch;min-width:0}
      .mz-colh,.mz-rowh{font-family:var(--font-mono, ui-monospace);font-size:11px;font-weight:700;color:var(--doc-tx);line-height:1.15}
      .mz-colh{text-align:center;padding:0 0 6px;align-self:end}
      .mz-rowh{display:flex;flex-direction:column;justify-content:center;padding-right:8px;text-align:right}
      .mz-colh small,.mz-rowh small{display:block;font-family:var(--font-body, system-ui);font-size:9.5px;font-weight:400;color:var(--doc-tx4);margin-top:2px;white-space:nowrap}
      .mz-cell{position:relative;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;background:var(--doc-paper2);border:1px solid var(--doc-line);border-radius:2px;font-family:var(--font-mono, ui-monospace);font-size:11px;color:var(--doc-tx);cursor:help;font-variant-numeric:tabular-nums}
      .doc-sec--paper2 .mz-cell{background:var(--doc-paper)}
      .mz-cell.neg{color:var(--signal-red)}
      .mz-cell.cruza{border:1px solid var(--doc-good)}
      .mz-cell.cruza::after{content:'';position:absolute;top:4px;right:4px;width:5px;height:5px;border-radius:50%;background:var(--doc-good)}
      .mz-cell.hoy{box-shadow:inset 0 0 0 2.5px var(--doc-tx);font-weight:700}
      .mz-hoy{position:absolute;top:-1px;left:-1px;font-family:var(--font-mono, ui-monospace);font-size:8px;letter-spacing:.14em;text-transform:uppercase;background:var(--doc-tx);color:var(--doc-paper);padding:2px 5px 2px 6px;border-radius:2px 0 3px 0;line-height:1}
      .mz-note{font-family:var(--font-mono, ui-monospace);font-size:10.5px;color:var(--doc-tx2);line-height:1.6;margin-top:12px;letter-spacing:.02em;max-width:60ch}
      .mz-leg{display:flex;gap:18px;flex-wrap:wrap;margin-top:10px;font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.06em;color:var(--doc-tx3)}
      .mz-leg span{display:inline-flex;align-items:center;gap:6px}
      .mz-leg i{width:11px;height:11px;border-radius:2px;border:1px solid var(--doc-line);background:var(--doc-paper2)}
      .mz-leg .sh{display:none}
      .mz-leg i.hoy{box-shadow:inset 0 0 0 2px var(--doc-tx)}
      .mz-leg i.cruza{border-color:var(--doc-good);position:relative}
      .mz-leg i.cruza::after{content:'';position:absolute;top:1px;right:1px;width:4px;height:4px;border-radius:50%;background:var(--doc-good)}

      /* ── planilla (mockup-tablas) ── */
      .pl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
      .pl{border-collapse:separate;border-spacing:0;width:100%;font-family:var(--font-mono, ui-monospace);font-variant-numeric:tabular-nums}
      .pl th,.pl td{padding:5px 6px;border-bottom:1px solid var(--doc-line);text-align:right;white-space:nowrap;font-size:10.5px;line-height:1.3;color:var(--doc-tx2);font-weight:400}
      .pl thead th{font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--doc-tx4);padding-bottom:7px;vertical-align:bottom}
      .pl th:first-child,.pl td:first-child{text-align:left}
      .pl tbody th{color:var(--doc-tx3);font-weight:400}
      .pl tr.tot th,.pl tr.tot td{font-weight:700;color:var(--doc-tx);border-top:2px solid var(--doc-tx);border-bottom:none;padding-top:7px}
      .pl tr.pre th,.pl tr.pre td{color:var(--doc-tx4)}
      .pl tr.ent th{color:var(--doc-warn);font-weight:700}
      .pl .neg{color:var(--signal-red)}
      /* dentro del modal (720px) las ocho columnas entran con el padding corto */
      .v-modal .pl th,.v-modal .pl td{padding:5px 4px;font-size:10px}
      .pl.ind td:nth-child(2){color:var(--doc-tx3);font-family:var(--font-body, system-ui);font-size:11.5px;white-space:normal;text-align:left}
      .pl.ind td:nth-child(3){color:var(--doc-tx2);text-align:left}
      .pl.ind th{color:var(--doc-tx);font-weight:600;font-family:var(--font-body, system-ui);font-size:12px;white-space:normal}
      .pl.ind td:last-child{font-weight:700;color:var(--doc-tx)}

      /* ── fila de dato compartida (mockup-tablas) ── */
      .drows{margin-top:4px}
      .drow{display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:14px;min-height:30px;padding:5px 0;border-bottom:1px solid var(--doc-line)}
      .drow .dk{font-size:12.5px;color:var(--doc-tx2);line-height:1.35}
      .drow .tip{font-style:normal;font-family:var(--font-body, system-ui);font-size:11px;color:var(--doc-tx4);margin-left:5px;cursor:help;vertical-align:1px}
      .drow .dk small{display:block;font-size:10.5px;color:var(--doc-tx4);margin-top:1px;line-height:1.35}
      .drow .dv{font-family:var(--font-mono, ui-monospace);font-size:12.5px;color:var(--doc-tx);white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}
      .drow .dv em{font-style:normal;font-family:var(--font-mono, ui-monospace);font-size:9.5px;color:var(--doc-tx4);display:inline-block;width:30px;text-align:left;margin-left:5px}
      .drow.in .dk{color:var(--doc-tx);font-weight:600}
      .drow.in .dv{font-weight:700}
      .drow.neg .dv{color:var(--signal-red)}
      .drow.cruza .dv{color:var(--doc-good)}
      .drow.tot{border-top:2px solid var(--doc-tx);border-bottom:none;margin-top:3px;padding-top:8px}
      .drow.tot .dk{color:var(--doc-tx);font-weight:600;font-size:13px}
      .drow.tot .dv{font-weight:700;font-size:14px}

      /* ── barra de tramos del Fall (CONGELADO · II) ── */
      .fbar{position:relative;height:7px;margin:8px 0 10px;border-radius:2px;cursor:help}
      .fbar span{position:absolute;top:0;height:100%;border-radius:2px}
      .fbar .fb-ing{left:0;background:var(--doc-paper3);border:1px solid var(--doc-line);box-sizing:border-box}
      .fbar .fb-op{left:0;background:var(--doc-line2)}
      .fbar .fb-cu{background:var(--doc-tx)}
      .fbar .fb-rojo{background:var(--signal-red)}
      .fbar .fb-libre{background:var(--doc-good)}

      /* ── colchón (CONGELADO · V) ── */
      .colchon{display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--doc-paper2);border:1px solid var(--doc-line);border-radius:3px;margin-top:2px}
      .colchon .k{font-size:12.5px;color:var(--doc-tx3);flex:1}
      .colchon .v{font-family:var(--font-mono, ui-monospace);font-size:14px;font-weight:700;color:var(--doc-tx);white-space:nowrap}
      .colchon .v small{font-size:10px;color:var(--doc-tx4);font-weight:400}
      .colchon .v.neg{color:var(--signal-red)}
      .v-copy{font-size:13.5px;line-height:1.65;color:var(--doc-tx2);max-width:60ch;margin-bottom:12px}

      /* ── curva anual (CONGELADO · III) y chart de patrimonio (VI) ── */
      .curva{width:100%;height:150px;display:block}
      .chart{width:100%;height:170px;display:block}
      .chart-leg{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.06em;color:var(--doc-tx3)}
      .chart-leg span::before{content:'';display:inline-block;width:12px;height:8px;background:var(--c);margin-right:6px}
      .chart-leg span.ln::before{height:3px;position:relative;top:-3px}

      /* ── La zona (CONGELADO · LA ZONA) ── */
      .zona-cells{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--doc-line);border:1px solid var(--doc-line);margin-top:18px}
      .zona-cells div{background:var(--doc-paper);padding:12px 14px}
      .zona-cells p{margin:0}
      .zona-cells .k{font-size:11.5px;color:var(--doc-tx3);margin-bottom:6px;line-height:1.35}
      .zona-cells .v{font-family:var(--font-mono, ui-monospace);font-size:17px;font-weight:700;color:var(--doc-tx)}
      .zona-cells .s{font-size:11.5px;color:var(--doc-tx3);margin-top:6px;line-height:1.4}
      .zona-cells .s b{font-family:var(--font-mono, ui-monospace);font-weight:700;color:var(--doc-tx2)}
      .zona-foot{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:12px;flex-wrap:wrap}
      .zona-foot .v-fuente{margin-top:0;flex:1;min-width:0}
      .tipo-line{font-size:12.5px;color:var(--doc-tx2);line-height:1.55;margin:12px 0 0;padding-top:12px;border-top:1px dotted var(--doc-line)}
      .tipo-line b{font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--doc-tx4);margin-right:8px}
      .poi{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:10px 0;border-bottom:1px solid var(--doc-line)}
      .poi .n{font-size:13px;font-weight:600;color:var(--doc-tx)}
      .poi .t{grid-column:1;font-family:var(--font-mono, ui-monospace);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--doc-tx4)}
      .poi .d{grid-row:span 2;font-family:var(--font-mono, ui-monospace);font-size:12px;font-weight:700;color:var(--doc-tx2);align-self:center}
      .perfil-row{padding:10px 0;border-bottom:1px solid var(--doc-line)}
      .perfil-row p{margin:0}
      .perfil-row .pn{font-size:13.5px;font-weight:600;color:var(--doc-tx2)}
      .perfil-row .pd{font-size:12px;color:var(--doc-tx3);margin-top:2px;line-height:1.45}
      .perfil-row.dom .pn{color:var(--doc-tx)}
      .perfil-row.dom .pn::before{content:'Dominante · ';font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--signal-red)}

      /* ── el día 1 (CONGELADO · VI) ── */
      .dia1{margin:14px 0 6px}
      .dia1-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px}
      .dia1-head .k{font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--doc-tx4)}
      .dia1-head .v{font-family:var(--font-mono, ui-monospace);font-size:12.5px;font-weight:700;color:var(--doc-tx)}
      .dia1-head .v small{font-size:10.5px;font-weight:500;color:var(--doc-tx3)}
      .dia1-bar{display:flex;height:38px;border-radius:3px;overflow:hidden;max-width:100%}
      .dia1-bar span{position:relative;height:100%}
      .dia1-bar .pie{background:var(--doc-neutral)}
      .dia1-bar .gastos{background:var(--doc-tx4)}
      .dia1-bar .amoblamiento{background:var(--doc-line2)}
      .dia1-bar .capex{background:var(--doc-line2)}
      .dia1-bar .capex::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(255,255,255,.5) 5px,rgba(255,255,255,.5) 10px)}
      .dia1-mult{font-family:var(--font-mono, ui-monospace);font-size:12px;color:var(--doc-tx2);margin-top:10px}
      .dia1-mult b{color:var(--doc-tx);font-weight:700}
      .dia1-nota{font-size:11.5px;color:var(--doc-tx3);margin-bottom:10px}
      /* cuarto tono en la barra apilada de "de dónde sale tu parte" (LTR pasa 0 y no lo dibuja) */
      .ba-sw.amoblamiento,.ba-seg.amoblamiento{background:var(--doc-line2)}
      .ba-sw.amoblamiento::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(-45deg,transparent,transparent 3px,rgba(255,255,255,.5) 3px,rgba(255,255,255,.5) 6px)}

      @media (max-width: 767px){
        /* en 390 el cuerpo del capítulo mide ~280px: la fila de cabecera se angosta y las cuatro columnas reparten el resto sin scroll */
        .matriz{--cell:64px;--rowh:44px;--axis:16px;max-width:none}
        .mz-grid{grid-template-columns:var(--rowh) repeat(var(--n,4),minmax(0,1fr))}
        .mz-rowh{padding-right:5px}
        .mz-cell{font-size:9.5px}
        .mz-leg .lg{display:none}
        .mz-leg .sh{display:inline}
        .pl th:first-child,.pl td:first-child{position:sticky;left:0;background:var(--doc-paper);z-index:1;box-shadow:1px 0 0 var(--doc-line)}
        .pl.ind td:nth-child(2){display:none}
        .curva{height:130px}
        .zona-cells{grid-template-columns:1fr 1fr}
        .zona-cells div:last-child{grid-column:span 2}
        .chart{height:150px}
      }
    `,
      }}
    />
  );
}
