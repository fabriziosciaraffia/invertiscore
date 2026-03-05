"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft, Loader2 } from "lucide-react";

export default function NuevoAnalisisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    comuna: "",
    ciudad: "",
    direccion: "",
    tipo: "",
    dormitorios: "",
    banos: "",
    superficie: "",
    antiguedad: "",
    precio: "",
    arriendo: "",
    gastos: "",
    contribuciones: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const nombre = `${form.tipo} ${form.dormitorios}D${form.banos}B ${form.comuna}`;

    try {
      const res = await fetch("/api/analisis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          comuna: form.comuna,
          ciudad: form.ciudad,
          direccion: form.direccion || undefined,
          tipo: form.tipo,
          dormitorios: Number(form.dormitorios),
          banos: Number(form.banos),
          superficie: Number(form.superficie),
          antiguedad: Number(form.antiguedad),
          precio: Number(form.precio),
          arriendo: Number(form.arriendo),
          gastos: Number(form.gastos),
          contribuciones: Number(form.contribuciones),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear el análisis");
      }

      const data = await res.json();
      router.push(`/analisis/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">InvertiScore</span>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Volver al Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      {/* Form */}
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Nuevo Análisis</h1>
          <p className="text-muted-foreground">
            Ingresa los datos de la propiedad para obtener tu InvertiScore
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Datos de la Propiedad</CardTitle>
              <CardDescription>
                Completa la información para generar el análisis con IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Ubicación */}
              <div className="space-y-4">
                <h3 className="font-semibold">Ubicación</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="comuna">Comuna</Label>
                    <Input
                      id="comuna"
                      placeholder="Ej: Providencia"
                      value={form.comuna}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input
                      id="ciudad"
                      placeholder="Ej: Santiago"
                      value={form.ciudad}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección (opcional)</Label>
                  <Input
                    id="direccion"
                    placeholder="Ej: Av. Providencia 1234"
                    value={form.direccion}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Características */}
              <div className="space-y-4">
                <h3 className="font-semibold">Características</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo de propiedad</Label>
                    <Input
                      id="tipo"
                      placeholder="Ej: Departamento"
                      value={form.tipo}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dormitorios">Dormitorios</Label>
                    <Input
                      id="dormitorios"
                      type="number"
                      placeholder="2"
                      value={form.dormitorios}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="banos">Baños</Label>
                    <Input
                      id="banos"
                      type="number"
                      placeholder="1"
                      value={form.banos}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="superficie">Superficie útil (m²)</Label>
                    <Input
                      id="superficie"
                      type="number"
                      placeholder="55"
                      value={form.superficie}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="antiguedad">Antigüedad (años)</Label>
                    <Input
                      id="antiguedad"
                      type="number"
                      placeholder="5"
                      value={form.antiguedad}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Financiero */}
              <div className="space-y-4">
                <h3 className="font-semibold">Datos Financieros</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="precio">Precio de venta (UF)</Label>
                    <Input
                      id="precio"
                      type="number"
                      placeholder="3500"
                      value={form.precio}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arriendo">
                      Arriendo mensual esperado (CLP)
                    </Label>
                    <Input
                      id="arriendo"
                      type="number"
                      placeholder="450000"
                      value={form.arriendo}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gastos">Gastos comunes (CLP)</Label>
                    <Input
                      id="gastos"
                      type="number"
                      placeholder="80000"
                      value={form.gastos}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contribuciones">
                      Contribuciones trimestrales (CLP)
                    </Label>
                    <Input
                      id="contribuciones"
                      type="number"
                      placeholder="150000"
                      value={form.contribuciones}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analizando con IA...
                  </>
                ) : (
                  "Generar InvertiScore"
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
