import { esErrorPrisma } from "../../utils/errores";
import type { Request, Response } from "express";
// Historias clinicas (epica AN-3).
//
// AN-18 el veterinario crea una entrada en la historia de una mascota
// AN-19 el veterinario elimina (anula) una entrada suya, con motivo
// AN-20 el veterinario modifica una entrada suya
// AN-21 el dueño consulta la historia de su mascota
//
// Reglas de acceso:
// - El dueño ve las entradas vigentes de sus propias mascotas.
// - Un veterinario ve y crea entradas solo de mascotas que tienen (o tuvieron)
//   una cita con el, no cancelada. Ve la historia completa, incluidas las
//   entradas de otros veterinarios, para dar continuidad a la atencion.
// - Solo el veterinario que escribio una entrada puede modificarla o anularla.
import prisma from "../../prisma";
import * as notificationService from "../notifications/notification.service";
import { buildHistoryPdf, buildPrescriptionPdf } from "./historyPdf.service";
import { auditar, ACCIONES, ETIQUETAS_ACCION } from "../audit/audit.service";
import { toPublicPet } from "../pets/pet.controller";
import { parseId } from "../../utils/params";
import { parseDate, toDateString, describeDateTime, startOfDay } from "../../utils/schedule";
import * as uploads from "../../utils/uploads";

const MAX_REASON = 200;
const MAX_TEXT = 2000;
const MAX_ANNUL_REASON = 200;

// Adjuntos: examenes, radiografias, informes.
const ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_RECORD = 10;

function serverError(res: Response, where: any, error: unknown) {
  console.error(`Error en ${where}:`, error);
  return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
}

function badRequest(res: Response, errors: string[]) {
  return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
}

const RECORD_INCLUDE = {
  vetProfile: { include: { user: { select: { name: true } } } },
  attachments: { orderBy: { createdAt: "asc" as const } },
  vaccinations: { orderBy: { id: "asc" as const } },
  prescriptions: { orderBy: { id: "asc" as const } },
};

function toPublicRecord(record: any, { paraVeterinario, vetProfileId }: { paraVeterinario: boolean; vetProfileId?: number }) {
  const publico: Record<string, unknown> = {
    id: record.id,
    visitDate: toDateString(record.visitDate),
    reason: record.reason,
    diagnosis: record.diagnosis,
    treatment: record.treatment,
    weight: record.weight === null ? null : Number(record.weight),
    temperature: record.temperature === null ? null : Number(record.temperature),
    vaccines: record.vaccines,
    observations: record.observations,
    appointmentId: record.appointmentId,
    // Proximo control sugerido, vacunas aplicadas (con proxima dosis) y medicamentos recetados.
    followUpDate: record.followUpDate ? toDateString(record.followUpDate) : null,
    vaccinations: (record.vaccinations || []).map((v: any) => ({
      id: v.id,
      name: v.name,
      appliedAt: toDateString(v.appliedAt),
      nextDueAt: v.nextDueAt ? toDateString(v.nextDueAt) : null,
      lot: v.lot,
    })),
    prescriptions: (record.prescriptions || []).map((r: any) => ({
      id: r.id,
      medication: r.medication,
      dose: r.dose,
      frequency: r.frequency,
      duration: r.duration,
      instructions: r.instructions,
    })),
    // Sin la ruta en disco: el archivo se pide por la API con su id.
    attachments: (record.attachments || []).map((a: any) => ({
      id: a.id,
      name: a.fileName,
      type: a.mimeType,
      size: a.sizeBytes,
    })),
    vet: { id: record.vetProfileId, name: record.vetProfile.user.name, specialty: record.vetProfile.specialty },
    createdAt: record.createdAt,
    // Se marca como editada si se cambio despues de crearla (mas de un minuto).
    edited: record.updatedAt.getTime() - record.createdAt.getTime() > 60 * 1000,
  };
  if (paraVeterinario) {
    publico.status = record.status;
    publico.annulReason = record.annulReason;
    publico.annulledAt = record.annulledAt;
    publico.canEdit = record.vetProfileId === vetProfileId && record.status === "ACTIVE";
  }
  return publico;
}

function toPetSummary(pet: any) {
  return { ...toPublicPet(pet), owner: pet.user ? { name: pet.user.name } : undefined };
}

// ¿El veterinario atiende (o atendio) a esta mascota?
// Por una cita no cancelada o por una urgencia que acepto (en curso o atendida).
async function vetTieneRelacion(vetProfileId: number, petId: number) {
  const cita = await prisma.appointment.findFirst({
    where: { vetProfileId, petId, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (cita) return true;

  const urgencia = await prisma.emergencyRequest.findFirst({
    where: { vetProfileId, petId, status: { in: ["ACCEPTED", "COMPLETED"] } },
    select: { id: true },
  });
  return Boolean(urgencia);
}

// Carga la mascota si quien pide tiene acceso a su historia. Si no, responde
// 404 (no se revela que la mascota existe) y devuelve null.
async function cargarMascotaConAcceso(req: Request, res: Response, petId: number) {
  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    include: { user: { select: { id: true, name: true } } },
  });
  let permitido = false;
  if (pet && req.user.role === "CLIENT") {
    permitido = pet.userId === req.user.id;
  } else if (pet && req.user.role === "VETERINARIAN" && req.user.vetProfile) {
    permitido = await vetTieneRelacion(req.user.vetProfile!.id, pet.id);
  }
  if (!permitido) {
    res.status(404).json({ message: "La mascota no existe o no tienes acceso a su historia clínica." });
    return null;
  }
  return pet;
}

function textoOpcional(valor: unknown) {
  const texto = valor === undefined || valor === null ? "" : String(valor).trim();
  return texto === "" ? null : texto;
}

// Valida los campos clinicos. Devuelve { errors, value }.
const MAX_VACUNAS = 10;
const MAX_RECETAS = 15;

interface VacunaEntrada {
  name: string;
  nextDueAt: Date | null;
  lot: string | null;
}

interface RecetaEntrada {
  medication: string;
  dose: string;
  frequency: string;
  duration: string | null;
  instructions: string | null;
}

// undefined = no vino en la peticion (al modificar, se deja como estaba); [] = quitar todas.
function validarVacunas(lista: unknown, errors: string[]): VacunaEntrada[] | undefined {
  if (lista === undefined) return undefined;
  if (!Array.isArray(lista)) {
    errors.push("Las vacunas deben enviarse como una lista.");
    return undefined;
  }
  if (lista.length > MAX_VACUNAS) {
    errors.push(`No puedes registrar más de ${MAX_VACUNAS} vacunas por consulta.`);
    return undefined;
  }
  const hoy = startOfDay();
  const salida: VacunaEntrada[] = [];
  lista.forEach((v: any, i: number) => {
    const pos = i + 1;
    const nombre = String(v?.name ?? "").trim();
    if (nombre === "") return void errors.push(`El nombre de la vacuna ${pos} es obligatorio.`);
    if (nombre.length > 80) return void errors.push(`El nombre de la vacuna ${pos} no puede superar los 80 caracteres.`);
    let proxima: Date | null = null;
    if (v?.nextDueAt !== undefined && v?.nextDueAt !== null && String(v.nextDueAt).trim() !== "") {
      proxima = parseDate(v.nextDueAt);
      if (!proxima) return void errors.push(`La fecha de la próxima dosis de la vacuna ${pos} no es válida (AAAA-MM-DD).`);
      if (proxima.getTime() < hoy.getTime()) return void errors.push(`La próxima dosis de la vacuna ${pos} no puede ser una fecha pasada.`);
    }
    const lote = textoOpcional(v?.lot);
    if (lote && lote.length > 40) return void errors.push(`El lote de la vacuna ${pos} no puede superar los 40 caracteres.`);
    salida.push({ name: nombre, nextDueAt: proxima, lot: lote });
  });
  return salida;
}

function validarRecetas(lista: unknown, errors: string[]): RecetaEntrada[] | undefined {
  if (lista === undefined) return undefined;
  if (!Array.isArray(lista)) {
    errors.push("Los medicamentos deben enviarse como una lista.");
    return undefined;
  }
  if (lista.length > MAX_RECETAS) {
    errors.push(`No puedes recetar más de ${MAX_RECETAS} medicamentos por consulta.`);
    return undefined;
  }
  const salida: RecetaEntrada[] = [];
  lista.forEach((r: any, i: number) => {
    const pos = i + 1;
    const medicamento = String(r?.medication ?? "").trim();
    const dosis = String(r?.dose ?? "").trim();
    const frecuencia = String(r?.frequency ?? "").trim();
    if (medicamento === "") return void errors.push(`El nombre del medicamento ${pos} es obligatorio.`);
    if (dosis === "") return void errors.push(`La dosis del medicamento ${pos} es obligatoria.`);
    if (frecuencia === "") return void errors.push(`La frecuencia del medicamento ${pos} es obligatoria.`);
    const duracion = textoOpcional(r?.duration);
    const indicaciones = textoOpcional(r?.instructions);
    if (medicamento.length > 100 || dosis.length > 60 || frecuencia.length > 60 || (duracion && duracion.length > 60)) {
      return void errors.push(`Algún dato del medicamento ${pos} es demasiado largo.`);
    }
    if (indicaciones && indicaciones.length > 300) return void errors.push(`Las indicaciones del medicamento ${pos} no pueden superar los 300 caracteres.`);
    salida.push({ medication: medicamento, dose: dosis, frequency: frecuencia, duration: duracion, instructions: indicaciones });
  });
  return salida;
}

function validateRecord(body: Record<string, any> = {}) {
  const errors: string[] = [];
  const reason = String(body.reason ?? "").trim();
  const diagnosis = String(body.diagnosis ?? "").trim();
  const treatment = textoOpcional(body.treatment);
  const vaccines = textoOpcional(body.vaccines);
  const observations = textoOpcional(body.observations);

  if (reason === "") errors.push("El motivo de consulta es obligatorio.");
  else if (reason.length > MAX_REASON) errors.push(`El motivo no puede superar los ${MAX_REASON} caracteres.`);
  if (diagnosis === "") errors.push("El diagnóstico es obligatorio.");
  else if (diagnosis.length > MAX_TEXT) errors.push(`El diagnóstico no puede superar los ${MAX_TEXT} caracteres.`);
  for (const [valor, nombre] of [
    [treatment, "El tratamiento"],
    [vaccines, "El campo de vacunas"],
    [observations, "El campo de observaciones"],
  ]) {
    if (valor && valor.length > MAX_TEXT) errors.push(`${nombre} no puede superar los ${MAX_TEXT} caracteres.`);
  }

  let weight = null;
  const pesoTexto = textoOpcional(body.weight);
  if (pesoTexto !== null) {
    if (!/^\d+(\.\d{1,2})?$/.test(pesoTexto) || Number(pesoTexto) <= 0 || Number(pesoTexto) > 200) {
      errors.push("El peso debe ser un número mayor a 0 y hasta 200 kg.");
    } else {
      weight = Number(pesoTexto);
    }
  }

  let temperature = null;
  const tempTexto = textoOpcional(body.temperature);
  if (tempTexto !== null) {
    if (!/^\d+(\.\d)?$/.test(tempTexto) || Number(tempTexto) < 30 || Number(tempTexto) > 45) {
      errors.push("La temperatura debe estar entre 30 y 45 °C.");
    } else {
      temperature = Number(tempTexto);
    }
  }

  let visitDate = null;
  if (body.visitDate !== undefined && body.visitDate !== null && String(body.visitDate).trim() !== "") {
    visitDate = parseDate(body.visitDate);
    if (!visitDate) errors.push("La fecha de la consulta no es válida (formato AAAA-MM-DD).");
    else if (visitDate.getTime() > Date.now()) errors.push("La fecha de la consulta no puede estar en el futuro.");
  }

  // Proximo control (opcional): ni pasado ni a mas de 2 años.
  let followUpDate: Date | null | undefined;
  if ("followUpDate" in body) {
    const texto = textoOpcional(body.followUpDate);
    if (texto === null) followUpDate = null;
    else {
      const fecha = parseDate(texto);
      const hoy = startOfDay().getTime();
      if (!fecha) errors.push("La fecha del próximo control no es válida (formato AAAA-MM-DD).");
      else if (fecha.getTime() < hoy) errors.push("La fecha del próximo control no puede ser pasada.");
      else if (fecha.getTime() > hoy + 2 * 366 * 24 * 60 * 60 * 1000) errors.push("La fecha del próximo control no puede ser a más de 2 años.");
      else followUpDate = fecha;
    }
  }
  const vaccinations = validarVacunas(body.vaccinations, errors);
  const prescriptions = validarRecetas(body.prescriptions, errors);

  return {
    errors,
    value: { reason, diagnosis, treatment, vaccines, observations, weight, temperature, visitDate, followUpDate, vaccinations, prescriptions },
  };
}

// GET /api/medical-records/pets/:petId
// AN-21 (dueño) y consulta del veterinario. El dueño solo ve entradas vigentes.
async function getPetHistory(req: Request, res: Response) {
  try {
    const petId = parseId(req.params.petId);
    if (!petId) return res.status(400).json({ message: "El identificador de la mascota no es valido." });

    const pet = await cargarMascotaConAcceso(req, res, petId);
    if (!pet) return undefined;

    await auditar(req, ACCIONES.VER_HISTORIA, { entityType: "Pet", entityId: petId, petId, ownerId: pet.userId });

    const paraVeterinario = req.user.role === "VETERINARIAN";
    const records = await prisma.medicalRecord.findMany({
      where: { petId, ...(paraVeterinario ? {} : { status: "ACTIVE" }) },
      include: RECORD_INCLUDE,
      orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
    });

    // Para el veterinario: citas suyas con esta mascota que ya empezaron (o pasaron)
    // y aun no tienen entrada. Es de donde sale cada entrada nueva.
    let pendingAppointments;
    let inProgressAppointments;
    if (paraVeterinario) {
      const citas = await prisma.appointment.findMany({
        where: {
          vetProfileId: req.user.vetProfile!.id,
          petId,
          status: { in: ["IN_PROGRESS", "COMPLETED"] },
          scheduledAt: { lte: new Date() },
        },
        include: {
          service: { select: { name: true } },
          medicalRecord: { select: { id: true } },
          emergency: { select: { id: true } },
        },
        orderBy: { scheduledAt: "desc" },
      });
      const resumen = (c: any) => ({
        id: c.id,
        status: c.status,
        date: toDateString(c.scheduledAt),
        when: describeDateTime(c.scheduledAt),
        service: c.service ? c.service.name : "Consulta general",
        notes: c.notes,
        recordId: c.medicalRecord ? c.medicalRecord.id : null,
        // Nacio de una urgencia: terminar sin registrar la devuelve a las urgencias abiertas.
        emergency: Boolean(c.emergency),
      });
      // Atenciones en curso (con o sin avance guardado) y consultas ya atendidas sin registrar.
      inProgressAppointments = citas.filter((c) => c.status === "IN_PROGRESS").map(resumen);
      pendingAppointments = citas.filter((c) => !c.medicalRecord).map(resumen);
    }

    const opciones = { paraVeterinario, vetProfileId: req.user.vetProfile?.id };
    return res.status(200).json({
      pet: toPetSummary(paraVeterinario ? pet : { ...pet, user: undefined }),
      records: records.map((r) => toPublicRecord(r, opciones)),
      ...(paraVeterinario ? { pendingAppointments, inProgressAppointments } : {}),
    });
  } catch (error) {
    return serverError(res, "getPetHistory", error);
  }
}

// GET /api/medical-records/pets/:petId/pdf
// Descarga la historia clinica (entradas vigentes) y el carnet de vacunas en PDF.
// Mismo acceso que la historia en pantalla: el dueño y los veterinarios con relacion con la mascota.
async function downloadHistoryPdf(req: Request, res: Response) {
  try {
    const petId = parseId(req.params.petId);
    if (!petId) return res.status(400).json({ message: "El identificador de la mascota no es valido." });
    const pet = await cargarMascotaConAcceso(req, res, petId);
    if (!pet) return undefined;

    const entradas = await prisma.medicalRecord.findMany({
      where: { petId, status: "ACTIVE" },
      include: RECORD_INCLUDE,
      orderBy: [{ visitDate: "asc" }, { createdAt: "asc" }],
    });
    await auditar(req, ACCIONES.DESCARGAR_PDF, { entityType: "Pet", entityId: petId, petId, ownerId: pet.userId });
    const pdf = await buildHistoryPdf({
      pet: toPublicPet(pet),
      owner: req.user.role === "VETERINARIAN" ? pet.user.name : null,
      records: entradas.map((r) => ({
        visitDate: toDateString(r.visitDate),
        reason: r.reason,
        diagnosis: r.diagnosis,
        treatment: r.treatment,
        weight: r.weight === null ? null : Number(r.weight),
        temperature: r.temperature === null ? null : Number(r.temperature),
        vaccines: r.vaccines,
        observations: r.observations,
        followUpDate: r.followUpDate ? toDateString(r.followUpDate) : null,
        vetName: r.vetProfile.user.name,
        vaccinations: r.vaccinations.map((v) => ({
          name: v.name,
          appliedAt: toDateString(v.appliedAt),
          nextDueAt: v.nextDueAt ? toDateString(v.nextDueAt) : null,
          lot: v.lot,
        })),
        prescriptions: r.prescriptions.map((p) => ({
          medication: p.medication,
          dose: p.dose,
          frequency: p.frequency,
          duration: p.duration,
          instructions: p.instructions,
        })),
      })),
    });

    const archivo = `historia-${pet.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${archivo}.pdf"`);
    return res.status(200).send(pdf);
  } catch (error) {
    return serverError(res, "downloadHistoryPdf", error);
  }
}

// POST /api/medical-records   (AN-18)
// body: { petId, appointmentId?, visitDate?, reason, diagnosis, treatment?, weight?, temperature?, vaccines?, observations? }
async function createRecord(req: Request, res: Response) {
  try {
    const body = req.body || {};
    const petId = parseId(body.petId);
    if (!petId) return badRequest(res, ["Debes indicar la mascota."]);

    const { errors, value } = validateRecord(body);

    // Cada entrada nace de una cita: se registra durante la consulta o despues.
    let appointment = null;
    if (body.appointmentId === undefined || body.appointmentId === null || String(body.appointmentId) === "") {
      errors.push("La entrada debe pertenecer a una cita: registra la consulta desde la cita de tu agenda.");
    } else {
      const appointmentId = parseId(body.appointmentId);
      if (!appointmentId) errors.push("El identificador de la cita no es valido.");
      else {
        appointment = await prisma.appointment.findUnique({
          where: { id: appointmentId },
          include: { medicalRecord: { select: { id: true } } },
        });
      }
    }
    if (errors.length > 0) return badRequest(res, errors);

    const vetProfileId = req.user.vetProfile!.id;
    const pet = await cargarMascotaConAcceso(req, res, petId);
    if (!pet) return undefined;
    if (pet.status !== "ACTIVE") {
      return res.status(409).json({ message: "La mascota fue retirada por su dueño; no se pueden agregar entradas." });
    }

    if (!appointment || appointment.vetProfileId !== vetProfileId || appointment.petId !== petId) {
      return res.status(404).json({ message: "La cita no existe o no corresponde a esta mascota." });
    }
    if (appointment.status === "CANCELLED") {
      return res.status(409).json({ message: "No se puede registrar una cita cancelada." });
    }
    if (appointment.status !== "IN_PROGRESS" && appointment.status !== "COMPLETED") {
      return res.status(409).json({ message: "Inicia la atención de la cita para registrar la consulta." });
    }
    if (appointment.medicalRecord) {
      return res.status(409).json({ message: "Esta cita ya tiene una entrada en la historia clínica." });
    }

    // Fecha: la indicada, la de la cita o hoy.
    const visitDate =
      value.visitDate || startOfDay(appointment.scheduledAt);

    const { visitDate: _fechaIndicada, vaccinations, prescriptions, followUpDate, ...campos } = value;
    let record;
    try {
      record = await prisma.$transaction(async (tx) => {
        const creado = await tx.medicalRecord.create({
          data: {
            ...campos,
            visitDate,
            petId,
            vetProfileId,
            appointmentId: appointment.id,
            ...(followUpDate ? { followUpDate } : {}),
            ...(vaccinations && vaccinations.length > 0
              ? { vaccinations: { create: vaccinations.map((v) => ({ name: v.name, appliedAt: visitDate, nextDueAt: v.nextDueAt, lot: v.lot, petId, vetProfileId })) } }
              : {}),
            ...(prescriptions && prescriptions.length > 0 ? { prescriptions: { create: prescriptions } } : {}),
          },
          include: RECORD_INCLUDE,
        });
        // El peso medido en consulta pasa a ser el peso actual de la mascota.
        if (campos.weight !== null) {
          await tx.pet.update({ where: { id: petId }, data: { weight: campos.weight } });
        }
        return creado;
      });
    } catch (error) {
      if (esErrorPrisma(error) && error.code === "P2002") {
        return res.status(409).json({ message: "Esta cita ya tiene una entrada en la historia clínica." });
      }
      throw error;
    }

    try {
      await notificationService.notify(
        pet.userId,
        `${req.user.name} agregó una entrada a la historia clínica de ${pet.name}: ${campos.reason}.`
      );
    } catch (error) {
      console.error("No se pudo notificar la nueva entrada:", error);
    }

    await auditar(req, ACCIONES.CREAR_ENTRADA, { entityType: "MedicalRecord", entityId: record.id, petId, ownerId: pet.userId });
    return res.status(201).json({
      message: "Entrada agregada a la historia clínica.",
      record: toPublicRecord(record, { paraVeterinario: true, vetProfileId }),
    });
  } catch (error) {
    return serverError(res, "createRecord", error);
  }
}

// Carga una entrada que el veterinario puede cambiar (suya y vigente).
async function cargarEntradaPropia(req: Request, res: Response) {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ message: "El identificador de la entrada no es valido." });
    return null;
  }
  const record = await prisma.medicalRecord.findUnique({ where: { id } });
  if (!record || !(await vetTieneRelacion(req.user.vetProfile!.id, record.petId))) {
    res.status(404).json({ message: "La entrada no existe." });
    return null;
  }
  if (record.vetProfileId !== req.user.vetProfile!.id) {
    res.status(403).json({ message: "Solo el veterinario que escribió la entrada puede cambiarla." });
    return null;
  }
  if (record.status !== "ACTIVE") {
    res.status(409).json({ message: "La entrada está anulada y no se puede cambiar." });
    return null;
  }
  return record;
}

// PUT /api/medical-records/:id   (AN-20)
async function updateRecord(req: Request, res: Response) {
  try {
    const actual = await cargarEntradaPropia(req, res);
    if (!actual) return undefined;

    const { errors, value } = validateRecord(req.body);
    if (errors.length > 0) return badRequest(res, errors);

    const { visitDate, vaccinations, prescriptions, followUpDate, ...campos } = value;
    const fechaConsulta = visitDate ?? actual.visitDate;
    const record = await prisma.$transaction(async (tx) => {
      // Si la peticion trae las listas, reemplazan a las anteriores; si no, se dejan como estaban.
      if (vaccinations !== undefined) {
        await tx.vaccination.deleteMany({ where: { recordId: actual.id } });
        if (vaccinations.length > 0) {
          await tx.vaccination.createMany({
            data: vaccinations.map((v) => ({ name: v.name, appliedAt: fechaConsulta, nextDueAt: v.nextDueAt, lot: v.lot, petId: actual.petId, vetProfileId: actual.vetProfileId, recordId: actual.id })),
          });
        }
      }
      if (prescriptions !== undefined) {
        await tx.prescription.deleteMany({ where: { recordId: actual.id } });
        if (prescriptions.length > 0) {
          await tx.prescription.createMany({ data: prescriptions.map((r) => ({ ...r, recordId: actual.id })) });
        }
      }
      return tx.medicalRecord.update({
        where: { id: actual.id },
        data: {
          ...campos,
          ...(visitDate ? { visitDate } : {}),
          ...(followUpDate !== undefined ? { followUpDate, followUpReminderSentAt: null } : {}),
        },
        include: RECORD_INCLUDE,
      });
    });
    if (campos.weight !== null) {
      await prisma.pet.update({ where: { id: actual.petId }, data: { weight: campos.weight } });
    }
    await auditar(req, ACCIONES.EDITAR_ENTRADA, { entityType: "MedicalRecord", entityId: record.id, petId: actual.petId });

    return res.status(200).json({
      message: "Entrada actualizada.",
      record: toPublicRecord(record, { paraVeterinario: true, vetProfileId: req.user.vetProfile!.id }),
    });
  } catch (error) {
    return serverError(res, "updateRecord", error);
  }
}

// PATCH /api/medical-records/:id/annul   body: { reason }   (AN-19)
// "Eliminar" anula la entrada: el dueño deja de verla y se conserva para auditoria.
async function annulRecord(req: Request, res: Response) {
  try {
    const actual = await cargarEntradaPropia(req, res);
    if (!actual) return undefined;

    const motivo = String(req.body?.reason ?? "").trim();
    if (motivo === "") return badRequest(res, ["Indica el motivo para eliminar la entrada."]);
    if (motivo.length > MAX_ANNUL_REASON) {
      return badRequest(res, [`El motivo no puede superar los ${MAX_ANNUL_REASON} caracteres.`]);
    }

    const record = await prisma.medicalRecord.update({
      where: { id: actual.id },
      data: { status: "ANNULLED", annulReason: motivo, annulledAt: new Date() },
      include: RECORD_INCLUDE,
    });
    await auditar(req, ACCIONES.ANULAR_ENTRADA, { entityType: "MedicalRecord", entityId: record.id, petId: actual.petId });
    return res.status(200).json({
      message: "Entrada eliminada de la historia clínica.",
      record: toPublicRecord(record, { paraVeterinario: true, vetProfileId: req.user.vetProfile!.id }),
    });
  } catch (error) {
    return serverError(res, "annulRecord", error);
  }
}

// POST /api/medical-records/:id/attachments   body: { file: dataURL, name? }
// El veterinario que escribio una entrada vigente le adjunta un PDF, JPG o PNG.
async function addAttachment(req: Request, res: Response) {
  try {
    const actual = await cargarEntradaPropia(req, res);
    if (!actual) return undefined;

    const archivo = uploads.parseDataUrl(req.body?.file, { tipos: ATTACHMENT_TYPES, maxBytes: MAX_ATTACHMENT_BYTES });
    if (archivo.error !== undefined) return badRequest(res, [archivo.error]);

    const total = await prisma.medicalAttachment.count({ where: { recordId: actual.id } });
    if (total >= MAX_ATTACHMENTS_PER_RECORD) {
      return res.status(409).json({
        message: `Una entrada admite hasta ${MAX_ATTACHMENTS_PER_RECORD} archivos. Elimina alguno para agregar otro.`,
      });
    }

    const storedName = await uploads.saveRecordFile(archivo);
    let adjunto;
    try {
      adjunto = await prisma.medicalAttachment.create({
        data: {
          recordId: actual.id,
          storedName,
          fileName: uploads.cleanFileName(req.body?.name, archivo.extension),
          mimeType: archivo.mime,
          sizeBytes: archivo.buffer.length,
        },
      });
    } catch (error) {
      // Si no se pudo registrar, no se deja un archivo huerfano en disco.
      await uploads.deleteRecordFile(storedName);
      throw error;
    }

    return res.status(201).json({
      message: "Archivo adjuntado a la entrada.",
      attachment: { id: adjunto.id, name: adjunto.fileName, type: adjunto.mimeType, size: adjunto.sizeBytes },
    });
  } catch (error) {
    return serverError(res, "addAttachment", error);
  }
}

// Carga un adjunto y comprueba que quien pide pueda verlo. Responde 404 si no.
//  - Dueño: solo de sus mascotas y de entradas vigentes.
//  - Veterinario: de mascotas con las que tiene (o tuvo) relacion.
async function cargarAdjuntoConAcceso(req: Request, res: Response) {
  const id = parseId(req.params.attachmentId);
  if (!id) {
    res.status(400).json({ message: "El identificador del archivo no es valido." });
    return null;
  }
  const adjunto = await prisma.medicalAttachment.findUnique({
    where: { id },
    include: { record: { include: { pet: { select: { userId: true } } } } },
  });

  let permitido = false;
  if (adjunto && req.user.role === "CLIENT") {
    permitido = adjunto.record.pet.userId === req.user.id && adjunto.record.status === "ACTIVE";
  } else if (adjunto && req.user.role === "VETERINARIAN" && req.user.vetProfile) {
    permitido = await vetTieneRelacion(req.user.vetProfile!.id, adjunto.record.petId);
  }
  if (!permitido) {
    res.status(404).json({ message: "El archivo no existe o no tienes acceso." });
    return null;
  }
  return adjunto;
}

// GET /api/medical-records/attachments/:attachmentId
async function downloadAttachment(req: Request, res: Response) {
  try {
    const adjunto = await cargarAdjuntoConAcceso(req, res);
    if (!adjunto) return undefined;

    await auditar(req, ACCIONES.DESCARGAR_ADJUNTO, {
      entityType: "MedicalAttachment",
      entityId: adjunto.id,
      petId: adjunto.record.petId,
      ownerId: adjunto.record.pet.userId,
    });
    res.setHeader("Content-Type", adjunto.mimeType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Informacion medica: que ningun intermediario la guarde en cache.
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="adjunto"; filename*=UTF-8''${encodeURIComponent(adjunto.fileName)}`
    );
    return res.sendFile(uploads.recordFileAbsolutePath(adjunto.storedName), (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ message: "El archivo ya no está disponible." });
      }
    });
  } catch (error) {
    return serverError(res, "downloadAttachment", error);
  }
}

// DELETE /api/medical-records/attachments/:attachmentId
// Solo el veterinario que escribio la entrada, mientras esta vigente.
async function removeAttachment(req: Request, res: Response) {
  try {
    const adjunto = await cargarAdjuntoConAcceso(req, res);
    if (!adjunto) return undefined;

    if (adjunto.record.vetProfileId !== req.user.vetProfile!.id) {
      return res.status(403).json({ message: "Solo el veterinario que escribió la entrada puede quitar sus archivos." });
    }
    if (adjunto.record.status !== "ACTIVE") {
      return res.status(409).json({ message: "La entrada está anulada y no se puede cambiar." });
    }

    await prisma.medicalAttachment.delete({ where: { id: adjunto.id } });
    await uploads.deleteRecordFile(adjunto.storedName);
    return res.status(200).json({ message: "Archivo eliminado." });
  } catch (error) {
    return serverError(res, "removeAttachment", error);
  }
}

// GET /api/medical-records/:id/prescription.pdf
// Receta de una consulta (medicamentos, dosis, indicaciones) con los datos del profesional.
async function downloadPrescriptionPdf(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "El identificador de la entrada no es valido." });
    const entrada = await prisma.medicalRecord.findUnique({
      where: { id },
      include: { ...RECORD_INCLUDE, vetProfile: { include: { user: { select: { name: true } } } } },
    });
    if (!entrada) return res.status(404).json({ message: "La entrada no existe." });
    const pet = await cargarMascotaConAcceso(req, res, entrada.petId);
    if (!pet) return undefined;
    if (req.user.role === "CLIENT" && entrada.status !== "ACTIVE") {
      return res.status(404).json({ message: "La entrada no existe." });
    }
    if (entrada.prescriptions.length === 0) {
      return res.status(404).json({ message: "Esta consulta no tiene receta." });
    }

    await auditar(req, ACCIONES.DESCARGAR_RECETA, { entityType: "MedicalRecord", entityId: entrada.id, petId: pet.id, ownerId: pet.userId });
    const pdf = await buildPrescriptionPdf({
      pet: toPublicPet(pet),
      owner: pet.user.name,
      vet: { name: entrada.vetProfile.user.name, specialty: entrada.vetProfile.specialty, license: entrada.vetProfile.license },
      visitDate: toDateString(entrada.visitDate),
      prescriptions: entrada.prescriptions,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receta-${entrada.id}.pdf"`);
    return res.status(200).send(pdf);
  } catch (error) {
    return serverError(res, "downloadPrescriptionPdf", error);
  }
}

// GET /api/medical-records/pets/:petId/accesses   (solo el dueño)
// Transparencia (Ley 1581): quien consulto, descargo o cambio la historia de su mascota.
// Se omiten las acciones del propio dueño.
async function listAccesses(req: Request, res: Response) {
  try {
    const petId = parseId(req.params.petId);
    if (!petId) return res.status(400).json({ message: "El identificador de la mascota no es valido." });
    const pet = await prisma.pet.findFirst({ where: { id: petId, userId: req.user.id } });
    if (!pet) return res.status(404).json({ message: "La mascota no existe." });

    const registros = await prisma.auditLog.findMany({
      where: { petId, ownerId: req.user.id, NOT: { actorId: req.user.id } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.status(200).json({
      accesses: registros.map((r) => ({
        id: r.id,
        action: r.action,
        label: ETIQUETAS_ACCION[r.action] ?? r.action,
        actor: r.actorName,
        role: r.actorRole,
        at: r.createdAt,
      })),
    });
  } catch (error) {
    return serverError(res, "listAccesses", error);
  }
}

export { downloadPrescriptionPdf, listAccesses, downloadHistoryPdf, getPetHistory, createRecord, updateRecord, annulRecord, addAttachment, downloadAttachment, removeAttachment };
