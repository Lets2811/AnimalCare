// Utilidades compartidas por las pruebas e2e: preparan datos por la API y por la base
// (aprobar un veterinario, darle horario, crear una cita ya empezada) y entran por la pantalla de login.
//
// Los usuarios se llaman "e2e.*": el teardown de Playwright los borra al terminar.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(aqui, "../../backend");
const requerir = createRequire(path.join(backend, "package.json"));

// En local la base se configura en backend/.env; en CI ya viene en el entorno.
requerir("dotenv").config({ path: path.join(backend, ".env"), quiet: true });
export const prisma = requerir("./src/prisma");

export const API = process.env.E2E_API_URL || "http://localhost:4000/api";
export const CLAVE = "Prueba123";

export async function http(metodo, ruta, { token, body } = {}) {
  const opciones = {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (body !== undefined) opciones.body = JSON.stringify(body);
  const r = await fetch(`${API}${ruta}`, opciones);
  const texto = await r.text();
  return { status: r.status, data: texto ? JSON.parse(texto) : null };
}

export const unico = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

export async function crearCliente(nombre = "Cliente E2E") {
  const email = `e2e.cli.${unico()}@test.com`;
  const r = await http("POST", "/auth/register", { body: { name: nombre, email, password: CLAVE, acceptPrivacy: true } });
  if (r.status !== 201) throw new Error(`registro de cliente: ${JSON.stringify(r.data)}`);
  const login = await http("POST", "/auth/login", { body: { email, password: CLAVE } });
  return { email, nombre, token: login.data.token, id: login.data.user.id };
}

export async function crearMascota(cliente, nombre = "Firulais") {
  const r = await http("POST", "/pets", {
    token: cliente.token,
    body: { name: nombre, species: "Perro", sex: "Macho", birthDate: "2021-03-03" },
  });
  if (r.status !== 201) throw new Error(`mascota: ${JSON.stringify(r.data)}`);
  return { id: r.data.pet.id, nombre };
}

// Veterinario aprobado, con consultorio y sin domicilio.
export async function crearVeterinario(nombre = "Vet E2E") {
  const email = `e2e.vet.${unico()}@test.com`;
  const r = await http("POST", "/auth/register", {
    body: {
      name: nombre,
      email,
      password: CLAVE,
      acceptPrivacy: true,
      role: "VETERINARIAN",
      license: `E2${unico().slice(-7)}`, // 4 a 10 caracteres
      specialty: "Medicina general",
      clinicService: true,
      homeService: false,
      address: "Calle 5 # 10-20, Popayan",
      phone: "3001234567",
      services: [],
    },
  });
  if (r.status !== 201) throw new Error(`registro de veterinario: ${JSON.stringify(r.data)}`);
  // El administrador lo aprobaria desde su panel; aqui se hace directo en la base.
  await prisma.user.update({ where: { email }, data: { status: "ACTIVE" } });
  const perfil = await prisma.vetProfile.findFirst({ where: { user: { email } } });
  return { email, nombre, perfilId: perfil.id };
}

// Cita ya empezada hace unos minutos (para poder iniciar la atencion).
export async function crearCitaEnCurso({ clienteId, vet, mascota, minutosAtras = 5 }) {
  return prisma.appointment.create({
    data: {
      mode: "CLINIC",
      scheduledAt: new Date(Date.now() - minutosAtras * 60000),
      durationMinutes: 30,
      status: "CONFIRMED",
      clientId: clienteId,
      vetProfileId: vet.perfilId,
      petId: mascota.id,
      notes: "Cojea de la pata derecha",
    },
  });
}

// "AAAA-MM-DD" de un instante en la zona de la clinica (la agenda se abre en "hoy" de Bogota:
// una cita de hace unos minutos puede ser de ayer si la prueba corre justo despues de medianoche).
export function fechaBogota(instante) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(instante);
}

// Horario de hoy que cubre todo el dia (para que el veterinario reciba urgencias ahora).
// Devuelve false si falta menos de media hora para medianoche: la urgencia ocupa 30 minutos.
export async function darHorarioDeHoy(vet) {
  const ahora = new Date();
  const hora = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(ahora)
    .split(":")
    .map(Number);
  if (hora[0] * 60 + hora[1] > 23 * 60 + 25) return false;
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", weekday: "short" }).format(ahora);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dia);
  await prisma.availability.create({ data: { vetProfileId: vet.perfilId, weekday, startTime: "00:00", endTime: "23:59" } });
  return true;
}

// Administrador creado igual que el script create-admin (no se registra por la API).
export async function crearAdmin() {
  const bcrypt = requerir("bcrypt");
  const email = `e2e.adm.${unico()}@test.com`;
  await prisma.user.create({
    data: { name: "Admin E2E", email, password: await bcrypt.hash(CLAVE, 10), role: "ADMIN", status: "ACTIVE" },
  });
  return { email };
}

export async function entrar(page, email) {
  await page.goto("/login");
  await page.getByLabel(/Correo electrónico/).fill(email);
  await page.getByLabel(/Contraseña/).fill(CLAVE);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

export async function cerrarBase() {
  await prisma.$disconnect();
}
