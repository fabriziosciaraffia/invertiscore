"use client";

/**
 * CSS del pop-up de ajustes (24-sep-2026). Portado de
 * `docs/wireframes/rediseno-informe/popup-matriz-aprobado.html` con los tokens de la app: el
 * mockup define los suyos (--ink, --sunk…) y acá se leen los `--doc-*` del informe, que ya
 * gobiernan los dos temas. El modal monta el cuerpo dentro de `.doc-tokens`.
 *
 * EL COLOR DE LA CELDA ES EL VEREDICTO, con la tríada de la portada (azul Comprar, ciruela
 * Ajustar, rojo Buscar otra) en su versión de FONDO: tintes claros en el tema claro, oscuros
 * en el oscuro, y el texto de la celda en el tono pleno. Son los hexes del contrato; el tema
 * oscuro es el default de la app (sin data-theme) y el claro se pide con [data-theme="light"].
 *
 * DOS MARCAS Y NINGUNA MÁS: Franco (contorno sólido de tinta y etiqueta) y hoy (contorno
 * punteado y etiqueta). La celda tocada lleva un aro de su propio color, más fino, para que no
 * compita con las dos marcas.
 */
export function PopupAjustesTokens() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .pjx{
        font-family:var(--font-body,system-ui);color:var(--doc-tx);font-variant-numeric:tabular-nums;
        --pjx-c:#9DBCE8; --pjx-c-bg:#1E2B3F; --pjx-c-bd:#2F4566;
        --pjx-a:#D2A9C4; --pjx-a-bg:#34232E; --pjx-a-bd:#4E3545;
        --pjx-b:#F0858C; --pjx-b-bg:#3E1E21; --pjx-b-bd:#5C2B30;
        --pjx-rojo:#EE6A72; --pjx-sunk:var(--doc-paper2); --pjx-ven:var(--doc-tx3);
      }
      [data-theme="light"] .pjx{
        --pjx-c:#2B558F; --pjx-c-bg:#DCE5F1; --pjx-c-bd:#B7C8E1;
        --pjx-a:#6E4560; --pjx-a-bg:#EFE3EB; --pjx-a-bd:#DCC6D4;
        --pjx-b:#C8323C; --pjx-b-bg:#F7DEDF; --pjx-b-bd:#EDBFC2;
        --pjx-rojo:#C8323C;
      }
      .pjx-v{display:inline-flex;align-items:center;gap:3px;font-weight:600;font-size:12px;border-radius:99px;
        padding:1px 8px;white-space:nowrap;border:1px solid transparent;line-height:1.5}
      .pjx-v.c{background:var(--pjx-c-bg);color:var(--pjx-c);border-color:var(--pjx-c-bd)}
      .pjx-v.a{background:var(--pjx-a-bg);color:var(--pjx-a);border-color:var(--pjx-a-bd)}
      .pjx-v.b{background:var(--pjx-b-bg);color:var(--pjx-b);border-color:var(--pjx-b-bd)}
      .pjx-hoy{font-size:13px;color:var(--doc-tx3);margin:-6px 0 14px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .pjx-preg{font-size:14px;margin:0 0 10px;color:var(--doc-tx3);line-height:1.45}
      .pjx-preg strong{color:var(--doc-tx);font-weight:600}
      .pjx-tip{font-size:12.5px;color:var(--doc-tx3);margin:0 0 14px;display:flex;align-items:center;gap:6px}
      .pjx-tip svg{flex:none}

      .pjx-mz{display:grid;gap:9px 8px}
      .pjx-ax{position:relative;display:flex;align-items:center;justify-content:center;min-width:0}
      .pjx-ax > svg:first-child{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
      .pjx-ax span{position:relative;font-size:11px;font-weight:600;background:var(--doc-paper);padding:0 5px;white-space:nowrap}
      .pjx-ax.vert span{writing-mode:vertical-rl;padding:5px 0}
      .pjx-ax.up span{transform:rotate(180deg)}
      .pjx-ax.tu{color:var(--doc-tx)}
      .pjx-ax.ven{color:var(--pjx-ven)}
      .pjx-punta{position:absolute;overflow:visible}
      .pjx-punta.der{right:-7px;top:0;width:26px;height:26px}
      .pjx-punta.izq{left:-7px;top:0;width:26px;height:26px}
      .pjx-punta.abajo{bottom:-7px;left:0;width:24px;height:24px}
      .pjx-punta.arriba{top:-7px;left:0;width:24px;height:24px}
      .pjx-hcol{font-size:12px;color:var(--doc-tx3);text-align:center;align-self:end}
      .pjx-hfil{grid-column:2;font-size:12px;color:var(--doc-tx3);display:flex;align-items:center;justify-content:flex-end;
        text-align:right;line-height:1.15;padding-right:2px}

      .pjx-celda{position:relative;border:1px solid var(--doc-line);border-radius:10px;padding:8px 3px 7px;min-height:60px;
        text-align:center;cursor:pointer;font:inherit;color:inherit;display:flex;flex-direction:column;align-items:center;
        justify-content:center;min-width:0;gap:1px;background:var(--pjx-sunk);
        box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 2px 6px rgba(0,0,0,.45);
        transition:transform .12s ease,box-shadow .12s ease;-webkit-tap-highlight-color:transparent}
      [data-theme="light"] .pjx-celda{box-shadow:0 1px 0 rgba(0,0,0,.05),0 2px 4px rgba(0,0,0,.07)}
      .pjx-celda:hover{transform:translateY(-1px)}
      .pjx-celda:active{transform:translateY(0) scale(.97)}
      @media (prefers-reduced-motion:reduce){.pjx-celda{transition:none}.pjx-celda:hover,.pjx-celda:active{transform:none}}
      .pjx-celda:focus-visible{outline:2px solid var(--doc-tx);outline-offset:2px}
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
      .pjx-celda.sel{outline:2px solid currentColor;outline-offset:2px}
      .pjx-celda.fr{outline:3px solid var(--doc-tx);outline-offset:3px}
      .pjx-celda.hoy{outline:3px dashed var(--doc-tx3);outline-offset:3px}
      .pjx-tag{position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:10.5px;font-weight:700;padding:1px 7px;
        border-radius:99px;white-space:nowrap;line-height:15px;z-index:1}
      .pjx-tag.fr{background:var(--doc-tx);color:var(--doc-paper)}
      .pjx-tag.hoy{background:var(--doc-paper);color:var(--doc-tx);border:1.5px dashed var(--doc-tx3)}

      .pjx-ley{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0}
      .pjx-panel{margin:14px 0 0;border-top:1px solid var(--doc-line);padding-top:12px}
      .pjx-frase{font-size:14.5px;margin:0 0 10px;line-height:1.55}
      .pjx-frase .neg{color:var(--pjx-rojo)}
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
