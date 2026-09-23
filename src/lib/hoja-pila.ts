// ============================================================================
// LA PILA DE HOJAS — quién escucha atrás y Esc cuando hay más de una abierta (23-sep-2026)
// ============================================================================
// Con el ⓘ de los indicadores una hoja se abre ENCIMA de otra: la hoja chica de la glosa
// sobre la hoja grande de un capítulo o de la planilla. Hasta hoy cada `Modal` escuchaba
// `popstate` y `keydown` por su cuenta, y con dos abiertas eso cerraba las dos:
//   · Esc: los dos listeners viven en `document`, así que un Esc cerraba ambas;
//   · atrás: cerrar la de arriba con ✕ consume su entrada con `history.back()`, y ese
//     `popstate` también lo recibía la de abajo, que se cerraba creyendo que era suyo.
// Acá hay UN listener de cada uno para todas, y la regla es una sola: atrás y Esc cierran
// solo la de ARRIBA. Cada nivel con historial empuja su propia entrada; cerrar por otra vía
// que atrás la consume con `history.back()` y deja anotado que ese `popstate` no es de nadie.
//
// Módulo puro con el entorno inyectado (`crearPila`), para que el gate lo ejercite sin
// navegador; `pilaHojas` es la instancia del navegador.
// ============================================================================

export type EntornoPila = {
  pushState: () => void;
  back: () => void;
  /** Registra UNA vez los listeners globales; recibe los dos manejadores de la pila. */
  escuchar: (onPop: () => void, onEsc: () => void) => void;
};

type Entrada = { id: number; cerrar: () => void; conHistorial: boolean };

export type Pila = {
  /** Abre un nivel. `conHistorial` = la hoja de teléfono (empuja una entrada); el panel y el
   *  popover de escritorio no tocan el historial. Devuelve el id del nivel. */
  apilar: (cerrar: () => void, opts: { conHistorial: boolean }) => number;
  /** Cierra un nivel por cualquier vía que NO sea atrás (✕, velo, arrastre, Esc, desmontar).
   *  Si el nivel tenía entrada de historial, la consume sin que nadie más la reciba. */
  desapilar: (id: number) => void;
  /** ¿Este nivel es el de más arriba? */
  esTope: (id: number) => boolean;
  /** Cuántos niveles hay abiertos. */
  profundidad: () => number;
};

export function crearPila(entorno: EntornoPila): Pila {
  const pila: Entrada[] = [];
  let seq = 0;
  // `popstate` que llegan por un `history.back()` nuestro: se descartan sin cerrar nada.
  let saltos = 0;
  let escuchando = false;

  const onPop = () => {
    if (saltos > 0) {
      saltos--;
      return;
    }
    // Atrás cierra la de arriba que tiene historial (las de escritorio no ocupan entradas).
    for (let i = pila.length - 1; i >= 0; i--) {
      if (pila[i].conHistorial) {
        const [e] = pila.splice(i, 1);
        e.cerrar();
        return;
      }
    }
  };
  const onEsc = () => {
    const tope = pila[pila.length - 1];
    if (!tope) return;
    // Esc cierra solo la de arriba, por la vía normal: su entrada de historial se consume.
    tope.cerrar();
  };

  return {
    apilar(cerrar, { conHistorial }) {
      if (!escuchando) {
        entorno.escuchar(onPop, onEsc);
        escuchando = true;
      }
      const id = ++seq;
      pila.push({ id, cerrar, conHistorial });
      if (conHistorial) entorno.pushState();
      return id;
    },
    desapilar(id) {
      const i = pila.findIndex((e) => e.id === id);
      if (i < 0) return; // ya salió por atrás
      const [e] = pila.splice(i, 1);
      if (e.conHistorial) {
        saltos++;
        entorno.back();
      }
    },
    esTope: (id) => pila.length > 0 && pila[pila.length - 1].id === id,
    profundidad: () => pila.length,
  };
}

let instancia: Pila | null = null;

/** La pila del navegador (una por página). */
export function pilaHojas(): Pila {
  if (!instancia) {
    instancia = crearPila({
      pushState: () => window.history.pushState({ francoHoja: true }, ""),
      back: () => window.history.back(),
      escuchar: (onPop, onEsc) => {
        window.addEventListener("popstate", onPop);
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") onEsc();
        });
      },
    });
  }
  return instancia;
}
