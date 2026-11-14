import type { Request, Response } from "express";
// Mascotas del dueño (CLIENT).
// Registrar, listar, actualizar y desactivar. No se borran fisicamente: una
// mascota desactivada conserva sus citas anteriores.
// El dueño se toma SIEMPRE del token.
import prisma from "../../prisma";
import { parseId } from "../../utils/params";
import { parseDate, toDateString, startOfDay } from "../../utils/schedule";
import { esErrorPrisma } from "../../utils/errores";

const ESPECIES = ["Perro", "Gato", "Ave", "Conejo", "Roedor", "Reptil", "Otro"];
const SEXOS = ["Macho", "Hembra"];
const MAX_NAME = 40;
const MAX_AGE_YEARS = 40;
const MAX_WEIGHT = 200;
const MAX_TEXT = 40;
const MAX_ALLERGIES = 500;

function toPublicPet(pet: any) {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    sex: pet.sex,
    birthDate: toDateString(pet.birthDate),
    weight: pet.weight === null ? null : Number(pet.weight),
    // Ficha clinica basica
    breed: pet.breed ?? null,
    color: pet.color ?? null,
    microchip: pet.microchip ?? null,
    sterilized: pet.sterilized ?? null,
    allergies: pet.allergies ?? null,
  };
}

// Campos opcionales de la ficha: solo se actualizan los que vienen en la peticion
// (un cliente que no los envia no borra lo que ya estaba guardado).
function validateFicha(body: Record<string, any>, errors: string[]) {
  const ficha: { breed?: string | null; color?: string | null; microchip?: string | null; sterilized?: boolean | null; allergies?: string | null } = {};
  const texto = (campo: "breed" | "color", etiqueta: string) => {
    if (!(campo in body)) return;
    const valor = String(body[campo] ?? "").trim();
    if (valor.length > MAX_TEXT) errors.push(`${etiqueta} no puede superar los ${MAX_TEXT} caracteres.`);
    else ficha[campo] = valor === "" ? null : valor;
  };
  texto("breed", "La raza");
  texto("color", "El color");

  if ("microchip" in body) {
    const chip = String(body.microchip ?? "").replace(/\s/g, "");
    if (chip === "") ficha.microchip = null;
    else if (!/^\d{9,15}$/.test(chip)) errors.push("El microchip debe tener entre 9 y 15 dígitos.");
    else ficha.microchip = chip;
  }
  if ("sterilized" in body) {
    if (body.sterilized === null || body.sterilized === "") ficha.sterilized = null;
    else if (typeof body.sterilized === "boolean") ficha.sterilized = body.sterilized;
    else errors.push("Indica si la mascota está esterilizada (sí o no).");
  }
  if ("allergies" in body) {
    const alergias = String(body.allergies ?? "").trim();
    if (alergias.length > MAX_ALLERGIES) errors.push(`Las alergias no pueden superar los ${MAX_ALLERGIES} caracteres.`);
    else ficha.allergies = alergias === "" ? null : alergias;
  }
  return ficha;
}

function validatePet(body: Record<string, any> = {}) {
  const errors: string[] = [];
  const nombre = String(body.name ?? "").trim();
  const especie = String(body.species ?? "").trim();
  const sexo = String(body.sex ?? "").trim();
  const fecha = parseDate(body.birthDate);
  const pesoTexto = body.weight === undefined || body.weight === null ? "" : String(body.weight).trim();

  if (nombre === "") errors.push("El nombre de la mascota es obligatorio.");
  else if (nombre.length > MAX_NAME) errors.push(`El nombre no puede superar los ${MAX_NAME} caracteres.`);

  if (!ESPECIES.includes(especie)) errors.push(`La especie debe ser una de: ${ESPECIES.join(", ")}.`);
  if (!SEXOS.includes(sexo)) errors.push("El sexo debe ser Macho o Hembra.");

  if (!body.birthDate) {
    errors.push("La fecha de nacimiento es obligatoria (puede ser aproximada).");
  } else if (!fecha) {
    errors.push("La fecha de nacimiento no es válida (formato AAAA-MM-DD).");
  } else if (fecha.getTime() > Date.now()) {
    errors.push("La fecha de nacimiento no puede estar en el futuro.");
  } else if (Date.now() - fecha.getTime() > MAX_AGE_YEARS * 365.25 * 24 * 60 * 60 * 1000) {
    errors.push(`La fecha de nacimiento no puede ser de hace más de ${MAX_AGE_YEARS} años.`);
  }

  let peso = null;
  if (pesoTexto !== "") {
    if (!/^\d+(\.\d{1,2})?$/.test(pesoTexto) || Number(pesoTexto) <= 0 || Number(pesoTexto) > MAX_WEIGHT) {
      errors.push(`El peso debe ser un número mayor a 0 y hasta ${MAX_WEIGHT} kg.`);
    } else {
      peso = Number(pesoTexto);
    }
  }

  const ficha = validateFicha(body, errors);
  return { errors, value: { name: nombre, species: especie, sex: sexo, birthDate: fecha, weight: peso, ...ficha } };
}

async function findOwnActivePet(id: number, userId: number) {
  return prisma.pet.findFirst({ where: { id, userId, status: "ACTIVE" } });
}

function microchipRepetido(res: Response) {
  return res.status(409).json({
    message: "Ese microchip ya está registrado en otra mascota.",
    fieldErrors: { microchip: "Ese microchip ya está registrado en otra mascota." },
  });
}

function serverError(res: Response, where: any, error: unknown) {
  console.error(`Error en ${where}:`, error);
  return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
}

// GET /api/pets
async function listMyPets(req: Request, res: Response) {
  try {
    const pets = await prisma.pet.findMany({
      where: { userId: req.user.id, status: "ACTIVE" },
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ pets: pets.map(toPublicPet), species: ESPECIES });
  } catch (error) {
    return serverError(res, "listMyPets", error);
  }
}

// GET /api/pets/reminders
// Proximas vacunas y controles de seguimiento de mis mascotas (proximos 60 dias, y los atrasados de los ultimos 30).
async function listReminders(req: Request, res: Response) {
  try {
    const hoy = startOfDay();
    const desde = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hasta = new Date(hoy.getTime() + 60 * 24 * 60 * 60 * 1000);

    const vacunas = await prisma.vaccination.findMany({
      where: { pet: { userId: req.user.id, status: "ACTIVE" } },
      include: { pet: { select: { id: true, name: true } } },
      orderBy: [{ appliedAt: "desc" }, { id: "desc" }],
    });
    // Solo cuenta la ultima aplicacion de cada vacuna de cada mascota: una dosis posterior cancela el recordatorio de la anterior.
    const ultimas = new Map<string, (typeof vacunas)[number]>();
    for (const v of vacunas) {
      const clave = `${v.petId}|${v.name.trim().toLowerCase()}`;
      if (!ultimas.has(clave)) ultimas.set(clave, v);
    }
    const proximasVacunas = [...ultimas.values()]
      .filter((v) => v.nextDueAt && v.nextDueAt >= desde && v.nextDueAt <= hasta)
      .sort((a, b) => a.nextDueAt!.getTime() - b.nextDueAt!.getTime())
      .map((v) => ({
        petId: v.pet.id,
        petName: v.pet.name,
        name: v.name,
        dueDate: toDateString(v.nextDueAt!),
        overdue: v.nextDueAt! < hoy,
      }));

    const controles = await prisma.medicalRecord.findMany({
      where: { status: "ACTIVE", followUpDate: { gte: desde, lte: hasta }, pet: { userId: req.user.id, status: "ACTIVE" } },
      include: { pet: { select: { id: true, name: true } }, vetProfile: { include: { user: { select: { name: true } } } } },
      orderBy: { followUpDate: "asc" },
    });
    return res.status(200).json({
      vaccines: proximasVacunas,
      followUps: controles.map((c) => ({
        petId: c.pet.id,
        petName: c.pet.name,
        date: toDateString(c.followUpDate!),
        vet: c.vetProfile.user.name,
        overdue: c.followUpDate! < hoy,
      })),
    });
  } catch (error) {
    return serverError(res, "listReminders", error);
  }
}

// POST /api/pets
async function createPet(req: Request, res: Response) {
  try {
    const { errors, value } = validatePet(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
    }
    const pet = await prisma.pet.create({ data: { ...value, birthDate: value.birthDate!, userId: req.user.id } });
    return res.status(201).json({ message: `${pet.name} quedó registrado.`, pet: toPublicPet(pet) });
  } catch (error) {
    if (esErrorPrisma(error) && error.code === "P2002") return microchipRepetido(res);
    return serverError(res, "createPet", error);
  }
}

// PUT /api/pets/:id
async function updatePet(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "El identificador de la mascota no es valido." });
    if (!(await findOwnActivePet(id, req.user.id))) {
      return res.status(404).json({ message: "La mascota no existe." });
    }
    const { errors, value } = validatePet(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
    }
    const pet = await prisma.pet.update({ where: { id }, data: { ...value, birthDate: value.birthDate! } });
    return res.status(200).json({ message: "Datos de la mascota actualizados.", pet: toPublicPet(pet) });
  } catch (error) {
    if (esErrorPrisma(error) && error.code === "P2002") return microchipRepetido(res);
    return serverError(res, "updatePet", error);
  }
}

// DELETE /api/pets/:id  (desactiva)
async function deactivatePet(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "El identificador de la mascota no es valido." });
    if (!(await findOwnActivePet(id, req.user.id))) {
      return res.status(404).json({ message: "La mascota no existe." });
    }
    await prisma.pet.update({ where: { id }, data: { status: "INACTIVE" } });
    return res.status(200).json({ message: "La mascota se quitó de tu lista. Sus citas anteriores se conservan." });
  } catch (error) {
    return serverError(res, "deactivatePet", error);
  }
}

export { listReminders, listMyPets, createPet, updatePet, deactivatePet, findOwnActivePet, toPublicPet };
