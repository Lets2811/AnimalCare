// Urgencias de extremo a extremo con dos navegadores: el dueño pide, el veterinario acepta,
// inicia la atencion y la termina (o la devuelve si no la realizo).
import { expect, test } from "@playwright/test";

import { cerrarBase, crearCliente, crearMascota, crearVeterinario, darHorarioDeHoy, entrar } from "./ayudas.js";

test.describe.configure({ mode: "serial" });
test.afterAll(cerrarBase);

let cliente;
let vet;
let mascota;
let hayHorario = false;

async function pedirUrgencia(page, sintomas) {
  await page.goto("/urgencias");
  await page.getByLabel(/^Mascota/).selectOption({ label: "Firulais (Perro)" });
  await page.getByLabel(/¿Qué le pasa\?/).fill(sintomas);
  await page.getByLabel(/Teléfono de contacto/).fill("3001234567");
  await page.getByRole("button", { name: "Pedir atención urgente" }).click();
  await expect(page.getByText(/Buscando un veterinario disponible/)).toBeVisible();
}

test("preparacion: veterinario con horario de hoy y dueño con mascota", async () => {
  vet = await crearVeterinario("Vet Urgencias E2E");
  cliente = await crearCliente("Dueño Urgencias E2E");
  mascota = await crearMascota(cliente, "Firulais");
  // Falso muy cerca de la medianoche: la urgencia ocupa 30 minutos dentro del dia.
  hayHorario = await darHorarioDeHoy(vet);
});

test("pedir, aceptar, iniciar la atencion y terminarla desde la historia clinica", async ({ browser }) => {
  test.skip(!hayHorario, "sin horario de prueba");
  test.setTimeout(90_000);
  const dueño = await (await browser.newContext()).newPage();
  const veterinario = await (await browser.newContext()).newPage();

  await entrar(dueño, cliente.email);
  await pedirUrgencia(dueño, "Vomita sin parar desde hace horas");

  await entrar(veterinario, vet.email);
  await veterinario.goto("/urgencias");
  await expect(veterinario.getByText("Urgencias abiertas (1)")).toBeVisible();
  await veterinario.getByRole("button", { name: "Aceptar" }).click();
  await expect(veterinario.getByText("Urgencia en curso")).toBeVisible();

  // El dueño lo ve (la pantalla se actualiza sola cada 10 segundos).
  await expect(dueño.getByText(/atenderá tu urgencia/)).toBeVisible({ timeout: 20_000 });

  // El veterinario inicia la atencion: va a la historia clinica con la cita de la urgencia.
  await veterinario.getByRole("button", { name: "Iniciar atención" }).click();
  await expect(veterinario).toHaveURL(new RegExp(`/pacientes/${mascota.id}\\?cita=`));
  await veterinario.getByLabel(/Diagnóstico/).fill("Gastroenteritis");
  await veterinario.getByRole("button", { name: "Guardar y terminar atención" }).click();
  await expect(veterinario).toHaveURL(/\/citas$/);

  // La urgencia queda atendida para el dueño.
  await expect(dueño.getByText("Atendida").first()).toBeVisible({ timeout: 20_000 });
  await dueño.context().close();
  await veterinario.context().close();
});

test("si el veterinario no realiza la urgencia, vuelve a quedar disponible", async ({ browser }) => {
  test.skip(!hayHorario, "sin horario de prueba");
  test.setTimeout(90_000);
  const dueño = await (await browser.newContext()).newPage();
  const veterinario = await (await browser.newContext()).newPage();

  await entrar(dueño, cliente.email);
  await pedirUrgencia(dueño, "Se golpeó y no apoya la pata");
  await entrar(veterinario, vet.email);
  await veterinario.goto("/urgencias");
  await veterinario.getByRole("button", { name: "Aceptar" }).click();
  await veterinario.getByRole("button", { name: "Iniciar atención" }).click();
  await expect(veterinario).toHaveURL(new RegExp(`/pacientes/${mascota.id}\\?cita=`));

  await veterinario.getByRole("button", { name: "Terminar sin registrar" }).click();
  await expect(veterinario.getByText(/Volverá a quedar disponible/)).toBeVisible();
  await veterinario.getByRole("button", { name: "Sí, terminar sin registrar" }).click();
  await expect(veterinario).toHaveURL(/\/urgencias$/);

  // Vuelve a la lista de urgencias abiertas (el mismo veterinario sigue disponible).
  await expect(veterinario.getByText("Urgencias abiertas (1)")).toBeVisible({ timeout: 15_000 });
  await dueño.reload();
  await expect(dueño.getByText(/Buscando un veterinario disponible/)).toBeVisible();
  await dueño.context().close();
  await veterinario.context().close();
});
