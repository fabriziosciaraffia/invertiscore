"use client";

/**
 * CSS del pop-up de ajustes. Portado de `docs/wireframes/rediseno-informe/popup-palancas-final.html`
 * con los tokens de la app: el mockup define los suyos (--page, --card, --tx…) y acá se leen
 * los `--doc-*` de la portada, que son los que ya gobiernan el informe en los dos temas.
 *
 * Dos mapeos que vale la pena dejar dichos:
 *  · el azul `--up` del mockup pasa a `--doc-good`, que es el color con el que el informe ya
 *    dice «esto mejora». Un azul nuevo sería un color nuevo en una paleta de dos.
 *  · el CTA usa `--verdict`, el mismo de la card, para que el botón se lea como continuación
 *    de la recomendación y no como un elemento de otra familia.
 *
 * Viaja con el componente (se monta solo cuando el pop-up se abre), no en el árbol de la página.
 */
export function PopupAjustesTokens() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .paj{font-family:var(--font-body,system-ui);color:var(--doc-tx)}
      .paj-chips{display:flex;align-items:center;gap:8px;margin:-4px 0 22px}
      .paj-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;
        letter-spacing:.04em;padding:5px 11px;border-radius:99px;white-space:nowrap;
        background:var(--doc-paper2);border:1px solid var(--doc-line2);color:var(--doc-tx3)}
      .paj-pill.dest{background:var(--doc-tx);color:var(--doc-paper);border-color:var(--doc-tx)}
      .paj-signo{font-size:13px;line-height:1;letter-spacing:normal}
      .paj-fl{color:var(--doc-tx4);font-weight:700;font-size:13px}
      .paj-sec{margin-bottom:26px}
      .paj-st{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;
        color:var(--doc-tx4);margin-bottom:10px}
      .paj-sx{font-size:12px;color:var(--doc-tx3);line-height:1.45;margin:-4px 0 12px}
      .paj-ejex{font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
        color:var(--doc-tx4);text-align:center;margin-bottom:6px;padding-left:52px}
      .paj-mwrap{display:grid;grid-template-columns:auto 1fr;gap:0 8px;align-items:center}
      .paj-ejey{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10.5px;font-weight:600;
        letter-spacing:.05em;text-transform:uppercase;color:var(--doc-tx4);text-align:center;padding:22px 0 0}
      .paj-mtx{border-collapse:separate;border-spacing:4px;width:100%;font-variant-numeric:tabular-nums}
      .paj-mtx th{font-size:11.5px;font-weight:600;color:var(--doc-tx3);padding:3px 2px;text-align:center}
      .paj-mtx th.rot{text-align:right;padding-right:7px;white-space:nowrap;width:44px}
      .paj-mtx td{text-align:center;padding:8px 3px;border-radius:8px;font-size:12.5px;font-weight:700;
        background:var(--doc-paper2);color:var(--doc-tx3);cursor:pointer;line-height:1.2;
        transition:transform .1s,box-shadow .1s}
      .paj-mtx td.vacia{background:transparent;cursor:default}
      .paj-mtx td:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.12)}
      .paj-mtx td small{display:block;font-size:10.5px;font-weight:600;opacity:.75;margin-top:2px}
      .paj-mtx td.cruza{background:color-mix(in srgb,var(--doc-good) 16%,transparent);color:var(--doc-good)}
      .paj-mtx td.hoy{outline:2px solid var(--doc-tx3);outline-offset:-2px}
      .paj-mtx td.mix{background:var(--doc-tx);color:var(--doc-paper)}
      .paj-mtx td.sel{outline:2.5px solid var(--verdict);outline-offset:-2px}
      .paj-leyenda{display:flex;gap:13px;flex-wrap:wrap;font-size:11.5px;color:var(--doc-tx3);
        margin-top:10px;padding-left:52px}
      .paj-leyenda span{display:inline-flex;align-items:center;gap:6px}
      .paj-sw{width:12px;height:12px;border-radius:3px;display:inline-block}
      .paj-sw.a{background:var(--doc-tx)}
      .paj-sw.b{background:color-mix(in srgb,var(--doc-good) 16%,transparent);border:1px solid var(--doc-good)}
      .paj-sw.c{background:var(--doc-paper2);outline:2px solid var(--doc-tx3);outline-offset:-2px}
      .paj-cel{background:var(--doc-paper3,var(--doc-paper2));border-radius:12px;padding:13px 14px;
        margin-top:12px;position:relative}
      .paj-cel .x{position:absolute;top:9px;right:10px;width:24px;height:24px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--doc-tx3);
        cursor:pointer;background:var(--doc-paper)}
      .paj-cel .ct{font-size:13.5px;font-weight:700;margin-bottom:10px;padding-right:30px}
      .paj-cg{display:grid;grid-template-columns:1fr auto;gap:6px 12px;font-size:13px}
      .paj-cg .l{color:var(--doc-tx3)}
      .paj-cg .v{font-weight:700;text-align:right;white-space:nowrap}
      .paj-cg .v.mal{color:var(--signal-red)}
      .paj-eleg{background:var(--doc-paper2);border-radius:12px;padding:16px}
      .paj-chipsm{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
      .paj-chip{background:var(--doc-paper);border:1px solid var(--doc-line2);padding:7px 11px;
        border-radius:10px;font-size:13px;font-weight:600;white-space:nowrap}
      .paj-chip s{color:var(--doc-tx4);font-weight:500;text-decoration-thickness:1.5px;margin-right:5px}
      .paj-plus{color:var(--doc-tx4);font-weight:600}
      .paj-neg{font-size:16px;font-weight:700;letter-spacing:-.015em;padding:12px 0;
        border-top:1px solid var(--doc-line2);border-bottom:1px solid var(--doc-line2);margin-bottom:6px}
      .paj-neg small{display:block;font-size:12px;font-weight:400;color:var(--doc-tx3);margin-top:3px}
      .paj-par{padding:10px 0;font-size:13px}
      .paj-par+.paj-par{border-top:1px solid var(--doc-line2)}
      .paj-par .l{color:var(--doc-tx3);margin-bottom:3px}
      .paj-par .p{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
      .paj-par .a1{font-size:13px;color:var(--doc-tx4);white-space:nowrap}
      .paj-par .fl{color:var(--doc-tx4);font-weight:700}
      .paj-par .b1{font-size:16px;font-weight:700;white-space:nowrap;letter-spacing:-.015em}
      .paj-par .b1.bien{color:var(--doc-good)}
      .paj-par .b1.mal{color:var(--signal-red)}
      .paj-nod table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
      .paj-nod th{font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
        color:var(--doc-tx4);text-align:right;padding:0 0 8px}
      .paj-nod th:first-child{text-align:left}
      .paj-nod td{padding:11px 0;border-top:1px solid var(--doc-line);font-size:13.5px;text-align:right}
      .paj-nod td:first-child{text-align:left;font-weight:600}
      .paj-nod td:first-child em{display:block;font-style:normal;font-weight:400;color:var(--doc-tx3);
        font-size:11.5px;margin-top:2px}
      .paj-nod .num{font-weight:700;font-size:15px;letter-spacing:-.015em;white-space:nowrap}
      .paj-nod .num small{display:block;font-size:11px;font-weight:400;color:var(--doc-tx3);margin-top:2px}
      .paj-nod .dst{color:var(--doc-good);font-weight:700;white-space:nowrap}
      .paj-nod .dst small{display:block;font-size:11px;font-weight:600;opacity:.75;margin-top:2px}
      .paj-nod .paj-oracion{text-align:left;font-weight:400;color:var(--doc-tx2);padding-left:14px;
        line-height:1.5;font-size:13px}
      .paj-pie{margin:10px 0 0}
      .paj-cta{margin-top:4px;padding-top:18px;border-top:1px solid var(--doc-line)}
      .paj-cta p{font-size:13px;color:var(--doc-tx2);line-height:1.5;margin-bottom:12px}
      .paj-btn{display:inline-flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;
        padding:12px 18px;border-radius:99px;background:var(--verdict);color:#fff;cursor:default}
      .paj-btn .ico{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;
        border-radius:50%;background:#fff;flex:none}
      .paj-btn .ico::before{content:"";width:0;height:0;border-left:5px solid var(--verdict);
        border-top:4px solid transparent;border-bottom:4px solid transparent;margin-left:2px}
      @media (max-width:460px){
        .paj-ejex,.paj-leyenda{padding-left:0}
        .paj-mtx td{font-size:11.5px;padding:7px 2px}
        .paj-mtx th.rot{width:36px;font-size:10.5px}
      }
      @media (prefers-reduced-motion:reduce){.paj-mtx td{transition:none}}
`,
      }}
    />
  );
}
