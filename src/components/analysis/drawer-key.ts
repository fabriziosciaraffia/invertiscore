// Las claves de drawer del informe LTR. Vivían en `components/ui/AnalysisDrawer.tsx`, que se
// retiró el 25-sep-2026 sin llamadores (la zona LTR pasó al Modal del informe el 24-sep); el tipo
// sigue en uso como clave por defecto de `GenericFindingCard` y en la firma de `HeroLTR`.
export type DrawerKey =
  | "costoMensual"
  | "negociacion"
  | "zona"
  | "capexPuestaAPunto";
