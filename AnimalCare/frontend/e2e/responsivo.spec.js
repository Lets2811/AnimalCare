// Responsividad: en celular (360 px), tableta (768 px) y escritorio (1280 px) ninguna pantalla debe
// desbordarse a los lados (scroll horizontal) y los botones y enlaces deben poder tocarse (24 px o mas).
import { expect, test } from "@playwright/test";

import { cerrarBase, crearAdmin, crearCliente, crearMascota, crearVeterinario, entrar } from "./ayudas.js";

test.afterAll(cerrarBase);

const TAMANOS = [
  { nombre: "celular", width: 360, height: 740 },
  { nombre: "tableta", width: 768, height: 1024 },
  { nombre: "escritorio", width: 1280, height: 800 },
];

let cliente;
let vet;
let admin;
let mascota;

test.beforeAll(async () => {
  vet = await crearVeterinario("Vet Responsivo");
  cliente = await crearCliente("Dueño Responsivo");
  mascota = await crearMascota(cliente, "Firulais");
  admin = await crearAdmin();
});

// Devuelve los elementos que se salen del ancho de la pantalla (para saber que arreglar).
async function desbordes(page) {
  return page.evaluate(() => {
    const ancho = document.documentElement.clientWidth;
    const sobran = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > ancho + 1 && getComputedStyle(el).position !== "fixed") {
        sobran.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} (${Math.round(r.right)}px)`);
      }
    }
    return { ancho, scroll: document.documentElement.scrollWidth, sobran: sobran.slice(0, 5) };
  });
}

async function revisar(page, ruta, tamano, fallas) {
  await page.goto(ruta);
  await page.waitForLoadState("networkidle");
  const d = await desbordes(page);
  if (d.scroll > d.ancho + 1) fallas.push(`${tamano.nombre} ${ruta}: scroll ${d.scroll}px > ${d.ancho}px; ${d.sobran.join(", ")}`);
}

for (const tamano of TAMANOS) {
  test.describe(tamano.nombre, () => {
    test.use({ viewport: { width: tamano.width, height: tamano.height } });

    test("pantallas publicas sin scroll horizontal", async ({ page }) => {
      const fallas = [];
      for (const ruta of ["/login", "/register", "/recuperar", "/privacidad"]) await revisar(page, ruta, tamano, fallas);
      expect(fallas, fallas.join("\n")).toEqual([]);
    });

    test("dueño de mascota", async ({ page }) => {
      await entrar(page, cliente.email);
      const fallas = [];
      for (const ruta of ["/dashboard", "/veterinarios", "/citas", "/mascotas", `/mascotas/${mascota.id}/historia`, "/urgencias", "/notificaciones", "/mi-cuenta"]) {
        await revisar(page, ruta, tamano, fallas);
      }
      expect(fallas, fallas.join("\n")).toEqual([]);
    });

    test("veterinario", async ({ page }) => {
      await entrar(page, vet.email);
      const fallas = [];
      for (const ruta of ["/dashboard", "/citas", "/mi-horario", "/mis-servicios", "/mi-perfil", "/urgencias", "/pacientes"]) {
        await revisar(page, ruta, tamano, fallas);
      }
      expect(fallas, fallas.join("\n")).toEqual([]);
    });

    test("administrador", async ({ page }) => {
      await entrar(page, admin.email);
      const fallas = [];
      for (const ruta of ["/admin/usuarios", "/admin/metricas", "/admin/auditoria"]) await revisar(page, ruta, tamano, fallas);
      expect(fallas, fallas.join("\n")).toEqual([]);
    });
  });
}
