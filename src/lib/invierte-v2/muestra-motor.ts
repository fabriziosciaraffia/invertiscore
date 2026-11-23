// LOS DATOS FIJOS DEL MOTOR DE UN DEPTO REAL, PARA LAS PÁGINAS DE MUESTRA (/dev/invierte-v2, 23-nov-2026). Un Comprar usado de Ñuñoa,
// 2 dormitorios, ~UF 3.032, armados con negociar.ts › cuerpoDeCandidato (la misma cuenta que inv_ubicaciones.analisis.motor). Solo para
// mostrar «A este precio» y el bloque de la oferta con números del motor sin cuentas ni escrituras. No lo lee ninguna pantalla real.
import type { MotorFijo } from "./cifras-motor";

export const MUESTRA_PRECIO_UF = 3032;
export const MUESTRA_M2 = 50;
export const MOTOR_MUESTRA: MotorFijo = {
  "v": 1,
  "cuerpo": {
    "nombre": "Depto 2D2B Ñuñoa",
    "comuna": "Ñuñoa",
    "ciudad": "Santiago",
    "tipo": "Departamento",
    "dormitorios": 2,
    "esStudio": false,
    "banos": 2,
    "superficie": 50,
    "superficieTotal": 50,
    "antiguedad": 25,
    "incluyeCorretajeInicial": true,
    "enConstruccion": false,
    "piso": 0,
    "estacionamiento": "no",
    "cantidadEstacionamientos": 0,
    "precioEstacionamiento": 0,
    "bodega": false,
    "cantidadBodegas": 0,
    "estadoVenta": "inmediata",
    "cuotasPie": 0,
    "montoCuota": 0,
    "precio": 3031.98,
    "valorMercadoFranco": 3427,
    "valorMercadoRef": {
      "valorUF": 3427,
      "nivel": "radio",
      "universo": "usado",
      "n": 42,
      "radioMetros": 500
    },
    "piePct": 20,
    "plazoCredito": 30,
    "tasaInteres": 4.1,
    "tasaMercado": 4.1,
    "esNuevo": false,
    "gastos": 90000,
    "contribuciones": 58354,
    "contribucionesOrigen": "estimada",
    "provisionMantencion": 0,
    "tipoRenta": "larga",
    "arriendo": 570000,
    "arriendoEstacionamiento": 0,
    "arriendoBodega": 0,
    "vacanciaMeses": 0.6,
    "amoblado": false,
    "usaAdministrador": false,
    "zonaRadio": {
      "precioM2VentaCLP": 2836594,
      "arriendoPromedio": 570000,
      "arriendoPrecioM2": null,
      "sampleSizeArriendo": 25,
      "arriendoFuente": "radio",
      "arriendoRangoMin": null,
      "arriendoRangoMax": null,
      "sampleSizeVenta": 42,
      "ventaFuente": "radio",
      "ventaUniverso": "usado",
      "ventaRadio": 500,
      "radioMetros": 500,
      "lat": -33.4726693,
      "lng": -70.6122865
    },
    "methodologyVersion": "v3"
  },
  "mediana": {
    "mediana": 79.41,
    "n": 520,
    "universo": "usado",
    "ventanaDias": 90,
    "p25": 69.95,
    "p75": 89.34,
    "capRefComuna": {
      "nivel": "celda",
      "bruto": 3.91,
      "bdoNeto": 3.4,
      "nArriendo": 181,
      "nVenta": 520,
      "ventana": 90,
      "celda": {
        "comuna": "Ñuñoa",
        "condicion": "usado",
        "dormitorios": 2,
        "superficieM2": 50
      },
      "arriendoProxyUsado": false,
      "fuente": "avisos de arriendo (181) y de venta (520) de Ñuñoa, usado, 2D, 40–60 m², últimos 90 días: precios y arriendos pedidos, no cerrados",
      "resolvedAt": "2026-11-23T17:38:13.823Z"
    }
  },
  "uf": 41392,
  "asOf": "2026-11-23T17:38:14.450Z",
  "arriendoCLP": 570000
};
