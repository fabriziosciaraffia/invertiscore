import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  ArrowLeft,
  TrendingUp,
  Shield,
  DollarSign,
  MapPin,
} from "lucide-react";
import type { Analisis } from "@/lib/types";
import { DeleteButton } from "./delete-button";

export default async function AnalisisDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data } = await supabase
    .from("analisis")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) {
    redirect("/dashboard");
  }

  const analisis = data as Analisis;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">InvertiScore</span>
          </div>
          <div className="flex items-center gap-2">
            <DeleteButton id={analisis.id} />
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Volver al Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header con Score */}
        <div className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-start">
          <div className="flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-full border-4 border-primary bg-primary/5">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">
                {analisis.score}
              </div>
              <div className="text-xs text-muted-foreground">InvertiScore</div>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold">{analisis.nombre}</h1>
            <p className="text-muted-foreground">
              {analisis.comuna}, {analisis.ciudad} · Análisis del{" "}
              {new Date(analisis.created_at).toLocaleDateString("es-CL")}
            </p>
            <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
              <span>Precio: {analisis.precio} UF</span>
              <span>
                Arriendo: ${analisis.arriendo.toLocaleString("es-CL")}/mes
              </span>
            </div>
          </div>
        </div>

        {/* Desglose de Score */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm">Rentabilidad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analisis.desglose.rentabilidad}
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${analisis.desglose.rentabilidad}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm">Plusvalía</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analisis.desglose.plusvalia}
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${analisis.desglose.plusvalia}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm">Bajo Riesgo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analisis.desglose.riesgo}
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${analisis.desglose.riesgo}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm">Ubicación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analisis.desglose.ubicacion}
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${analisis.desglose.ubicacion}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resumen AI */}
        <Card>
          <CardHeader>
            <CardTitle>Análisis de IA</CardTitle>
            <CardDescription>
              Resumen generado por inteligencia artificial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed text-muted-foreground">
              {analisis.resumen}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
