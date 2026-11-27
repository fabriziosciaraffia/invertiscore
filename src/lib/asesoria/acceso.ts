// ─────────────────────────────────────────────────────────────────────────────
// EL INTERRUPTOR DE LA ASESORÍA (27-nov-2026). Vive en `config.asesoria_modo`: «apagada», «lista» o «todos»; ausente o raro,
// APAGADA. En «lista» la ven los dispositivos habilitados desde /admin/asesoria («Habilitar este dispositivo»: el hash de la
// cookie franco_disp, sin enlaces) y las cuentas de prueba (test_accounts). Quien la ve por la lista queda marcado como prueba en
// cada evento (`es_prueba`), también en «todos». Puro: lo lee el servidor (acceso-servidor.ts). Lo fija el tier ASESORIA.
// ─────────────────────────────────────────────────────────────────────────────
export const CLAVE_MODO_ASESORIA = "asesoria_modo";
export const TABLA_ACCESO_ASESORIA = "asesoria_acceso";
export type ModoAsesoria = "apagada" | "lista" | "todos";

export function leerModoAsesoria(v: unknown): ModoAsesoria {
  if (typeof v !== "string") return "apagada";
  const s = v.trim().replace(/^"(.*)"$/, "$1");
  return s === "lista" || s === "todos" || s === "apagada" ? s : "apagada";
}

export interface AccesoAsesoria { habilitada: boolean; prueba: boolean }

export function accesoAsesoria(p: { modo: ModoAsesoria; dispositivoEnLista: boolean; cuentaDePrueba: boolean }): AccesoAsesoria {
  const deLista = p.dispositivoEnLista || p.cuentaDePrueba;
  if (p.modo === "todos") return { habilitada: true, prueba: deLista };
  if (p.modo === "lista") return { habilitada: deLista, prueba: deLista };
  return { habilitada: false, prueba: false };
}

export const SIN_ASESORIA: AccesoAsesoria = { habilitada: false, prueba: false };

/** /deptos con la asesoría habilitada (27-nov-2026): el mapa con la burbuja abierta de entrada. */
export const PARAM_ASESORIA = "asesoria";
export const DESTINO_DEPTOS_CON_ASESORIA = `/explorar?desde=deptos&${PARAM_ASESORIA}=1`;
