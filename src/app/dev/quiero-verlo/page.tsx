// /dev/quiero-verlo (25-oct-2026): la confirmación de «Quiero verlo» del informe, dibujada sin crear cuentas ni mandar
// correos, para medir que un correo largo no se desborda. ?estado=listo|ya y ?correo=… (por defecto, uno de 40 caracteres).
// Gate en el servidor: dev y previews de Vercel sí; producción, 404. Lo mide la sonda
// scripts/eval/golden/quiero-verlo-webkit-sonda.ts.
import { notFound } from "next/navigation";
import { ConfirmacionEnviado } from "@/components/guia/ConfirmacionEnviado";
import "@/components/guia/guia.css";

export const dynamic = "force-dynamic";

/** 40 caracteres, como el gate. */
const CORREO_LARGO_DE_PRUEBA ="fabriziosciaraffia+qadeptos5xy@gmail.com";

export default function QuieroVerloDemo({ searchParams }: { searchParams: { estado?: string; correo?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const estado = searchParams.estado === "ya" ? "ya" : "listo";
  const correo = searchParams.correo || CORREO_LARGO_DE_PRUEBA;
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: 16 }} data-demo-quiero-verlo={estado}>
      <div className="qv">
        <div className="qv-banda" data-qv={estado}>
          {estado === "ya"
            ? <ConfirmacionEnviado tipo="ya" correo={correo} cuando="el 17 de octubre" asunto="Providencia · 2D1B · UF 4.200" />
            : <ConfirmacionEnviado tipo="listo" correo={correo} />}
        </div>
      </div>
    </main>
  );
}
