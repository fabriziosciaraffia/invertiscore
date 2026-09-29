// /dev/lo-que-sigue: gate en el servidor. Dev y previews de Vercel sí; producción, 404.
import { notFound } from "next/navigation";
import { DemoCliente } from "./demo-cliente";

export const dynamic = "force-dynamic";

export default function DemoLoQueSiguePage() {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  return <DemoCliente />;
}
