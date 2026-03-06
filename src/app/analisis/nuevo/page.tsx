"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { InfoTooltip } from "@/components/ui/tooltip";
import { Building2, ArrowLeft, Loader2, ChevronDown } from "lucide-react";
import { COMUNAS, REGIONES } from "@/lib/comunas";

const UF_CLP_FALLBACK = 38800;

const TIPOS_PROPIEDAD = ["Departamento", "Casa", "Oficina", "Local comercial"];
const ESTADOS_VENTA = [
  { value: "blanco", label: "En blanco (antes de construcción)" },
  { value: "verde", label: "En verde (construcción iniciada)" },
  { value: "inmediata", label: "Entrega inmediata" },
];

// Form field tooltips
const FIELD_TIPS: Record<string, string> = {
  precio: "Precio de venta de la propiedad en UF. Lo encuentras en la publicación o cotización.",
  precioCLP: "Precio de venta en pesos chilenos. Lo encuentras en la publicación o cotización.",
  piePct: "Porcentaje del precio que pagas de tu bolsillo. En Chile, los bancos financian hasta 80%, así que el pie mínimo es 20%.",
  gastos: "Monto mensual que cobra la administración del edificio. Pregunta al corredor o revisa la publicación.",
  contribuciones: "Impuesto territorial que se paga al SII cada trimestre. Lo puedes consultar en sii.cl con el rol de la propiedad.",
  arriendo: "Cuánto esperas cobrar de arriendo mensual. Si no sabes, revisa arriendos similares en Portal Inmobiliario para la misma zona.",
  arriendoUF: "Cuánto esperas cobrar de arriendo mensual en UF. Si no sabes, revisa arriendos similares en Portal Inmobiliario.",
  tasaInteres: "Tasa real anual del crédito hipotecario. La tasa actual de referencia en Chile es ~4.72%. Puedes simularlo en el sitio de tu banco.",
  provisionMantencion: "Reserva mensual para reparaciones y mantención. La regla general es 1% del valor de la propiedad al año, dividido en 12 meses.",
  vacanciaMeses: "Meses al año que estimas que la propiedad estará sin arrendatario. 1 mes/año es el estándar.",
  piso: "El piso puede influir en el arriendo (pisos altos se arriendan más fácil y caro) y en la plusvalía.",
  antiguedad: "Los años del inmueble afectan los costos de mantención (más antiguo = más reparaciones) y la plusvalía (nuevos se aprecian más).",
  estacionamiento: "Si incluye estacionamiento, suma valor al arriendo (~$30.000-$50.000 CLP/mes extra) y a la plusvalía.",
  bodega: "Si incluye bodega, suma un pequeño valor al arriendo (~$10.000-$20.000 CLP/mes extra).",
};

function calcDividendo(precioUF: number, piePct: number, plazoAnos: number, tasaAnual: number, ufClp: number) {
  const credito = precioUF * (1 - piePct / 100) * ufClp;
  if (credito <= 0) return 0;
  const tasaMensual = tasaAnual / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(credito / n);
  return Math.round((credito * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

function Select({
  id, value, onChange, children, required,
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
        id={id} value={value} onChange={onChange} required={required}
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

function FieldLabel({ htmlFor, children, tip }: { htmlFor: string; children: React.ReactNode; tip?: string }) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor}>{children}</Label>
      {tip && <InfoTooltip content={tip} />}
    </div>
  );
}

function CurrencyMiniToggle({ field, value, onChange }: { field: string; value: "CLP" | "UF"; onChange: (field: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(field)}
      className="ml-1 inline-flex h-5 items-center rounded border border-border bg-muted/50 px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted"
      title={`Cambiar a ${value === "CLP" ? "UF" : "CLP"}`}
    >
      {value}
    </button>
  );
}

export default function NuevoAnalisisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ufValue, setUfValue] = useState(UF_CLP_FALLBACK);

  // Fetch real UF value on mount
  useEffect(() => {
    fetch("/api/uf")
      .then((r) => r.json())
      .then((d) => { if (d.uf) setUfValue(d.uf); })
      .catch(() => {});
  }, []);

  const UF_CLP = ufValue;

  // Market data from API
  const [marketData, setMarketData] = useState<{
    arriendo_promedio: number;
    precio_m2_promedio: number;
    gastos_comunes_m2: number;
    numero_publicaciones: number;
    source: string;
  } | null>(null);
  // Per-field currency toggles for monetary fields
  const [fieldCurrency, setFieldCurrency] = useState<Record<string, "CLP" | "UF">>({
    precio: "UF",
    arriendo: "CLP",
    gastos: "CLP",
    contribuciones: "CLP",
    provisionMantencion: "CLP",
    precioEstacionamiento: "UF",
    tarifaNoche: "CLP",
    costoLimpieza: "CLP",
    costoAmoblado: "CLP",
    serviciosBasicos: "CLP",
    montoCuota: "CLP",
  });

  const toggleFieldCurrency = (field: string) => {
    setFieldCurrency((prev) => ({
      ...prev,
      [field]: prev[field] === "CLP" ? "UF" : "CLP",
    }));
  };

  const [form, setForm] = useState({
    nombreAnalisis: "",
    region: "Metropolitana",
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
    estadoVenta: "inmediata",
    fechaEntregaMes: "",
    fechaEntregaAnio: "",
    cuotasPie: "",
    montoCuota: "",
    precio: "",
    piePct: "20",
    plazoCredito: "25",
    tasaInteres: "4.72",
    gastos: "",
    contribuciones: "",
    provisionMantencion: "",
    tipoRenta: "larga",
    arriendo: "",
    vacanciaMeses: "1",
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

  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, region: e.target.value, comuna: "", ciudad: "" }));
  };

  const handleComunaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const comuna = e.target.value;
    if (comuna === "__otra__") {
      setForm((prev) => ({ ...prev, comuna: "", ciudad: "" }));
      return;
    }
    const match = COMUNAS.find((c) => c.comuna === comuna);
    setForm((prev) => ({
      ...prev,
      comuna,
      ciudad: match?.ciudad || prev.ciudad,
    }));
  };

  // Comunas filtered by region
  const filteredComunas = useMemo(
    () => COMUNAS.filter((c) => c.region === form.region),
    [form.region]
  );

  // Fetch market data when comuna or dormitorios change
  useEffect(() => {
    if (!form.comuna) { setMarketData(null); return; }
    fetch(`/api/market-data?comuna=${encodeURIComponent(form.comuna)}&dormitorios=${form.dormitorios}`)
      .then((r) => r.json())
      .then((d) => setMarketData(d.data))
      .catch(() => setMarketData(null));
  }, [form.comuna, form.dormitorios]);

  // Market suggestions computed from API data + surface
  const suggestions = useMemo(() => {
    const supUtil = parseFloat(form.superficieUtil) || 0;
    const precioUF = parseFloat(form.precio) || 0;
    if (!form.comuna || supUtil <= 0) return null;

    if (marketData) {
      const arriendo = marketData.arriendo_promedio;
      const gastos = Math.round(marketData.gastos_comunes_m2 * supUtil);
      const contribAnual = precioUF > 0 ? Math.round(precioUF * UF_CLP * 0.008) : 0;
      const contribuciones = Math.round(contribAnual / 4);
      return { arriendo, gastos, contribuciones, source: marketData.source, publicaciones: marketData.numero_publicaciones };
    }

    // Fallback: basic estimate
    const arriendo = Math.round(6000 * supUtil);
    const gastos = Math.round(1100 * supUtil);
    const contribAnual = precioUF > 0 ? Math.round(precioUF * UF_CLP * 0.008) : 0;
    const contribuciones = Math.round(contribAnual / 4);
    return { arriendo, gastos, contribuciones, source: "estimate" as const, publicaciones: 0 };
  }, [form.comuna, form.superficieUtil, form.precio, marketData, UF_CLP]);

  // Real-time calculations
  // Helper: convert a field value to CLP based on its currency toggle
  const toCLP = useCallback((field: string, value: number) => {
    return fieldCurrency[field] === "UF" ? value * UF_CLP : value;
  }, [fieldCurrency, UF_CLP]);

  const toUF = useCallback((field: string, value: number) => {
    return fieldCurrency[field] === "UF" ? value : value / UF_CLP;
  }, [fieldCurrency, UF_CLP]);

  const calc = useMemo(() => {
    const precioUF = fieldCurrency.precio === "UF"
      ? (parseFloat(form.precio) || 0)
      : (parseFloat(form.precio) || 0) / UF_CLP;

    const supUtil = parseFloat(form.superficieUtil) || 0;
    const piePct = parseFloat(form.piePct) || 20;
    const plazo = parseFloat(form.plazoCredito) || 25;
    const tasa = parseFloat(form.tasaInteres) || 4.72;

    const precioCLP = precioUF * UF_CLP;
    const precioM2 = supUtil > 0 ? precioUF / supUtil : 0;
    const pieUF = precioUF * (piePct / 100);
    const pieCLP = pieUF * UF_CLP;
    const financiamientoPct = 100 - piePct;
    const dividendo = calcDividendo(precioUF, piePct, plazo, tasa, UF_CLP);
    const provisionAuto = Math.round((precioCLP * 0.01) / 12);

    return { precioUF, precioCLP, precioM2, pieUF, pieCLP, financiamientoPct, dividendo, provisionAuto };
  }, [form.precio, form.superficieUtil, form.piePct, form.plazoCredito, form.tasaInteres, fieldCurrency.precio, UF_CLP]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supUtil = parseFloat(form.superficieUtil) || 0;
    const supTotal = parseFloat(form.superficieTotal) || supUtil;

    // Convert each field to the expected unit using its per-field currency
    const precioUF = toUF("precio", parseFloat(form.precio) || 0);

    // Arriendo is always stored as CLP
    let arriendo: number;
    if (form.tipoRenta === "larga") {
      arriendo = Math.round(toCLP("arriendo", parseFloat(form.arriendo) || 0));
    } else {
      arriendo = Math.round(toCLP("tarifaNoche", parseFloat(form.arriendo) || 0));
    }

    const gastos = Math.round(toCLP("gastos", parseFloat(form.gastos) || 0));
    const contribuciones = Math.round(toCLP("contribuciones", parseFloat(form.contribuciones) || 0));
    const antiguedad = form.enConstruccion ? 0 : parseFloat(form.antiguedad) || 0;
    const provisionMantencion = form.provisionMantencion
      ? Math.round(toCLP("provisionMantencion", parseFloat(form.provisionMantencion)))
      : calc.provisionAuto;

    const nombre = form.nombreAnalisis.trim() || `${form.tipo} ${form.dormitorios}D${form.banos}B ${form.comuna}`;

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
          precioEstacionamiento: toUF("precioEstacionamiento", parseFloat(form.precioEstacionamiento) || 0),
          bodega: form.bodega === "si",
          estadoVenta: form.estadoVenta,
          fechaEntrega: form.estadoVenta !== "inmediata"
            ? `${form.fechaEntregaAnio}-${form.fechaEntregaMes}`
            : undefined,
          cuotasPie: Number(form.cuotasPie) || 0,
          montoCuota: Math.round(toCLP("montoCuota", parseFloat(form.montoCuota) || 0)),
          precio: precioUF,
          piePct: parseFloat(form.piePct),
          plazoCredito: parseFloat(form.plazoCredito),
          tasaInteres: parseFloat(form.tasaInteres),
          gastos,
          contribuciones,
          provisionMantencion,
          tipoRenta: form.tipoRenta,
          arriendo,
          vacanciaMeses: parseFloat(form.vacanciaMeses),
          tarifaNoche: Math.round(toCLP("tarifaNoche", parseFloat(form.tarifaNoche) || 0)),
          ocupacionPct: parseFloat(form.ocupacionPct) || 65,
          comisionPlataforma: parseFloat(form.comisionPlataforma) || 3,
          costoLimpieza: Math.round(toCLP("costoLimpieza", parseFloat(form.costoLimpieza) || 0)),
          amoblado: form.amoblado === "si",
          costoAmoblado: Math.round(toCLP("costoAmoblado", parseFloat(form.costoAmoblado) || 0)),
          serviciosBasicos: Math.round(toCLP("serviciosBasicos", parseFloat(form.serviciosBasicos) || 0)),
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
  const fmtUF = (n: number) => "UF " + (Math.round(n * 10) / 10).toLocaleString("es-CL");

  return (
    <div className="min-h-screen bg-background">
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

      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Nuevo Análisis</h1>
          <p className="text-muted-foreground">
            Ingresa los datos de la propiedad para obtener tu InvertiScore
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            UF hoy: ${UF_CLP.toLocaleString("es-CL")} CLP
            {ufValue !== UF_CLP_FALLBACK && " (actualizado)"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="nombreAnalisis">Nombre del análisis (opcional)</Label>
            <Input
              id="nombreAnalisis"
              placeholder="Ej: Depto Providencia 2D1B, Inversión Ñuñoa..."
              value={form.nombreAnalisis}
              onChange={handleChange}
            />
            <p className="text-xs text-muted-foreground">
              Si no ingresas un nombre, se generará automáticamente
            </p>
          </div>

          {/* SECCION 1: PROPIEDAD */}
          <Card>
            <CardHeader><CardTitle>Datos de la Propiedad</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <SectionTitle>Ubicación</SectionTitle>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="region">Región</Label>
                  <Select id="region" value={form.region} onChange={handleRegionChange} required>
                    {REGIONES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comuna">Comuna</Label>
                  <Select id="comuna" value={form.comuna} onChange={handleComunaChange} required>
                    <option value="">Seleccionar comuna...</option>
                    {filteredComunas.map((c) => (
                      <option key={c.comuna} value={c.comuna}>{c.comuna}</option>
                    ))}
                    <option value="__otra__">Otra (ingresar manualmente)</option>
                  </Select>
                </div>
              </div>
              {!filteredComunas.some((c) => c.comuna === form.comuna) && form.comuna === "" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="comuna">Nombre de la comuna</Label>
                    <Input id="comuna" placeholder="Ej: Lo Prado" value={form.comuna} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input id="ciudad" placeholder="Santiago" value={form.ciudad} onChange={handleChange} required />
                  </div>
                </div>
              )}
              {form.ciudad && (
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input id="ciudad" value={form.ciudad} onChange={handleChange} required readOnly className="bg-muted/50" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección (opcional)</Label>
                <Input id="direccion" placeholder="Ej: Av. Providencia 1234" value={form.direccion} onChange={handleChange} />
              </div>

              <SectionTitle>Características</SectionTitle>
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
                    <Label htmlFor="banos">Baños</Label>
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
                  <Label htmlFor="superficieUtil">Superficie útil m²</Label>
                  <Input id="superficieUtil" type="number" placeholder="55" value={form.superficieUtil} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="superficieTotal">Superficie total m²</Label>
                  <Input id="superficieTotal" type="number" placeholder="60" value={form.superficieTotal} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="piso" tip={FIELD_TIPS.piso}>Piso</FieldLabel>
                  <Input id="piso" type="number" placeholder="5" value={form.piso} onChange={handleChange} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel htmlFor="antiguedad" tip={FIELD_TIPS.antiguedad}>Antigüedad (años)</FieldLabel>
                  <div className="flex items-center gap-3">
                    <Input
                      id="antiguedad" type="number" placeholder="5"
                      value={form.antiguedad} onChange={handleChange}
                      disabled={form.enConstruccion} required={!form.enConstruccion}
                      className={form.enConstruccion ? "opacity-50" : ""}
                    />
                    <label className="flex shrink-0 items-center gap-2 text-sm">
                      <input type="checkbox" id="enConstruccion" checked={form.enConstruccion} onChange={handleChange} className="h-4 w-4 rounded border-input" />
                      En construcción
                    </label>
                  </div>
                  {!form.enConstruccion && form.antiguedad && (
                    <p className="text-xs text-muted-foreground">
                      {Number(form.antiguedad) <= 5 ? "Mantención mínima, garantías vigentes" :
                       Number(form.antiguedad) <= 15 ? "Mantención moderada, posibles reparaciones menores" :
                       Number(form.antiguedad) <= 30 ? "Mantención alta, posibles reparaciones mayores" :
                       "Mantención muy alta, riesgo estructural"}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FieldLabel htmlFor="estacionamiento" tip={FIELD_TIPS.estacionamiento}>Estacionamiento</FieldLabel>
                    <Select id="estacionamiento" value={form.estacionamiento} onChange={handleChange}>
                      <option value="si">Sí incluido</option>
                      <option value="no">No</option>
                      <option value="opcional">Opcional (extra)</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="bodega" tip={FIELD_TIPS.bodega}>Bodega</FieldLabel>
                    <Select id="bodega" value={form.bodega} onChange={handleChange}>
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </Select>
                  </div>
                </div>
              </div>
              {form.estacionamiento === "opcional" && (
                <div className="space-y-2 md:w-1/2">
                  <div className="flex items-center">
                    <Label htmlFor="precioEstacionamiento">Precio estacionamiento</Label>
                    <CurrencyMiniToggle field="precioEstacionamiento" value={fieldCurrency.precioEstacionamiento} onChange={toggleFieldCurrency} />
                  </div>
                  <Input id="precioEstacionamiento" type="number" placeholder="350" value={form.precioEstacionamiento} onChange={handleChange} />
                  <p className="text-xs text-muted-foreground">Se suma al precio total de la propiedad</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECCION 2: ESTADO DE VENTA */}
          <Card>
            <CardHeader><CardTitle>Estado de Venta</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                {ESTADOS_VENTA.map((estado) => (
                  <label key={estado.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                    <input type="radio" name="estadoVenta" id="estadoVenta" value={estado.value} checked={form.estadoVenta === estado.value} onChange={handleChange} className="h-4 w-4 text-primary" />
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
                      <Label htmlFor="fechaEntregaAnio">Año</Label>
                      <Select id="fechaEntregaAnio" value={form.fechaEntregaAnio} onChange={handleChange}>
                        <option value="">Año...</option>
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
                      <div className="flex items-center">
                        <Label htmlFor="montoCuota">Monto por cuota</Label>
                        <CurrencyMiniToggle field="montoCuota" value={fieldCurrency.montoCuota} onChange={toggleFieldCurrency} />
                      </div>
                      <Input id="montoCuota" type="number" placeholder="500000" value={form.montoCuota} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECCION 3: DATOS FINANCIEROS */}
          <Card>
            <CardHeader><CardTitle>Datos Financieros</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <FieldLabel htmlFor="precio" tip={fieldCurrency.precio === "UF" ? FIELD_TIPS.precio : FIELD_TIPS.precioCLP}>
                      Precio de venta
                    </FieldLabel>
                    <CurrencyMiniToggle field="precio" value={fieldCurrency.precio} onChange={toggleFieldCurrency} />
                  </div>
                  <Input id="precio" type="number" step="0.01" placeholder={fieldCurrency.precio === "UF" ? "3200" : "124160000"} value={form.precio} onChange={handleChange} required />
                  {calc.precioUF > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {fieldCurrency.precio === "UF"
                        ? `${fmt(calc.precioCLP)} CLP`
                        : `${fmtUF(calc.precioUF)}`}
                      {calc.precioM2 > 0 && <> · {fmtUF(calc.precioM2)}/m²</>}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="piePct" tip={FIELD_TIPS.piePct}>Pie ({form.piePct}%)</FieldLabel>
                  <input id="piePct" type="range" min="10" max="50" step="5" value={form.piePct} onChange={handleChange} className="mt-2 w-full accent-primary" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmtUF(calc.pieUF)} ({fmt(calc.pieCLP)})</span>
                    <span>Financiamiento: {calc.financiamientoPct}%</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plazoCredito">Plazo crédito ({form.plazoCredito} años)</Label>
                  <input id="plazoCredito" type="range" min="10" max="30" step="5" value={form.plazoCredito} onChange={handleChange} className="mt-2 w-full accent-primary" />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="tasaInteres" tip={FIELD_TIPS.tasaInteres}>Tasa interés anual (%)</FieldLabel>
                  <Input id="tasaInteres" type="number" step="0.01" placeholder="4.72" value={form.tasaInteres} onChange={handleChange} required />
                  <p className="text-xs text-muted-foreground">Referencia actual mercado: ~4.72%</p>
                </div>
              </div>

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
                  <div className="flex items-center">
                    <FieldLabel htmlFor="gastos" tip={FIELD_TIPS.gastos}>Gastos comunes /mes</FieldLabel>
                    <CurrencyMiniToggle field="gastos" value={fieldCurrency.gastos} onChange={toggleFieldCurrency} />
                  </div>
                  <Input id="gastos" type="number" placeholder={suggestions?.gastos ? String(suggestions.gastos) : "80000"} value={form.gastos} onChange={handleChange} required />
                  {suggestions?.gastos && !form.gastos && (
                    <p className="text-xs text-emerald-500">Sugerido: {fmt(suggestions.gastos)} · Según datos de mercado{suggestions.source === "database" ? "" : suggestions.source === "seed" ? " (referencia)" : " (estimación)"}. Puedes modificarlo.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <FieldLabel htmlFor="contribuciones" tip={FIELD_TIPS.contribuciones}>Contribuciones /trim</FieldLabel>
                    <CurrencyMiniToggle field="contribuciones" value={fieldCurrency.contribuciones} onChange={toggleFieldCurrency} />
                  </div>
                  <Input id="contribuciones" type="number" placeholder={suggestions?.contribuciones ? String(suggestions.contribuciones) : "150000"} value={form.contribuciones} onChange={handleChange} required />
                  {suggestions?.contribuciones && suggestions.contribuciones > 0 && !form.contribuciones && (
                    <p className="text-xs text-emerald-500">Sugerido: {fmt(suggestions.contribuciones)} · Según datos de mercado. Puedes modificarlo.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <FieldLabel htmlFor="provisionMantencion" tip={FIELD_TIPS.provisionMantencion}>Provisión mantención /mes</FieldLabel>
                    <CurrencyMiniToggle field="provisionMantencion" value={fieldCurrency.provisionMantencion} onChange={toggleFieldCurrency} />
                  </div>
                  <Input id="provisionMantencion" type="number" placeholder={String(calc.provisionAuto)} value={form.provisionMantencion} onChange={handleChange} />
                  <p className="text-xs text-muted-foreground">Auto: {fmt(calc.provisionAuto)} (1% anual)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECCION 4: ARRIENDO */}
          <Card>
            <CardHeader><CardTitle>Destino del Arriendo</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex overflow-hidden rounded-lg border border-border">
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, tipoRenta: "larga" }))} className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${form.tipoRenta === "larga" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/50"}`}>
                  Renta Larga
                </button>
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, tipoRenta: "corta" }))} className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${form.tipoRenta === "corta" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/50"}`}>
                  Renta Corta (Airbnb)
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {form.tipoRenta === "larga"
                  ? "Arriendo tradicional con contrato de 12+ meses. Ingreso estable y predecible, menor gestión operativa. Ideal para inversión pasiva."
                  : "Arriendo por noches a través de plataformas como Airbnb o Booking. Mayor ingreso potencial, pero requiere gestión activa (limpieza, check-in, comunicación) y tiene mayor vacancia estacional."}
              </p>

              {form.tipoRenta === "larga" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <FieldLabel htmlFor="arriendo" tip={fieldCurrency.arriendo === "UF" ? FIELD_TIPS.arriendoUF : FIELD_TIPS.arriendo}>
                          Arriendo esperado /mes
                        </FieldLabel>
                        <CurrencyMiniToggle field="arriendo" value={fieldCurrency.arriendo} onChange={toggleFieldCurrency} />
                      </div>
                      <Input id="arriendo" type="number" placeholder={
                        fieldCurrency.arriendo === "UF"
                          ? suggestions?.arriendo ? (suggestions.arriendo / UF_CLP).toFixed(1) : "12"
                          : suggestions?.arriendo ? String(suggestions.arriendo) : "450000"
                      } value={form.arriendo} onChange={handleChange} required />
                      {suggestions?.arriendo && !form.arriendo && (
                        <p className="text-xs text-emerald-500">
                          Sugerido: {fieldCurrency.arriendo === "UF" ? fmtUF(suggestions.arriendo / UF_CLP) : fmt(suggestions.arriendo)} · Según datos de mercado{suggestions.publicaciones > 0 ? ` (${suggestions.publicaciones} publicaciones)` : ""}. Puedes modificarlo.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor="vacanciaMeses" tip={FIELD_TIPS.vacanciaMeses}>Vacancia estimada (meses/año)</FieldLabel>
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
                      <div className="flex items-center">
                        <Label htmlFor="tarifaNoche">Tarifa por noche</Label>
                        <CurrencyMiniToggle field="tarifaNoche" value={fieldCurrency.tarifaNoche} onChange={toggleFieldCurrency} />
                      </div>
                      <Input id="tarifaNoche" type="number" placeholder="45000" value={form.tarifaNoche} onChange={handleChange} required={form.tipoRenta === "corta"} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ocupacionPct">Ocupación estimada ({form.ocupacionPct}%)</Label>
                      <input id="ocupacionPct" type="range" min="30" max="90" step="5" value={form.ocupacionPct} onChange={handleChange} className="mt-2 w-full accent-primary" />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="comisionPlataforma">Comisión plataforma (%)</Label>
                      <Input id="comisionPlataforma" type="number" step="0.1" placeholder="3" value={form.comisionPlataforma} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="costoLimpieza">Costo limpieza por estadía</Label>
                        <CurrencyMiniToggle field="costoLimpieza" value={fieldCurrency.costoLimpieza} onChange={toggleFieldCurrency} />
                      </div>
                      <Input id="costoLimpieza" type="number" placeholder="25000" value={form.costoLimpieza} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="amoblado">Amoblado</Label>
                      <Select id="amoblado" value={form.amoblado} onChange={handleChange}>
                        <option value="no">No</option>
                        <option value="si">Sí</option>
                      </Select>
                    </div>
                    {form.amoblado === "si" && (
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Label htmlFor="costoAmoblado">Inversión amoblado</Label>
                          <CurrencyMiniToggle field="costoAmoblado" value={fieldCurrency.costoAmoblado} onChange={toggleFieldCurrency} />
                        </div>
                        <Input id="costoAmoblado" type="number" placeholder="3000000" value={form.costoAmoblado} onChange={handleChange} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 md:w-1/2">
                    <div className="flex items-center">
                      <Label htmlFor="serviciosBasicos">Servicios básicos /mes</Label>
                      <CurrencyMiniToggle field="serviciosBasicos" value={fieldCurrency.serviciosBasicos} onChange={toggleFieldCurrency} />
                    </div>
                    <Input id="serviciosBasicos" type="number" placeholder="80000" value={form.serviciosBasicos} onChange={handleChange} />
                    <p className="text-xs text-muted-foreground">Luz, agua, internet, gas</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button className="w-full gap-2" size="lg" type="submit" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generando InvertiScore...</>
            ) : (
              "Generar InvertiScore"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
