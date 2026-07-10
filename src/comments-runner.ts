import "dotenv/config";
import { processComments } from "./comments.js";
import { log } from "./logger.js";

log.info("Iniciando revisión de comentarios...");
processComments().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
