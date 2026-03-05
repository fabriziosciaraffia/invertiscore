import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Building2,
  ArrowLeft,
  DollarSign,
  BarChart3,
  Sparkles,
} from "lucide-react";
import type { Analisis, FullAnalysisResult } from "@/lib/types";
import { DeleteButton } from "./delete-button";
import { ScoreCircle } from "./score-circle";
import { ShareButton } from "./share-button";
import { PremiumResults } from "./results-client";

const UF_CLP = 38800;

function getClasificacionLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "Inversión Excelente", color: "text-green-500" };
  if (score >= 65) return { text: "Inversión Buena", color: "text-blue-500" };
  if (score >= 50) return { text: "Inversión Regular", color: "text-yellow-500" };
  if (score >= 30) return { text: "Inversión Débil", color: "text-orange-500" };
  return { text: "Evitar", color: "text-red-500" };
}

export default async function AnalisisDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("analisis")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) {
    redirect("/dashboard");
  }

  const analisis = data as Analisis;
  const results: FullAnalysisResult | null = analisis.results || null;
  const clasificacion = getClasificacionLabel(analisis.score);
  const unlocked = user?.email === "fabriziosciaraffia@gmail.com";

  // Basic metrics for free section (works with or without full results)
  const precioCLP = analisis.precio * UF_CLP;
  const yieldBruto = precioCLP > 0 ? ((analisis.arriendo * 12) / precioCLP * 100) : 0;
  const precioM2 = analisis.superficie > 0 ? analisis.precio / analisis.superficie : 0;
  const flujoEstimado = results?.metrics?.flujoNetoMensual ?? (analisis.arriendo - Math.round((analisis.precio * 0.8 * UF_CLP * 0.0472 / 12) / (1 - Math.pow(1 + 0.0472 / 12, -300))) - analisis.gastos - Math.round(analisis.contribuciones / 3));

  const resumenEjecutivo = results?.resumenEjecutivo ??
    `Inversión con score ${analisis.score}/100. Yield bruto ${yieldBruto.toFixed(1)}%.`;

  const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border/50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">InvertiScore</span>
          </div>
          <div className="flex items-center gap-2">
            <ShareButton id={analisis.id} score={analisis.score} nombre={analisis.nombre} />
            <DeleteButton id={analisis.id} />
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* ===== FREE: Section 1 - Score + Classification ===== */}
        <div className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-start">
          <ScoreCircle score={analisis.score} />
          <div>
            <div className={`mb-1 text-sm font-semibold ${clasificacion.color}`}>
              {clasificacion.text}
            </div>
            <h1 className="text-3xl font-bold">{analisis.nombre}</h1>
            <p className="text-muted-foreground">
              {analisis.comuna}, {analisis.ciudad} · {new Date(analisis.created_at).toLocaleDateString("es-CL")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {resumenEjecutivo}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span className="rounded bg-secondary px-2.5 py-1">{analisis.tipo}</span>
              <span className="rounded bg-secondary px-2.5 py-1">
                {analisis.dormitorios}D{analisis.banos}B · {analisis.superficie} m²
              </span>
              <span className="rounded bg-secondary px-2.5 py-1">{analisis.precio} UF</span>
              <span className="rounded bg-secondary px-2.5 py-1">{fmt(analisis.arriendo)}/mes</span>
            </div>
          </div>
        </div>

        {/* ===== FREE: Section 4 - 3 Basic Metrics ===== */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign className="h-4 w-4 text-primary" />
                Yield Bruto
              </div>
              <div className="mt-1 text-2xl font-bold">
                {(results?.metrics?.yieldBruto ?? yieldBruto).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <BarChart3 className="h-4 w-4 text-primary" />
                Flujo Mensual Estimado
              </div>
              <div className={`mt-1 text-2xl font-bold ${flujoEstimado >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {flujoEstimado >= 0 ? "+" : ""}{fmt(flujoEstimado)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                Precio UF/m²
              </div>
              <div className="mt-1 text-2xl font-bold">
                {(results?.metrics?.precioM2 ?? precioM2).toFixed(1)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== FREE: Section 5 - CTA ===== */}
        {!unlocked && (
          <Card className="mb-8 border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center md:flex-row md:text-left">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">
                  Tu InvertiScore es {analisis.score}. ¿Quieres saber por qué?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Desbloquea el informe completo con radar de dimensiones, 8 métricas,
                  flujo de caja, proyecciones y análisis detallado.
                </p>
              </div>
              <Button size="lg" className="shrink-0 gap-2">
                <Sparkles className="h-4 w-4" />
                Desbloquear — $4.990
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ===== PREMIUM: All detailed sections ===== */}
        {results && <PremiumResults results={results} unlocked={unlocked} />}

        {/* Fallback for old analyses without full results */}
        {!results && (
          <Card className="mb-8 border-border/50 bg-card/50">
            <CardContent className="p-6">
              <h3 className="mb-2 text-sm font-semibold">Resumen</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {analisis.resumen}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
