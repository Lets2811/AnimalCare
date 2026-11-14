// La documentacion OpenAPI (backend/openapi.json) debe describir exactamente las rutas del backend.
// No necesita la base de datos ni el servidor: lee los archivos de rutas y los compara.
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { construir } = require("../scripts/generar-openapi");

const RAIZ = path.join(__dirname, "..");

// Rutas reales: por cada archivo de rutas, el prefijo con que app.js lo monta.
function rutasReales() {
  const app = fs.readFileSync(path.join(RAIZ, "src/app.ts"), "utf8");
  const archivoDe = Object.fromEntries(
    [...app.matchAll(/import (\w+) from "\.\/(modules\/[\w./]+\.routes)";/g)].map((m) => [m[1], m[2]])
  );
  const prefijos = {};
  for (const m of app.matchAll(/app\.use\("(\/api[^"]*)", (\w+)\);/g)) prefijos[archivoDe[m[2]]] = m[1];
  // El panel del veterinario se monta dentro de vet.routes.js.
  prefijos["modules/vets/panel/vetPanel.routes"] = "/api/vets/me";

  const rutas = new Set();
  for (const [archivo, prefijo] of Object.entries(prefijos)) {
    if (archivo === "modules/system/docs.routes") continue; // la propia documentacion no se documenta
    const texto = fs.readFileSync(path.join(RAIZ, "src", `${archivo}.ts`), "utf8");
    for (const m of texto.matchAll(/router\.(get|post|put|patch|delete)\("([^"]*)"/g)) {
      const ruta = `${prefijo}${m[2] === "/" ? "" : m[2]}`.replace(/^\/api/, "").replace(/:(\w+)/g, "{$1}");
      rutas.add(`${m[1]} ${ruta === "" ? "/" : ruta}`);
    }
  }
  return rutas;
}

function rutasDocumentadas(spec) {
  const rutas = new Set();
  for (const [ruta, operaciones] of Object.entries(spec.paths)) {
    for (const metodo of Object.keys(operaciones)) rutas.add(`${metodo} ${ruta}`);
  }
  return rutas;
}

describe("Documentacion OpenAPI", () => {
  test("cada ruta del backend esta documentada y no hay rutas documentadas que no existan", () => {
    const reales = rutasReales();
    const docs = rutasDocumentadas(construir());
    const sinDocumentar = [...reales].filter((r) => !docs.has(r));
    const sobrantes = [...docs].filter((r) => !reales.has(r));
    assert.deepEqual(sinDocumentar, [], `Rutas sin documentar en scripts/generar-openapi.js: ${sinDocumentar.join(", ")}`);
    assert.deepEqual(sobrantes, [], `Rutas documentadas que ya no existen: ${sobrantes.join(", ")}`);
    assert.ok(reales.size > 60, "se encontraron las rutas del backend");
  });

  test("openapi.json esta al dia (se regenera con npm run openapi)", () => {
    const guardado = JSON.parse(fs.readFileSync(path.join(RAIZ, "openapi.json"), "utf8"));
    assert.deepEqual(guardado, JSON.parse(JSON.stringify(construir())), "ejecuta `npm run openapi` y guarda el resultado");
  });

  test("cada operacion tiene resumen, etiqueta y respuestas; las privadas piden token", () => {
    const spec = construir();
    assert.equal(spec.openapi, "3.0.3");
    for (const [ruta, operaciones] of Object.entries(spec.paths)) {
      for (const [metodo, op] of Object.entries(operaciones)) {
        const nombre = `${metodo} ${ruta}`;
        assert.ok(op.summary && op.tags?.length && op.responses, `${nombre}: falta resumen, etiqueta o respuestas`);
        if (op.description) assert.deepEqual(op.security, [{ bearerAuth: [] }], `${nombre}: debe pedir token`);
      }
    }
  });
});
