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
      /* ── «Tu resultado a 10 años» (capitulo-v-resultado.html, aprobado 22-sep-2026) ──
         Regla de color del informe, más estrecha que la skill: ROJO para plata que sale, TINTA para
         todo lo demás, con trama o intensidad para distinguir series. El verde y el ocre
         (--doc-good / --doc-warn) no entran acá. Tokens propios del capítulo: la segunda tinta y la
         trama, por tema; el pie en claro a #71717A es el que pasa contraste (3,67:1 contra la tinta
         plena; 4,83:1 con el rótulo blanco). Contrastes medidos en el mockup, panel «Contraste». */
      .doc-dictamen,.doc-tokens{ --doc-ink1:#8A8A90; --doc-lab1:#0C0C0E; --doc-trama-base:#2C2C2F; --doc-trama-linea:#9D9D9E }
      [data-theme="light"] .doc-dictamen,[data-theme="light"] .doc-tokens{ --doc-ink1:#71717A; --doc-lab1:#FFFFFF; --doc-trama-base:#E4E4E7; --doc-trama-linea:#737374 }
      /* gráfico de barras del patrimonio (PatrimonioBarras) */
      .pb-svg{width:100%;height:190px;display:block;margin-top:2px}
      .pb-grid{stroke:var(--doc-line);stroke-dasharray:3 3}
      .pb-tick{font-size:8.5px;fill:var(--doc-tx3);font-family:var(--font-body, system-ui)}
      .pb-anio{font-size:9px;fill:var(--doc-tx4);font-family:var(--font-body, system-ui)}
      .pb-aporte{fill:var(--signal-red)}
      .pb-precio{fill:var(--doc-tx);fill-opacity:.22}
      .pb-trama-base{fill:var(--doc-tx);fill-opacity:.06}
      .pb-trama-linea{stroke:var(--doc-tx);stroke-opacity:.42}
      .pb-parte{fill:none;stroke:var(--doc-tx);stroke-width:2.2}
      .pb-parte-pt{fill:var(--doc-tx)}
      .pb-leg{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-size:10.5px;color:var(--doc-tx3)}
      .pb-sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
      .pb-sw-aporte{background:var(--signal-red)}
      .pb-sw-precio{background:var(--doc-tx);opacity:.22}
      .pb-sw-plus{background:repeating-linear-gradient(45deg,transparent,transparent 2px,var(--doc-tx3) 2px,var(--doc-tx3) 3px)}
      .pb-sw-parte{height:3px;vertical-align:middle;background:var(--doc-tx)}
      /* barra apilada firme/proyectado, forma B (BarraApiladaB) */
      .bb-fp{display:flex;justify-content:space-between;font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--doc-tx3);margin:12px 0 5px}
      .bb-rojo{color:var(--signal-red)}
      .bb-bar{display:flex;height:44px;border-radius:3px;overflow:hidden}
      .bb-s{height:100%;position:relative}
      .bb-s+.bb-s{box-shadow:inset 1px 0 0 var(--doc-paper)}
      .bb-s.pie{background:var(--doc-ink1)} .bb-s.amort{background:var(--doc-tx)}
      .bb-s.plus{background:var(--doc-trama-base)}
      .bb-s.plus::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 4px,var(--doc-trama-linea) 4px,var(--doc-trama-linea) 5.5px)}
      .bb-lab{display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:600;white-space:nowrap;overflow:hidden;font-variant-numeric:tabular-nums}
      .bb-lab.pie{color:var(--doc-lab1)} .bb-lab.amort{color:var(--doc-paper)}
      .bb-rotulos{position:relative;height:34px;margin-top:4px;font-size:10.5px;color:var(--doc-tx2);font-variant-numeric:tabular-nums}
      .bb-rotulos span{position:absolute;top:0;white-space:nowrap;transform:translateX(-50%)}
      .bb-rotulos span::before{content:'';position:absolute;left:50%;top:-6px;width:1px;height:6px;background:var(--doc-line2)}
      .bb-rotulos span b{display:block;color:var(--doc-tx);font-weight:600}
      .bb-nota{font-size:11px;color:var(--doc-tx3);margin-top:6px;line-height:1.45}
      .refi-aviso{font-size:12.5px;line-height:1.5;color:var(--doc-tx2);margin-top:10px;padding:8px 10px;border-left:3px solid var(--signal-red);background:var(--doc-paper2);border-radius:0 8px 8px 0}
      /* ── «Ocupación en renta corta» (capitulo-iii-noches-str.html, aprobado 22-sep-2026): las dos
         celdas y el eje 0–100 (.oc-*), la curva del flujo mensual (.cf-*). Tinta y rojo. ── */
      .oc-dos{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:4px 0 2px}
      @media (max-width:520px){.oc-dos{grid-template-columns:1fr}}
      .oc-c{background:var(--doc-inset-1);border-radius:12px;padding:12px 14px}
      .oc-k{font-family:var(--font-mono, ui-monospace);font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--doc-tx4)}
      .oc-n{font-family:var(--font-mono, ui-monospace);font-size:24px;font-weight:700;color:var(--doc-tx);margin-top:4px;font-variant-numeric:tabular-nums;line-height:1.1}
      .oc-n small{font-family:var(--font-body, system-ui);font-size:11.5px;font-weight:500;color:var(--doc-tx3);margin-left:6px}
      .oc-s{font-size:11.5px;color:var(--doc-tx3);margin-top:5px;line-height:1.45}
      .oc-c.tenue .oc-n{color:var(--doc-ink1)}
      .oc-c.vacia .oc-n{color:var(--doc-tx4);font-size:18px}
      .oc-eje{position:relative;height:6px;border-radius:3px;background:var(--doc-line2);margin:24px 10px 42px}
      .oc-tk{position:absolute;top:6px;width:1px;height:4px;background:var(--doc-line2);transform:translateX(-50%)}
      .oc-tk.may{height:7px;background:var(--doc-tx4)}
      .oc-t{position:absolute;top:15px;font-family:var(--font-mono, ui-monospace);font-size:9.5px;color:var(--doc-tx4);transform:translateX(-50%)}
      .oc-m{position:absolute;top:-4px;width:3px;height:14px;border-radius:2px;transform:translateX(-50%)}
      .oc-m.est{background:var(--doc-tx)}
      .oc-m.real{background:var(--doc-ink1)}
      .oc-l{position:absolute;font-family:var(--font-mono, ui-monospace);font-size:10px;font-weight:700;transform:translateX(-50%);white-space:nowrap}
      .oc-l.est{top:-20px;color:var(--doc-tx)}
      .oc-l.real{top:26px;color:var(--doc-ink1)}
      .cf-svg{width:100%;height:170px;display:block}
      .cf-grid{stroke:var(--doc-line);stroke-dasharray:3 3}
      .cf-tick{font-size:9px;fill:var(--doc-tx4);font-family:var(--font-mono, ui-monospace)}
      .cf-mes{font-size:11px;fill:var(--doc-tx4);font-family:var(--font-mono, ui-monospace)}
      .cf-cero{stroke:var(--doc-tx3);stroke-width:1}
      .cf-prom{stroke:var(--doc-ink1);stroke-width:1;stroke-dasharray:4 4}
      .cf-linea{stroke:var(--doc-tx);stroke-width:2.5}
      .cf-pt{fill:var(--doc-tx)}
      .cf-pt.neg{fill:var(--signal-red)}
      .cf-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:10.5px;color:var(--doc-tx3);margin-top:4px}
      .cf-leg b{color:var(--doc-ink1);font-weight:600}
      .cf-sw{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--doc-tx);margin-right:5px;vertical-align:middle}
      .cf-sw.neg{background:var(--signal-red)}
      .cf-sw.cero{width:14px;height:2px;border-radius:0;background:var(--doc-tx3)}
      .cf-sw.prom{width:14px;height:2px;border-radius:0;background:repeating-linear-gradient(90deg,var(--doc-ink1) 0 4px,transparent 4px 8px)}
      /* ── «Plusvalía» (capitulo-iv-plusvalia.html, aprobado 22-sep-2026): la serie de la comuna contra
         el 3%, tinta plena y tinta tenue; sin verde ni ocre. Los valores intermedios aparecen al
         tocar (click, que sí llega tras el tap) o al pasar el cursor; los extremos van fijos. ── */
      .sp-svg{width:100%;height:210px;display:block}
      .sp-grid{stroke:var(--doc-line);stroke-dasharray:3 3}
      .sp-tick{font-size:8.5px;fill:var(--doc-tx3);font-family:var(--font-body, system-ui)}
      .sp-anio{font-size:9px;fill:var(--doc-tx4);font-family:var(--font-body, system-ui)}
      .sp-ref{fill:none;stroke:var(--doc-ink1);stroke-width:1.6}
      .sp-serie{fill:none;stroke:var(--doc-tx);stroke-width:2.2}
      .sp-pt{fill:var(--doc-tx);pointer-events:none}
      .sp-toque{fill:transparent;cursor:pointer;outline:none}
      .sp-toque:focus-visible+.sp-pt{r:4}
      .sp-valor{font-size:10px;font-weight:600;fill:var(--doc-tx);font-family:var(--font-body, system-ui);font-variant-numeric:tabular-nums;pointer-events:none}
      .sp-acum{font-size:10px;font-weight:700;fill:var(--doc-tx);font-family:var(--font-body, system-ui)}
      .sp-acum-ref{font-size:10px;fill:var(--doc-ink1);font-family:var(--font-body, system-ui)}
      .sp-leg{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-size:10.5px;color:var(--doc-tx3)}
      .sp-sw{display:inline-block;width:14px;height:3px;border-radius:2px;margin-right:5px;vertical-align:middle}
      .sp-sw-serie{background:var(--doc-tx)} .sp-sw-ref{background:var(--doc-ink1)}
      /* ── matriz de sensibilización (mockup-tablas) ── */
      /* ── EL ⓘ (23-sep-2026, info-indicadores.html · opción A) ──
         Disparador de 24 × 24 (WCAG 2.5.8) con el glifo de 15 px adentro; abierto se rellena de
         tinta. Márgenes negativos para que el blanco táctil no empuje la línea del rótulo. */
      .v-i{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin:-5px -5px -5px -1px;padding:0;
        vertical-align:middle;background:none;border:none;border-radius:99px;cursor:pointer;flex:none;color:inherit}
      .v-i::before{content:"i";display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:99px;
        border:1.2px solid var(--doc-tx4);font-family:var(--font-heading, Georgia, serif);font-style:italic;font-weight:700;font-size:10px;
        line-height:1;color:var(--doc-tx3);letter-spacing:0;text-transform:none}
      .v-i.on::before{background:var(--doc-tx);border-color:var(--doc-tx);color:var(--doc-paper)}
      .v-i:focus-visible{outline:2px solid var(--doc-tx);outline-offset:1px}
      /* La hoja chica (solo teléfono): alto del contenido, tope cerca de media pantalla. Gana a la
         regla de la hoja grande (.v-modal-overlay[role=dialog] .v-modal) por especificidad. El
         velo es más liviano: la hoja de abajo se apaga sin taparse. */
      .v-modal-overlay.v-glosa-overlay{z-index:70}
      @media (max-width: 767px){
        .v-modal-overlay.v-glosa-overlay{background:rgba(0,0,0,.28)}
        .v-modal-overlay[role="dialog"] .v-modal.v-glosa{height:auto;max-height:52vh;max-height:52dvh;box-shadow:0 -10px 30px rgba(0,0,0,.22)}
        .v-modal.v-glosa .v-modal-head{border-bottom:none;padding:8px 16px 2px 20px}
        .v-modal.v-glosa .v-modal-head h3{font-family:var(--font-body, system-ui);font-size:16px;font-weight:600}
        .v-modal.v-glosa .v-modal-cuerpo{padding:6px 20px 22px}
      }
      .v-glosa-txt{font-size:14px;line-height:1.6;color:var(--doc-tx2);margin:0}
      .v-glosa-aca{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:14px;padding-top:10px;border-top:1px solid var(--doc-line);font-size:12.5px;color:var(--doc-tx3)}
      .v-glosa-aca b{font-family:var(--font-mono, ui-monospace);font-size:13px;font-weight:700;color:var(--doc-tx);text-align:right}
      /* El popover de escritorio: 300 px anclado al ⓘ, fijo a la ventana, arriba si cabe. */
      .v-pop{position:fixed;z-index:80;width:300px;background:var(--doc-paper);border:1px solid var(--doc-line2);border-radius:12px;
        box-shadow:0 10px 30px rgba(0,0,0,.14),0 1px 3px rgba(0,0,0,.08);padding:14px 16px;color:var(--doc-tx);text-align:left;
        text-transform:none;letter-spacing:0;font-family:var(--font-body, system-ui)}
      .v-pop::before{content:"";position:absolute;top:-6px;left:calc(var(--flecha, 40px) - 5px);width:10px;height:10px;background:var(--doc-paper);
        border-left:1px solid var(--doc-line2);border-top:1px solid var(--doc-line2);transform:rotate(45deg)}
      .v-pop.arriba::before{top:auto;bottom:-6px;transform:rotate(225deg)}
      .v-pop-t{font-size:14px;font-weight:600;margin-bottom:6px}
      .v-pop p{font-size:13px;line-height:1.55;color:var(--doc-tx2);margin:0}
      [data-theme="dark"] .v-pop,:root:not([data-theme="light"]) .v-pop{box-shadow:0 10px 30px rgba(0,0,0,.5)}
      /* ── LAS CAPAS EN OSCURO (23-sep-2026, aprobado sobre capturas: docs/wireframes/rediseno-informe/shots-capas) ──
         En oscuro la sombra casi no se ve, así que la separación la da la SUPERFICIE: cada capa que
         sube es un escalón más clara que la de abajo, con los tokens del informe —página --page
         #0C0C0E → hoja grande --card #1A1A1E → hoja chica --sunk #232328 → popover --line-sunk
         #2C2C30—, un velo más fuerte y un borde fino arriba de cada hoja. Medido con el velo
         compuesto: ΔL* de 5,4 a 8,7 entre capas vecinas, contra 0 a 1,4 antes (la hoja grande y la
         página eran idénticas). El popover es de escritorio y la hoja chica de teléfono: no conviven.
         SOLO OSCURO: todo va detrás de html:not([data-theme="light"]); el claro no cambia.
         DENTRO de cada hoja la escalera de tokens SUBE UN ESCALÓN ENTERA —crudos (--page, --card,
         --sunk, --line) y --doc-*—: aclarar solo el fondo dejaba cinco piezas del color de la hoja
         nueva (.v-centro, y paj-pill, hoy, fila-nav y paj-eleg del pop-up). Los valores de partida se
         capturan en la hoja (--esc-*) y la subida se declara en sus hijos: redeclarar --card y leer
         var(--card) en el mismo elemento se resolvería en cadena. El .doc-tokens de adentro también
         sube, porque «.doc-dictamen .doc-tokens» redeclara los crudos con hex literal. */
      html:not([data-theme="light"]) .v-modal-overlay[role="dialog"]{background:rgba(12,12,14,.86)}
      html:not([data-theme="light"]) .v-modal-overlay[role="dialog"] .v-modal{
        --esc-1:var(--card); --esc-2:var(--sunk); --esc-3:var(--line-sunk);
        background:var(--esc-1);border-top:1px solid var(--line2)}
      html:not([data-theme="light"]) .v-modal-overlay[role="dialog"] .v-modal > *,
      html:not([data-theme="light"]) .v-modal-overlay[role="dialog"] .v-modal .doc-tokens{
        --page:var(--esc-1); --card:var(--esc-2); --sunk:var(--esc-3); --line:var(--esc-3);
        --doc-paper:var(--esc-1); --doc-paper2:var(--esc-2); --doc-paper3:var(--esc-3); --doc-paper4:var(--esc-3);
        --doc-line:var(--esc-3); --doc-inset-0:var(--esc-1); --doc-inset-1:var(--esc-2); --doc-inset-2:var(--esc-3)}
      html:not([data-theme="light"]) .v-modal-overlay.v-glosa-overlay[role="dialog"]{background:rgba(12,12,14,.55)}
      html:not([data-theme="light"]) .v-modal-overlay[role="dialog"] .v-modal.v-glosa{
        --esc-1:var(--sunk); --esc-2:var(--line-sunk); --esc-3:var(--line-sunk)}
      html:not([data-theme="light"]) .v-modal-overlay[role="dialog"] .v-modal.v-glosa > *{--line:var(--line2); --doc-line:var(--line2)}
      html:not([data-theme="light"]) .v-pop{background:var(--line-sunk);border-color:var(--line2)}
      html:not([data-theme="light"]) .v-pop::before{background:var(--line-sunk);border-color:var(--line2)}
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
      .mz-cell.neg{color:var(--signal-red)}
      .mz-cell.umbral{border:1px solid var(--doc-tx)}
      .mz-cell.umbral::after{content:'';position:absolute;top:4px;right:4px;width:5px;height:5px;border-radius:50%;background:var(--doc-tx)}
      /* salto de veredicto: marca mono en Ink al pie de la celda (sin color nuevo) */
      .mz-cell.conver .mz-v{transform:translateY(-5px)}
      .mz-ver{position:absolute;left:0;right:0;bottom:4px;text-align:center;font-family:var(--font-mono, ui-monospace);font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--doc-tx);line-height:1;white-space:nowrap}
      .mz-cell.neg .mz-ver{color:var(--doc-tx)}
      .mz-cell.hoy{box-shadow:inset 0 0 0 2.5px var(--doc-tx);font-weight:700}
      .mz-hoy{position:absolute;top:-1px;left:-1px;font-family:var(--font-mono, ui-monospace);font-size:8px;letter-spacing:.14em;text-transform:uppercase;background:var(--doc-tx);color:var(--doc-paper);padding:2px 5px 2px 6px;border-radius:2px 0 3px 0;line-height:1}
      .mz-note{font-family:var(--font-mono, ui-monospace);font-size:10.5px;color:var(--doc-tx2);line-height:1.6;margin-top:12px;letter-spacing:.02em;max-width:60ch}
      .mz-leg{display:flex;gap:18px;flex-wrap:wrap;margin-top:10px;font-family:var(--font-mono, ui-monospace);font-size:9.5px;letter-spacing:.06em;color:var(--doc-tx3)}
      .mz-leg span{display:inline-flex;align-items:center;gap:6px}
      .mz-leg i{width:11px;height:11px;border-radius:2px;border:1px solid var(--doc-line);background:var(--doc-paper2)}
      .mz-leg .sh{display:none}
      .mz-leg i.hoy{box-shadow:inset 0 0 0 2px var(--doc-tx)}
      .mz-leg i.umbral{border-color:var(--doc-tx);position:relative}
      .mz-leg i.umbral::after{content:'';position:absolute;top:1px;right:1px;width:4px;height:4px;border-radius:50%;background:var(--doc-tx)}
      .mz-leg i.ver{border:0;background:none;width:auto;height:auto;font-style:normal;font-weight:700;color:var(--doc-tx);font-size:10px;line-height:1}

      /* ── planilla (mockup-tablas) ── */
      .pl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
      .pl{border-collapse:separate;border-spacing:0;width:100%;font-family:var(--font-mono, ui-monospace);font-variant-numeric:tabular-nums}
      .pl th,.pl td{padding:5px 6px;border-bottom:1px solid var(--doc-line);text-align:right;white-space:nowrap;font-size:10.5px;line-height:1.3;color:var(--doc-tx2);font-weight:400}
      .pl thead th{font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--doc-tx4);padding-bottom:7px;vertical-align:bottom}
      .pl th:first-child,.pl td:first-child{text-align:left}
      .pl tbody th{color:var(--doc-tx3);font-weight:400}
      .pl tr.tot th,.pl tr.tot td{font-weight:700;color:var(--doc-tx);border-top:2px solid var(--doc-tx);border-bottom:none;padding-top:7px}
      .pl tr.pre th,.pl tr.pre td{color:var(--doc-tx4)}
      .pl tr.ent th{color:var(--doc-tx);font-weight:700}
      .pl .neg{color:var(--signal-red)}
      /* dentro del modal (720px) las ocho columnas entran con el padding corto */
      .v-modal .pl th,.v-modal .pl td{padding:5px 4px;font-size:10px}

      /* ── fila de dato compartida (mockup-tablas) ── */
      .drows{margin-top:4px}
      .drow{display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:14px;min-height:30px;padding:5px 0;border-bottom:1px solid var(--doc-line)}
      .drow .dk{font-size:12.5px;color:var(--doc-tx2);line-height:1.35}
      .drow .dk .v-i{margin-left:1px}
      .drow .dk small{display:block;font-size:10.5px;color:var(--doc-tx4);margin-top:1px;line-height:1.35}
      .drow .dv{font-family:var(--font-mono, ui-monospace);font-size:12.5px;color:var(--doc-tx);white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}
      .drow .dv em{font-style:normal;font-family:var(--font-mono, ui-monospace);font-size:9.5px;color:var(--doc-tx4);display:inline-block;width:30px;text-align:left;margin-left:5px}
      .drow.in .dk{color:var(--doc-tx);font-weight:600}
      .drow.in .dv{font-weight:700}
      .drow.neg .dv{color:var(--signal-red)}
      .drow.tot{border-top:2px solid var(--doc-tx);border-bottom:none;margin-top:3px;padding-top:8px}
      .drow.tot .dk{color:var(--doc-tx);font-weight:600;font-size:13px}
      .drow.tot .dv{font-weight:700;font-size:14px}

      /* ── barra de tramos del Fall — RETIRADA ENTERA (16-sep-2026) ──
         Estuvo acá con sus cinco selectores hasta hoy. Salió del capítulo II de las dos
         modalidades porque cambiaba de unidad a mitad del parque sin avisar (el acta larga
         está en «reparto-ingreso.ts»), y su último consumidor era «/dev/drawers-pixel».
         Reemplazado se retira: el componente, estos selectores, el export del índice y los
         «tramosBarra» de los fixtures se fueron en el mismo cambio. Lo que decía ahora está
         escrito, en «.doc-reparto», acá abajo. */

      /* ── el reparto del ingreso (16-sep-2026) ──
         La línea que reemplazó a la barra. Va TIPOGRAFÍA, no gráfico, y hereda el tamaño de
         la prosa del vocabulario. El único color es el «--signal-red» del monto cuando la
         plata SALE, y no es nuevo: la fila total de este mismo capítulo ya lo aplica. Cuando
         queda plata, va en tinta — la frase afirma un hecho, no emite un veredicto, así que
         el verde del tramo libre de la barra NO se muda acá. */
      .doc-reparto{font-size:13px;line-height:1.5;color:var(--doc-tx2);margin:2px 0 10px}
      .doc-reparto b{color:var(--doc-tx);font-weight:700}

      /* ── colchón (CONGELADO · V) ── */
      .colchon{display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--doc-paper2);border:1px solid var(--doc-line);border-radius:3px;margin-top:2px}
      .colchon .k{font-size:12.5px;color:var(--doc-tx3);flex:1}
      .colchon .v{font-family:var(--font-mono, ui-monospace);font-size:14px;font-weight:700;color:var(--doc-tx);white-space:nowrap}
      .colchon .v small{font-size:10px;color:var(--doc-tx4);font-weight:400}
      .colchon .v.neg{color:var(--signal-red)}
      .v-copy{font-size:13.5px;line-height:1.65;color:var(--doc-tx2);max-width:60ch;margin-bottom:12px}

      /* ── curva anual (CONGELADO · III) y chart de patrimonio (VI) ── */
      .curva{width:100%;height:150px;display:block}
      /* -- Serie ANUAL con signo (capitulo II STR) --
         El SVG dibuja SOLO geometria y por eso puede estirarse; TODO el texto es HTML
         posicionado en % sobre el mismo sistema de coordenadas, asi que conserva su tamano
         a cualquier ancho. Medido: con el texto adentro renderizaba a 4,7px a 390. */
      .ca-wrap{margin:6px 0 4px}
      .ca-plot{position:relative;height:118px}
      .ca-svg{width:100%;height:100%;display:block;overflow:visible}
      .ca-pt{position:absolute;width:7px;height:7px;border-radius:50%;
        transform:translate(-50%,-50%);pointer-events:none}
      .ca-pt.ext{width:9px;height:9px}
      .ca-pt.neg{background:var(--signal-red)}
      .ca-pt.pos{background:var(--doc-tx)}
      .ca-val{position:absolute;font-family:var(--font-mono, ui-monospace);font-size:10.5px;
        color:var(--doc-tx3);white-space:nowrap;font-variant-numeric:tabular-nums}
      .ca-cero-lbl{position:absolute;left:0;transform:translateY(-50%);
        font-family:var(--font-mono, ui-monospace);font-size:9.5px;color:var(--doc-tx4);
        background:var(--doc-paper);padding-right:3px}
      .ca-eje{position:relative;height:14px;margin-top:2px}
      .ca-eje span{position:absolute;font-family:var(--font-mono, ui-monospace);
        font-size:9.5px;letter-spacing:.04em;color:var(--doc-tx4);white-space:nowrap}
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
      /* cuarto tono en la barra apilada de "de dónde sale tu parte" (LTR pasa 0 y no lo dibuja) */

      @media (max-width: 767px){
        /* en 390 el cuerpo del capítulo mide ~280px: la fila de cabecera se angosta y las cuatro columnas reparten el resto sin scroll */
        .matriz{--cell:64px;--rowh:44px;--axis:16px;max-width:none}
        .mz-grid{grid-template-columns:var(--rowh) repeat(var(--n,4),minmax(0,1fr))}
        .mz-rowh{padding-right:5px}
        .mz-cell{font-size:9.5px}
        /* cabecera + toggle: a 390 el título mono no cabe junto al toggle y el botón "TIR"
           quedaba recortado por el contenedor (overflow clip del capítulo). Envuelve. */
        .mx-head{flex-wrap:wrap;gap:6px 10px}
        .mz-ver{font-size:7px;bottom:3px;letter-spacing:.04em}
        .mz-cell.conver .mz-v{transform:translateY(-4px)}
        .mz-leg .lg{display:none}
        .mz-leg .sh{display:inline}
        .pl th:first-child,.pl td:first-child{position:sticky;left:0;background:var(--doc-paper);z-index:1;box-shadow:1px 0 0 var(--doc-line)}
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
