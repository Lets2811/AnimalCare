// Recordatorios automaticos de citas.
//
// Cada cierto tiempo se buscan las citas activas que empiezan en las
// proximas 24 horas y que aun no tienen recordatorio, y se avisa al cliente
// y al veterinario. reminderSentAt evita avisar dos veces.
//
// Los avisos son dentro de la plataforma. Para enviarlos tambien por correo o
// WhatsApp habria que conectar un proveedor (SMTP, Twilio...) en este punto.
import prisma from "../../prisma";
import { describeDateTime } from "../../utils/schedule";

const VENTANA_MS = 24 * 60 * 60 * 1000;

// Devuelve cuantas citas recibieron recordatorio en esta pasada.
// soloDonde permite acotar la pasada (las pruebas la limitan a sus datos).
async function runReminders(now = new Date(), soloDonde = {}) {
  const citas = await prisma.appointment.findMany({
    where: {
      ...soloDonde,
      status: { in: ["PENDING", "CONFIRMED"] },
      reminderSentAt: null,
      scheduledAt: { gt: now, lte: new Date(now.getTime() + VENTANA_MS) },
    },
    include: {
      client: { select: { id: true, name: true } },
      pet: { select: { name: true } },
      vetProfile: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  let enviados = 0;
  for (const cita of citas) {
    // Se marca primero y solo si sigue sin marcar: si dos procesos corren a
    // la vez, solo uno envia el aviso.
    const marcada = await prisma.appointment.updateMany({
      where: { id: cita.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (marcada.count === 0) continue;

    const cuando = describeDateTime(cita.scheduledAt);
    const mascota = cita.pet ? ` con ${cita.pet.name}` : "";
    const lugar = cita.mode === "HOME" ? `a domicilio (${cita.address})` : `en ${cita.vetProfile.address || "la veterinaria"}`;

    await prisma.notification.createMany({
      data: [
        {
          userId: cita.client.id,
          message: `Recordatorio: tienes cita${mascota} con ${cita.vetProfile.user.name} el ${cuando}, ${lugar}.`,
        },
        {
          userId: cita.vetProfile.user.id,
          message: `Recordatorio: cita con ${cita.client.name}${mascota} el ${cuando}.`,
        },
      ],
    });
    enviados += 1;
  }
  return enviados;
}

const VENTANA_VACUNA_MS = 7 * 24 * 60 * 60 * 1000;
const VENTANA_CONTROL_MS = 3 * 24 * 60 * 60 * 1000;

// Recordatorios clinicos para el dueño: vacunas con proxima dosis en los proximos 7 dias y controles
// de seguimiento en los proximos 3. Cada uno se avisa una sola vez (reminderSentAt / followUpReminderSentAt).
// soloPetIds permite acotar la pasada (las pruebas la limitan a sus datos).
async function runClinicalReminders(now = new Date(), soloPetIds?: number[]) {
  const filtroPet = soloPetIds ? { in: soloPetIds } : undefined;
  let enviados = 0;

  const vacunas = await prisma.vaccination.findMany({
    where: {
      reminderSentAt: null,
      nextDueAt: { gte: now, lte: new Date(now.getTime() + VENTANA_VACUNA_MS) },
      pet: { ...(filtroPet ? { id: filtroPet } : {}), status: "ACTIVE", user: { status: "ACTIVE" } },
    },
    include: { pet: { select: { name: true, userId: true } } },
  });
  for (const v of vacunas) {
    const marcada = await prisma.vaccination.updateMany({ where: { id: v.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (marcada.count === 0) continue;
    await prisma.notification.create({
      data: {
        userId: v.pet.userId,
        message: `Vacuna próxima: a ${v.pet.name} le toca "${v.name}" el ${describeDateTime(v.nextDueAt!)}. Agenda una cita para aplicarla.`,
      },
    });
    enviados += 1;
  }

  const controles = await prisma.medicalRecord.findMany({
    where: {
      status: "ACTIVE",
      followUpReminderSentAt: null,
      followUpDate: { gte: now, lte: new Date(now.getTime() + VENTANA_CONTROL_MS) },
      pet: { ...(filtroPet ? { id: filtroPet } : {}), status: "ACTIVE", user: { status: "ACTIVE" } },
    },
    include: { pet: { select: { name: true, userId: true } }, vetProfile: { include: { user: { select: { name: true } } } } },
  });
  for (const c of controles) {
    const marcada = await prisma.medicalRecord.updateMany({ where: { id: c.id, followUpReminderSentAt: null }, data: { followUpReminderSentAt: now } });
    if (marcada.count === 0) continue;
    await prisma.notification.create({
      data: {
        userId: c.pet.userId,
        message: `Control de seguimiento: ${c.vetProfile.user.name} sugirió revisar a ${c.pet.name} el ${describeDateTime(c.followUpDate!)}. Puedes agendar la cita.`,
      },
    });
    enviados += 1;
  }
  return enviados;
}

// Arranca la revision periodica. Devuelve el temporizador para poder detenerlo.
// Se desactiva con REMINDERS_ENABLED=false (por ejemplo, en un servidor de pruebas).
function startReminderJob(intervalMs = Number(process.env.REMINDER_INTERVAL_MS) || 10 * 60 * 1000) {
  if (process.env.REMINDERS_ENABLED === "false") {
    return null;
  }
  const tick = () =>
    Promise.all([runReminders(), runClinicalReminders()]).catch((error) => console.error("Error enviando recordatorios:", error));
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
}

export { runReminders, runClinicalReminders, startReminderJob };
