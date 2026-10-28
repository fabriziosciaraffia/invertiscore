// /dev/popups (24-oct-2026): los pop-ups de «Analizar este» con datos de muestra, para medir que
// caben enteros en un teléfono (390 × 740) sin crear cuentas. Un estado por la URL: ?estado=a (sin saldo, con la oferta de
// cuentas nuevas) · a0 (sin saldo, sin la oferta) · d1 (con saldo, como se abre) · d1t (con saldo y la línea del ticket)
// · d2 (con saldo; «Cambiar» y el pie a 10 % lo hace quien mide) · p y p0 (la línea del plan, con y sin saldo; 28-oct-2026,
// reemplazan al aviso E de Explorar, retirado).
// No escribe nada: los botones no navegan. Gate en el servidor: dev y previews de Vercel sí; producción, 404. Lo mide la
// sonda scripts/eval/golden/popups-alto-webkit-sonda.ts.
import { notFound } from "next/navigation";
import { DemoPopups, type EstadoDemoPopups } from "./demo-popups";

/** Acá y no en demo-popups.tsx: una constante de un módulo "use client" llega al servidor como referencia, no como lista. */
const ESTADOS: readonly EstadoDemoPopups[] = ["a", "a0", "d1", "d1t", "d2", "p", "p0", "c1", "c0", "nd", "nd2"];

export const dynamic = "force-dynamic";

export default function PopupsDemo({ searchParams }: { searchParams: { estado?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const estado = (ESTADOS as readonly string[]).includes(searchParams.estado ?? "") ? (searchParams.estado as EstadoDemoPopups) : "a";
  return <DemoPopups estado={estado} />;
}
