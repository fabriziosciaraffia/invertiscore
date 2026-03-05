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
  Lock,
  Brain,
  Calendar,
  BarChart3,
  Sparkles,
} from "lucide-react";
import type { Analisis } from "@/lib/types";
import { DeleteButton } from "./delete-button";
import { ScoreCircle } from "./score-circle";
import { ShareButton } from "./share-button";
import { CashflowChart } from "./cashflow-chart";

const UF_CLP = 38000;

function PremiumOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card/90 px-6 py-4 shadow-lg">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm font-medium">Disponible en Informe Premium</span>
      </div>
    </div>
  );
}

function calcDividendo(precioUF: number) {
  const pie = 0.2;
  const credito = precioUF * (1 - pie) * UF_CLP;
  const tasaMensual = 0.0472 / 12;
  const n = 25 * 12;
  const dividendo = (credito * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n));
  return Math.round(dividendo);
}

function proyeccion(precioUF: number, arriendoMensual: number, gastos: number, contribucionesMes: number, anos: number) {
  const plusvaliaAnual = 0.04;
  const arriendoInflacion = 0.035;
  const dividendo = calcDividendo(precioUF);

  let valorPropiedad = precioUF * UF_CLP;
  let arriendoActual = arriendoMensual;
  let flujoCajaTotal = 0;

  for (let i = 0; i < anos; i++) {
    const flujoAnual = (arriendoActual - dividendo - gastos - contribucionesMes) * 12;
    flujoCajaTotal += flujoAnual;
    valorPropiedad *= 1 + plusvaliaAnual;
    arriendoActual *= 1 + arriendoInflacion;
  }

  const inversionInicial = precioUF * 0.2 * UF_CLP;
  const plusvaliaTotal = valorPropiedad - precioUF * UF_CLP;
  const retornoTotal = flujoCajaTotal + plusvaliaTotal;
  const roi = (retornoTotal / inversionInicial) * 100;

  return {
    valorPropiedad: Math.round(valorPropiedad),
    plusvaliaTotal: Math.round(plusvaliaTotal),
    flujoCajaTotal: Math.round(flujoCajaTotal),
    retornoTotal: Math.round(retornoTotal),
    roi: Math.round(roi),
    arriendoFuturo: Math.round(arriendoActual),
  };
}

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
  const dividendo = calcDividendo(analisis.precio);
  const contribucionesMes = Math.round(analisis.contribuciones / 3);
  const flujoNeto = analisis.arriendo - dividendo - analisis.gastos - contribucionesMes;
  const precioCLP = analisis.precio * UF_CLP;
  const capRate = ((analisis.arriendo - analisis.gastos - contribucionesMes) * 12) / precioCLP * 100;
  const precioM2 = analisis.precio / analisis.superficie;
  const proy5 = proyeccion(analisis.precio, analisis.arriendo, analisis.gastos, contribucionesMes, 5);
  const proy10 = proyeccion(analisis.precio, analisis.arriendo, analisis.gastos, contribucionesMes, 10);

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
        {/* ===== FREE: Header con Score ===== */}
        <div className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-start">
          <ScoreCircle score={analisis.score} />
          <div>
            <h1 className="text-3xl font-bold">{analisis.nombre}</h1>
            <p className="text-muted-foreground">
              {analisis.comuna}, {analisis.ciudad} · {new Date(analisis.created_at).toLocaleDateString("es-CL")}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span className="rounded bg-secondary px-2.5 py-1">
                {analisis.tipo}
              </span>
              <span className="rounded bg-secondary px-2.5 py-1">
                {analisis.dormitorios}D{analisis.banos}B · {analisis.superficie} m²
              </span>
              <span className="rounded bg-secondary px-2.5 py-1">
                {analisis.precio} UF
              </span>
              <span className="rounded bg-secondary px-2.5 py-1">
                {fmt(analisis.arriendo)}/mes
              </span>
            </div>
          </div>
        </div>

        {/* ===== FREE: 4 Métricas ===== */}
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          {[
            { icon: DollarSign, label: "Rentabilidad", val: analisis.desglose.rentabilidad },
            { icon: TrendingUp, label: "Plusvalía", val: analisis.desglose.plusvalia },
            { icon: Shield, label: "Bajo Riesgo", val: analisis.desglose.riesgo },
            { icon: MapPin, label: "Ubicación", val: analisis.desglose.ubicacion },
          ].map(({ icon: Icon, label, val }) => (
            <Card key={label} className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <Icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{val}</div>
                <div className="mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${val}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ===== FREE: CTA ===== */}
        <Card className="mb-8 border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center md:flex-row md:text-left">
            <div className="flex-1">
              <h3 className="text-lg font-semibold">
                Tu InvertiScore es {analisis.score}. ¿Quieres saber por qué?
              </h3>
              <p className="text-sm text-muted-foreground">
                Desbloquea el informe completo con flujo de caja, proyecciones y análisis detallado.
              </p>
            </div>
            <Button size="lg" className="shrink-0 gap-2">
              <Sparkles className="h-4 w-4" />
              Desbloquear Informe Completo — $4.990
            </Button>
          </CardContent>
        </Card>

        {/* ===== PREMIUM: Flujo de Caja Desglose ===== */}
        <div className="relative mb-8">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <CardTitle>Desglose Flujo de Caja Mensual</CardTitle>
              </div>
              <CardDescription>
                Crédito hipotecario: 80% financiamiento, 25 años, tasa 4.72%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                  <div className="text-xs text-muted-foreground">Arriendo mensual</div>
                  <div className="text-lg font-bold text-emerald-400">{fmt(analisis.arriendo)}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                  <div className="text-xs text-muted-foreground">Dividendo hipotecario</div>
                  <div className="text-lg font-bold text-red-400">-{fmt(dividendo)}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                  <div className="text-xs text-muted-foreground">Gastos + Contribuciones</div>
                  <div className="text-lg font-bold text-red-400">
                    -{fmt(analisis.gastos + contribucionesMes)}
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                  <div className="text-xs text-muted-foreground">Flujo neto mensual</div>
                  <div className={`text-lg font-bold ${flujoNeto >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {flujoNeto >= 0 ? "+" : ""}{fmt(flujoNeto)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Pie (20%): {fmt(analisis.precio * 0.2 * UF_CLP)}</span>
                <span>CAP rate neto: {capRate.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
          <PremiumOverlay />
        </div>

        {/* ===== PREMIUM: Gráfico Flujo de Caja Año 1 ===== */}
        <div className="relative mb-8">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle>Flujo de Caja — Año 1</CardTitle>
              </div>
              <CardDescription>
                Mes 1: vacancia (sin arriendo) · Mes 2: corretaje (50% arriendo) · Mes 3-12: operación normal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CashflowChart
                arriendoMensual={analisis.arriendo}
                dividendo={dividendo}
                gastos={analisis.gastos}
                contribucionesMes={contribucionesMes}
              />
            </CardContent>
          </Card>
          <PremiumOverlay />
        </div>

        {/* ===== PREMIUM: Análisis IA ===== */}
        <div className="relative mb-8">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle>Análisis de IA</CardTitle>
              </div>
              <CardDescription>
                Pros, contras y recomendación generados por inteligencia artificial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-emerald-400">Pros</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {capRate >= 4 && <li>• CAP rate neto de {capRate.toFixed(1)}%, superior al promedio</li>}
                  {analisis.antiguedad <= 5 && <li>• Propiedad nueva, menores costos de mantención</li>}
                  {analisis.desglose.ubicacion >= 75 && <li>• Ubicación con alta demanda de arriendo</li>}
                  {flujoNeto > 0 && <li>• Flujo de caja mensual positivo desde el inicio</li>}
                  {capRate < 4 && analisis.desglose.ubicacion >= 75 && <li>• Buena ubicación compensa rentabilidad moderada</li>}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-red-400">Contras</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {capRate < 3.5 && <li>• CAP rate neto bajo ({capRate.toFixed(1)}%), rentabilidad ajustada</li>}
                  {analisis.antiguedad > 15 && <li>• Antigüedad de {analisis.antiguedad} años puede requerir mantención</li>}
                  {flujoNeto < 0 && <li>• Flujo de caja mensual negativo (-{fmt(Math.abs(flujoNeto))})</li>}
                  {analisis.gastos > analisis.arriendo * 0.25 && <li>• Gastos comunes representan más del 25% del arriendo</li>}
                </ul>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                <h4 className="mb-2 text-sm font-semibold">Resumen</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {analisis.resumen}
                </p>
              </div>
            </CardContent>
          </Card>
          <PremiumOverlay />
        </div>

        {/* ===== PREMIUM: Proyección 5 y 10 años ===== */}
        <div className="relative mb-8">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Proyección a 5 y 10 Años</CardTitle>
              </div>
              <CardDescription>
                Supuestos: plusvalía 4% anual, arriendos +3.5% anual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: "5 años", data: proy5 },
                  { label: "10 años", data: proy10 },
                ].map(({ label, data }) => (
                  <div key={label} className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-primary">{label}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor propiedad</span>
                        <span className="font-medium">{fmt(data.valorPropiedad)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plusvalía acumulada</span>
                        <span className="font-medium text-emerald-400">+{fmt(data.plusvaliaTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Flujo de caja acumulado</span>
                        <span className={`font-medium ${data.flujoCajaTotal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {data.flujoCajaTotal >= 0 ? "+" : ""}{fmt(data.flujoCajaTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Arriendo proyectado</span>
                        <span className="font-medium">{fmt(data.arriendoFuturo)}/mes</span>
                      </div>
                      <div className="mt-2 border-t border-border/50 pt-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Retorno total</span>
                          <span className="font-bold text-primary">+{fmt(data.retornoTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ROI sobre pie</span>
                          <span className="font-bold text-primary">{data.roi}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <PremiumOverlay />
        </div>

        {/* ===== PREMIUM: Comparación Precio/m² ===== */}
        <div className="relative mb-8">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Comparación Precio/m²</CardTitle>
              </div>
              <CardDescription>
                Precio por metro cuadrado vs promedio estimado de la zona
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const promedioZona = precioM2 * (analisis.desglose.ubicacion >= 75 ? 1.08 : 0.95);
                const diff = ((precioM2 - promedioZona) / promedioZona) * 100;
                const maxBar = Math.max(precioM2, promedioZona);

                return (
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>Esta propiedad</span>
                        <span className="font-semibold">{precioM2.toFixed(1)} UF/m²</span>
                      </div>
                      <div className="h-4 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(precioM2 / maxBar) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>Promedio {analisis.comuna}</span>
                        <span className="font-semibold">{promedioZona.toFixed(1)} UF/m²</span>
                      </div>
                      <div className="h-4 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-muted-foreground/40"
                          style={{ width: `${(promedioZona / maxBar) * 100}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {diff > 0
                        ? `El precio está un ${Math.abs(diff).toFixed(1)}% por sobre el promedio de la zona.`
                        : `El precio está un ${Math.abs(diff).toFixed(1)}% por debajo del promedio de la zona, lo que puede representar una oportunidad.`}
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          <PremiumOverlay />
        </div>

        {/* ===== CTA Final ===== */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Sparkles className="h-8 w-8 text-primary" />
            <h3 className="text-xl font-bold">Desbloquea el informe completo</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Accede al flujo de caja detallado, proyecciones a 5 y 10 años,
              análisis IA con pros y contras, y comparación de mercado.
            </p>
            <Button size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Desbloquear Informe Completo — $4.990
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
