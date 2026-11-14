// Carpeta raiz del backend (la que contiene package.json), tanto en desarrollo (src/...)
// como compilado (dist/src/...). Asi las rutas a uploads/ y openapi.json no dependen de donde viva el codigo.
import fs from "node:fs";
import path from "node:path";

function buscarRaiz(desde: string): string {
  let dir = desde;
  while (!fs.existsSync(path.join(dir, "package.json"))) {
    const padre = path.dirname(dir);
    if (padre === dir) return process.cwd();
    dir = padre;
  }
  return dir;
}

export const RAIZ_BACKEND = buscarRaiz(__dirname);
