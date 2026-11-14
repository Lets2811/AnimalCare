// Genera docs/matriz-trazabilidad.md: historia de usuario -> criterios de aceptacion -> pruebas.
//
//   npm run matriz
//
// Lee de forma automatica:
//   - README.md                      tabla de historias (AN-xx | titulo | estado)
//   - docs/criterios-aceptacion-*.md encabezados "## AN-xx — ..." (criterios por historia)
//   - tests/*.test.js                describe(...) y test(...) del backend; el codigo AN-xx del titulo
//                                    del describe liga cada prueba a su historia
//   - ../frontend/src/**/*.test.*    pruebas de interfaz (se ligan a historias por la tabla INTERFAZ)
//   - coverage/lcov.info             cobertura (si se corrio npm run coverage en backend y frontend)
//
// Si agregas una prueba cuyo describe empieza por "AN-xx: ...", aparece sola en la matriz.
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "../..");
const read = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

// Pruebas de interfaz (vitest): archivo -> historias que ejercitan.
const INTERFAZ = {
  "frontend/src/components/CitaTarjeta.test.jsx": ["AN-14", "AN-15", "AN-16"],
  "frontend/src/services/appointment.service.test.js": ["AN-14", "AN-16"],
  "frontend/src/components/UrgenciaCliente.test.jsx": ["AN-23"],
  "frontend/src/components/UrgenciaVeterinario.test.jsx": ["AN-23"],
  "frontend/src/components/Adjuntos.test.jsx": ["AN-18", "AN-21"],
  "frontend/src/pages/AgendarCita.test.jsx": ["AN-13"],
  "frontend/src/services/api.test.js": ["AN-8", "AN-37"],
  "frontend/src/components/MapaUbicacion.test.jsx": ["AN-10", "AN-11"],
  "frontend/src/services/mapas.test.js": ["AN-10", "AN-11"],
  "frontend/src/components/AgendaSemanal.test.jsx": ["AN-17"],
  "frontend/src/pages/AdminMetricas.test.jsx": ["AN-38"],
  "frontend/src/services/medicalRecord.service.test.js": ["AN-21"],
  "frontend/src/components/Alerta.test.jsx": ["Transversal"],
  "frontend/src/components/Selector.test.jsx": ["Transversal"],
  "frontend/src/components/ToastProvider.test.jsx": ["Transversal"],
  "frontend/src/services/zona.test.js": ["Transversal"],
  "frontend/src/utils/nombres.test.js": ["Transversal"],
};

// Grupos de pruebas cuyo titulo no lleva el codigo AN-xx pero ejercitan esas historias.
const EXTRA = {
  "Cuenta: consentimiento y verificacion de correo": ["AN-6"],
  "Mejora: buscador con filtros, orden y proximo turno": ["AN-10", "AN-11", "AN-27"],
  "Mejora: dias con turnos disponibles al agendar": ["AN-13"],
  "Mejora: perfil editable, foto y tarjeta profesional": ["AN-26"],
  "Mejora: politica de cancelacion": ["AN-14"],
  "Mejora: recordatorios de 24 horas": ["AN-22"],
  "Atencion de la cita: iniciar, llenar la historia clinica y terminar": ["AN-16", "AN-18"],
};

function historias() {
  const filas = [];
  for (const linea of read("README.md").split("\n")) {
    const m = /^\|\s*(AN-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/.exec(linea);
    if (m && !filas.some((f) => f.id === m[1])) filas.push({ id: m[1], titulo: m[2], estado: m[3] });
  }
  return filas.sort((a, b) => Number(a.id.slice(3)) - Number(b.id.slice(3)));
}

function criterios() {
  const mapa = {};
  const dir = path.join(RAIZ, "docs");
  for (const archivo of fs.readdirSync(dir).filter((f) => f.startsWith("criterios-aceptacion"))) {
    const texto = read(`docs/${archivo}`);
    for (const m of texto.matchAll(/^## (AN-\d+)[^\n]*/gm)) {
      const ancla = m[0]
        .slice(3)
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúñ\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      const escenarios = (texto.slice(m.index).split(/^## /m)[1] || "").match(/^\* \*\*Escenario/gm) || [];
      mapa[m[1]] = { archivo, ancla, escenarios: escenarios.length };
    }
  }
  return mapa;
}

// Devuelve [{ describe, tests: [titulo] }] del archivo de pruebas del backend.
function pruebasBackend() {
  const grupos = [];
  for (const archivo of fs.readdirSync(path.join(RAIZ, "backend/tests")).filter((f) => f.endsWith(".test.js"))) {
    let actual = null;
    for (const linea of read(`backend/tests/${archivo}`).split("\n")) {
      const d = /^describe\("(.+?)", /.exec(linea);
      if (d) {
        actual = { describe: d[1], archivo, tests: [] };
        grupos.push(actual);
        continue;
      }
      const t = /^\s+test\("(.+?)", /.exec(linea);
      if (t && actual) actual.tests.push(t[1]);
    }
  }
  return grupos;
}

function pruebasInterfaz() {
  const out = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (/\.test\.jsx?$/.test(e.name)) {
        const rel = path.relative(RAIZ, p).replace(/\\/g, "/");
        const tests = [...fs.readFileSync(p, "utf8").matchAll(/^\s+test\(\s*"(.+?)",/gm)].map((m) => m[1]);
        out.push({ archivo: rel, tests, historias: INTERFAZ[rel] || ["Transversal"] });
      }
    }
  };
  recorrer(path.join(RAIZ, "frontend/src"));
  return out;
}

function lcov(p) {
  const ruta = path.join(RAIZ, p);
  if (!fs.existsSync(ruta)) return null;
  // LH = lineas ejecutadas, LF = lineas totales (cada herramienta las escribe en un orden distinto).
  const texto = fs.readFileSync(ruta, "utf8");
  const suma = (clave) => [...texto.matchAll(new RegExp(`^${clave}:(\\d+)`, "gm"))].reduce((n, m) => n + Number(m[1]), 0);
  const hechas = suma("LH");
  const total = suma("LF");
  return total ? { hechas, total, pct: ((hechas / total) * 100).toFixed(1) } : null;
}

function main() {
  const hist = historias();
  const crit = criterios();
  const back = pruebasBackend();
  const ui = pruebasInterfaz();
  const idsEn = (texto) => [...texto.matchAll(/AN-\d+/g)].map((m) => m[0]);

  const porHistoria = {};
  const otros = [];
  for (const g of back) {
    const ids = [...new Set([...idsEn(g.describe), ...(EXTRA[g.describe] || [])])];
    if (ids.length === 0) otros.push(g);
    for (const id of ids) (porHistoria[id] ||= []).push(g);
  }

  const totalBack = back.reduce((n, g) => n + g.tests.length, 0);
  const totalUi = ui.reduce((n, f) => n + f.tests.length, 0);
  const cb = lcov("backend/coverage/lcov.info");
  const cf = lcov("frontend/coverage/lcov.info");

  const l = [];
  l.push("# Matriz de trazabilidad");
  l.push("");
  l.push("> Generada con `npm run matriz` (en `backend/`). No se edita a mano: se regenera a partir del README,");
  l.push("> los criterios de aceptación y los títulos de las pruebas.");
  l.push("");
  l.push("## Resumen");
  l.push("");
  l.push(`- Historias de usuario en el README: **${hist.length}**`);
  l.push(`- Pruebas de API (backend, node:test): **${totalBack}** casos en ${back.length} grupos`);
  l.push(`- Pruebas de interfaz (frontend, vitest): **${totalUi}** casos en ${ui.length} archivos`);
  l.push("- Pruebas de extremo a extremo (Playwright): ver `frontend/e2e/`");
  l.push(
    `- Cobertura de líneas: backend ${cb ? `**${cb.pct} %** (${cb.hechas}/${cb.total})` : "sin medir (`npm run coverage`)"}, ` +
      `frontend ${cf ? `**${cf.pct} %** (${cf.hechas}/${cf.total})` : "sin medir (`npm run coverage`)"}`
  );
  l.push("");
  l.push("## Historia → criterios → pruebas");
  l.push("");
  l.push("| Historia | Título | Estado | Criterios de aceptación | Pruebas de API | Pruebas de interfaz |");
  l.push("|---|---|---|---|---|---|");
  for (const h of hist) {
    const c = crit[h.id];
    const criterio = c ? `[${c.escenarios} escenarios](${c.archivo}#${c.ancla})` : "—";
    const api = (porHistoria[h.id] || []).reduce((n, g) => n + g.tests.length, 0);
    const interfaz = ui.filter((f) => f.historias.includes(h.id)).reduce((n, f) => n + f.tests.length, 0);
    l.push(`| ${h.id} | ${h.titulo} | ${h.estado} | ${criterio} | ${api || "—"} | ${interfaz || "—"} |`);
  }
  l.push("");
  const sinPrueba = hist.filter((h) => !(porHistoria[h.id] || []).length && !ui.some((f) => f.historias.includes(h.id)));
  if (sinPrueba.length) {
    l.push(`> Historias sin pruebas automáticas ligadas por título: ${sinPrueba.map((h) => h.id).join(", ")}.`);
    l.push("");
  }

  l.push("## Detalle de pruebas de API por historia");
  l.push("");
  for (const h of hist) {
    const grupos = porHistoria[h.id] || [];
    if (!grupos.length) continue;
    l.push(`### ${h.id} — ${h.titulo}`);
    l.push("");
    for (const g of grupos) {
      l.push(`**${g.describe}**`);
      for (const t of g.tests) l.push(`- ${t}`);
      l.push("");
    }
  }

  l.push("## Funcionalidad sin código de historia (mejoras y transversales)");
  l.push("");
  for (const g of otros) {
    l.push(`**${g.describe}** (${g.tests.length})`);
    for (const t of g.tests) l.push(`- ${t}`);
    l.push("");
  }

  l.push("## Pruebas de interfaz por archivo");
  l.push("");
  l.push("| Archivo | Casos | Historias |");
  l.push("|---|---|---|");
  for (const f of ui) l.push(`| ${f.archivo.replace("frontend/src/", "")} | ${f.tests.length} | ${f.historias.join(", ")} |`);
  l.push("");

  fs.writeFileSync(path.join(RAIZ, "docs/matriz-trazabilidad.md"), l.join("\n"));
  console.log(`docs/matriz-trazabilidad.md generado: ${hist.length} historias, ${totalBack} pruebas de API, ${totalUi} de interfaz.`);
}

main();
