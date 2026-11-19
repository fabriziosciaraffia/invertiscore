"use client";

// Los controles de /admin/invierte-v2 (etapa 1 de Invierte con Franco, 18-nov-2026): el modo del interruptor, la lista de
// correos y «Reiniciar prueba». Cada acción llama a /api/admin/invierte-v2 y recarga la página con lo guardado.
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MODOS_INVIERTE_V2, type ModoInvierteV2 } from "@/lib/invierte-v2/acceso";

const ROTULO_MODO: Record<ModoInvierteV2, string> = { apagado: "Apagado (todos ven Pronto)", lista: "Solo la lista", todos: "Todos" };

async function llamar(cuerpo: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch("/api/admin/invierte-v2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }).catch(() => null);
  if (!r) return { ok: false, error: "red" };
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  return { ok: r.ok, error: d.error };
}

const CLASE_BTN = "rounded-full border border-[var(--franco-border)] px-3 py-1 font-body text-[12px] text-[var(--franco-text)] disabled:opacity-50";

export function ModoSelect({ inicial }: { inicial: ModoInvierteV2 }) {
  const router = useRouter();
  const [modo, setModo] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cambiar(nuevo: ModoInvierteV2) {
    if (nuevo === "todos" && !window.confirm("¿Encender el flujo nuevo para TODAS las cuentas? Pronto deja de verse en los usados.")) return;
    setOcupado(true); setError(null);
    const r = await llamar({ accion: "modo", modo: nuevo });
    setOcupado(false);
    if (!r.ok) { setError("No se guardó"); return; }
    setModo(nuevo);
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2">
      <select value={modo} disabled={ocupado} onChange={(e) => void cambiar(e.target.value as ModoInvierteV2)} aria-label="Modo del interruptor" data-admin="inv2-modo"
        className="rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-1 font-body text-[13px] text-[var(--franco-text)]">
        {MODOS_INVIERTE_V2.map((m) => <option key={m} value={m}>{ROTULO_MODO[m]}</option>)}
      </select>
      {error && <span className="text-[12px] text-[var(--signal-red)]" role="alert">{error}</span>}
    </span>
  );
}

export function AgregarCorreo() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true); setError(null);
    const r = await llamar({ accion: "agregar", email });
    setOcupado(false);
    if (!r.ok) { setError(r.error === "correo" ? "Ese correo no es válido" : "No se guardó"); return; }
    setEmail("");
    router.refresh();
  }
  return (
    <form onSubmit={enviar} className="flex flex-wrap items-center gap-2" data-admin="inv2-agregar">
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.cl" aria-label="Correo para la lista"
        className="min-w-[240px] rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-1 font-body text-[13px] text-[var(--franco-text)]" />
      <button type="submit" disabled={ocupado || !email.trim()} className={CLASE_BTN}>Agregar</button>
      {error && <span className="text-[12px] text-[var(--signal-red)]" role="alert">{error}</span>}
    </form>
  );
}

export function QuitarCorreo({ email }: { email: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  return (
    <button type="button" disabled={ocupado} className={CLASE_BTN} data-admin="inv2-quitar"
      onClick={async () => {
        if (!window.confirm(`¿Quitar ${email} de la lista? Vuelve a ver Pronto (su orden firmada se sigue viendo).`)) return;
        setOcupado(true);
        await llamar({ accion: "quitar", email });
        setOcupado(false);
        router.refresh();
      }}>Quitar</button>
  );
}

export function ReenviarCopia({ ordenId }: { ordenId: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" disabled={ocupado} className={CLASE_BTN} data-admin="inv2-reenviar"
        onClick={async () => {
          setOcupado(true); setError(null);
          const r = await fetch("/api/admin/invierte-v2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "reenviar", ordenId }) }).catch(() => null);
          const d = r ? ((await r.json().catch(() => ({}))) as { copia?: boolean; motivo?: string | null }) : {};
          setOcupado(false);
          if (!d.copia) { setError(`No salió${d.motivo ? `: ${d.motivo}` : ""}`); }
          router.refresh();
        }}>Reenviar copia</button>
      {error && <span className="text-[11px] text-[var(--signal-red)]" role="alert">{error}</span>}
    </span>
  );
}

export function ReiniciarPrueba({ userId, email }: { userId: string; email: string | null }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" disabled={ocupado} className={CLASE_BTN} data-admin="inv2-reiniciar"
        onClick={async () => {
          if (!window.confirm(`¿Reiniciar la prueba de ${email ?? userId}? Se borran su orden de prueba, el PDF, su bitácora de prueba y su contacto.`)) return;
          setOcupado(true); setError(null);
          const r = await llamar({ accion: "reiniciar", userId });
          setOcupado(false);
          if (!r.ok) { setError(r.error === "orden-real" ? "Tiene una orden real: no se borra" : r.error === "no-es-prueba" ? "No es cuenta de prueba" : "No se pudo"); return; }
          router.refresh();
        }}>Reiniciar prueba</button>
      {error && <span className="text-[11px] text-[var(--signal-red)]" role="alert">{error}</span>}
    </span>
  );
}

/** «Marcar hecha» de una tarea interna (la ficha de la persona, entrega 2). */
export function TareaHecha({ id }: { id: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(false);
  async function hecha() {
    setOcupado(true); setError(false);
    const r = await llamar({ accion: "tarea", id });
    setOcupado(false);
    if (!r.ok) { setError(true); return; }
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={CLASE_BTN} disabled={ocupado} onClick={() => void hecha()} data-admin="inv2-tarea-hecha">Marcar hecha</button>
      {error && <span className="text-[12px] text-[var(--signal-red)]" role="alert">No se guardó</span>}
    </span>
  );
}

/** El número de «Escribirle» de la base (modo prueba, entrega 2): +569 y ocho dígitos. Vacío lo quita. */
export function NumeroWhatsapp({ inicial }: { inicial: string | null }) {
  const router = useRouter();
  const [numero, setNumero] = useState(inicial ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true); setEstado(null);
    const r = await llamar({ accion: "whatsapp", numero });
    setOcupado(false);
    if (!r.ok) { setEstado(r.error === "numero" ? "Ese número no es válido (+569 y ocho dígitos)" : "No se guardó"); return; }
    setEstado("Guardado");
    router.refresh();
  }
  return (
    <form onSubmit={enviar} className="flex flex-wrap items-center gap-2" data-admin="inv2-whatsapp">
      <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="+569…" inputMode="tel" aria-label="WhatsApp de Franco"
        className="rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-1 font-mono text-[12px] text-[var(--franco-text)]" />
      <button type="submit" className={CLASE_BTN} disabled={ocupado}>Guardar</button>
      {estado && <span className="text-[12px] text-[var(--franco-text-secondary)]" role="status">{estado}</span>}
    </form>
  );
}

/**
 * La revisión de la preaprobación (entrega 3): la IA propone banco, monto en UF y vigencia; la persona de Franco los confirma o
 * corrige y aprueba con un toque, o escribe el motivo (lo ve la persona) y pide subirla de nuevo. Cada acción manda el correo.
 */
export function RevisarPreaprobacion({ id, banco, montoUF, vigenteHasta }: { id: string; banco: string | null; montoUF: number | null; vigenteHasta: string | null }) {
  const router = useRouter();
  const [b, setB] = useState(banco ?? "");
  const [m, setM] = useState(montoUF != null ? String(Math.round(montoUF)) : "");
  const [v, setV] = useState(vigenteHasta ?? "");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);
  const ERR: Record<string, string> = { banco: "Falta el banco", monto: "El monto en UF no es válido", vigencia: "La vigencia no es una fecha", motivo: "Escribe el motivo (10 a 300 caracteres)", estado: "Ya se revisó", guardar: "No se guardó" };
  async function enviar(accion: "aprobar" | "corregir") {
    setOcupado(true); setEstado(null);
    const r = await llamar(accion === "aprobar" ? { accion, id, banco: b, montoUF: Number(m.replace(/\D/g, "")), vigenteHasta: v } : { accion, id, motivo });
    setOcupado(false);
    if (!r.ok) { setEstado(ERR[r.error ?? ""] ?? "No se guardó"); return; }
    router.refresh();
  }
  const campo = "rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-1 font-body text-[13px] text-[var(--franco-text)]";
  return (
    <div className="mt-3 flex flex-col gap-3 font-body text-[13px]" data-admin="inv2-revisar">
      <div className="flex flex-wrap items-center gap-2">
        <input value={b} onChange={(e) => setB(e.target.value)} placeholder="Banco" aria-label="Banco" className={campo} />
        <input value={m} onChange={(e) => setM(e.target.value)} placeholder="Monto UF" aria-label="Monto aprobado en UF" inputMode="numeric" className={`${campo} w-28`} />
        <input type="date" value={v} onChange={(e) => setV(e.target.value)} aria-label="Vigente hasta" className={campo} />
        <button type="button" className={CLASE_BTN} disabled={ocupado} onClick={() => void enviar("aprobar")} data-admin="inv2-aprobar">Aprobar</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo para la persona (por ejemplo: Venció el 3 de noviembre. Pídele a tu banco una vigente.)" aria-label="Motivo" className={`${campo} min-w-[320px] flex-1`} />
        <button type="button" className={CLASE_BTN} disabled={ocupado} onClick={() => void enviar("corregir")} data-admin="inv2-corregir">Pedir corregir</button>
      </div>
      {estado && <span className="text-[12px] text-[var(--signal-red)]" role="alert">{estado}</span>}
    </div>
  );
}
