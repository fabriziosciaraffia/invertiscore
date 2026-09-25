"use client";

/**
 * CSS del pop-up de ajustes (24-sep-2026 · versión final 25-sep-2026). Portado de
 * `docs/wireframes/rediseno-informe/popup-matriz-aprobado.html` con los tokens de la app: el
 * mockup define los suyos (--ink, --sunk…) y acá se leen los `--doc-*` del informe, que ya
 * gobiernan los dos temas. El modal monta el cuerpo dentro de `.doc-tokens`. El tema oscuro es el
 * default de la app (sin data-theme) y el claro se pide con [data-theme="light"].
 *
 * DOS SISTEMAS DE COLOR, UNO POR POP-UP:
 *  · AJUSTAR — la ESCALA DE CERCANÍA A COMPRAR, toda azul: `e0` pleno con letra de contraste «ya
 *    es Comprar», `e1` fácil de negociar, `e2` con argumentos, `e3` difícil (casi blanco en claro,
 *    casi fondo en oscuro), y `fx` rayado «fuera de alcance». Hexes del contrato final.
 *  · COMPRAR — la tríada de veredicto de la portada (azul, ciruela, rojo) en versión de fondo,
 *    sin cambios: cada celda con el color del veredicto al que cae.
 * El ciruela, en Ajustar, queda solo en las píldoras del veredicto.
 *
 * DOS MARCAS Y NINGUNA MÁS, FINAS: Franco con borde sólido de 2 px y hoy con borde punteado de
 * 1,5 px, cada una con su etiqueta chica en la esquina. La celda tocada lleva un borde de 2 px de
 * su propio color.
 */
export function PopupAjustesTokens() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .pjx{
        font-family:var(--font-body,system-ui);color:var(--doc-tx);font-variant-numeric:tabular-nums;
        --pjx-c:#9DBCE8; --pjx-c-bg:#1E2B3F; --pjx-c-bd:#2F4566;
        --pjx-a:#D8AECA; --pjx-a-bg:#35232F; --pjx-a-bd:#4E3545;
        --pjx-b:#F0858C; --pjx-b-bg:#3E1E21; --pjx-b-bd:#5C2B30;
        --pjx-e0-bg:#8DB0E3; --pjx-e0-tx:#0B1A2E; --pjx-e0-bd:#8DB0E3;
        --pjx-e1-bg:#45679A; --pjx-e1-tx:#EEF3FB; --pjx-e1-bd:#5A7CAE;
        --pjx-e2-bg:#2C4468; --pjx-e2-tx:#D2E0F4; --pjx-e2-bd:#3C5780;
        --pjx-e3-bg:#1F2A3B; --pjx-e3-tx:#A3B6D2; --pjx-e3-bd:#2E3C52;
        --pjx-rojo:#EE6A72; --pjx-sunk:var(--doc-paper2); --pjx-sunk2:var(--doc-line); --pjx-ven:var(--doc-tx3);
      }
      [data-theme="light"] .pjx{
        --pjx-c:#2B558F; --pjx-c-bg:#DCE5F1; --pjx-c-bd:#B7C8E1;
        --pjx-a:#6E4560; --pjx-a-bg:#F1E4EC; --pjx-a-bd:#DCC6D4;
        --pjx-b:#C8323C; --pjx-b-bg:#F7DEDF; --pjx-b-bd:#EDBFC2;
        --pjx-e0-bg:#2B558F; --pjx-e0-tx:#FFFFFF; --pjx-e0-bd:#2B558F;
        --pjx-e1-bg:#94AFD6; --pjx-e1-tx:#10284A; --pjx-e1-bd:#7F9ECB;
        --pjx-e2-bg:#C5D4EA; --pjx-e2-tx:#1E3F6E; --pjx-e2-bd:#AEC2E0;
        --pjx-e3-bg:#EAF0F7; --pjx-e3-tx:#4A6388; --pjx-e3-bd:#D5DFEC;
        --pjx-rojo:#C8323C;
      }
      .pjx-v{display:inline-flex;align-items:center;gap:3px;font-weight:600;font-size:12px;border-radius:99px;
        padding:1px 8px;white-space:nowrap;border:1px solid transparent;line-height:1.5}
      .pjx-v.c{background:var(--pjx-e0-bg);color:var(--pjx-e0-tx);border-color:var(--pjx-e0-bd)}
      .pjx-v.a{background:var(--pjx-a-bg);color:var(--pjx-a);border-color:var(--pjx-a-bd)}
      .pjx-v.b{background:var(--pjx-b-bg);color:var(--pjx-b);border-color:var(--pjx-b-bd)}
      .pjx-hoy{font-size:13px;color:var(--doc-tx3);margin:-6px 0 14px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .pjx-preg{font-size:14px;margin:0 0 12px;color:var(--doc-tx);line-height:1.5}
      .pjx-preg strong{font-weight:600}
      .pjx-tip{font-size:12.5px;color:var(--doc-tx3);margin:0 0 12px;display:flex;align-items:center;gap:6px}
      .pjx-tip svg{flex:none}

      .pjx-escala{margin:0 0 14px}
      .pjx-escala .tit{font-size:12.5px;color:var(--doc-tx3);margin:0 0 6px}
      .pjx-escala .barra{display:grid;grid-template-columns:repeat(5,1fr);gap:3px}
      .pjx-escala .sw{height:10px;border-radius:3px;border:1px solid transparent}
      .pjx-escala .lab{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-top:4px}
      .pjx-escala .lab span{font-size:10.5px;color:var(--doc-tx3);line-height:1.2}
      .pjx-escala .lab span:last-child{text-align:right}
      .pjx-escala .sw.e0{background:var(--pjx-e0-bg);border-color:var(--pjx-e0-bd)}
      .pjx-escala .sw.e1{background:var(--pjx-e1-bg);border-color:var(--pjx-e1-bd)}
      .pjx-escala .sw.e2{background:var(--pjx-e2-bg);border-color:var(--pjx-e2-bd)}
      .pjx-escala .sw.e3{background:var(--pjx-e3-bg);border-color:var(--pjx-e3-bd)}
      .pjx-escala .sw.fx{background:repeating-linear-gradient(135deg,var(--pjx-sunk2) 0 3px,var(--doc-paper) 3px 6px);border:1px dashed var(--doc-tx3)}

      .pjx-mz{display:grid;gap:8px 7px}
      .pjx-ax{position:relative;display:flex;align-items:center;justify-content:center;min-width:0}
      .pjx-ax > svg:first-child{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
      .pjx-ax span{position:relative;font-size:11px;font-weight:600;background:var(--doc-paper);padding:0 5px;white-space:nowrap}
      .pjx-ax.vert span{writing-mode:vertical-rl;padding:5px 0}
      .pjx-ax.up span{transform:rotate(180deg)}
      .pjx-ax.tu{color:var(--doc-tx)}
      .pjx-ax.ven{color:var(--pjx-ven)}
      .pjx-punta{position:absolute;overflow:visible}
      .pjx-punta.der{right:-7px;top:0;width:24px;height:24px}
      .pjx-punta.izq{left:-7px;top:0;width:24px;height:24px}
      .pjx-punta.abajo{bottom:-7px;left:0;width:22px;height:22px}
      .pjx-punta.arriba{top:-7px;left:0;width:22px;height:22px}
      .pjx-hcol{font-size:12px;color:var(--doc-tx3);text-align:center;align-self:end}
      .pjx-hfil{grid-column:2;font-size:12px;color:var(--doc-tx3);display:flex;align-items:center;justify-content:flex-end;
        text-align:right;line-height:1.15;padding-right:2px}

      .pjx-celda{position:relative;border:1px solid var(--doc-line);border-radius:10px;padding:10px 4px;min-height:54px;
        text-align:center;cursor:pointer;font:inherit;color:inherit;display:flex;flex-direction:column;align-items:center;
        justify-content:center;min-width:0;gap:1px;background:var(--pjx-sunk);
        box-shadow:0 1px 0 rgba(255,255,255,.04) inset,0 2px 6px rgba(0,0,0,.4);
        transition:transform .12s ease,box-shadow .12s ease;-webkit-tap-highlight-color:transparent}
      [data-theme="light"] .pjx-celda{box-shadow:0 1px 0 rgba(0,0,0,.04),0 2px 4px rgba(0,0,0,.06)}
      .pjx-celda:hover{transform:translateY(-1px)}
      .pjx-celda:active{transform:scale(.97)}
      @media (prefers-reduced-motion:reduce){.pjx-celda{transition:none}.pjx-celda:hover,.pjx-celda:active{transform:none}}
      .pjx-celda:focus-visible{outline:2px solid var(--doc-tx);outline-offset:2px}
      /* AJUSTAR · el número que falta, en UNA línea también en el teléfono, y su dificultad. */
      .pjx-celda .n{font-size:15.5px;font-weight:600;white-space:nowrap;letter-spacing:-.01em;line-height:1.2}
      .pjx-celda .n small{font-size:inherit;font-weight:600}
      .pjx-celda .sub{font-size:10.5px;margin-top:1px;opacity:.9;white-space:nowrap}
      .pjx-celda.e0{background:var(--pjx-e0-bg);border-color:var(--pjx-e0-bd);color:var(--pjx-e0-tx)}
      .pjx-celda.e1{background:var(--pjx-e1-bg);border-color:var(--pjx-e1-bd);color:var(--pjx-e1-tx)}
      .pjx-celda.e2{background:var(--pjx-e2-bg);border-color:var(--pjx-e2-bd);color:var(--pjx-e2-tx)}
      .pjx-celda.e3{background:var(--pjx-e3-bg);border-color:var(--pjx-e3-bd);color:var(--pjx-e3-tx)}
      .pjx-celda.fx{background:repeating-linear-gradient(135deg,var(--pjx-sunk) 0 6px,var(--doc-paper) 6px 12px);
        border:1px dashed var(--doc-tx3);color:var(--doc-tx2)}
      .pjx-celda.fx .n{font-size:13.5px}
      /* COMPRAR · como estaba: veredicto al que cae y cuánto te queda al mes. */
      .pjx-celda .l1{font-size:10.5px;line-height:1.1;font-weight:600}
      .pjx-celda .l2{font-size:15px;font-weight:600;line-height:1.15}
      .pjx-celda .l2.chica{font-size:12.5px}
      .pjx-celda .l3{font-size:10.5px;line-height:1.1;opacity:.85}
      .pjx-celda.c{background:var(--pjx-c-bg);border-color:var(--pjx-c-bd);color:var(--pjx-c)}
      .pjx-celda.a{background:var(--pjx-a-bg);border-color:var(--pjx-a-bd);color:var(--pjx-a)}
      .pjx-celda.b{background:var(--pjx-b-bg);border-color:var(--pjx-b-bd);color:var(--pjx-b)}
      .pjx-celda .l2.tinta{color:var(--doc-tx)}
      .pjx-celda .l2.neg{color:var(--pjx-rojo)}
      .pjx-celda .l3.tinta{color:var(--doc-tx3)}
      /* LAS DOS MARCAS, FINAS. */
      .pjx-celda.fr{border:2px solid var(--doc-tx)}
      .pjx-celda.hoy{border:1.5px dashed var(--doc-tx2)}
      .pjx-celda.sel{border:2px solid currentColor}
      .pjx-tag{position:absolute;top:-9px;left:8px;font-size:10px;font-weight:600;padding:0 6px;border-radius:99px;
        line-height:16px;white-space:nowrap;z-index:1}
      .pjx-tag.fr{background:var(--doc-tx);color:var(--doc-paper)}
      .pjx-tag.hoy{background:var(--doc-paper);color:var(--doc-tx2);border:1px solid var(--doc-line)}

      .pjx-ley{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0}
      .pjx-panel{margin:18px 0 0;border-top:1px solid var(--doc-line);padding-top:12px}
      .pjx-frase{font-size:14px;margin:0 0 10px;line-height:1.55}
      .pjx-frase .neg{color:var(--pjx-rojo)}
      /* AJUSTAR · la tabla Hoy / Así. */
      .pjx-tab{width:100%;border-collapse:collapse;font-size:13.5px}
      .pjx-tab th{font-size:12px;font-weight:600;color:var(--doc-tx3);text-align:right;padding:0 0 6px;border-bottom:1px solid var(--doc-tx)}
      .pjx-tab th:first-child{text-align:left}
      .pjx-tab th.asi{color:var(--doc-tx)}
      .pjx-tab td{padding:7px 0;border-bottom:1px solid var(--doc-line);text-align:right;white-space:nowrap}
      .pjx-tab td:first-child{text-align:left;color:var(--doc-tx3);padding-right:8px;white-space:normal}
      .pjx-tab td.asi{font-weight:600;padding-left:10px}
      .pjx-tab td.hoy{color:var(--doc-tx3);padding-left:10px}
      .pjx-tab td.neg{color:var(--pjx-rojo)}
      /* COMPRAR · las cuatro cifras, como estaban. */
      .pjx-cifras{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
      .pjx-cifra{background:var(--pjx-sunk);border-radius:10px;padding:8px 10px}
      .pjx-cifra .r{font-size:11.5px;color:var(--doc-tx3)}
      .pjx-cifra .n{font-size:17px;font-weight:600}
      .pjx-cifra .n.neg{color:var(--pjx-rojo)}
      .pjx-mercado{margin:14px 0 0;font-size:13px;color:var(--doc-tx2);line-height:1.55}
      .pjx-cta{margin:16px 0 0;padding-top:12px;border-top:1px solid var(--doc-line)}
      .pjx-cta p{font-size:12.5px;color:var(--doc-tx3);margin:0 0 8px}
      .pjx-btn{display:inline-flex;align-items:center;padding:9px 14px;border-radius:10px;background:var(--pjx-sunk);
        color:var(--doc-tx3);font-size:13.5px;font-weight:600;cursor:not-allowed}
      `,
      }}
    />
  );
}
