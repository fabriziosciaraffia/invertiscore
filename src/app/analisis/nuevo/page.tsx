"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft, Loader2, ChevronDown } from "lucide-react";
import { COMUNAS } from "@/lib/comunas";

const UF_CLP = 38800;

const TIPOS_PROPIEDAD = ["Departamento", "Casa", "Oficina", "Local comercial"];
const ESTADOS_VENTA = [
  { value: "blanco", label: "En blanco (antes de construcción)" },
  { value: "verde", label: "En verde (construcción iniciada)" },
  { value: "inmediata", label: "Entrega inmediata" },
];

function calcDividendo(precioUF: number, piePct: number, plazoAnos: number, tasaAnual: number) {
  const credito = precioUF * (1 - piePct / 100) * UF_CLP;
  if (credito <= 0) return 0;
  const tasaMensual = tasaAnual / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(credito / n);
  return Math.round((credito * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

function Select({
  id,
  value,
  onChange,
  children,
  required,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-border pb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

export default function NuevoAnalisisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    // Propiedad
    comuna: "",
    ciudad: "",
    direccion: "",
    tipo: "Departamento",
    dormitorios: "2",
    banos: "1",
    superficieUtil: "",
    superficieTotal: "",
    antiguedad: "",
    enConstruccion: false,
    piso: "",
    estacionamiento: "si",
    precioEstacionamiento: "",
    bodega: "no",
    // Estado de venta
    estadoVenta: "inmediata",
    fechaEntregaMes: "",
    fechaEntregaAnio: "",
    cuotasPie: "",
    montoCuota: "",
    // Financiero
    precio: "",
    piePct: "20",
    plazoCredito: "25",
    tasaInteres: "4.72",
    gastos: "",
    contribuciones: "",
    provisionMantencion: "",
    // Arriendo
    tipoRenta: "larga",
    arriendo: "",
    vacanciaMeses: "1",
    // Airbnb
    tarifaNoche: "",
    ocupacionPct: "65",
    comisionPlataforma: "3",
    costoLimpieza: "",
    amoblado: "no",
    costoAmoblado: "",
    serviciosBasicos: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [id]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleComunaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const comuna = e.target.value;
    const match = COMUNAS.find((c) => c.comuna === comuna);
    setForm((prev) => ({
      ...prev,
      comuna,
      ciudad: match?.ciudad || prev.ciudad,
    }));
  };

  // Real-time calculations
  const calc = useMemo(() => {
    const precio = parseFloat(form.precio) || 0;
    const supUtil = parseFloat(form.superficieUtil) || 0;
    const piePct = parseFloat(form.piePct) || 20;
    const plazo = parseFloat(form.plazoCredito) || 25;
    const tasa = parseFloat(form.tasaInteres) || 4.72;

    const precioCLP = precio * UF_CLP;
    const precioM2 = supUtil > 0 ? precio / supUtil : 0;
    const pieUF = precio * (piePct / 100);
    const pieCLP = pieUF * UF_CLP;
    const financiamientoPct = 100 - piePct;
    const dividendo = calcDividendo(precio, piePct, plazo, tasa);

    // Provision mantencion auto: 1% valor anual / 12
    const provisionAuto = Math.round((precioCLP * 0.01) / 12);

    return { precioCLP, precioM2, pieUF, pieCLP, financiamientoPct, dividendo, provisionAuto };
  }, [form.precio, form.superficieUtil, form.piePct, form.plazoCredito, form.tasaInteres]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supUtil = parseFloat(form.superficieUtil) || 0;
    const supTotal = parseFloat(form.superficieTotal) || supUtil;
    const precio = parseFloat(form.precio) || 0;
    const arriendo = parseFloat(form.arriendo) || 0;
    const gastos = parseFloat(form.gastos) || 0;
    const contribuciones = parseFloat(form.contribuciones) || 0;
    const antiguedad = form.enConstruccion ? 0 : parseFloat(form.antiguedad) || 0;
    const provisionMantencion = parseFloat(form.provisionMantencion) || calc.provisionAuto;

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
          superficie: supUtil,
          superficieTotal: supTotal,
          antiguedad,
          enConstruccion: form.enConstruccion,
          piso: Number(form.piso) || 0,
          estacionamiento: form.estacionamiento,
          precioEstacionamiento: parseFloat(form.precioEstacionamiento) || 0,
          bodega: form.bodega === "si",
          estadoVenta: form.estadoVenta,
          fechaEntrega: form.estadoVenta !== "inmediata"
            ? `${form.fechaEntregaAnio}-${form.fechaEntregaMes}`
            : undefined,
          cuotasPie: Number(form.cuotasPie) || 0,
          montoCuota: parseFloat(form.montoCuota) || 0,
          precio,
          piePct: parseFloat(form.piePct),
          plazoCredito: parseFloat(form.plazoCredito),
          tasaInteres: parseFloat(form.tasaInteres),
          gastos,
          contribuciones,
          provisionMantencion,
          tipoRenta: form.tipoRenta,
          arriendo,
          vacanciaMeses: parseFloat(form.vacanciaMeses),
          // Airbnb fields
          tarifaNoche: parseFloat(form.tarifaNoche) || 0,
          ocupacionPct: parseFloat(form.ocupacionPct) || 65,
          comisionPlataforma: parseFloat(form.comisionPlataforma) || 3,
          costoLimpieza: parseFloat(form.costoLimpieza) || 0,
          amoblado: form.amoblado === "si",
          costoAmoblado: parseFloat(form.costoAmoblado) || 0,
          serviciosBasicos: parseFloat(form.serviciosBasicos) || 0,
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

  const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
  const fmtUF = (n: number) => n.toFixed(1) + " UF";

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
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Nuevo An&aacute;lisis</h1>
          <p className="text-muted-foreground">
            Ingresa los datos de la propiedad para obtener tu InvertiScore
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* ===== SECCION 1: DATOS DE LA PROPIEDAD ===== */}
          <Card>
            <CardHeader>
              <CardTitle>Datos de la Propiedad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Ubicación */}
              <SectionTitle>Ubicaci&oacute;n</SectionTitle>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="comuna">Comuna</Label>
                  <Select id="comuna" value={form.comuna} onChange={handleComunaChange} required>
                    <option value="">Seleccionar comuna...</option>
                    {COMUNAS.map((c) => (
                      <option key={c.comuna} value={c.comuna}>
                        {c.comuna}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input id="ciudad" value={form.ciudad} onChange={handleChange} required readOnly className="bg-muted/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Direcci&oacute;n (opcional)</Label>
                <Input id="direccion" placeholder="Ej: Av. Providencia 1234" value={form.direccion} onChange={handleChange} />
              </div>

              {/* Características */}
              <SectionTitle>Caracter&iacute;sticas</SectionTitle>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de propiedad</Label>
                  <Select id="tipo" value={form.tipo} onChange={handleChange} required>
                    {TIPOS_PROPIEDAD.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dormitorios">Dormitorios</Label>
                    <Select id="dormitorios" value={form.dormitorios} onChange={handleChange}>
                      {[0, 1, 2, 3, 4].map((n) => (
                        <option key={n} value={String(n)}>{n}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="banos">Ba&ntilde;os</Label>
                    <Select id="banos" value={form.banos} onChange={handleChange}>
                      {[1, 2, 3].map((n) => (
                        <option key={n} value={String(n)}>{n}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="superficieUtil">Superficie &uacute;til m&sup2;</Label>
                  <Input id="superficieUtil" type="number" placeholder="55" value={form.superficieUtil} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="superficieTotal">Superficie total m&sup2;</Label>
                  <Input id="superficieTotal" type="number" placeholder="60" value={form.superficieTotal} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="piso">Piso</Label>
                  <Input id="piso" type="number" placeholder="5" value={form.piso} onChange={handleChange} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="antiguedad">Antig&uuml;edad (a&ntilde;os)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="antiguedad"
                      type="number"
                      placeholder="5"
                      value={form.antiguedad}
                      onChange={handleChange}
                      disabled={form.enConstruccion}
                      required={!form.enConstruccion}
                      className={form.enConstruccion ? "opacity-50" : ""}
                    />
                    <label className="flex shrink-0 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        id="enConstruccion"
                        checked={form.enConstruccion}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-input"
                      />
                      En construcci&oacute;n
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estacionamiento">Estacionamiento</Label>
                    <Select id="estacionamiento" value={form.estacionamiento} onChange={handleChange}>
                      <option value="si">S&iacute; incluido</option>
                      <option value="no">No</option>
                      <option value="opcional">Opcional (extra)</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bodega">Bodega</Label>
                    <Select id="bodega" value={form.bodega} onChange={handleChange}>
                      <option value="no">No</option>
                      <option value="si">S&iacute;</option>
                    </Select>
                  </div>
                </div>
              </div>
              {form.estacionamiento === "opcional" && (
                <div className="space-y-2 md:w-1/2">
                  <Label htmlFor="precioEstacionamiento">Precio estacionamiento (UF)</Label>
                  <Input id="precioEstacionamiento" type="number" placeholder="350" value={form.precioEstacionamiento} onChange={handleChange} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== SECCION 2: ESTADO DE VENTA ===== */}
          <Card>
            <CardHeader>
              <CardTitle>Estado de Venta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                {ESTADOS_VENTA.map((estado) => (
                  <label key={estado.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="estadoVenta"
                      id="estadoVenta"
                      value={estado.value}
                      checked={form.estadoVenta === estado.value}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">{estado.label}</span>
                  </label>
                ))}
              </div>

              {form.estadoVenta !== "inmediata" && (
                <div className="space-y-4 rounded-lg border border-border/50 bg-muted/30 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fechaEntregaMes">Mes entrega estimada</Label>
                      <Select id="fechaEntregaMes" value={form.fechaEntregaMes} onChange={handleChange}>
                        <option value="">Mes...</option>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                            {new Date(2000, i).toLocaleString("es-CL", { month: "long" })}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fechaEntregaAnio">A&ntilde;o</Label>
                      <Select id="fechaEntregaAnio" value={form.fechaEntregaAnio} onChange={handleChange}>
                        <option value="">A&ntilde;o...</option>
                        {[2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cuotasPie">Cuotas del pie</Label>
                      <Input id="cuotasPie" type="number" placeholder="24" value={form.cuotasPie} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="montoCuota">Monto por cuota (CLP)</Label>
                      <Input id="montoCuota" type="number" placeholder="500000" value={form.montoCuota} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== SECCION 3: DATOS FINANCIEROS ===== */}
          <Card>
            <CardHeader>
              <CardTitle>Datos Financieros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio de venta (UF)</Label>
                  <Input id="precio" type="number" step="0.01" placeholder="3500" value={form.precio} onChange={handleChange} required />
                  {parseFloat(form.precio) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {fmt(calc.precioCLP)} CLP
                      {calc.precioM2 > 0 && <> &middot; {fmtUF(calc.precioM2)}/m&sup2;</>}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="piePct">Pie ({form.piePct}%)</Label>
                  <input
                    id="piePct"
                    type="range"
                    min="10"
                    max="50"
                    step="5"
                    value={form.piePct}
                    onChange={handleChange}
                    className="mt-2 w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmtUF(calc.pieUF)} ({fmt(calc.pieCLP)})</span>
                    <span>Financiamiento: {calc.financiamientoPct}%</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plazoCredito">Plazo cr&eacute;dito ({form.plazoCredito} a&ntilde;os)</Label>
                  <input
                    id="plazoCredito"
                    type="range"
                    min="10"
                    max="30"
                    step="5"
                    value={form.plazoCredito}
                    onChange={handleChange}
                    className="mt-2 w-full accent-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tasaInteres">Tasa inter&eacute;s anual (%)</Label>
                  <Input id="tasaInteres" type="number" step="0.01" placeholder="4.72" value={form.tasaInteres} onChange={handleChange} required />
                  <p className="text-xs text-muted-foreground">Referencia actual mercado: ~4.72%</p>
                </div>
              </div>

              {/* Dividendo estimado en tiempo real */}
              {calc.dividendo > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Dividendo estimado</span>
                    <span className="text-lg font-bold text-primary">{fmt(calc.dividendo)}/mes</span>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="gastos">Gastos comunes (CLP/mes)</Label>
                  <Input id="gastos" type="number" placeholder="80000" value={form.gastos} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contribuciones">Contribuciones (CLP/trim)</Label>
                  <Input id="contribuciones" type="number" placeholder="150000" value={form.contribuciones} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provisionMantencion">Provisi&oacute;n mantenci&oacute;n (CLP/mes)</Label>
                  <Input
                    id="provisionMantencion"
                    type="number"
                    placeholder={String(calc.provisionAuto)}
                    value={form.provisionMantencion}
                    onChange={handleChange}
                  />
                  <p className="text-xs text-muted-foreground">Auto: {fmt(calc.provisionAuto)} (1% anual)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ===== SECCION 4: DESTINO DEL ARRIENDO ===== */}
          <Card>
            <CardHeader>
              <CardTitle>Destino del Arriendo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Toggle renta larga / corta */}
              <div className="flex overflow-hidden rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, tipoRenta: "larga" }))}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    form.tipoRenta === "larga"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Renta Larga
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, tipoRenta: "corta" }))}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    form.tipoRenta === "corta"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Renta Corta (Airbnb)
                </button>
              </div>

              {form.tipoRenta === "larga" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="arriendo">Arriendo esperado (CLP/mes)</Label>
                      <Input id="arriendo" type="number" placeholder="450000" value={form.arriendo} onChange={handleChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vacanciaMeses">Vacancia estimada (meses/a&ntilde;o)</Label>
                      <Select id="vacanciaMeses" value={form.vacanciaMeses} onChange={handleChange}>
                        <option value="0.5">0.5 meses</option>
                        <option value="1">1 mes</option>
                        <option value="1.5">1.5 meses</option>
                        <option value="2">2 meses</option>
                        <option value="3">3 meses</option>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tarifaNoche">Tarifa por noche (CLP)</Label>
                      <Input id="tarifaNoche" type="number" placeholder="45000" value={form.tarifaNoche} onChange={handleChange} required={form.tipoRenta === "corta"} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ocupacionPct">Ocupaci&oacute;n estimada ({form.ocupacionPct}%)</Label>
                      <input
                        id="ocupacionPct"
                        type="range"
                        min="30"
                        max="90"
                        step="5"
                        value={form.ocupacionPct}
                        onChange={handleChange}
                        className="mt-2 w-full accent-primary"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="comisionPlataforma">Comisi&oacute;n plataforma (%)</Label>
                      <Input id="comisionPlataforma" type="number" step="0.1" placeholder="3" value={form.comisionPlataforma} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="costoLimpieza">Costo limpieza por estad&iacute;a (CLP)</Label>
                      <Input id="costoLimpieza" type="number" placeholder="25000" value={form.costoLimpieza} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="amoblado">Amoblado</Label>
                      <Select id="amoblado" value={form.amoblado} onChange={handleChange}>
                        <option value="no">No</option>
                        <option value="si">S&iacute;</option>
                      </Select>
                    </div>
                    {form.amoblado === "si" && (
                      <div className="space-y-2">
                        <Label htmlFor="costoAmoblado">Inversi&oacute;n amoblado (CLP)</Label>
                        <Input id="costoAmoblado" type="number" placeholder="3000000" value={form.costoAmoblado} onChange={handleChange} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 md:w-1/2">
                    <Label htmlFor="serviciosBasicos">Servicios b&aacute;sicos (CLP/mes)</Label>
                    <Input id="serviciosBasicos" type="number" placeholder="80000" value={form.serviciosBasicos} onChange={handleChange} />
                    <p className="text-xs text-muted-foreground">Luz, agua, internet, gas</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            className="w-full gap-2"
            size="lg"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando InvertiScore...
              </>
            ) : (
              "Generar InvertiScore"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
