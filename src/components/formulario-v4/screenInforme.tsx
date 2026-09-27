"use client";

// Wizard v4 — LA ÚLTIMA PREGUNTA: a quién le vas a arrendar.
//
// Estuvo de PRIMERA pantalla y era la mayor fuga del wizard (29% de abandono,
// 61 personas que se iban sin tocar nada). Desde el 19-ago-2026 va al final,
// después de `plazo`: con los números ya puestos, elegir modalidad deja de ser
// "elegir un producto a ciegas" y pasa a ser el último dato del análisis.
//
// El copy sigue esa mudanza. Antes preguntaba "¿qué informe quieres?" —lenguaje
// de catálogo— y ahora pregunta por el hecho concreto que el usuario sí conoce:
// quién va a estar viviendo ahí. La etiqueta de producto (RENTA LARGA / RENTA
// CORTA) baja al pie de cada opción, como consecuencia y no como pregunta.
//
// FORMATO DEL INFORME (27-sep-2026, entrega 2): sin los 01/02 ni el rótulo rojo, y sin el wash
// rojo de selección que esta pantalla tenía como excepción. Las opciones son tarjetas como las
// del resto del wizard; «La mayoría empieza acá» va en gris. El nombre de producto ya no va al
// pie de la tarjeta: lo confirma el chip de la pantalla siguiente («Renta larga»).

import { useEffect, useRef } from "react";
import type { ScreenProps } from "./screensActo1";
import { ChoiceTile } from "./ui";
import type { Modalidad } from "./wizardV4Nodes";
import { rangoViewportH, registrarSondaSalida } from "./stepTelemetry";
import { AMBAS_ENABLED } from "@/lib/ambas-flag";

// ─────────────────────────────────────────────────────────────────────────────
// COPY DE LA PANTALLA — por qué dice lo que dice
//
// El eyebrow Signal Red ("empieza aquí") apuntaba al Comparativo. Al apagarse
// AMBAS ese rol pasa a RENTA LARGA, y el argumento cambia de "no sabes, llévate
// las dos" a uno honesto: es lo que busca la mayoría y lo más simple de
// proyectar. No es la opción más cara disfrazada de default.
//
// Las dos descripciones nombran a la PERSONA, no al producto: alguien que va a
// vivir ahí / turistas por noche. Es lo que el usuario puede imaginar sin saber
// qué significan "LTR" y "STR".
//
// SOBRE EL SEGUNDO ANÁLISIS: la pantalla NO lo menciona. Hubo una nota al pie
// que ofrecía analizar la otra modalidad después por $9.990 y se retiró: esta es
// la pantalla de mayor fuga del wizard (29% de abandono) y meter un precio antes
// de que el usuario haya recibido nada es cobrarle la entrada. Cero mención,
// cero promesa que romper. Si alguna vez vuelve, va con su precio real y sin
// "el primero es gratis" — solo lo es con el welcome disponible.
// ─────────────────────────────────────────────────────────────────────────────

const OPCIONES: Array<{
  value: Modalidad;
  /** Titular: la persona que va a estar en el depto. */
  nombre: string;
  /** Nombre de producto, al pie. Es la consecuencia, no la pregunta. */
  etiqueta: string;
  beneficio: string;
  eyebrow?: string;
}> = [
  {
    value: "ltr",
    nombre: "A alguien que va a vivir ahí",
    etiqueta: "Renta larga",
    beneficio:
      "Contrato y pago todos los meses. Lo más común y lo más simple de proyectar.",
    // El rótulo «empieza acá» depende del interruptor: con AMBAS encendido lo
    // lleva el Comparativo; apagado pasa a renta larga.
    eyebrow: AMBAS_ENABLED ? undefined : "La mayoría empieza acá",
  },
  {
    value: "str",
    nombre: "A turistas, por noche",
    etiqueta: "Renta corta",
    beneficio:
      "Publicado en Airbnb. Puede rendir más, pero exige gestión y depende de la ocupación.",
  },
  {
    value: "both",
    nombre: "Las dos, para comparar",
    etiqueta: "Comparativo",
    beneficio: "Franco calcula las dos y te da un solo veredicto: cuál gana para este depto, y por cuánto.",
    eyebrow: AMBAS_ENABLED ? "Si no sabes, empieza aquí" : undefined,
  },
];

/**
 * Opciones visibles. Con `NEXT_PUBLIC_AMBAS_ENABLED="false"` el Comparativo no
 * se renderiza — no queda deshabilitado ni con un "próximamente": deja de
 * existir para el usuario. El objeto se conserva arriba para que volver a
 * encenderlo sea la variable de entorno y nada más.
 */
const OPCIONES_VISIBLES = AMBAS_ENABLED ? OPCIONES : OPCIONES.filter((o) => o.value !== "both");

/**
 * Las modalidades que el wizard ofrece, en orden. FUENTE ÚNICA: la usa también el selector del
 * resumen (chip «Informe»), que hasta el 25-sep-2026 pintaba las tres sin mirar el flag — un
 * anónimo que elegía «Comparativo» ahí terminaba con un LTR suelto y sin su análisis gratis.
 */
export const MODALIDADES_OFRECIDAS: readonly Modalidad[] = OPCIONES_VISIBLES.map((o) => o.value);

export function InformeScreen({ answers, answer }: ScreenProps) {
  // Sonda de `mod` (I-2). Nació cuando esta era la primera pantalla y la mayor
  // fuga del wizard; la pregunta que respondía era si el usuario llegaba a VER
  // las tres opciones. Se conserva con el nodo mudado al final porque la misma
  // señal sirve para lo contrario: acá abajo, con dos opciones y el trabajo ya
  // hecho, "no scrolleó y no eligió" debería desaparecer. Emite al DESMONTAR (el
  // contenedor lleva key={node}, así que salir del paso desmonta) — un evento
  // por visita, con lo que pasó en ella.
  //
  // OJO al leer la serie: los datos de antes del 19-ago-2026 son de esta pantalla
  // EN OTRO LUGAR del flujo. No son comparables. `n_opciones` y `ambas_activo`
  // parten la serie; el hito del panel admin marca la fecha.
  const clicks = useRef(0);
  const scrolleo = useRef(false);
  // La selección se anota EN EL CLICK, no vía efecto: elegir una opción navega
  // de inmediato y la pantalla se desmonta sin llegar a re-renderizar, así que
  // un efecto de sincronización nunca vería el valor (salía "ninguna").
  const seleccionRef = useRef<string | undefined>(answers.modalidad);
  useEffect(() => {
    const onScroll = () => { scrolleo.current = true; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  registrarSondaSalida("mod", () => ({
    name: "wizard4_mod_interaccion",
    props: {
      seleccion: seleccionRef.current ?? "ninguna",
      // Por VISITA al paso: cada opción navega al tocarla, así que acá es 0 ó 1.
      n_cambios: clicks.current,
      hubo_scroll: scrolleo.current,
      viewport_h_rango: rangoViewportH(typeof window === "undefined" ? 0 : window.innerHeight),
      // Instrumentación del apagado (mínima, sin eventos nuevos): esta propiedad
      // parte en dos la serie de `mod_interaccion` sin romperla. Con ella,
      // "seleccion", "hubo_scroll" y el abandono de `mod` se pueden comparar
      // entre el período de 3 opciones y el de 2 — que es exactamente la
      // pregunta que este goal deja abierta. `n_opciones` va además del booleano
      // porque sobrevive a que el flag cambie de nombre o de semántica.
      ambas_activo: AMBAS_ENABLED,
      n_opciones: OPCIONES_VISIBLES.length,
    },
  }));

  return (
    <div>
      {/* Bajada: cierra el arco del wizard. Dice que el trabajo ya está hecho y
          que esto es lo último — el mismo mensaje que da el «Última pregunta»
          de la cabecera y el ~80% de la barra. Los tres tienen que ser ciertos a la
          vez o ninguno sirve. */}
      <p className="wz-bajada">Ya tengo los números. Con esto te armo el análisis.</p>
      <div className="wz-gap">
        {OPCIONES_VISIBLES.map((o) => (
          <ChoiceTile
            key={o.value}
            selected={answers.modalidad === o.value}
            onClick={() => {
              clicks.current += 1;
              seleccionRef.current = o.value;
              answer("mod", { modalidad: o.value });
            }}
            ariaLabel={`${o.eyebrow ? o.eyebrow + ". " : ""}${o.nombre}. ${o.beneficio} ${o.etiqueta}.`}
          >
            {o.eyebrow && <span className="wz-eb">{o.eyebrow}</span>}
            <span className="wz-t wz-t-grande">{o.nombre}</span>
            <span className="wz-s">{o.beneficio}</span>
          </ChoiceTile>
        ))}
      </div>
    </div>
  );
}
