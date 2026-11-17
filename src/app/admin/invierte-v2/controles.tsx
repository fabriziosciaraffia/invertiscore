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
