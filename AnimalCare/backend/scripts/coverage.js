// Cobertura de codigo del backend: corre las pruebas con la API dentro del mismo proceso
// y mide cuanto de src/ ejecutan. Genera el reporte en consola y coverage/lcov.info.
//
//   npm run coverage
//
// Necesita la base de datos (igual que npm test) y Node 22 o superior.
require("dotenv").config();

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

fs.mkdirSync("coverage", { recursive: true });

const resultado = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    "--experimental-test-coverage",
    "--test-coverage-include=src/**/*.ts",
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=lcov",
    "--test-reporter-destination=coverage/lcov.info",
    "tests/schedule.test.js",
    "tests/openapi.test.js",
    "tests/unit/validadores.test.js",
    "tests/unit/infraestructura.test.js",
    "tests/unit/servicios.test.js",
    "tests/unit/seguridad.test.js",
    "tests/seguridad.test.js",
    "tests/sprint2.test.js",
  ],
  { stdio: "inherit", env: { ...process.env, TEST_IN_PROCESS: "1", REMINDERS_ENABLED: "false", MAIL_TRANSPORT: "console" } }
);

process.exit(resultado.status ?? 1);
