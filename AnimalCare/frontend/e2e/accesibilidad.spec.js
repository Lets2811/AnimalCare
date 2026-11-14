// Accesibilidad automatica (axe-core, reglas WCAG 2 A y AA) en las pantallas principales de cada rol.
// Falla si hay violaciones "serious" o "critical". Las "moderate" y "minor" se listan como anotaciones.
//
// axe detecta una parte de los problemas (contraste, etiquetas, nombres de botones, estructura);
// no reemplaza una revision manual con teclado y lector de pantalla.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { cerrarBase, crearAdmin, crearCliente, crearMascota, crearVeterinario, entrar } from "./ayudas.js";

test.afterAll(cerrarBase);

let cliente;
let vet;
let admin;
let mascota;

async function revisar(page, ruta, info) {
  await page.goto(ruta);
  await page.waitForLoadState("networkidle");
  const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

  const graves = resultado.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  const leves = resultado.violations.filter((v) => !["serious", "critical"].includes(v.impact));
  for (const v of leves) info.annotations.push({ type: `leve ${ruta}`, description: `${v.id}: ${v.help} (${v.nodes.length})` });

  const detalle = graves
    .map((v) => {
      const nodos = v.nodes
        .slice(0, 4)
        .map((n) => `   ${n.target.join(" ")}  ->  ${(n.any[0] || n.all[0] || n.none[0] || {}).message || ""}`)
        .join("\n");
      return `${v.id} [${v.impact}] ${v.help}\n${nodos}`;
    })
    .join("\n");
  // soft: se revisan todas las pantallas aunque una falle, y se reportan juntas.
  expect.soft(graves.length, `${ruta}\n${detalle}`).toBe(0);
}

// Los datos se preparan una vez; cada rol es una prueba independiente (si una falla, las demas corren).
test.beforeAll(async () => {
  vet = await crearVeterinario("Vet Accesibilidad");
  cliente = await crearCliente("Dueño Accesibilidad");
  mascota = await crearMascota(cliente, "Firulais");
  admin = await crearAdmin();
});

test("pantallas publicas", async ({ page }, info) => {
  for (const ruta of ["/login", "/register", "/recuperar", "/privacidad"]) await revisar(page, ruta, info);
});

test("dueño de mascota", async ({ page }, info) => {
  await entrar(page, cliente.email);
  for (const ruta of ["/dashboard", "/veterinarios", "/citas", "/mascotas", `/mascotas/${mascota.id}/historia`, "/urgencias", "/notificaciones", "/mi-cuenta"]) {
    await revisar(page, ruta, info);
  }
});

test("veterinario", async ({ page }, info) => {
  await entrar(page, vet.email);
  for (const ruta of ["/dashboard", "/citas", "/mi-horario", "/mis-servicios", "/mi-perfil", "/urgencias"]) {
    await revisar(page, ruta, info);
  }
});

test("administrador", async ({ page }, info) => {
  await entrar(page, admin.email);
  await revisar(page, "/admin/usuarios", info);
});
