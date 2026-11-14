// Crea datos de demostracion para probar la aplicacion sin registrar todo a mano.
//
//   npm run seed            crea lo que falte (no toca las cuentas que ya existan)
//   npm run seed -- --reset borra las cuentas "demo.*" y las vuelve a crear desde cero
//
// Cuentas (todas con la contrasena Demo1234):
//   demo.admin@animalcare.com     Administrador
//   demo.cliente@animalcare.com   Dueño con 2 mascotas, una cita proxima y una atendida
//   demo.cliente2@animalcare.com  Dueño con 1 mascota
//   demo.vet@animalcare.com       Veterinario aprobado (clinica y domicilio), horario L-V
//   demo.vet2@animalcare.com      Veterinario aprobado (solo clinica), horario L-V
//   demo.pendiente@animalcare.com Veterinario pendiente de aprobacion (para probar al admin)
//
// Solo para entornos de desarrollo: se niega a correr con NODE_ENV=production.
import dotenv from "dotenv";
dotenv.config();

import { execFileSync } from "node:child_process";
import path from "node:path";
import bcrypt from "bcrypt";

import prisma from "../src/prisma";
import { PRIVACY_VERSION } from "../src/utils/privacidad";
import { combine, toDateString, addDays, startOfDay, localWeekday } from "../src/utils/schedule";

const CLAVE = "Demo1234";
interface DatosCuenta {
  name: string;
  email: string;
  role: "ADMIN" | "CLIENT" | "VETERINARIAN";
  status?: "ACTIVE" | "PENDING";
}

interface DatosVeterinario extends Omit<DatosCuenta, "role"> {
  license: string;
  specialty: string;
  bio: string;
  phone: string;
  address: string;
  homeService: boolean;
  clinicService: boolean;
  services: { name: string; description: string; price: number; durationMinutes: number }[];
}

const D = process.env.SEED_PREFIX || "demo."; // SEED_PREFIX solo se usa en las pruebas

async function crearUsuario(datos: DatosCuenta, hash: string) {
  const existente = await prisma.user.findUnique({ where: { email: datos.email } });
  if (existente) {
    console.log(`  = ${datos.email} ya existe, no se toca`);
    return { usuario: existente, nuevo: false };
  }
  const usuario = await prisma.user.create({
    data: {
      name: datos.name,
      email: datos.email,
      password: hash,
      role: datos.role,
      status: datos.status || "ACTIVE",
      emailVerifiedAt: new Date(),
      privacyAcceptedAt: new Date(),
      privacyVersion: PRIVACY_VERSION,
    },
  });
  console.log(`  + ${datos.email} (${datos.role})`);
  return { usuario, nuevo: true };
}

async function crearVeterinario(datos: DatosVeterinario, hash: string) {
  const { usuario, nuevo } = await crearUsuario({ ...datos, role: "VETERINARIAN" }, hash);
  if (!nuevo) return prisma.vetProfile.findUnique({ where: { userId: usuario.id } });

  const perfil = await prisma.vetProfile.create({
    data: {
      userId: usuario.id,
      license: datos.license,
      specialty: datos.specialty,
      bio: datos.bio,
      phone: datos.phone,
      address: datos.address,
      homeService: datos.homeService,
      clinicService: datos.clinicService,
    },
  });
  if (datos.status === "PENDING") return perfil; // pendiente: sin servicios ni horario todavia

  for (const s of datos.services) {
    await prisma.service.create({ data: { ...s, vetProfileId: perfil.id } });
  }
  // Lunes a viernes, mañana y tarde.
  for (let weekday = 1; weekday <= 5; weekday += 1) {
    for (const [startTime, endTime] of [["08:00", "12:00"], ["14:00", "18:00"]]) {
      await prisma.availability.create({ data: { vetProfileId: perfil.id, weekday, startTime, endTime } });
    }
  }
  return perfil;
}

interface DatosMascota {
  name: string;
  species: string;
  sex: string;
  birthDate: Date;
  weight: number;
  breed?: string;
  color?: string;
  microchip?: string;
  sterilized?: boolean;
  allergies?: string;
}

async function crearMascota(userId: number, datos: DatosMascota) {
  const ya = await prisma.pet.findFirst({ where: { userId, name: datos.name } });
  if (ya) return ya;
  return prisma.pet.create({ data: { ...datos, userId } });
}

// Primer dia habil (lun-vie) a partir de mañana, como "AAAA-MM-DD".
function proximoDiaHabil(desdeDias = 1) {
  let dia = addDays(startOfDay(), desdeDias);
  while ([0, 6].includes(localWeekday(dia))) dia = addDays(dia, 1);
  return toDateString(dia);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed de demostracion no se ejecuta en produccion.");
  }
  if (process.argv.includes("--reset")) {
    console.log("Borrando cuentas demo.* existentes...");
    execFileSync(process.execPath, [path.join(__dirname, "clean-test-data.js"), D], { stdio: "inherit" });
  }

  const hash = await bcrypt.hash(CLAVE, 10);
  console.log("Creando datos de demostracion:");

  await crearUsuario({ name: "Administrador Demo", email: `${D}admin@animalcare.com`, role: "ADMIN" }, hash);
  const { usuario: cliente } = await crearUsuario({ name: "Cliente Demo", email: `${D}cliente@animalcare.com`, role: "CLIENT" }, hash);
  const { usuario: cliente2 } = await crearUsuario({ name: "Cliente Dos Demo", email: `${D}cliente2@animalcare.com`, role: "CLIENT" }, hash);

  const vet = await crearVeterinario(
    {
      name: "Dra. Veterinaria Demo",
      email: `${D}vet@animalcare.com`,
      license: "DEMO-0001",
      specialty: "Medicina general",
      bio: "Veterinaria de demostración con atención en consultorio y a domicilio.",
      phone: "3001112233",
      address: "Calle 5 # 10-20, Popayán",
      homeService: true,
      clinicService: true,
      services: [
        { name: "Consulta general", description: "Revisión completa de la mascota", price: 60000, durationMinutes: 30 },
        { name: "Vacunación", description: "Aplicación de vacunas del esquema", price: 45000, durationMinutes: 30 },
        { name: "Baño medicado", description: "Baño con productos dermatológicos", price: 80000, durationMinutes: 60 },
      ],
    },
    hash
  );
  await crearVeterinario(
    {
      name: "Dr. Segundo Veterinario Demo",
      email: `${D}vet2@animalcare.com`,
      license: "DEMO-0002",
      specialty: "Dermatología",
      bio: "Veterinario de demostración, solo atiende en consultorio.",
      phone: "3004445566",
      address: "Carrera 9 # 4-12, Popayán",
      homeService: false,
      clinicService: true,
      services: [{ name: "Consulta dermatológica", description: "Diagnóstico de la piel", price: 70000, durationMinutes: 30 }],
    },
    hash
  );
  await crearVeterinario(
    {
      name: "Dr. Pendiente Demo",
      email: `${D}pendiente@animalcare.com`,
      status: "PENDING",
      license: "DEMO-0003",
      specialty: "Cirugía",
      bio: "Cuenta pendiente: el administrador debe aprobarla.",
      phone: "3007778899",
      address: "Calle 1 # 2-3, Popayán",
      homeService: false,
      clinicService: true,
      services: [],
    },
    hash
  );

  const luna = await crearMascota(cliente.id, {
    name: "Luna",
    species: "Perro",
    sex: "Hembra",
    birthDate: new Date("2022-04-10"),
    weight: 12.5,
    breed: "Labrador",
    color: "Dorado",
    microchip: "985112345678901",
    sterilized: true,
    allergies: "Penicilina",
  });
  await crearMascota(cliente.id, { name: "Michi", species: "Gato", sex: "Macho", birthDate: new Date("2021-08-20"), weight: 4.2 });
  await crearMascota(cliente2.id, { name: "Rocky", species: "Perro", sex: "Macho", birthDate: new Date("2020-01-15"), weight: 18 });

  // Citas de ejemplo solo si el cliente aun no tiene ninguna con este veterinario.
  const yaTiene = await prisma.appointment.count({ where: { clientId: cliente.id, vetProfileId: vet!.id } });
  if (yaTiene === 0) {
    const servicio = await prisma.service.findFirst({ where: { vetProfileId: vet!.id, name: "Consulta general" } });
    const base = { clientId: cliente.id, vetProfileId: vet!.id, petId: luna.id, serviceId: servicio?.id, mode: "CLINIC" as const, durationMinutes: 30 };

    const proxima = await prisma.appointment.create({
      data: { ...base, scheduledAt: combine(proximoDiaHabil(1), "09:00")!, status: "CONFIRMED", notes: "Control anual" },
    });
    const atendida = await prisma.appointment.create({
      data: { ...base, scheduledAt: combine(toDateString(addDays(startOfDay(), -7)), "10:00")!, status: "COMPLETED", notes: "Vómito ocasional" },
    });
    await prisma.medicalRecord.create({
      data: {
        petId: luna.id,
        vetProfileId: vet!.id,
        appointmentId: atendida.id,
        visitDate: startOfDay(atendida.scheduledAt),
        reason: "Vómito ocasional",
        diagnosis: "Gastritis leve",
        treatment: "Dieta blanda por 3 días",
        weight: 12.5,
        temperature: 38.6,
        vaccines: "Triple canina (refuerzo)",
        // Control de seguimiento, vacuna con proxima dosis y receta (para ver los recordatorios y el PDF).
        followUpDate: addDays(startOfDay(), 14),
        vaccinations: {
          create: [{ name: "Rabia", appliedAt: startOfDay(atendida.scheduledAt), nextDueAt: addDays(startOfDay(), 20), lot: "RB-2026-07", petId: luna.id, vetProfileId: vet!.id }],
        },
        prescriptions: {
          create: [{ medication: "Omeprazol", dose: "10 mg", frequency: "cada 24 horas", duration: "5 días", instructions: "En ayunas" }],
        },
      },
    });
    await prisma.review.create({
      data: { appointmentId: atendida.id, clientId: cliente.id, vetProfileId: vet!.id, rating: 5, comment: "Muy amable y clara con las indicaciones." },
    });
    await prisma.vetProfile.update({ where: { id: vet!.id }, data: { rating: 5 } });
    console.log(`  + citas de ejemplo (#${proxima.id} próxima, #${atendida.id} atendida con historia y reseña)`);
  }

  console.log(`\nListo. Contraseña de todas las cuentas demo: ${CLAVE}`);
}

main()
  .catch((error) => {
    console.error("No se pudo crear los datos de demostracion:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
