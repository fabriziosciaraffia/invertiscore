// Render de video + limpieza de metadata, en un paso que no se puede olvidar.
//
//   node scripts/render-limpio.mjs <composicion> <salida.mp4>
//
// POR QUÉ EXISTE: Remotion escribe `comment=Made with Remotion <version>` en el MP4 y
// no hay forma de apagarlo por configuración — está cableado en el paso de mux
// (`@remotion/renderer/dist/make-metadata-args.js`), y `Config.setMetadata()` con un
// `comment` no reemplaza sino que concatena. Parchear la dependencia se rompería en
// silencio en cada bump de Remotion, así que la limpieza va acá.
//
// GARANTÍA POR CONSTRUCCIÓN: se renderiza a un temporal y el nombre final se escribe
// SOLO si ffmpeg limpió bien y la verificación pasó. Un archivo con el nombre final es,
// por lo tanto, un archivo limpio. Si algo falla, el script sale con código distinto de
// cero y no deja un MP4 final a medias.
//
// La limpieza es `-c copy`: no recomprime, y toca únicamente el comentario. Los tags de
// encoder estándar (`Lavf`, handler_name, brands) quedan donde están.
//
// COLOR: el mismo paso termina de etiquetar BT.709. `Config.setColorSpace("bt709")`
// convierte y marca la matriz, pero deja `color_primaries` y `color_trc` en unspecified
// —el filtro zscale que aplica Remotion fija solo `matrix`, y su salida pisa los flags—
// y esos dos viven en el VUI del bitstream, donde `-c copy` no llega. El filtro de
// bitstream `h264_metadata` reescribe el VUI sin recomprimir. Sin los tres campos el
// reproductor del celular adivina el espacio de color, y ahí aparece el video lavado.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

const [composicion, salida] = process.argv.slice(2);
if (!composicion || !salida) {
  console.error("uso: node scripts/render-limpio.mjs <composicion> <salida.mp4>");
  process.exit(1);
}

/** Los binarios de ffmpeg vienen dentro del paquete compositor, que es por plataforma. */
function binarioDeRemotion(nombre) {
  const base = join(RAIZ, "node_modules", "@remotion");
  const paquete = readdirSync(base).find((d) => d.startsWith("compositor-"));
  if (!paquete) throw new Error("no se encontró el paquete compositor de Remotion");
  const exe = process.platform === "win32" ? `${nombre}.exe` : nombre;
  const ruta = join(base, paquete, exe);
  if (!existsSync(ruta)) throw new Error(`no se encontró ${exe} en ${paquete}`);
  return ruta;
}

const correr = (cmd, args, etiqueta) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: RAIZ, shell: false });
  if (r.error) {
    console.error(`\n✗ ${etiqueta} no se pudo lanzar: ${r.error.message}`);
    return false;
  }
  if (r.status !== 0) {
    console.error(
      `\n✗ ${etiqueta} falló (${r.status === null ? "terminado por señal " + r.signal : "código " + r.status})`,
    );
    return false;
  }
  return true;
};

const tmp = `${salida.replace(/\.mp4$/, "")}.tmp.mp4`;
const limpiar = () => {
  for (const f of [tmp]) if (existsSync(join(RAIZ, f))) rmSync(join(RAIZ, f));
};

// Se invoca la entrada JS del CLI con el node actual, no el shim de node_modules/.bin:
// en Windows ese shim es un .cmd y spawnSync sin shell no lo puede ejecutar.
const cliRemotion = join(RAIZ, "node_modules", "@remotion", "cli", "remotion-cli.js");
const ffmpeg = binarioDeRemotion("ffmpeg");
const ffprobe = binarioDeRemotion("ffprobe");

// 1 — render al temporal
if (!correr(process.execPath, [cliRemotion, "render", composicion, tmp], "el render")) {
  limpiar();
  process.exit(1);
}

// 2 — limpieza del comentario hacia el nombre final. `-metadata comment=` con valor
// vacío borra la clave; no se usa `-map_metadata -1` porque eso se llevaría también los
// tags de encoder, que sí queremos conservar.
if (existsSync(join(RAIZ, salida))) rmSync(join(RAIZ, salida));
const argsFfmpeg = [
  "-y",
  "-i",
  tmp,
  "-c",
  "copy",
  "-metadata",
  "comment=",
  "-bsf:v",
  "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1",
  salida,
];
if (!correr(ffmpeg, argsFfmpeg, "la limpieza de metadata")) {
  if (existsSync(join(RAIZ, salida))) rmSync(join(RAIZ, salida));
  limpiar();
  process.exit(1);
}

// 3 — verificación del archivo final: ni comentario de herramienta, ni color sin
// etiquetar. Si el comportamiento de ffmpeg o de Remotion cambia, se entera acá y no
// en el reporte.
const fallar = (msg, detalle) => {
  console.error(`\n✗ ${msg}`);
  if (detalle) console.error(detalle);
  if (existsSync(join(RAIZ, salida))) rmSync(join(RAIZ, salida));
  limpiar();
  process.exit(1);
};

const CAMPOS_COLOR = ["color_space", "color_primaries", "color_transfer"];
const sonda = spawnSync(
  ffprobe,
  [
    "-v",
    "error",
    "-show_entries",
    `format_tags:stream=${CAMPOS_COLOR.join(",")}`,
    "-of",
    "default",
    salida,
  ],
  { cwd: RAIZ, encoding: "utf8" },
);
if (sonda.status !== 0) fallar("no se pudo verificar la metadata del archivo final");

if (/^TAG:comment=.+$/im.test(sonda.stdout)) {
  fallar(
    "el archivo final TODAVÍA lleva un comentario en la metadata:",
    sonda.stdout
      .split(/\r?\n/)
      .filter((l) => /comment/i.test(l))
      .join("\n"),
  );
}

const color = Object.fromEntries(
  sonda.stdout
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => l.split("=")),
);
const sinEtiquetar = CAMPOS_COLOR.filter((k) => color[k] !== "bt709");
if (sinEtiquetar.length) {
  fallar(
    `el archivo final no quedó etiquetado BT.709 en: ${sinEtiquetar.join(", ")}`,
    CAMPOS_COLOR.map((k) => `  ${k}=${color[k]}`).join("\n"),
  );
}

limpiar();
console.log(`\n✓ ${salida} — sin comentario de herramienta, BT.709 en los tres campos`);
