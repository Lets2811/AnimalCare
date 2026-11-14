// Borra los datos que crearon las pruebas de extremo a extremo (usuarios e2e.*).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));

export default function teardown() {
  const backend = path.resolve(aqui, "../../backend");
  const script = path.join(backend, "scripts/clean-test-data.ts");
  try {
    const salida = execFileSync(process.execPath, ["--import", "tsx", script, "e2e."], { encoding: "utf8", cwd: backend });
    console.log(salida.trim());
  } catch (error) {
    console.warn("No se pudieron borrar los datos de las pruebas e2e:", error.message);
  }
}
