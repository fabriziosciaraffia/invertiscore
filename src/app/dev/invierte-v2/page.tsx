// /dev/invierte-v2 (18-nov-2026): las ventanas del flujo nuevo de Invierte con Franco con datos de muestra, para medir que caben
// enteras en celular, notebook y escritorio sin crear cuentas. ?estado=contacto (la hoja de contacto, sin sesión) · orden («Ver mi
// orden») · preguntas (las de la firma). No escribe nada. Gate en el servidor: dev y previews de Vercel sí; producción, 404. Lo
// mide la sonda scripts/eval/golden/invierte-v2-alto-sonda.ts.
import { notFound } from "next/navigation";
import { DemoVentanas, type EstadoDemoVentanas } from "./demo-ventanas";

const ESTADOS: readonly EstadoDemoVentanas[] = ["contacto", "orden", "preguntas"];

export const dynamic = "force-dynamic";

export default function VentanasDemo({ searchParams }: { searchParams: { estado?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const estado = (ESTADOS as readonly string[]).includes(searchParams.estado ?? "") ? (searchParams.estado as EstadoDemoVentanas) : "contacto";
  return <DemoVentanas estado={estado} />;
}
