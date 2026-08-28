import { Config } from "@remotion/cli/config";

// Reels de refranco.ai. H.264 en calidad alta: Instagram recomprime igual, y entrar
// con poco ruido de compresión es lo único que se puede controlar desde acá.
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setCrf(16);

// BT.709 explícito. Remotion 4 usa "default", que NO escribe las etiquetas de color en
// el archivo; sin ellas el reproductor del celular adivina, y adivina mal — es la causa
// clásica del video que se ve lavado fuera del escritorio. Con bt709 además convierte
// de verdad (no solo etiqueta) y fija el rango limitado que espera el video.
Config.setColorSpace("bt709");
Config.setEntryPoint("src/index.ts");

// Los reels no tienen sonido. Sin esto Remotion emite igual una pista AAC en silencio,
// que solo suma peso al archivo. `muted` descarta el audio y `enforceAudioTrack` en
// false evita que se agregue una pista vacía para rellenar.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
