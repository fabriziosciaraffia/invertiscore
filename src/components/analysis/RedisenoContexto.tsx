"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * EL INTERRUPTOR DEL REDISEÑO, PARA EL JSX.
 *
 * Hasta acá el rediseño era CSS y alcanzaba con una clase: `.doc-r2` en el marco y las
 * reglas colgando de ella. La parte 4 rompe eso — el contrato §8 no cambia el color de
 * las tarjetas de zona, cambia QUÉ NÚMERO MANDA en cada una y en qué orden van. Eso es
 * estructura, o sea JSX, y una clase no lo puede apagar.
 *
 * POR QUÉ CONTEXTO Y NO UNA PROP. `ZonaLtrSection` cuelga cinco niveles abajo de
 * `SubjectCardGrid` y la misma pieza la monta también el drawer «Explorar». Pasar la
 * prop por toda la cadena sería un diff que toca archivos que no cambian, y que después
 * hay que deshacer entero. El contexto entra y sale en un solo lugar.
 *
 * ES EL MISMO GATE POR MODALIDAD que `DocumentoFrame`: lo provee `SubjectCardGrid`, que
 * es LTR. STR no lo monta, así que `useRediseno()` le devuelve el default y su informe
 * queda exactamente como está (contrato §11). Los tres pasos de retiro están escritos en
 * `rediseno-flag.ts` y este archivo se va con ellos.
 *
 * EL DEFAULT ES `false`, NO LA CONSTANTE, y es la diferencia entre un gate por modalidad
 * y uno global. Si el default fuera `REDISENO_INFORME`, el día que 4d lo ponga en `true`
 * cualquier pieza que lea este contexto SIN provider —o sea STR— se encendería sola. Con
 * `false`, lo único que enciende es un provider montado explícitamente, y el único que lo
 * monta es `SubjectCardGrid`, que es LTR. Es el mismo criterio que el `rediseno = false`
 * de `DocumentoFrame`.
 *
 * La ruta dev lo fuerza con `?rediseno=1` sin tocar la constante, que es lo que permite
 * sacar los shots antes de encender nada.
 */
const RedisenoCtx = createContext<boolean>(false);

export function RedisenoProvider({ valor, children }: { valor: boolean; children: ReactNode }) {
  return <RedisenoCtx.Provider value={valor}>{children}</RedisenoCtx.Provider>;
}

/** ¿Esta pieza se dibuja con el rediseño? */
export function useRediseno(): boolean {
  return useContext(RedisenoCtx);
}
