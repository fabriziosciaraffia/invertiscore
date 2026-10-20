// El `AsyncLocalStorage` que el servidor de Next pone en `globalThis` antes de cargar `next/headers` (20-oct-2026). Sin
// él, fuera de Next, `requestAsyncStorage` es uno de mentira que revienta al usarlo, y el tier AGENTE-SERVIDOR no puede
// correr `capturarServidor` dentro de un pedido de verdad. Se importa PRIMERO (en el runner y en el tier): los imports
// corren en orden y el primero que cargue `next/headers` fija cuál usa.
import { AsyncLocalStorage } from "node:async_hooks";

const g = globalThis as { AsyncLocalStorage?: unknown };
g.AsyncLocalStorage ??= AsyncLocalStorage;
