// Flujo del veterinario, de extremo a extremo: entra a su agenda, inicia la atencion de una cita,
// llena la historia clinica (guardar avance y terminar) y el dueño ve el resultado.
import { expect, test } from "@playwright/test";

import { cerrarBase, crearCitaEnCurso, crearCliente, crearMascota, crearVeterinario, entrar, fechaBogota } from "./ayudas.js";

test.describe.configure({ mode: "serial" });
test.afterAll(cerrarBase);

let cliente;
let vet;
let mascota;
let cita;

test("preparacion: veterinario aprobado, dueño con mascota y una cita ya empezada", async () => {
  vet = await crearVeterinario("Vet Agenda E2E");
  cliente = await crearCliente("Dueño Agenda E2E");
  mascota = await crearMascota(cliente, "Firulais");
  cita = await crearCitaEnCurso({ clienteId: cliente.id, vet, mascota });
  expect(cita.id).toBeGreaterThan(0);
});

test("el veterinario inicia la atencion y llena la historia clinica", async ({ page }) => {
  await entrar(page, vet.email);
  await page.goto("/citas");
  await page.getByLabel("Día de la agenda").fill(fechaBogota(cita.scheduledAt));
  await expect(page.getByText("Dueño Agenda E2E")).toBeVisible();

  await page.getByRole("button", { name: "Iniciar atención" }).click();
  await expect(page).toHaveURL(new RegExp(`/pacientes/${mascota.id}\\?cita=${cita.id}`));
  await expect(page.getByRole("heading", { name: /Atención en curso/ })).toBeVisible();
  // El motivo viene de la cita.
  await expect(page.getByLabel(/Motivo de consulta/)).toHaveValue("Cojea de la pata derecha");

  await page.getByLabel(/Diagnóstico/).fill("Esguince leve");
  await page.getByRole("button", { name: "Guardar avance" }).click();
  await expect(page.getByText("Avance guardado")).toBeVisible();
  // Con un avance guardado ya no se ofrece terminar sin registrar.
  await expect(page.getByRole("button", { name: "Terminar sin registrar" })).toHaveCount(0);

  await page.getByLabel(/Tratamiento/).fill("Reposo 5 días");
  await page.getByRole("button", { name: "Guardar y terminar atención" }).click();
  await expect(page).toHaveURL(/\/citas$/);

  // La cita ya no esta "en atencion": aparece como completada al ver todas.
  await page.getByLabel("Día de la agenda").fill(fechaBogota(cita.scheduledAt));
  await page.getByRole("tab", { name: "Todas" }).click();
  await expect(page.getByText("Completada")).toBeVisible();
});

test("el dueño ve la consulta en la historia clinica de su mascota", async ({ page }) => {
  await entrar(page, cliente.email);
  await page.goto(`/mascotas/${mascota.id}/historia`);
  await expect(page.getByText("Esguince leve")).toBeVisible();
  await expect(page.getByText("Reposo 5 días")).toBeVisible();
});

test("terminar sin registrar una cita sin historia la deja atendida", async ({ page }) => {
  const otra = await crearCitaEnCurso({ clienteId: cliente.id, vet, mascota, minutosAtras: 20 });
  await entrar(page, vet.email);
  await page.goto("/citas");
  await page.getByLabel("Día de la agenda").fill(fechaBogota(otra.scheduledAt));
  await page.getByRole("button", { name: "Iniciar atención" }).click();
  await expect(page.getByRole("heading", { name: /Atención en curso/ })).toBeVisible();
  await page.getByRole("button", { name: "Terminar sin registrar" }).click();
  await page.getByRole("button", { name: "Sí, terminar sin registrar" }).click();
  await expect(page).toHaveURL(/\/citas$/);
});
