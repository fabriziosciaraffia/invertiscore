import { Config } from "@remotion/cli/config";

// Reels de refranco.ai. H.264 en calidad alta: Instagram recomprime igual, y entrar
// con poco ruido de compresión es lo único que se puede controlar desde acá.
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setCrf(16);
Config.setEntryPoint("src/index.ts");
