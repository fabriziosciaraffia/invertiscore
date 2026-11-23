// Los avisos de B4 de verdad (correo por Resend), para las rutas y el cron. El correo sale solo a quien el interruptor deja: mientras el
// modo no sea «todos», únicamente las cuentas de la lista, tenga lo que tenga marcado la cuenta (decisión de Fabrizio, 23-nov-2026).
import { sendOfertaInvierte } from "@/lib/email";
import { estadoInterruptor } from "./acceso-servidor";
import { puedeRecibirCopia } from "./copias-servidor";
import type { DepsAviso } from "./b4-servidor";

export const DEPS_AVISO_B4: DepsAviso = {
  correo: (p) => sendOfertaInvierte(p),
  puedeRecibir: async (email) => { const { modo, lista } = await estadoInterruptor(); return puedeRecibirCopia(modo, lista, email); },
};
