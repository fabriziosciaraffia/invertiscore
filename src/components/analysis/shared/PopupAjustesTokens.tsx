"use client";

/**
 * CSS del pop-up de ajustes. Portado de `docs/wireframes/rediseno-informe/popup-palancas-final.html`
 * con los tokens de la app: el mockup define los suyos (--page, --card, --tx…) y acá se leen
 * los `--doc-*` de la portada, que son los que ya gobiernan el informe en los dos temas.
 *
 * TRES FAMILIAS DE COLOR, Y NINGUNA CUARTA (auditoría del 13-sep-2026):
 *  · la TRÍADA DEL VEREDICTO. Todo lo que nombra un veredicto se pinta con ella. «La celda
 *    llega a Comprar», «llegas a Comprar» y el Score de destino van en `--doc-comprar`, que
 *    es el azul de la tríada nombrable sin depender del veredicto de la fila. Hasta hoy iban
 *    en `--doc-good`: un verde que en la página significa «este dato está bien», no «este
 *    caso pasa a Comprar». Eran dos afirmaciones distintas con el mismo color, y encima el
 *    verde compite con el rojo de Franco en una paleta de dos. El CTA sigue en `--verdict`
 *    —el de la fila— para leerse como continuación de la card.
 *  · el SEMÁFORO DEL DATO, `--doc-good` / `--signal-red`, y solo donde hay un dato en un eje
 *    ordinal: flujo mensual y retorno por cada $100, que pueden ser negativos. Es la misma
 *    excepción documentada del Dial y el Thermo.
 *  · el ROJO DE FRANCO por la regla del rojo: la plata que el ajuste te exige poner el día
 *    uno. Métrica que pide atención, no decoración.
 *
 * La selección de una celda NO es color: es un aro de tinta. Antes usaba `--verdict`, o sea
 * dibujaba un aro ciruela alrededor de una celda que dice «llega a Comprar».
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
      /* LA CELDA MANDA, NO EL ANCHO DISPONIBLE. Con \`width:100%\` una grilla de dos columnas
         estiraba las celdas hasta deformarlas; acá el ancho lo fija la celda y la tabla ocupa
         lo que ocupe, centrada. Así 1×1 y 7×3 se leen con la misma tipografía y el mismo alto
         de fila, que es lo que las hace parecer la misma pieza. */
      .paj-mwrap{display:grid;grid-template-columns:auto auto;gap:0 8px;align-items:center;justify-content:center}
      /* EL TOPE DE ALTO SE FUE, Y LA PREMISA DEL COMENTARIO VIEJO ERA FALSA (17-sep-2026).
         Decía «tope pensado para 7 filas» y el tope era 326 px (280 bajo 460). Medido en el
         navegador a 390: la cabecera mide 30,5 px y cada fila 46,5, así que siete filas miden
         356 y seis miden 310. Nunca dio para siete ni para seis: cortaba en cinco.
         Medido sobre el parque: 46 de 681 matrices (6,8%) se cortaban, y en 5 la celda que la
         leyenda llama «lo que Franco recomienda» abría FUERA DE VISTA — dentro de una caja con
         scroll propio adentro de un modal que ya scrollea, o sea sin ninguna señal de que
         hubiera algo más abajo.
         Lo que el tope compraba era altura del modal, y el modal ya mide entre 1.200 y 1.950 px
         al abrir: sacarlo suma 76 px en el peor caso (7 filas) sobre el tope de 280. La caja se
         queda —es la que centra la tabla en la rejilla— sin recortarla. */
      .paj-mwrap{max-height:none}
      .paj-mtxbox{max-height:none}
      .paj-ejey{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10.5px;font-weight:600;
        letter-spacing:.05em;text-transform:uppercase;color:var(--doc-tx4);text-align:center;padding:22px 0 0}
      .paj-mtx{border-collapse:separate;border-spacing:4px;font-variant-numeric:tabular-nums;
        table-layout:fixed}
      .paj-mtx td,.paj-mtx th:not(.rot){width:150px}
      .paj-mwrap.sola .paj-mtx td,.paj-mwrap.sola .paj-mtx th:not(.rot){width:190px}
      /* Una sola fila: sin eje vertical, la tabla queda en una columna de la rejilla y su
         cabecera de fila se ensancha para que el rótulo del pie quepa en una línea. */
      .paj-mwrap.linea{grid-template-columns:auto}
      .paj-mwrap.linea .paj-mtx th.rot{width:auto;padding-right:10px;text-align:right}
      .paj-mwrap.linea .paj-mtx th.rot small{display:block;font-size:10px;font-weight:400;
        color:var(--doc-tx4);margin-top:2px;line-height:1.3;white-space:normal;max-width:110px}
      .paj-mtx th{font-size:11.5px;font-weight:600;color:var(--doc-tx3);padding:3px 2px;text-align:center}
      .paj-mtx th small{display:block;font-size:10px;font-weight:400;color:var(--doc-tx4);
        margin-top:2px;line-height:1.3;white-space:normal}
      .paj-mtx th.rot{text-align:right;padding-right:7px;white-space:nowrap;width:44px}
      .paj-mtx td{text-align:center;padding:8px 3px;border-radius:8px;font-size:12.5px;font-weight:700;
        background:var(--doc-paper2);color:var(--doc-tx3);cursor:pointer;line-height:1.2;
        transition:transform .1s,box-shadow .1s}
      .paj-mtx td.vacia{background:transparent;cursor:default}
      .paj-mtx td:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.12)}
      .paj-mtx td small{display:block;font-size:10.5px;font-weight:600;opacity:.75;margin-top:2px}
      .paj-mtx td.cruza{background:color-mix(in srgb,var(--doc-comprar) 16%,transparent);color:var(--doc-comprar)}
      /* EL ARO DE HOY VA EN SOMBRA INSET, NO EN OUTLINE (15-sep-2026). Precedente directo:
         «.mz-cell.hoy» (TokensShared.tsx:42) marca el hoy con box-shadow inset por la misma
         razon. Con outline, «td.sel» —que tambien es outline, con la misma especificidad y
         declarado despues— se lo llevaba puesto: al seleccionar la celda del aro el aro gris
         DESAPARECIA y la celda quedaba sin la marca que la leyenda llama «hoy». Bug del
         13-sep, ajeno al chip. Outline y box-shadow no compiten, asi que ahora conviven: el
         gris por dentro dice cual es la de hoy, el de tinta por fuera dice cual tocaste.

         LA MARCA ES EL ARO Y NADA MAS, como el contrato visual
         (popup-palancas-final.html:77). Entre el 14 y el 15 de septiembre hubo aca un chip
         de tinta portado de «.mz-hoy»; se retiro porque en ESTA matriz la tinta plena ya
         significa «el optimo» (td.mix y el swatch .paj-sw.a la nombran), mientras que en la
         matriz de origen ninguna celda lleva tinta y por eso alla el chip no ambigua. */
      .paj-mtx td.hoy{box-shadow:inset 0 0 0 2px var(--doc-tx3)}
      /* La sombra de hover y el aro son la MISMA propiedad, asi que la celda de hoy tiene que
         listar las dos o pierde una: sin esta linea el aro gris se comia el realce al pasar
         por encima, que es la unica senal de que la celda se puede tocar. */
      .paj-mtx td.hoy:hover{box-shadow:inset 0 0 0 2px var(--doc-tx3),0 3px 10px rgba(0,0,0,.12)}
      .paj-mtx td.mix{background:var(--doc-tx);color:var(--doc-paper)}
      /* El aro de selección va POR FUERA (offset positivo) y en tinta: así se ve también
         sobre la celda elegida, que ya tiene el fondo de tinta lleno. Cabe en el
         \`border-spacing:4px\` sin tocar a la vecina. */
      .paj-mtx td.sel{outline:2px solid var(--doc-tx);outline-offset:1px}
      .paj-leyenda{display:flex;gap:13px;flex-wrap:wrap;font-size:11.5px;color:var(--doc-tx3);
        margin-top:10px;padding-left:52px}
      .paj-leyenda span{display:inline-flex;align-items:center;gap:6px}
      .paj-sw{width:12px;height:12px;border-radius:3px;display:inline-block}
      .paj-sw.a{background:var(--doc-tx)}
      /* LA CELDA QUE CAE (15-sep-2026). Es el fondo pelado de «.paj-mtx td», sin el azul de
         «llega» ni ninguna marca propia: en la matriz de COMPRAR el gris deja de ser el
         estado por defecto y pasa a significar algo, así que la leyenda lo nombra. El swatch
         es el mismo color que la celda para que se reconozca de un vistazo. */
      .paj-sw.e{background:var(--doc-paper2)}
      .paj-sw.b{background:color-mix(in srgb,var(--doc-comprar) 16%,transparent);border:1px solid var(--doc-comprar)}
      /* EL SWATCH DEL ARO, la cuarta entrada. Se dibuja igual que la marca que nombra: aro de
         tinta POR FUERA sobre fondo de tarjeta, con el mismo offset positivo que «td.sel».
         El «margin:1px» le hace sitio al aro dentro de la caja de 12px, o el outline se come
         al vecino de la leyenda. Del contrato, «.sw.d». */
      .paj-sw.d{background:var(--doc-paper);outline:2px solid var(--doc-tx);outline-offset:1px;margin:1px}

      /* ── EL MENÚ DE RESPUESTAS ──────────────────────────────────────────────
         Se monta sobre «.fila-nav», que NO vive acá: la define la portada como
         «.doc-dictamen .fila-nav» (PortadaInforme.tsx:1029) y el pop-up cae dentro de ese
         scope —verificado en el DOM: la cadena es .paj › .doc-tokens › .v-modal › … ›
         .doc-dictamen— así que la rejilla, el radio, el borde que se pinta al hover, la
         elevación de 1px, el disco de 32px que se invierte y el anillo de foco en Signal Red
         se heredan sin escribir una línea.
         Lo único que se corrige de la herencia es el GAP DE FILA: producción lo tiene en 0
         porque allá la fila es de una sola línea, y acá el trade-off es una segunda fila que
         quedaría pegada al título. */
      .paj-opts{display:flex;flex-direction:column;gap:8px}
      .paj-opts .fila-nav{gap:4px 14px}
      /* LA ELEGIDA NO FLOTA Y LAS ALTERNATIVAS SÍ — regla del sistema para conjuntos de
         opciones. La marca de activa va en EL DISCO, que es pieza chica y admite la tinta
         invertida; la fila alta no se invierte porque el sistema no tiene ese gesto escrito. */
      .paj-opts .fila-nav.on{border-color:var(--doc-line2)}
      .paj-opts .fila-nav.on:hover{box-shadow:none;transform:none}
      .paj-opts .fila-nav.on .disco{background:var(--doc-tx);border-color:var(--doc-tx);color:var(--doc-paper)}
      .paj-opt-t{font-size:13.5px;font-weight:700;letter-spacing:-.01em}
      .paj-opt-t s{color:var(--doc-tx4);font-weight:500;margin-right:5px}
      .paj-opt-sub{display:block;font-size:11.5px;font-weight:400;color:var(--doc-tx3);margin-top:2px}
      /* NINGÚN GRUPO SE PARTE POR DENTRO. A 390 px la línea rompía entre «30» y «años», que
         quedaba huérfano arriba. Precedente: «.rec-chip» y «.rec-chip-g» de «Lo que haría
         yo», que resuelven exactamente esto al mismo ancho y con acta escrita. Y el «·» viaja
         DENTRO del grupo que lo precede, igual que allá el «+» viaja con el primer chip: así
         el salto cae siempre después del separador y el «·» no puede quedar solo al principio
         de una línea. */
      .paj-opt-sub .nb{white-space:nowrap}
      .paj-opt-sub b{font-weight:700;color:var(--doc-tx)}
      .paj-opt-v{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;
        letter-spacing:-.015em;text-align:right}
      .paj-opt-v small{display:block;font-size:10.5px;font-weight:600;color:var(--doc-tx3);
        letter-spacing:.02em;margin-top:1px}
      /* EL TRADE-OFF, en fila propia y a lo ancho. Precedente de tratamiento: «.pal-detail»
         —chica, en gris de cuerpo— que es como el informe dice una acotación bajo una fila. */
      .paj-opt-tr{grid-column:1/-1;font-size:11.5px;line-height:1.45;color:var(--doc-tx3)}
      /* EL SWATCH DE «HOY» NO PUEDE SER EL COLOR DE LA CELDA QUE CAE (17-sep-2026).
         Llevaba «--doc-paper2», que es exactamente el fondo de «.paj-mtx td» —o sea el de la
         celda caída y el de su swatch «.paj-sw.e»—, así que en COMPRAR la leyenda tenía dos
         entradas con el mismo gris y lo único que las separaba era un aro de 2 px dentro de un
         cuadrado de 12. Medido en el navegador, en los dos temas: rgb(244,244,246) las dos en
         claro, rgb(26,26,30) en oscuro.
         Y la marca que nombra tampoco es un fondo: «td.hoy» es un ARO inset sobre la celda que
         sea —azul, gris o de tinta—. El swatch se dibuja como su marca, que es lo que «.paj-sw.d»
         ya hace con el aro de selección y su acta. Sobre «--doc-paper» el aro queda solo, que es
         justamente lo que la marca es. */
      .paj-sw.c{background:var(--doc-paper);outline:2px solid var(--doc-tx3);outline-offset:-2px}
      /* La celda única: una línea, no un cuadrito con ejes alrededor. */
      .paj-unica{display:flex;justify-content:space-between;align-items:center;gap:12px;
        background:var(--doc-paper2);border-radius:12px;padding:14px 16px;cursor:pointer;font-size:13.5px}
      .paj-unica .k{color:var(--doc-tx2)}
      .paj-unica .v{font-weight:700;white-space:nowrap}
      .paj-unica .v.cruza{color:var(--doc-comprar)}
      /* La promesa de la celda única, que salió del cuadrito a su propia línea (17-sep-2026).
         No inventa color: usa el MISMO --doc-comprar con que esta sección ya pinta un
         veredicto que cruza, dos líneas más arriba. Lo único propio es el margen, porque se
         pega al cuadrito y el .paj-sx general trae el suyo para otra cosa.
         (Y sin backticks: esto vive dentro de un template literal.) */
      .paj-promesa{margin:8px 0 0}
      .paj-promesa b{color:var(--doc-comprar);font-weight:700}
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
      /* LA NOTA DEL PIE QUE SE PASA DEL TOPE DE LA RECOMENDACIÓN. Mismo tratamiento que
         «.paj-neg small»: bloque, chica, sin peso y en tinta terciaria. Suelta el «nowrap»
         de «.v» —la frase no cabe en una línea a 390— y se queda con el «text-align:right»
         heredado, que es el del valor al que califica. NO va en rojo: en este modal el rojo
         ya significa «la plata que pones» y esto no es un error, es un precio. */
      .paj-cg .v small{display:block;font-size:11.5px;font-weight:400;color:var(--doc-tx3);
        white-space:normal;margin-top:3px;max-width:200px;margin-left:auto}
      .paj-eleg{background:var(--doc-paper2);border-radius:12px;padding:16px}
      .paj-chipsm{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
      .paj-chip{background:var(--doc-paper);border:1px solid var(--doc-line2);padding:7px 11px;
        border-radius:10px;font-size:13px;font-weight:600;white-space:nowrap}
      .paj-chip s{color:var(--doc-tx4);font-weight:500;text-decoration-thickness:1.5px;margin-right:5px}
      .paj-plus{color:var(--doc-tx4);font-weight:600}
      .paj-neg{font-size:16px;font-weight:700;letter-spacing:-.015em;padding:12px 0;
        border-top:1px solid var(--doc-line2);border-bottom:1px solid var(--doc-line2);margin-bottom:6px}
      .paj-neg small{display:block;font-size:12px;font-weight:400;color:var(--doc-tx3);margin-top:3px}
      /* LA PILL DE LA BANDA DE ESFUERZO. Portada de «/comunas» (VeredictoCuota.tsx:286) en
         su tipografia —mono, versalita, tracking .08em, 10px— y NADA MAS: alla la banda
         estructural va en un #C8323C hardcodeado, y aca ese rojo ya significa la plata que
         pones (.paj-cg .v.mal, .paj-par .b1.mal). Tercer sentido del mismo rojo en un modal.
         La cuarta banda no existe en el informe, asi que el problema no se plantea: van las
         tres en la escala de tinta, que es donde viven las marcas que no son veredicto.
         Resetea peso y tamano porque .paj-neg es 16px/700 y la pill los heredaria. */
      /* EN LÍNEA PROPIA, no al costado. Medido a 390: al lado de «UF 5.500 → UF 4.175» la
         pill mide 249 px sobre 288 disponibles, le deja 31 px a la referencia y la parte en
         dos — el bloque pasaba de una línea a tres. Abajo ocupa una sola. */
      .paj-banda{display:block;width:fit-content;margin-top:6px;font-family:var(--font-mono, ui-monospace);
        font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;
        padding:2px 8px;border-radius:99px;white-space:nowrap;
        /* EL FONDO ES «--doc-paper», NO «--doc-paper2». La pill vive dentro de «.paj-eleg»,
           que YA es «--doc-paper2»: con ese token medía el mismo hex que su contenedor
           (rgb(26,26,30) sobre rgb(26,26,30)) y se leía como un contorno vacío, no como una
           pill. El vecino que resuelve esto en el MISMO panel es «.paj-chip», que usa
           «--doc-paper» con borde «--doc-line2»; esta se apoya en él. */
        background:var(--doc-paper);border:1px solid var(--doc-line2);color:var(--doc-tx3)}
      .paj-par{padding:10px 0;font-size:13px}
      .paj-par+.paj-par{border-top:1px solid var(--doc-line2)}
      .paj-par .l{color:var(--doc-tx3);margin-bottom:3px}
      .paj-par .l small{display:block;font-size:11.5px;color:var(--doc-tx4);margin-top:1px}
      .paj-par .p{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
      .paj-par .a1{font-size:13px;color:var(--doc-tx4);white-space:nowrap}
      .paj-par .fl{color:var(--doc-tx4);font-weight:700}
      .paj-par .b1{font-size:16px;font-weight:700;white-space:nowrap;letter-spacing:-.015em}
      /* Semáforo del DATO, y solo donde hay un dato con signo: flujo y retorno. */
      .paj-par .b1.bien{color:var(--doc-good)}
      .paj-par .b1.mal{color:var(--signal-red)}
      /* El Score de después NO es un dato con signo: es el número que declara el veredicto
         al que llegas. Iba en verde fijo —«bien» pase lo que pase—, que pintaba de bueno un
         62 igual que un 81. Va con el azul de Comprar, que es lo que ese número dice. */
      .paj-par .b1.destino{color:var(--doc-comprar)}
      /* El prefijo «paj-nod» viene de «no depende», que era el título de una de las dos secciones que
         usa estas reglas. Ese título ya no existe —ahora dice «Un cambio a la vez»— y el
         prefijo se queda igual a propósito: esto es el ESTILO DE TABLA del pop-up y lo
         comparte «Cuánto aguanta este veredicto», así que el nombre nunca describió una
         sola sección. Renombrarlo toca 16 sitios entre este archivo, el componente y dos
         guards, y eso es una barrida aparte. Nadie lo lee en pantalla. */
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
      /* «Llegas a …» dice un VEREDICTO, así que se pinta con el de la tríada que nombra, no
         con el verde del dato. Solo el azul cuando dice Comprar: si la palanca deja el caso
         en otro lado, el color no puede prometer Comprar. */
      .paj-nod .dst{color:var(--doc-tx);font-weight:700;white-space:nowrap}
      .paj-nod .dst.comprar{color:var(--doc-comprar)}
      .paj-nod .dst small{display:block;font-size:11px;font-weight:600;opacity:.75;margin-top:2px}
      /* LA BANDA NO SE PARTE (15-sep-2026). Acá la segunda columna lleva una oración larga y
         la primera colapsa a su mínimo, así que «sin colchón» salía en dos líneas —«sin» y
         «colchón»— en los dos anchos. La otra tabla que comparte «paj-nod» no tiene el
         problema porque su segunda columna son cifras, así que la regla va acotada a esta
         sección y no a las dos. Es el mismo «nowrap» que «.paj-nod .num» ya usa para que un
         dato de segunda línea no se parta. */
      .paj-aguanta td:first-child em{white-space:nowrap}
      /* La segunda línea de la oración: a qué veredicto cae si el supuesto se pasa del borde
         (15-sep-2026). Calcada de las dos de arriba —«.num small» y «.dst small»—, que es la
         forma que esta tabla ya usa para poner un dato debajo de otro. */
      .paj-nod .paj-oracion small{display:block;font-size:11px;font-weight:400;color:var(--doc-tx3);margin-top:3px}
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
        .paj-mtx td,.paj-mtx th:not(.rot){width:130px}
        .paj-mwrap.sola .paj-mtx td,.paj-mwrap.sola .paj-mtx th:not(.rot){width:170px}
      }
      @media (prefers-reduced-motion:reduce){.paj-mtx td{transition:none}}
`,
      }}
    />
  );
}
