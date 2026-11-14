// Flujo clinico de extremo a extremo: el veterinario registra una consulta con vacuna (proxima dosis), receta y
// control de seguimiento; el dueño ve el carnet, la receta, descarga los PDF, ve quien consulto la historia y
// exporta sus datos; el administrador ve todo en la auditoria.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { cerrarBase, crearAdmin, crearCitaEnCurso, crearCliente, crearVeterinario, entrar, fechaBogota, http } from "./ayudas.js";

test.describe.configure({ mode: "serial" });
test.afterAll(cerrarBase);

const enDias = (n) => fechaBogota(new Date(Date.now() + n * 24 * 60 * 60 * 1000));

let cliente;
let vet;
let admin;
let mascota;
let cita;

test("preparacion: mascota con ficha, veterinario aprobado y una cita en curso", async () => {
  vet = await crearVeterinario("Vet Clinico E2E");
  cliente = await crearCliente("Dueño Clinico E2E");
  const r = await http("POST", "/pets", {
    token: cliente.token,
    body: { name: "Firulais", species: "Perro", sex: "Macho", birthDate: "2021-03-03", breed: "Criollo", allergies: "Penicilina" },
  });
  expect(r.status).toBe(201);
  mascota = { id: r.data.pet.id, nombre: "Firulais" };
  cita = await crearCitaEnCurso({ clienteId: cliente.id, vet, mascota });
  admin = await crearAdmin();
});

test("el veterinario registra vacuna, receta y control en la consulta", async ({ page }) => {
  await entrar(page, vet.email);
  await page.goto("/citas");
  await page.getByLabel("Día de la agenda").fill(fechaBogota(cita.scheduledAt));
  await page.getByRole("button", { name: "Iniciar atención" }).click();
  await expect(page.getByRole("heading", { name: /Atención en curso/ })).toBeVisible();
  // La ficha de la mascota se ve en la historia: el veterinario sabe de las alergias.
  await expect(page.getByText("Penicilina")).toBeVisible();

  await page.getByLabel(/Diagnóstico/).fill("Gastroenteritis leve");
  await page.getByRole("button", { name: "+ Agregar vacuna" }).click();
  await page.getByLabel("Vacuna 1").fill("Rabia");
  await page.getByLabel("Próxima dosis").fill(enDias(20));
  await page.getByRole("button", { name: "+ Agregar medicamento" }).click();
  await page.getByLabel("Medicamento 1").fill("Omeprazol");
  await page.getByLabel("Dosis", { exact: true }).fill("10 mg");
  await page.getByLabel("Frecuencia").fill("cada 24 horas");
  await page.getByLabel("Próximo control sugerido").fill(enDias(10));

  // El formulario con los editores abiertos tampoco debe tener problemas graves de accesibilidad.
  const accesibilidad = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const graves = accesibilidad.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  expect(graves.map((v) => `${v.id}: ${v.nodes[0].target.join(" ")}`)).toEqual([]);

  await page.getByRole("button", { name: "Guardar y terminar atención" }).click();
  await expect(page).toHaveURL(/\/citas$/);
});

test("el dueño ve el carnet, la receta y los PDF", async ({ page }) => {
  await entrar(page, cliente.email);
  await page.goto(`/mascotas/${mascota.id}/historia`);

  await expect(page.getByText("Alergias:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Carnet de vacunas" })).toBeVisible();
  await expect(page.getByText("Próximas dosis")).toBeVisible();
  await expect(page.getByText(/Omeprazol/)).toBeVisible();
  await expect(page.getByText("Próximo control")).toBeVisible();

  const [receta] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar receta (PDF)" }).click()]);
  expect(receta.suggestedFilename()).toMatch(/^receta-\d+\.pdf$/);

  const [historia] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar PDF" }).click()]);
  expect(historia.suggestedFilename()).toBe("historia-Firulais.pdf");
});

test("el dueño ve quien consulto su historia y exporta sus datos", async ({ page }) => {
  await entrar(page, cliente.email);
  await page.goto(`/mascotas/${mascota.id}/historia`);
  await page.getByRole("button", { name: /Ver quién ha consultado/ }).click();
  await expect(page.getByText(/Vet Clinico E2E/).first()).toBeVisible();
  await expect(page.getByText(/Agregó una consulta/)).toBeVisible();

  await page.goto("/mi-cuenta");
  await expect(page.getByText(/versión 2026-11-14/)).toBeVisible();
  const [datos] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar mis datos (JSON)" }).click()]);
  expect(datos.suggestedFilename()).toBe("animalcare-mis-datos.json");
});

test("el administrador ve los accesos en la auditoria", async ({ page }) => {
  await entrar(page, admin.email);
  await page.goto("/admin/auditoria");
  await page.getByLabel("Número de mascota").fill(String(mascota.id));
  await expect(page.getByRole("cell", { name: "Agregó una consulta" })).toBeVisible();
  await page.getByLabel("Acción").selectOption("DOWNLOAD_PDF");
  await expect(page.getByRole("cell", { name: "Descargó la historia en PDF" })).toBeVisible();
});
