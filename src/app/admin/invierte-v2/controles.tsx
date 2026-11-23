"use client";

// Los controles de /admin/invierte-v2 (etapa 1 de Invierte con Franco, 18-nov-2026): el modo del interruptor, la lista de
// correos y «Reiniciar prueba». Cada acción llama a /api/admin/invierte-v2 y recarga la página con lo guardado.
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MODOS_INVIERTE_V2, type ModoInvierteV2 } from "@/lib/invierte-v2/acceso";
import { MapaPinAjustable } from "@/components/formulario-v4/MapaPinAjustable";
import { FUENTES_RESPUESTA, lineaPregunta, type PreguntaDepto } from "@/lib/invierte-v2/depto-flujo";
import { POSTURA_COPY, type Postura } from "@/lib/invierte-v2/rango";
import type { OfertaVista } from "@/lib/invierte-v2/rango-servidor";

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

/**
 * EL FLUJO DE UN DEPTO ELEGIDO (etapa 3, B1, 21-nov-2026). La persona de Franco registra el acuerdo con quien vende y confirma la
 * ubicación: la dirección (sin número), el número y el punto en el mapa —parte en el pin de la publicación; se mueve con el dedo o se
 * pegan las coordenadas—. Al confirmar se rehace el análisis con el punto real y el depto pasa de etapa solo si hay acuerdo y el
 * análisis rehecho da Comprar (o Ajusta supuestos con precio al que vuelve a Comprar). Sin dirección confirmada no pasa a listo.
 */
export function GestionDepto({ userId, avisoId, etapa, acuerdo, alternativa, comuna, pin, ubicacion, preguntas, rango, oferta = null }: {
  userId: string; avisoId: string; etapa: string; acuerdo: string | null; alternativa: string | null; comuna: string | null;
  pin: { lat: number; lng: number } | null;
  ubicacion: { direccion: string; numero: string | null; lat: number; lng: number; distanciaM: number | null; veredicto: string | null; precioComprarUF: number | null; flujoCLP: number | null } | null;
  /** B2: «Lo que Franco averiguó» de este depto. */
  preguntas: PreguntaDepto[];
  /** B3: el rango (la oferta borrador o la firmada). */
  rango: OfertaVista | null;
  /** B4: la última ronda de la oferta del depto (presentar, la respuesta, la sugerencia, comunicada). */
  oferta?: OfertaVista | null;
}) {
  const router = useRouter();
  const [ac, setAc] = useState(acuerdo ?? "pendiente");
  const [alt, setAlt] = useState(alternativa ?? "");
  const [dir, setDir] = useState(ubicacion?.direccion ?? "");
  const [num, setNum] = useState(ubicacion?.numero ?? "");
  const [lat, setLat] = useState(String(ubicacion?.lat ?? pin?.lat ?? ""));
  const [lng, setLng] = useState(String(ubicacion?.lng ?? pin?.lng ?? ""));
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const ERR: Record<string, string> = { acuerdo: "Elige el acuerdo", depto: "El depto ya no está elegido", direccion: "Escribe la calle (sin número)", punto: "El punto no está en Gran Santiago", arriendo: "Sin arriendos para rehacer el análisis en ese punto", config: "Falta la UF o la tasa", guardar: "No se guardó", red: "Sin conexión" };
  async function enviar(cuerpo: Record<string, unknown>, que: string) {
    setOcupado(que); setEstado(null);
    const r = await llamar(cuerpo);
    setOcupado(null);
    if (!r.ok) { setEstado(ERR[r.error ?? ""] ?? "No se guardó"); return; }
    router.refresh();
  }
  const campo = "rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-1 font-body text-[13px] text-[var(--franco-text)]";
  const nLat = Number(lat), nLng = Number(lng);
  return (
    <div className="flex flex-col gap-3 font-body text-[13px]" data-admin="inv2-gestion-depto">
      <p className="m-0"><b>Etapa:</b> {etapa}{ubicacion ? ` · ubicación confirmada (${ubicacion.distanciaM ?? "?"} m del pin) · rehecho: ${ubicacion.veredicto ?? "—"}${ubicacion.precioComprarUF ? ` (Comprar a UF ${Math.round(ubicacion.precioComprarUF)})` : ""}${ubicacion.flujoCLP != null ? ` · al mes ${ubicacion.flujoCLP}` : ""}` : " · ubicación sin confirmar"}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={ac} onChange={(e) => setAc(e.target.value)} aria-label="Acuerdo con quien vende" className={campo}>
          <option value="pendiente">Acuerdo pendiente</option>
          <option value="con_acuerdo">Con acuerdo</option>
          <option value="sin_acuerdo">Sin acuerdo (no avanza)</option>
        </select>
        {ac === "sin_acuerdo" && <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alternativa con acuerdo (id del aviso)" aria-label="Alternativa" className={`${campo} min-w-[300px]`} />}
        <button type="button" className={CLASE_BTN} disabled={!!ocupado} onClick={() => void enviar({ accion: "acuerdo", userId, avisoId, acuerdo: ac, alternativa: alt || null }, "acuerdo")} data-admin="inv2-guardar-acuerdo">{ocupado === "acuerdo" ? "Guardando…" : "Guardar acuerdo"}</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={dir} onChange={(e) => setDir(e.target.value)} placeholder="Calle (sin número)" aria-label="Calle" className={`${campo} min-w-[220px]`} />
        <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="Número" aria-label="Número" className={`${campo} w-24`} />
        <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitud" aria-label="Latitud" className={`${campo} w-32`} />
        <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitud" aria-label="Longitud" className={`${campo} w-32`} />
        <button type="button" className={CLASE_BTN} disabled={!!ocupado} onClick={() => void enviar({ accion: "ubicacion", avisoId, direccion: dir, numero: num, lat: nLat, lng: nLng }, "ubicacion")} data-admin="inv2-confirmar-ubicacion">{ocupado === "ubicacion" ? "Rehaciendo el análisis…" : "Confirmar ubicación"}</button>
      </div>
      <div className="max-w-[520px]">
        <MapaPinAjustable lat={Number.isFinite(nLat) ? nLat : null} lng={Number.isFinite(nLng) ? nLng : null} comuna={comuna} limite="cobertura" height={200} onMover={(a, b) => { setLat(a.toFixed(7)); setLng(b.toFixed(7)); }} />
      </div>
      <PreguntasDepto avisoId={avisoId} preguntas={preguntas} />
      {rango && <RangoDepto userId={userId} avisoId={avisoId} r={rango} />}
      {oferta && <OfertaAdmin o={oferta} />}
      {estado && <span className="text-[12px] text-[var(--signal-red)]" role="alert">{estado}</span>}
    </div>
  );
}

const ROTULO_FUENTE: Record<(typeof FUENTES_RESPUESTA)[number], string> = { quien_vende: "Quien lo vende", documento: "Un documento", visita: "La visita", publicacion: "La publicación" };

/** «Lo que Franco averiguó» en el admin (B2): las preguntas del depto (de la lectura y las agregadas), «Marcar preguntadas» (Franco se
 *  las hizo a quien vende: la persona las ve «esperando respuesta»), la respuesta de cada una con su fuente y una pregunta más. */
function PreguntasDepto({ avisoId, preguntas }: { avisoId: string; preguntas: PreguntaDepto[] }) {
  const router = useRouter();
  const [nueva, setNueva] = useState("");
  const [resp, setResp] = useState<Record<string, { t: string; f: string }>>({});
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);
  const ERR: Record<string, string> = { respuesta: "Escribe la respuesta", fuente: "Elige de dónde salió", pregunta: "Escríbela entre «¿» y «?»", guardar: "No se guardó", red: "Sin conexión" };
  async function enviar(cuerpo: Record<string, unknown>) {
    setOcupado(true); setEstado(null);
    const r = await llamar(cuerpo);
    setOcupado(false);
    if (!r.ok) { setEstado(ERR[r.error ?? ""] ?? "No se guardó"); return; }
    setNueva(""); router.refresh();
  }
  const campo = "rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-1 font-body text-[13px] text-[var(--franco-text)]";
  const pendientes = preguntas.filter((q) => !q.enviadaAt && !q.respuesta).length;
  return (
    <div className="flex flex-col gap-2" data-admin="inv2-preguntas">
      <p className="m-0 font-semibold">Lo que Franco averiguó {pendientes > 0 && <button type="button" className={CLASE_BTN} disabled={ocupado} onClick={() => void enviar({ accion: "preguntas_enviadas", avisoId })} data-admin="inv2-marcar-preguntadas">Marcar {pendientes} como preguntadas</button>}</p>
      {preguntas.length === 0 && <p className="m-0 text-[12px] text-[var(--franco-text-muted)]">Sin preguntas todavía (las deja la lectura de Franco).</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {preguntas.map((q) => {
          const r = resp[q.id] ?? { t: "", f: "quien_vende" };
          return (
            <li key={q.id} className="flex flex-col gap-1">
              <span><b>{q.pregunta}</b> <span className="text-[12px] text-[var(--franco-text-muted)]">{lineaPregunta(q) ?? "Sin preguntar todavía"}</span></span>
              {!q.respuesta && (
                <span className="flex flex-wrap items-center gap-2">
                  <input value={r.t} onChange={(e) => setResp({ ...resp, [q.id]: { ...r, t: e.target.value } })} placeholder="Respuesta (lo que ve la persona)" aria-label={`Respuesta a ${q.pregunta}`} className={`${campo} min-w-[280px]`} />
                  <select value={r.f} onChange={(e) => setResp({ ...resp, [q.id]: { ...r, f: e.target.value } })} aria-label="De dónde salió" className={campo}>
                    {FUENTES_RESPUESTA.map((f) => <option key={f} value={f}>{ROTULO_FUENTE[f]}</option>)}
                  </select>
                  <button type="button" className={CLASE_BTN} disabled={ocupado} onClick={() => void enviar({ accion: "respuesta", id: q.id, respuesta: r.t, fuente: r.f })} data-admin="inv2-responder">Guardar respuesta</button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="flex flex-wrap items-center gap-2">
        <input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="¿Otra pregunta para quien vende?" aria-label="Pregunta nueva" className={`${campo} min-w-[280px]`} />
        <button type="button" className={CLASE_BTN} disabled={ocupado || !nueva.trim()} onClick={() => void enviar({ accion: "pregunta", avisoId, pregunta: nueva })} data-admin="inv2-agregar-pregunta">Agregar</button>
      </span>
      {estado && <span className="text-[12px] text-[var(--signal-red)]" role="alert">{estado}</span>}
    </div>
  );
}

/** El rango de oferta en el admin (B3): lo que calculó la regla v1 y, mientras la oferta no esté firmada, la corrección (opcional). */
function RangoDepto({ userId, avisoId, r }: { userId: string; avisoId: string; r: OfertaVista }) {
  const router = useRouter();
  const [postura, setPostura] = useState<Postura>(r.postura);
  const [piso, setPiso] = useState(String(r.pisoUF));
  const [rec, setRec] = useState(String(r.recomendadoUF));
  const [alto, setAlto] = useState(String(r.altoUF));
  const [razones, setRazones] = useState(r.razones.join("\n"));
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);
  const campo = "rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-1 font-body text-[13px] text-[var(--franco-text)]";
  async function guardar() {
    setOcupado(true); setEstado(null);
    const x = await llamar({ accion: "rango", userId, avisoId, postura, piso: Number(piso), recomendado: Number(rec), alto: Number(alto), razones: razones.split("\n") });
    setOcupado(false);
    if (!x.ok) { setEstado(x.error === "datos" ? "Revisa: piso ≤ recomendado ≤ borde alto ≤ techo, y al menos una razón" : x.error === "estado" ? "La oferta ya está firmada" : "No se guardó"); return; }
    router.refresh();
  }
  const firmada = r.estado !== "borrador";
  return (
    <div className="flex flex-col gap-2" data-admin="inv2-rango">
      <p className="m-0"><b>Rango de oferta</b> · {POSTURA_COPY[r.postura]} · {r.descuentoPct} % · UF {r.pisoUF}–{r.recomendadoUF}–{r.altoUF} (techo {r.techoUF}){r.comprarUF != null ? " · Ajusta: deja de convenir sobre el techo" : ""} · {firmada ? `oferta ${r.estado}${r.montoUF ? ` por UF ${r.montoUF}` : ""}` : r.corregida ? `corregido por ${r.corregida.por ?? "admin"}` : "de la regla v1.1"}</p>
      <ul className="m-0 pl-5 text-[12px]">{r.razones.map((t, i) => <li key={i}>{t}</li>)}</ul>
      {!firmada && (
        <div className="flex flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <select value={postura} onChange={(e) => setPostura(e.target.value as Postura)} aria-label="Postura" className={campo}>
              {(Object.keys(POSTURA_COPY) as Postura[]).map((k) => <option key={k} value={k}>{POSTURA_COPY[k]}</option>)}
            </select>
            <input value={piso} onChange={(e) => setPiso(e.target.value)} aria-label="Piso UF" className={`${campo} w-24`} />
            <input value={rec} onChange={(e) => setRec(e.target.value)} aria-label="Recomendado UF" className={`${campo} w-24`} />
            <input value={alto} onChange={(e) => setAlto(e.target.value)} aria-label="Borde alto UF" className={`${campo} w-24`} />
          </span>
          <textarea value={razones} onChange={(e) => setRazones(e.target.value)} aria-label="Razones (una por línea)" rows={3} className={`${campo} min-w-[320px]`} />
          <span><button type="button" className={CLASE_BTN} disabled={ocupado} onClick={() => void guardar()} data-admin="inv2-corregir-rango">{ocupado ? "Guardando…" : "Guardar corrección"}</button></span>
        </div>
      )}
      {estado && <span className="text-[12px] text-[var(--signal-red)]" role="alert">{estado}</span>}
    </div>
  );
}

/** B4 (23-nov-2026): la oferta del depto en el admin. Cada paso lo hace una persona de Franco: presentar (con el PDF que se le entrega a
 *  quien vende), registrar la respuesta (también fuera de plazo), corregir lo que sugiere Franco y marcar una aceptación como comunicada. */
export function OfertaAdmin({ o }: { o: OfertaVista }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"aceptada" | "contraoferta" | "rechazada">("contraoferta");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [vence, setVence] = useState("");
  const [sug, setSug] = useState(o.sugeridaUF != null ? String(o.sugeridaUF) : "");
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);
  const campo = "rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-1 font-body text-[13px] text-[var(--franco-text)]";
  const fecha = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—");
  async function enviar(cuerpo: Record<string, unknown>) {
    setOcupado(true); setEstado(null);
    const x = await llamar({ ...cuerpo, ofertaId: o.id });
    setOcupado(false);
    if (!x.ok) { setEstado(x.error === "monto" ? "Revisa el monto" : x.error === "fecha" ? "Revisa la fecha (de hoy en adelante)" : x.error === "estado" ? "La oferta ya no está en ese estado" : "No se guardó"); return; }
    router.refresh();
  }
  const comunicar = o.estado === "firmada" && (o.tipoRonda === "aceptar" || o.tipoRonda === "reactivar");
  const vencidaSinTardia = o.estado === "sin_acuerdo" && o.sinAcuerdoMotivo === "vencida" && !o.respuestaTardia;
  const puedeResponder = o.estado === "presentada" || vencidaSinTardia;
  const contraAbierta = o.estado === "contraoferta" || (o.estado === "sin_acuerdo" && o.respuestaTardia === "contraoferta" && !o.tardiaDecision);
  return (
    <div className="flex flex-col gap-2" data-admin="inv2-oferta-b4">
      <p className="m-0"><b>Oferta</b> · ronda {o.ronda ?? 1} · {o.estado}{o.tipoRonda ? ` (${o.tipoRonda})` : ""} · UF {o.montoUF ?? "—"} · firmada {fecha(o.firmadaAt)}
        {o.presentadaAt ? ` · presentada ${fecha(o.presentadaAt)}` : ""}{o.vigenteHasta ? ` · vence ${fecha(o.vigenteHasta)}` : ""}
        {o.respuesta ? ` · respuesta ${o.respuesta} ${fecha(o.respuestaAt)}` : ""}{o.contraofertaUF ? ` · piden UF ${o.contraofertaUF} (vence ${fecha(o.contraofertaVence)})` : ""}
        {o.sugeridaUF ? ` · Franco sugiere UF ${o.sugeridaUF}${o.sugeridaFuente === "admin" ? ` (corregida; la regla dio ${o.sugeridaReglaUF})` : " (regla)"}` : ""}
        {o.respuestaTardia ? ` · fuera de plazo: ${o.respuestaTardia}${o.tardiaDecision ? ` → ${o.tardiaDecision}` : ""}` : ""}{o.retiradaAt ? ` · retirada ${fecha(o.retiradaAt)} desde ${o.retiradaDesde}` : ""}</p>
      {o.texto && <span><a className={CLASE_BTN} href={`/api/admin/invierte-v2?oferta=${o.id}`} target="_blank" rel="noopener noreferrer" data-admin="inv2-oferta-pdf">Ver el PDF de la oferta firmada</a></span>}
      {o.estado === "firmada" && !comunicar && (
        <span><button type="button" className={CLASE_BTN} disabled={ocupado} onClick={() => void enviar({ accion: "presentar" })} data-admin="inv2-presentar">{ocupado ? "Guardando…" : "Presentada hoy a quien vende"}</button></span>
      )}
      {comunicar && (
        <span><button type="button" className={CLASE_BTN} disabled={ocupado} onClick={() => void enviar({ accion: "comunicada" })} data-admin="inv2-comunicada">{ocupado ? "Guardando…" : `Comunicada: acepta UF ${o.montoUF}`}</button></span>
      )}
      {puedeResponder && (
        <div className="flex flex-col gap-2" data-admin="inv2-respuesta">
          <p className="m-0 text-[12px]">{vencidaSinTardia ? "Respondieron fuera de plazo: la oferta no obliga; la persona decide." : "Registrar la respuesta de quien vende"}</p>
          <span className="flex flex-wrap items-center gap-2">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} aria-label="Respuesta" className={campo}>
              <option value="contraoferta">Contraoferta</option>
              <option value="aceptada">Aceptada (sujeta a visita)</option>
              {!vencidaSinTardia && <option value="rechazada">No aceptada</option>}
            </select>
            {tipo === "contraoferta" && <input value={monto} onChange={(e) => setMonto(e.target.value)} aria-label="Lo que piden (UF)" placeholder="UF que piden" className={`${campo} w-28`} />}
            {tipo === "contraoferta" && <input type="date" value={vence} onChange={(e) => setVence(e.target.value)} aria-label="Vence (vacío: 5 días)" className={campo} />}
          </span>
          {tipo === "contraoferta" && <input value={nota} onChange={(e) => setNota(e.target.value)} aria-label="Nota de quien vende" placeholder="Nota (opcional)" className={`${campo} min-w-[320px]`} />}
          <span><button type="button" className={CLASE_BTN} disabled={ocupado} onClick={() => void enviar({ accion: "respuesta", tipo, montoUF: Number(monto.replace(/\D/g, "")), nota, vence: vence || null })} data-admin="inv2-registrar-respuesta">{ocupado ? "Guardando…" : "Registrar respuesta"}</button></span>
        </div>
      )}
      {contraAbierta && (
        <span className="flex flex-wrap items-center gap-2" data-admin="inv2-sugerencia">
          <input value={sug} onChange={(e) => setSug(e.target.value)} aria-label="Franco sugiere (UF)" className={`${campo} w-28`} />
          <button type="button" className={CLASE_BTN} disabled={ocupado} onClick={() => void enviar({ accion: "sugerencia", montoUF: Number(sug.replace(/\D/g, "")) })} data-admin="inv2-corregir-sugerencia">Corregir lo que sugiere Franco</button>
        </span>
      )}
      {estado && <span className="text-[12px] text-[var(--signal-red)]" role="alert">{estado}</span>}
    </div>
  );
}
